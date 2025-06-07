document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const status = document.getElementById('status');
  const statusText = document.getElementById('statusText');

  // Check if content script is ready when popup opens
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    
    // Check if this is a restricted page
    if (currentTab.url.startsWith('chrome://') || 
        currentTab.url.startsWith('chrome-extension://') || 
        currentTab.url.startsWith('edge://') || 
        currentTab.url.startsWith('about:')) {
      statusText.textContent = 'Not available on this page';
      startBtn.disabled = true;
      stopBtn.disabled = true;
      return;
    }
    
    // Ping content script to check if it's ready
    chrome.tabs.sendMessage(currentTab.id, { action: 'ping' }, (response) => {
      if (chrome.runtime.lastError) {
        statusText.textContent = 'Content script loading...';
        // Retry after a short delay
        setTimeout(() => {
          chrome.tabs.sendMessage(currentTab.id, { action: 'ping' }, (response) => {
            if (chrome.runtime.lastError) {
              statusText.textContent = 'Please refresh the page';
              startBtn.disabled = true;
            } else {
              statusText.textContent = 'Ready';
              startBtn.disabled = false;
            }
          });
        }, 1000);
      } else {
        statusText.textContent = 'Ready';
        startBtn.disabled = false;
      }
    });
  });

  startBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'startListening' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending message:', chrome.runtime.lastError);
          statusText.textContent = 'Error: Please refresh the page';
          return;
        }
        
        if (response && response.success) {
          updateUI(true);
        } else {
          statusText.textContent = 'Failed to start listening';
        }
      });
    });
  });

  stopBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'stopListening' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending message:', chrome.runtime.lastError);
          return;
        }
        
        updateUI(false);
      });
    });
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
});
