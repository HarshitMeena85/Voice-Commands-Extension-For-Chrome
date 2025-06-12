let recognition = null;
let isListening = false;
let shouldKeepListening = false;
let listeningIndicator = null;
let isGlobalMode = false;

// Improved speech recognition initialization with better error handling
function initializeSpeechRecognition() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    console.warn('Speech recognition not supported in this browser');
    return false;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  try {
    recognition = new SpeechRecognition();
    
    // Configure recognition settings
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('Voice recognition started');
      isListening = true;
      if (isGlobalMode) {
        showListeningIndicator();
      }
    };

    recognition.onresult = (event) => {
      const results = event.results;
      const lastResultIndex = results.length - 1;
      
      if (results[lastResultIndex].isFinal) {
        const transcript = results[lastResultIndex][0].transcript.trim();
        console.log('Voice command received:', transcript);
        
        if (transcript) {
          executeCommand(transcript);
        }
      }
    };

    recognition.onend = () => {
      console.log('Voice recognition ended');
      isListening = false;
      
      if (shouldKeepListening && (isGlobalMode || !document.hidden)) {
        let retryCount = 0;
        const maxRetries = 3;
        
        const tryRestart = () => {
          if (!shouldKeepListening) return;
          
          try {
            recognition.start();
            console.log('Recognition restarted successfully');
            isListening = true;
          } catch (error) {
            retryCount++;
            console.error(`Failed to restart recognition (attempt ${retryCount}):`, error);
            
            if (retryCount < maxRetries && shouldKeepListening) {
              console.log(`Retrying in 1 second... (attempt ${retryCount}/${maxRetries})`);
              setTimeout(tryRestart, 1000);
            } else {
              console.error('Max restart attempts reached');
              shouldKeepListening = false;
              hideListeningIndicator();
              if (isGlobalMode) {
                showError('Failed to restart speech recognition. Please try again.');
              }
            }
          }
        };
        
        setTimeout(tryRestart, 100);
      } else {
        hideListeningIndicator();
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      
      switch(event.error) {
        case 'not-allowed':
        case 'service-not-allowed':
          shouldKeepListening = false;
          isGlobalMode = false;
          hideListeningIndicator();
          showError('Microphone access denied. Please check permissions in browser settings.');
          break;
        case 'network':
          showError('Network error. Speech recognition requires internet connection.');
          break;
        case 'no-speech':
          console.log('No speech detected, continuing to listen...');
          return; // Don't show error, just continue
        case 'audio-capture':
          shouldKeepListening = false;
          isGlobalMode = false;
          hideListeningIndicator();
          showError('Audio capture failed. Please check your microphone.');
          break;
        case 'aborted':
          console.log('Speech recognition aborted');
          break;
        default:
          showError(`Speech recognition error: ${event.error}`);
      }
      
      isListening = false;
    };

    return true;
  } catch (error) {
    console.error('Failed to initialize speech recognition:', error);
    return false;
  }
}

// Execute voice command
async function executeCommand(command) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'executeCommand',
      command: command
    });
    
    if (response && response.success) {
      if (isGlobalMode) {
        showFeedback(`✓ ${command}`);
      }
    } else {
      if (isGlobalMode) {
        showError(`Failed: ${command}`);
      }
    }
  } catch (error) {
    console.error('Error executing command:', error);
    if (isGlobalMode) {
      showError(`Error: ${error.message}`);
    }
  }
}

// Show listening indicator
function showListeningIndicator() {
  if (listeningIndicator || !isGlobalMode) {
    return;
  }
  
  listeningIndicator = document.createElement('div');
  listeningIndicator.id = 'voice-tab-controller-indicator';
  listeningIndicator.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(45deg, #4CAF50, #45a049);
      color: white;
      padding: 10px 15px;
      border-radius: 25px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      display: flex;
      align-items: center;
      gap: 8px;
      animation: voiceControllerPulse 1.5s infinite;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.2);
    ">
      <div style="
        width: 8px;
        height: 8px;
        background: white;
        border-radius: 50%;
        animation: voiceControllerBlink 1s infinite;
      "></div>
      🎤 Global Voice Control Active
    </div>
    <style>
      @keyframes voiceControllerPulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.8; transform: scale(1.02); }
      }
      @keyframes voiceControllerBlink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }
    </style>
  `;
  
  document.body.appendChild(listeningIndicator);
}

// Hide listening indicator
function hideListeningIndicator() {
  if (listeningIndicator && listeningIndicator.parentNode) {
    listeningIndicator.parentNode.removeChild(listeningIndicator);
    listeningIndicator = null;
  }
}

// Show feedback message
function showFeedback(message) {
  const feedback = document.createElement('div');
  feedback.style.cssText = `
    position: fixed;
    top: 70px;
    right: 20px;
    background: linear-gradient(45deg, #2196F3, #1976D2);
    color: white;
    padding: 8px 12px;
    border-radius: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 3px 10px rgba(0,0,0,0.2);
    z-index: 10001;
    animation: slideInRight 0.3s ease-out;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.2);
  `;
  feedback.textContent = message;
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(feedback);
  
  setTimeout(() => {
    if (feedback.parentNode) {
      feedback.style.animation = 'slideInRight 0.3s ease-out reverse';
      setTimeout(() => {
        if (feedback.parentNode) {
          feedback.parentNode.removeChild(feedback);
        }
        if (style.parentNode) {
          style.parentNode.removeChild(style);
        }
      }, 300);
    }
  }, 2000);
}

// Show error message
function showError(message) {
  const error = document.createElement('div');
  error.style.cssText = `
    position: fixed;
    top: 70px;
    right: 20px;
    background: linear-gradient(45deg, #f44336, #d32f2f);
    color: white;
    padding: 8px 12px;
    border-radius: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 3px 10px rgba(0,0,0,0.2);
    z-index: 10001;
    animation: shake 0.5s ease-in-out;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.2);
  `;
  error.textContent = message;
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(error);
  
  setTimeout(() => {
    if (error.parentNode) {
      error.parentNode.removeChild(error);
    }
    if (style.parentNode) {
      style.parentNode.removeChild(style);
    }
  }, 4000);
}

// Handle messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);

  if (request.action === 'ping') {
    sendResponse({ 
      success: true, 
      speechSupported: recognition !== null,
      isListening: isListening
    });
    return;
  }

  if (request.action === 'startListening') {
    if (!recognition) {
      sendResponse({ success: false, error: 'Speech recognition not supported' });
      return;
    }

    if (isListening) {
      sendResponse({ success: true });
      return;
    }

    try {
      shouldKeepListening = true;
      isGlobalMode = true;
      recognition.start();
      sendResponse({ success: true });
    } catch (error) {
      console.error('Error starting recognition:', error);
      sendResponse({ success: false, error: error.message });
    }
    return;
  }

  if (request.action === 'stopListening') {
    shouldKeepListening = false;
    isGlobalMode = false;
    
    if (recognition && isListening) {
      try {
        recognition.stop();
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
    }
    
    hideListeningIndicator();
    sendResponse({ success: true });
    return;
  }

  sendResponse({ success: false, error: 'Unknown action' });
});

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initializeSpeechRecognition();
  });
} else {
  initializeSpeechRecognition();
}

// Handle page unload
window.addEventListener('beforeunload', () => {
  if (recognition && isListening) {
    try {
      recognition.stop();
    } catch (error) {
      console.error('Error stopping recognition on page unload:', error);
    }
  }
  hideListeningIndicator();
});
