chrome.runtime.onInstalled.addListener(() => {
  console.log('Voice Tab Controller installed');
});

let cachedTabs = [];
let cacheTimeout = null;
let isGlobalListening = false;
let activeListeningTabId = null;
let cachingStarted = false;

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  let tabId = sender && sender.tab ? sender.tab.id : null;

  if (request.action === 'executeCommand') {
    if (tabId !== null) {
      executeVoiceCommand(request.command, tabId);
      sendResponse({ success: true });
    } else {
      console.warn('Cannot execute command: tabId is null');
      sendResponse({ success: false, error: 'No valid tab ID' });
    }
  } else if (request.action === 'startGlobalListening') {
    // Use the active tab if tabId is not passed from the sender
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs.length > 0 ? tabs[0] : null;
      if (tab && tab.id) {
        startGlobalListening(tab.id);
        sendResponse({ success: true });
      } else {
        console.warn('No active tab found to start global listening');
        sendResponse({ success: false, error: 'No active tab' });
      }
    });
    // Return true to indicate asynchronous response
    return true;
  } else if (request.action === 'stopGlobalListening') {
    stopGlobalListening();
    sendResponse({ success: true });
  }
});


// Listen for tab activation with error handling
chrome.tabs.onActivated.addListener((activeInfo) => {
  // Add defensive check for activeInfo
  if (!activeInfo || !activeInfo.tabId) {
    console.warn('Tab activation event without valid tabId');
    return;
  }

  if (isGlobalListening) {
    // Notify the new active tab to start listening
    chrome.tabs.sendMessage(activeInfo.tabId, {
      action: 'startListening'
    }).catch((error) => {
      console.log('Could not send message to tab:', activeInfo.tabId, error.message);
    });
    
    // Stop listening on the previous tab if it exists
    if (activeListeningTabId && activeListeningTabId !== activeInfo.tabId) {
      chrome.tabs.sendMessage(activeListeningTabId, {
        action: 'stopListening'
      }).catch((error) => {
        console.log('Could not stop listening on previous tab:', activeListeningTabId);
      });
    }
    
    activeListeningTabId = activeInfo.tabId;
  }
});

function startGlobalListening(tabId) {
  // Validate tabId before proceeding
  if (!tabId || typeof tabId !== 'number') {
    console.error('Invalid tabId provided to startGlobalListening:', tabId);
    return;
  }

  isGlobalListening = true;
  activeListeningTabId = tabId;
  
  // Start caching for faster execution
  if (!cachingStarted) {
    cachingStarted = true;
    updateTabCache();
  }
}

function stopGlobalListening() {
  isGlobalListening = false;
  activeListeningTabId = null;
  
  // Stop listening on all tabs with error handling
  chrome.tabs.query({}, (tabs) => {
    if (!tabs || !Array.isArray(tabs)) {
      console.warn('Invalid tabs array received');
      return;
    }

    tabs.forEach(tab => {
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'stopListening'
        }).catch((error) => {
          // Silently ignore errors for tabs without content script
        });
      }
    });
  });
}

// Cache tabs periodically for faster access with error handling
function updateTabCache() {
  chrome.tabs.query({}, (tabs) => {
    if (chrome.runtime.lastError) {
      console.error('Error querying tabs:', chrome.runtime.lastError);
      // Retry after a delay
      cacheTimeout = setTimeout(updateTabCache, 5000);
      return;
    }

    if (tabs && Array.isArray(tabs)) {
      cachedTabs = tabs;
    }
    cacheTimeout = setTimeout(updateTabCache, 2000);
  });
}


async function executeVoiceCommand(command, currentTabId) {
  // Validate inputs
  if (!command || typeof command !== 'string') {
    console.error('Invalid command provided:', command);
    return;
  }

  if (!currentTabId || typeof currentTabId !== 'number') {
    console.error('Invalid tabId provided:', currentTabId);
    return;
  }

  const startTime = performance.now();
  const lowerCommand = command.toLowerCase().trim();
  
  if (!cachingStarted) {
    cachingStarted = true;
    updateTabCache();
  }
  
  try {
    if (lowerCommand.includes('new tab')) {
      chrome.tabs.create({}, (tab) => {
        if (chrome.runtime.lastError) {
          console.error('Error creating new tab:', chrome.runtime.lastError);
        } else {
          console.log(`New tab executed in ${performance.now() - startTime}ms`);
        }
      });
      return;
    }
    
    if (lowerCommand.includes('close tab')) {
      chrome.tabs.query({ windowId: chrome.windows.WINDOW_ID_CURRENT }, (tabs) => {
        if (chrome.runtime.lastError) {
          console.error('Error querying tabs:', chrome.runtime.lastError);
          return;
        }

        if (!tabs || !Array.isArray(tabs)) {
          console.error('Invalid tabs array');
          return;
        }

        if (tabs.length === 1) {
          chrome.tabs.create({}, () => {
            chrome.tabs.remove(currentTabId, () => {
              if (chrome.runtime.lastError) {
                console.error('Error removing tab:', chrome.runtime.lastError);
              }
            });
          });
        } else {
          chrome.tabs.remove(currentTabId, () => {
            if (chrome.runtime.lastError) {
              console.error('Error removing tab:', chrome.runtime.lastError);
            }
          });
        }
        console.log(`Close tab executed in ${performance.now() - startTime}ms`);
      });
      return;
    }
    
    if (lowerCommand.includes('next tab')) {
      chrome.tabs.query({ currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError || !tabs || !Array.isArray(tabs)) {
          console.error('Error querying tabs for next tab');
          return;
        }

        if (tabs.length > 1) {
          const currentIndex = tabs.findIndex(tab => tab && tab.id === currentTabId);
          if (currentIndex !== -1) {
            const nextIndex = (currentIndex + 1) % tabs.length;
            const nextTab = tabs[nextIndex];
            if (nextTab && nextTab.id) {
              chrome.tabs.update(nextTab.id, { active: true });
            }
          }
        }
        console.log(`Next tab executed in ${performance.now() - startTime}ms`);
      });
      return;
    }
    
    if (lowerCommand.includes('previous tab') || lowerCommand.includes('prev tab')) {
      chrome.tabs.query({ currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError || !tabs || !Array.isArray(tabs)) {
          console.error('Error querying tabs for previous tab');
          return;
        }

        if (tabs.length > 1) {
          const currentIndex = tabs.findIndex(tab => tab && tab.id === currentTabId);
          if (currentIndex !== -1) {
            const prevIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
            const prevTab = tabs[prevIndex];
            if (prevTab && prevTab.id) {
              chrome.tabs.update(prevTab.id, { active: true });
            }
          }
        }
        console.log(`Previous tab executed in ${performance.now() - startTime}ms`);
      });
      return;
    }
    
    // Continue with other commands using the same defensive pattern...
    if (lowerCommand.includes('reload') || lowerCommand.includes('refresh')) {
      chrome.tabs.get(currentTabId, (tab) => {
        if (chrome.runtime.lastError) {
          console.error('Error getting tab for reload:', chrome.runtime.lastError);
          return;
        }

        if (tab && tab.url && 
            !tab.url.startsWith('chrome://') && 
            !tab.url.startsWith('chrome-extension://') &&
            !tab.url.startsWith('edge://') &&
            !tab.url.startsWith('about:')) {
          chrome.tabs.reload(currentTabId, () => {
            if (chrome.runtime.lastError) {
              console.error('Error reloading tab:', chrome.runtime.lastError);
            }
          });
        }
        console.log(`Reload executed in ${performance.now() - startTime}ms`);
      });
      return;
    }

    // Add similar defensive checks for all other commands...
    
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
