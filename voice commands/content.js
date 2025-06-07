let recognition = null;
let isListening = false;

// Initialize immediately and also on DOM ready
initializeSpeechRecognition();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSpeechRecognition);
}

function initializeSpeechRecognition() {
  console.log('Initializing speech recognition...');
  
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    console.log('Speech recognition not supported');
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    console.log('Voice recognition started');
    isListening = true;
    showListeningIndicator();
  };

  recognition.onresult = (event) => {
    const lastResult = event.results[event.results.length - 1];
    if (lastResult.isFinal) {
      const transcript = lastResult[0].transcript.toLowerCase().trim();
      console.log('Voice command:', transcript);
      
      if (isValidCommand(transcript)) {
        chrome.runtime.sendMessage({
          action: 'executeCommand',
          command: transcript
        });
        showCommandExecuted(transcript);
      }
    }
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    
    if (event.error === 'not-allowed') {
      showError('Microphone access denied. Please allow microphone permissions.');
    } else if (event.error === 'no-speech') {
      showError('No speech detected. Try speaking louder.');
    } else {
      showError(`Speech error: ${event.error}`);
    }
    
    hideListeningIndicator();
  };

  recognition.onend = () => {
    console.log('Voice recognition ended');
    isListening = false;
    hideListeningIndicator();
  };
  
  console.log('Speech recognition initialized');
}

function isValidCommand(transcript) {
  const commands = [
    'new tab', 'close tab', 'next tab', 'previous tab', 'prev tab',
    'new window', 'close window', 'reload', 'refresh', 'duplicate tab',
    'pin tab', 'mute tab'
  ];
  
  return commands.some(command => transcript.includes(command));
}

function startListening() {
  console.log('Attempting to start listening...');
  
  if (!recognition) {
    console.error('Speech recognition not initialized');
    showError('Speech recognition not available');
    return;
  }
  
  if (isListening) {
    console.log('Already listening');
    return;
  }
  
  try {
    recognition.start();
  } catch (error) {
    console.error('Error starting recognition:', error);
    showError('Failed to start listening');
  }
}

function stopListening() {
  if (recognition && isListening) {
    recognition.stop();
  }
}

function showError(message) {
  removeExistingIndicator();
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
  `;
  
  if (document.body) {
    document.body.appendChild(indicator);
  }
  
  setTimeout(() => {
    hideListeningIndicator();
  }, 5000);
}

function showListeningIndicator() {
  removeExistingIndicator();
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
  `;
  
  if (document.body) {
    document.body.appendChild(indicator);
  }
}

function showCommandExecuted(command) {
  removeExistingIndicator();
  const indicator = document.createElement('div');
  indicator.id = 'voice-command-indicator';
  indicator.innerHTML = `✓ Executed: ${command}`;
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
  `;
  
  if (document.body) {
    document.body.appendChild(indicator);
  }
  
  setTimeout(() => {
    hideListeningIndicator();
  }, 2000);
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

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  
  if (request.action === 'startListening') {
    startListening();
    sendResponse({success: true, message: 'Started listening'});
  } else if (request.action === 'stopListening') {
    stopListening();
    sendResponse({success: true, message: 'Stopped listening'});
  } else if (request.action === 'ping') {
    sendResponse({success: true, message: 'Content script ready'});
  }
  
  return true; // Keep message channel open for async response
});

// Signal that content script is ready
console.log('Voice Tab Controller content script loaded and ready');
