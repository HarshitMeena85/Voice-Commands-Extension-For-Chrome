chrome.runtime.onInstalled.addListener(() => {
  console.log('Voice Tab Controller installed');
});

// Pre-cache tab queries for faster execution
let cachedTabs = [];
let cacheTimeout = null;

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'executeCommand') {
    // Execute immediately without await to avoid blocking
    executeVoiceCommand(request.command, sender.tab.id);
    sendResponse({success: true}); // Respond immediately
  }
});

// Cache tabs periodically for faster access
function updateTabCache() {
  chrome.tabs.query({}, (tabs) => {
    cachedTabs = tabs;
    // Update cache every 2 seconds while listening
    cacheTimeout = setTimeout(updateTabCache, 2000);
  });
}

// Start caching when first command is received
let cachingStarted = false;

async function executeVoiceCommand(command, currentTabId) {
  const startTime = performance.now();
  const lowerCommand = command.toLowerCase().trim();
  
  // Start caching if not already started
  if (!cachingStarted) {
    cachingStarted = true;
    updateTabCache();
  }
  
  try {
    // Fast command execution - avoid unnecessary async operations where possible
    if (lowerCommand.includes('new tab')) {
      chrome.tabs.create({}, () => {
        console.log(`New tab executed in ${performance.now() - startTime}ms`);
      });
      return;
    }
    
    if (lowerCommand.includes('close tab')) {
      // Quick check for last tab
      chrome.tabs.query({ windowId: chrome.windows.WINDOW_ID_CURRENT }, (tabs) => {
        if (tabs.length === 1) {
          chrome.tabs.create({}, () => {
            chrome.tabs.remove(currentTabId);
          });
        } else {
          chrome.tabs.remove(currentTabId);
        }
        console.log(`Close tab executed in ${performance.now() - startTime}ms`);
      });
      return;
    }
    
    if (lowerCommand.includes('next tab')) {
      chrome.tabs.query({ currentWindow: true }, (tabs) => {
        if (tabs.length > 1) {
          const currentIndex = tabs.findIndex(tab => tab.id === currentTabId);
          if (currentIndex !== -1) {
            const nextIndex = (currentIndex + 1) % tabs.length;
            chrome.tabs.update(tabs[nextIndex].id, { active: true });
          }
        }
        console.log(`Next tab executed in ${performance.now() - startTime}ms`);
      });
      return;
    }
    
    if (lowerCommand.includes('previous tab') || lowerCommand.includes('prev tab')) {
      chrome.tabs.query({ currentWindow: true }, (tabs) => {
        if (tabs.length > 1) {
          const currentIndex = tabs.findIndex(tab => tab.id === currentTabId);
          if (currentIndex !== -1) {
            const prevIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
            chrome.tabs.update(tabs[prevIndex].id, { active: true });
          }
        }
        console.log(`Previous tab executed in ${performance.now() - startTime}ms`);
      });
      return;
    }
    
    if (lowerCommand.includes('new window')) {
      chrome.windows.create({}, () => {
        console.log(`New window executed in ${performance.now() - startTime}ms`);
      });
      return;
    }
    
    if (lowerCommand.includes('close window')) {
      chrome.windows.getAll((windows) => {
        if (windows.length > 1) {
          chrome.windows.getCurrent((currentWindow) => {
            chrome.windows.remove(currentWindow.id);
          });
        } else {
          chrome.tabs.create({});
        }
        console.log(`Close window executed in ${performance.now() - startTime}ms`);
      });
      return;
    }
    
    if (lowerCommand.includes('reload') || lowerCommand.includes('refresh')) {
      chrome.tabs.get(currentTabId, (tab) => {
        if (!tab.url.startsWith('chrome://') && 
            !tab.url.startsWith('chrome-extension://') &&
            !tab.url.startsWith('edge://') &&
            !tab.url.startsWith('about:')) {
          chrome.tabs.reload(currentTabId);
        }
        console.log(`Reload executed in ${performance.now() - startTime}ms`);
      });
      return;
    }
    
    if (lowerCommand.includes('duplicate tab')) {
      chrome.tabs.get(currentTabId, (tab) => {
        if (!tab.url.startsWith('chrome://') && 
            !tab.url.startsWith('chrome-extension://') &&
            !tab.url.startsWith('edge://') &&
            !tab.url.startsWith('about:')) {
          chrome.tabs.create({ url: tab.url });
        }
        console.log(`Duplicate tab executed in ${performance.now() - startTime}ms`);
      });
      return;
    }
    
    if (lowerCommand.includes('pin tab')) {
      chrome.tabs.get(currentTabId, (tab) => {
        chrome.tabs.update(currentTabId, { pinned: !tab.pinned });
        console.log(`Pin tab executed in ${performance.now() - startTime}ms`);
      });
      return;
    }
    
    if (lowerCommand.includes('mute tab')) {
      chrome.tabs.get(currentTabId, (tab) => {
        if (tab.mutedInfo !== undefined) {
          chrome.tabs.update(currentTabId, { muted: !tab.mutedInfo.muted });
        }
        console.log(`Mute tab executed in ${performance.now() - startTime}ms`);
      });
      return;
    }
    
  } catch (error) {
    console.error('Error executing command:', error);
  }
}

// Clean up cache when extension is idle
chrome.runtime.onSuspend.addListener(() => {
  if (cacheTimeout) {
    clearTimeout(cacheTimeout);
  }
});