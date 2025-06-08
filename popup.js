document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const status = document.getElementById('status');
  const statusText = document.getElementById('statusText');

  let currentTab = null;

  // Initialize popup
  init();

  async function init() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      currentTab = tabs[0];
      
      // Check if this is a restricted page
      if (isRestrictedPage(currentTab.url)) {
        statusText.textContent = 'Voice control not available on this page';
        startBtn.disabled = true;
        stopBtn.disabled = true;
        return;
      }
      
      // Check content script status
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

  async function checkContentScriptStatus() {
    let retryCount = 0;
    const maxRetries = 3;
    
    const checkScript = async () => {
      try {
        const response = await sendMessageToTab({ action: 'ping' });
        
        if (response && response.success) {
          if (response.speechSupported) {
            statusText.textContent = 'Ready';
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
      const response = await sendMessageToTab({ action: 'startListening' });
      
      if (response && response.success) {
        updateUI(true);
      } else {
        statusText.textContent = 'Failed to start listening';
      }
    } catch (error) {
      console.error('Error starting listening:', error);
      statusText.textContent = 'Error: ' + error.message;
      
      // Try to re-initialize
      setTimeout(checkContentScriptStatus, 1000);
    }
  });

  stopBtn.addEventListener('click', async () => {
    try {
      await sendMessageToTab({ action: 'stopListening' });
      updateUI(false);
    } catch (error) {
      console.error('Error stopping listening:', error);
      // Still update UI even if there was an error
      updateUI(false);
    }
  });

  function updateUI(listening) {
    if (listening) {
      startBtn.disabled = true;
      stopBtn.disabled = false;
      statusText.textContent = 'Listening for commands...';
      status.classList.add('listening');
    } else {
      startBtn.disabled = false;
      stopBtn.disabled = true;
      statusText.textContent = 'Ready';
      status.classList.remove('listening');
    }
  }

  // Handle popup closing - stop listening
  window.addEventListener('beforeunload', async () => {
    try {
      await sendMessageToTab({ action: 'stopListening' });
    } catch (error) {
      // Ignore errors when popup is closing
    }
  });
});