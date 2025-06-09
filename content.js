let recognition = null;
let isListening = false;
let isInitialized = false;
let isProcessingCommand = false;
let shouldKeepListening = false;

const COMMAND_PATTERNS = [
  { pattern: /new tab/i, command: 'new tab' },
  { pattern: /close tab/i, command: 'close tab' },
  { pattern: /next tab/i, command: 'next tab' },
  { pattern: /(previous|prev) tab/i, command: 'previous tab' },
  { pattern: /new window/i, command: 'new window' },
  { pattern: /close window/i, command: 'close window' },
  { pattern: /(reload|refresh)/i, command: 'reload' },
  { pattern: /duplicate tab/i, command: 'duplicate tab' },
  { pattern: /pin tab/i, command: 'pin tab' },
  { pattern: /mute tab/i, command: 'mute tab' }
];

function initializeWhenReady() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSpeechRecognition);
  } else {
    initializeSpeechRecognition();
  }
}

function initializeSpeechRecognition() {
  console.log('Initializing speech recognition...');
  
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    console.log('Speech recognition not supported');
    isInitialized = false;
    return;
  }

  try {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;
    
    recognition.onstart = () => {
      console.log('Voice recognition started');
      isListening = true;
      showListeningIndicator();
    };

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.toLowerCase().trim();
        
        if (result.isFinal || result[0].confidence > 0.7) {
          console.log('Voice command (interim):', transcript, 'Final:', result.isFinal, 'Confidence:', result[0].confidence);
          
          const matchedCommand = findMatchingCommand(transcript);
          if (matchedCommand && !isProcessingCommand) {
            isProcessingCommand = true;
            
            chrome.runtime.sendMessage({
              action: 'executeCommand',
              command: matchedCommand
            });
            
            showCommandExecuted(matchedCommand);
            
            setTimeout(() => {
              isProcessingCommand = false;
            }, 500);
          }
        }
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        shouldKeepListening = false;
        showError('Microphone access denied. Please allow microphone permissions.');
        return;
      }
      
      if (event.error === 'network') {
        showError('Network error. Speech recognition requires internet connection.');
      }
      
      isListening = false;
      hideListeningIndicator();
    };

    recognition.onend = () => {
      console.log('Voice recognition ended');
      isListening = false;
      
      if (shouldKeepListening) {
        setTimeout(() => {
          if (shouldKeepListening && recognition) {
            try {
              recognition.start();
            } catch (error) {
              console.error('Failed to restart recognition:', error);
              shouldKeepListening = false;
              hideListeningIndicator();
            }
          }
        }, 100);
      } else {
        hideListeningIndicator();
      }
    };
    
    isInitialized = true;
    console.log('Speech recognition initialized successfully');
  } catch (error) {
    console.error('Failed to initialize speech recognition:', error);
    isInitialized = false;
  }
}

function findMatchingCommand(transcript) {
  for (const { pattern, command } of COMMAND_PATTERNS) {
    if (pattern.test(transcript)) {
      return command;
    }
  }
  return null;
}

function startListening() {
  console.log('Attempting to start listening...');
  
  if (!isInitialized) {
    console.error('Speech recognition not initialized');
    showError('Speech recognition not available on this page');
    return;
  }
  
  if (!recognition) {
    console.error('Speech recognition not available');
    showError('Speech recognition not available');
    return;
  }
  
  shouldKeepListening = true;
  
  if (isListening) {
    console.log('Already listening');
    return;
  }
  
  try {
    recognition.start();
  } catch (error) {
    console.error('Error starting recognition:', error);
    if (error.name === 'InvalidStateError') {
      isListening = true;
      showListeningIndicator();
    } else {
      showError('Failed to start listening: ' + error.message);
      shouldKeepListening = false;
    }
  }
}

function stopListening() {
  shouldKeepListening = false;
  
  if (recognition && isListening) {
    try {
      recognition.stop();
    } catch (error) {
      console.error('Error stopping recognition:', error);
    }
    isListening = false;
    isProcessingCommand = false;
    hideListeningIndicator();
  }
}

function showError(message) {
  removeExistingIndicator();
  
  const addIndicator = () => {
    const indicator = document.createElement('div');
    indicator.id = 'voice-error-indicator';
    indicator.innerHTML = `❌ ${message}`;
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #f44336;
      color: white;
      padding: 10px 15px;
      border-radius: 25px;
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      max-width: 300px;
      word-wrap: break-word;
    `;
    
    document.body.appendChild(indicator);
    
    setTimeout(() => {
      hideListeningIndicator();
    }, 3000);
  };
  
  if (document.body) {
    addIndicator();
  } else {
    const observer = new MutationObserver(() => {
      if (document.body) {
        observer.disconnect();
        addIndicator();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
}

function showListeningIndicator() {
  removeExistingIndicator();
  
  const addIndicator = () => {
    const indicator = document.createElement('div');
    indicator.id = 'voice-listening-indicator';
    indicator.innerHTML = '🎤 Listening...';
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 10px 15px;
      border-radius: 25px;
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      animation: pulse 1.5s infinite;
    `;
    
    if (!document.getElementById('voice-animation-style')) {
      const style = document.createElement('style');
      style.id = 'voice-animation-style';
      style.textContent = `
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.7; }
          100% { opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(indicator);
  };
  
  if (document.body) {
    addIndicator();
  } else {
    const observer = new MutationObserver(() => {
      if (document.body) {
        observer.disconnect();
        addIndicator();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
}

function showCommandExecuted(command) {
  removeExistingIndicator();
  
  const addIndicator = () => {
    const indicator = document.createElement('div');
    indicator.id = 'voice-command-indicator';
    indicator.innerHTML = `⚡ ${command}`;
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #2196F3;
      color: white;
      padding: 10px 15px;
      border-radius: 25px;
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      animation: flash 0.3s ease-out;
    `;
    
    if (!document.getElementById('voice-flash-style')) {
      const style = document.createElement('style');
      style.id = 'voice-flash-style';
      style.textContent = `
        @keyframes flash {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(indicator);
    
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.style.animation = 'none';
        showListeningIndicator();
      }
    }, 1000);
  };
  
  if (document.body) {
    addIndicator();
  } else {
    const observer = new MutationObserver(() => {
      if (document.body) {
        observer.disconnect();
        addIndicator();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
}

function hideListeningIndicator() {
  removeExistingIndicator();
}

function removeExistingIndicator() {
  const indicators = ['voice-listening-indicator', 'voice-command-indicator', 'voice-error-indicator'];
  indicators.forEach(id => {
    const existing = document.getElementById(id);
    if (existing) {
      existing.remove();
    }
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  
  if (request.action === 'startListening') {
    if (!isInitialized) {
      initializeSpeechRecognition();
    }
    startListening();
    sendResponse({success: true, message: 'Started listening'});
  } else if (request.action === 'stopListening') {
    stopListening();
    sendResponse({success: true, message: 'Stopped listening'});
  } else if (request.action === 'ping') {
    sendResponse({
      success: true, 
      message: 'Content script ready',
      initialized: isInitialized,
      speechSupported: ('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window)
    });
  }
  
  return true;
});

initializeWhenReady();

console.log('Voice Tab Controller content script loaded and ready');
