document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const status = document.getElementById('status');
  const statusText = document.getElementById('statusText');

  let currentTab = null;

  init();

  async function init() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      currentTab = tabs[0];
      
      if (isRestrictedPage(currentTab.url)) {
        statusText.textContent = 'Voice control not available on this page';
        startBtn.disabled = true;
        stopBtn.disabled = true;
        return;
      }
      
      await checkContentScriptStatus();
    } catch (error) {
      console.error('Initialization error:', error);
      statusText.textContent = 'Error initializing extension';
      startBtn.disabled = true;
      stopBtn.disabled = true;
    }
  }

  function isRestrictedPage(url) {
    const restrictedPrefixes = [
      'chrome://',
      'chrome-extension://',
      'edge://',
      'about:',
      'moz-extension://',
      'safari-extension://'
    ];
    
    return restrictedPrefixes.some(prefix => url.startsWith(prefix));
  }

  // Request microphone permission before starting
  async function requestMicrophonePermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Stop the stream, we just needed permission
      return true;
    } catch (error) {
      console.error('Microphone permission denied:', error);
      return false;
    }
  }

  async function checkContentScriptStatus() {
    let retryCount = 0;
    const maxRetries = 3;
    
    const checkScript = async () => {
      try {
        const response = await sendMessageToTab({ action: 'ping' });
        
        if (response && response.success) {
          if (response.speechSupported) {
            statusText.textContent = 'Ready for global listening';
            startBtn.disabled = false;
          } else {
            statusText.textContent = 'Speech recognition not supported';
            startBtn.disabled = true;
          }
        } else {
          throw new Error('Invalid response');
        }
      } catch (error) {
        retryCount++;
        
        if (retryCount < maxRetries) {
          statusText.textContent = `Loading... (${retryCount}/${maxRetries})`;
          setTimeout(checkScript, 1000);
        } else {
          statusText.textContent = 'Please refresh the page';
          startBtn.disabled = true;
        }
      }
    };
    
    await checkScript();
  }

  async function sendMessageToTab(message) {
    return new Promise((resolve, reject) => {
      if (!currentTab) {
        reject(new Error('No current tab'));
        return;
      }
      
      chrome.tabs.sendMessage(currentTab.id, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  startBtn.addEventListener('click', async () => {
    try {
      statusText.textContent = 'Requesting microphone permission...';
      
      // First request microphone permission
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        statusText.textContent = 'Microphone permission required. Please allow access and try again.';
        return;
      }
      
      statusText.textContent = 'Starting global listening...';
      
      const response = await chrome.runtime.sendMessage({ 
        action: 'startGlobalListening' 
      });
      
      if (response && response.success) {
        await sendMessageToTab({ action: 'startListening' });
        updateUI(true);
      } else {
        statusText.textContent = 'Failed to start listening';
      }
    } catch (error) {
      console.error('Error starting listening:', error);
      statusText.textContent = 'Error: ' + error.message;
    }
  });

  stopBtn.addEventListener('click', async () => {
    try {
      statusText.textContent = 'Stopping listening...';
      await chrome.runtime.sendMessage({ action: 'stopGlobalListening' });
      updateUI(false);
    } catch (error) {
      console.error('Error stopping listening:', error);
      updateUI(false);
    }
  });

  function updateUI(listening) {
    if (listening) {
      startBtn.disabled = true;
      stopBtn.disabled = false;
      statusText.textContent = '🎤 Listening across all tabs...';
      status.classList.add('listening');
    } else {
      startBtn.disabled = false;
      stopBtn.disabled = true;
      statusText.textContent = 'Ready for global listening';
      status.classList.remove('listening');
    }
  }

  window.addEventListener('beforeunload', async () => {
    try {
      await chrome.runtime.sendMessage({ action: 'stopGlobalListening' });
    } catch (error) {
      // Ignore errors when popup is closing
    }
  });
  // Add this function to request microphone permission
async function requestMicrophonePermission() {
  try {
    // Request permission from extension context
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop()); // Stop immediately, we just needed permission
    console.log('Microphone permission granted');
    return true;
  } catch (error) {
    console.error('Microphone permission denied:', error);
    if (error.name === 'NotAllowedError') {
      // Open Chrome settings for manual permission grant
      chrome.tabs.create({
        url: `chrome://settings/content/siteDetails?site=chrome-extension%3A%2F%2F${chrome.runtime.id}%2F`
      });
    }
    return false;
  }
}

// Modify your start button handler
startBtn.addEventListener('click', async () => {
  try {
    statusText.textContent = 'Requesting microphone permission...';
    
    // First request microphone permission
    const hasPermission = await requestMicrophonePermission();
    if (!hasPermission) {
      statusText.textContent = 'Please grant microphone permission in the opened settings page, then try again.';
      return;
    }
    
    // Continue with starting global listening
    const response = await chrome.runtime.sendMessage({ 
      action: 'startGlobalListening' 
    });
    
    if (response && response.success) {
      await sendMessageToTab({ action: 'startListening' });
      updateUI(true);
    }
  } catch (error) {
    console.error('Error starting listening:', error);
    statusText.textContent = 'Error: ' + error.message;
  }
});

});
