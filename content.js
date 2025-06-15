let recognition = null;
let isListening = false;
let shouldKeepListening = false;
let listeningIndicator = null;
let isGlobalMode = false;

function initializeSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('Speech recognition not supported in this browser');
    return false;
  }

  try {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('Voice recognition started');
      isListening = true;
      if (isGlobalMode) showListeningIndicator();
    };

    recognition.onresult = (event) => {
      const results = event.results;
      const lastResultIndex = results.length - 1;
      if (results[lastResultIndex].isFinal) {
        const transcript = results[lastResultIndex][0].transcript.trim();
        console.log('Voice command received:', transcript);
        if (transcript) executeCommand(transcript);
      }
    };

    recognition.onend = () => {
      console.log('Voice recognition ended');
      isListening = false;
      if (shouldKeepListening && (isGlobalMode || !document.hidden)) {
        let retries = 0;
        const maxRetries = 3;
        const tryRestart = () => {
          if (!shouldKeepListening) return;
          try {
            recognition.start();
            console.log('Recognition restarted');
            isListening = true;
          } catch (e) {
            retries++;
            if (retries < maxRetries && shouldKeepListening) {
              setTimeout(tryRestart, 1000);
            } else {
              console.error('Max restart attempts reached');
              shouldKeepListening = false;
              hideListeningIndicator();
              if (isGlobalMode) showError('Failed to restart speech recognition');
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
      if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(event.error)) {
        shouldKeepListening = false;
        isGlobalMode = false;
        hideListeningIndicator();
      }
      isListening = false;
    };

    return true;
  } catch (error) {
    console.error('Failed to initialize speech recognition:', error);
    return false;
  }
}

async function executeCommand(command) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'executeCommand',
      command
    });
    if (response && response.success && isGlobalMode) {
      showFeedback(`✓ ${command}`);
    } else {
      showError(`Failed: ${command}`);
    }
  } catch (error) {
    console.error('Error executing command:', error);
    showError(`Error: ${error.message}`);
  }
}

function showListeningIndicator() {
  if (listeningIndicator || !isGlobalMode) return;
  listeningIndicator = document.createElement('div');
  listeningIndicator.innerHTML = `<div style="position:fixed;top:20px;right:20px;background:#4CAF50;color:white;padding:10px 15px;border-radius:20px;font-size:14px;z-index:9999;">🎤 Voice Control Active</div>`;
  document.body.appendChild(listeningIndicator);
}

function hideListeningIndicator() {
  if (listeningIndicator && listeningIndicator.parentNode) {
    listeningIndicator.parentNode.removeChild(listeningIndicator);
    listeningIndicator = null;
  }
}

function showFeedback(message) {
  console.log(message);
}

function showError(message) {
  console.error(message);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({
      success: true,
      speechSupported: recognition !== null,
      isListening
    });
    return;
  }

 if (request.action === 'startListening') {
  const thisTabId = request.tabId;
  chrome.runtime.sendMessage({ action: 'getPrimaryTabId' }, (res) => {
    if (!res || thisTabId !== res.primaryTabId) {
      console.log('[content.js] Not primary tab. Skipping recognition.');
      sendResponse({ success: true });
      return;
    }

    if (isListening) {
      sendResponse({ success: true });
      return;
    }

    try {
      console.log('[content.js] Starting recognition...');
      shouldKeepListening = true;
      isGlobalMode = true;
      recognition.start();
      sendResponse({ success: true });
    } catch (error) {
      console.error('Error starting recognition:', error);
      sendResponse({ success: false, error: error.message });
    }
  });
  return true;
}


  if (request.action === 'stopListening') {
    shouldKeepListening = false;
    isGlobalMode = false;
    if (recognition && isListening) {
      try {
        recognition.stop();
      } catch {}
    }
    hideListeningIndicator();
    sendResponse({ success: true });
    return;
  }

  sendResponse({ success: false, error: 'Unknown action' });
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSpeechRecognition);
} else {
  initializeSpeechRecognition();
}

window.addEventListener('beforeunload', () => {
  if (recognition && isListening) {
    try {
      recognition.stop();
    } catch {}
  }
  hideListeningIndicator();
});
