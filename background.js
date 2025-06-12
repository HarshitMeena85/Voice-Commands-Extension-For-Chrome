let isGlobalListening = false;
let primaryListeningTabId = null;
let allListeningTabs = new Set();

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Voice Tab Controller installed');
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);

  if (request.action === 'startGlobalListening') {
    startGlobalListening(sender.tab?.id)
      .then(() => sendResponse({ success: true }))
      .catch(error => {
        console.error('Failed to start global listening:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === 'stopGlobalListening') {
    stopGlobalListening()
      .then(() => sendResponse({ success: true }))
      .catch(error => {
        console.error('Failed to stop global listening:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === 'executeCommand') {
    executeVoiceCommand(request.command, sender.tab?.id)
      .then(() => sendResponse({ success: true }))
      .catch(error => {
        console.error('Failed to execute command:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  return false;
});

// Improved function to wait for content script
async function waitForContentScript(tabId, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      if (response && response.success) {
        return true;
      }
    } catch (error) {
      console.log(`Content script not ready on tab ${tabId}, attempt ${i + 1}`);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return false;
}

// Start listening on a specific tab
async function startListeningOnTab(tabId) {
  const isReady = await waitForContentScript(tabId);
  if (isReady) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: 'startListening' });
      if (response && response.success) {
        console.log('Successfully started listening on tab:', tabId);
        return true;
      }
    } catch (error) {
      console.error('Failed to start listening on tab:', tabId, error);
    }
  }
  return false;
}

async function startGlobalListening(initiatingTabId) {
  try {
    isGlobalListening = true;
    primaryListeningTabId = initiatingTabId;
    
    // Start listening on all valid tabs
    const tabs = await chrome.tabs.query({});
    const startPromises = [];
    
    for (const tab of tabs) {
      if (!isRestrictedPage(tab.url)) {
        startPromises.push(
          startListeningOnTab(tab.id).then(success => {
            if (success) {
              allListeningTabs.add(tab.id);
            }
          })
        );
      }
    }
    
    await Promise.allSettled(startPromises);
    console.log('Global listening started across', allListeningTabs.size, 'tabs');
    return Promise.resolve();
  } catch (error) {
    console.error('Error starting global listening:', error);
    return Promise.reject(error);
  }
}

async function stopGlobalListening() {
  try {
    isGlobalListening = false;
    
    // Stop listening on all tabs
    const stopPromises = [];
    for (const tabId of allListeningTabs) {
      stopPromises.push(
        chrome.tabs.sendMessage(tabId, { action: 'stopListening' })
          .catch(error => {
            console.log('Could not stop listening on tab:', tabId);
          })
      );
    }
    
    await Promise.allSettled(stopPromises);
    
    allListeningTabs.clear();
    primaryListeningTabId = null;
    console.log('Global listening stopped');
    return Promise.resolve();
  } catch (error) {
    console.error('Error stopping global listening:', error);
    return Promise.reject(error);
  }
}

async function executeVoiceCommand(command, currentTabId) {
  const startTime = performance.now();
  console.log(`Executing command: "${command}" from tab ${currentTabId}`);
  
  if (!command || typeof command !== 'string') {
    throw new Error('Invalid command');
  }
  
  const lowerCommand = command.toLowerCase().trim();
  
  // Stop listening command
  if (lowerCommand.includes('stop listening')) {
    await stopGlobalListening();
    console.log(`Stop listening executed in ${performance.now() - startTime}ms`);
    return;
  }
  
  // New tab command
  if (lowerCommand.includes('new tab')) {
    const tab = await chrome.tabs.create({});
    console.log(`New tab executed in ${performance.now() - startTime}ms`);
    return;
  }
  
  // Close tab command - operates on currently active tab
  if (lowerCommand.includes('close tab')) {
    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTabs.length > 0) {
      const activeTabId = activeTabs[0].id;
      await chrome.tabs.remove(activeTabId);
      allListeningTabs.delete(activeTabId);
      console.log(`Close tab executed in ${performance.now() - startTime}ms`);
    }
    return;
  }
  
  // Next tab command
  if (lowerCommand.includes('next tab')) {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (activeTabs.length > 0) {
      const currentIndex = tabs.findIndex(tab => tab.id === activeTabs[0].id);
      const nextIndex = (currentIndex + 1) % tabs.length;
      await chrome.tabs.update(tabs[nextIndex].id, { active: true });
      console.log(`Next tab executed in ${performance.now() - startTime}ms`);
    }
    return;
  }
  
  // Previous tab command
  if (lowerCommand.includes('previous tab') || lowerCommand.includes('prev tab')) {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (activeTabs.length > 0) {
      const currentIndex = tabs.findIndex(tab => tab.id === activeTabs[0].id);
      const prevIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
      await chrome.tabs.update(tabs[prevIndex].id, { active: true });
      console.log(`Previous tab executed in ${performance.now() - startTime}ms`);
    }
    return;
  }
  
  // New window command
  if (lowerCommand.includes('new window')) {
    const window = await chrome.windows.create({});
    console.log(`New window executed in ${performance.now() - startTime}ms`);
    return;
  }
  
  // Close window command
  if (lowerCommand.includes('close window')) {
    const currentWindow = await chrome.windows.getCurrent();
    const allWindows = await chrome.windows.getAll();
    
    if (allWindows.length === 1) {
      await chrome.windows.create({});
    }
    
    await chrome.windows.remove(currentWindow.id);
    console.log(`Close window executed in ${performance.now() - startTime}ms`);
    return;
  }
  
  // Reload/Refresh command - operates on currently active tab
  if (lowerCommand.includes('reload') || lowerCommand.includes('refresh')) {
    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTabs.length > 0) {
      await chrome.tabs.reload(activeTabs[0].id);
      console.log(`Reload executed in ${performance.now() - startTime}ms`);
    }
    return;
  }
  
  // Duplicate tab command - operates on currently active tab
  if (lowerCommand.includes('duplicate tab')) {
    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTabs.length > 0) {
      const tab = await chrome.tabs.duplicate(activeTabs[0].id);
      console.log(`Duplicate tab executed in ${performance.now() - startTime}ms`);
    }
    return;
  }
  
  // Pin tab command - operates on currently active tab
  if (lowerCommand.includes('pin tab')) {
    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTabs.length > 0) {
      const tab = await chrome.tabs.get(activeTabs[0].id);
      const newPinnedState = !tab.pinned;
      await chrome.tabs.update(activeTabs[0].id, { pinned: newPinnedState });
      console.log(`${newPinnedState ? 'Pin' : 'Unpin'} tab executed in ${performance.now() - startTime}ms`);
    }
    return;
  }
  
  // Mute tab command - operates on currently active tab
  if (lowerCommand.includes('mute tab')) {
    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTabs.length > 0) {
      const tab = await chrome.tabs.get(activeTabs[0].id);
      const newMutedState = !tab.mutedInfo?.muted;
      await chrome.tabs.update(activeTabs[0].id, { muted: newMutedState });
      console.log(`${newMutedState ? 'Mute' : 'Unmute'} tab executed in ${performance.now() - startTime}ms`);
    }
    return;
  }
  
  throw new Error(`Unknown command: ${command}`);
}

// Handle new tabs being created
chrome.tabs.onCreated.addListener((tab) => {
  if (isGlobalListening && !isRestrictedPage(tab.url)) {
    setTimeout(async () => {
      const success = await startListeningOnTab(tab.id);
      if (success) {
        allListeningTabs.add(tab.id);
      }
    }, 1500); // Give more time for content script to load
  }
});

// Handle tabs being removed
chrome.tabs.onRemoved.addListener((tabId) => {
  allListeningTabs.delete(tabId);
  if (primaryListeningTabId === tabId) {
    primaryListeningTabId = null;
  }
});

// Handle tab updates (like navigation)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (isGlobalListening && changeInfo.status === 'complete' && !isRestrictedPage(tab.url)) {
    setTimeout(async () => {
      if (!allListeningTabs.has(tabId)) {
        const success = await startListeningOnTab(tabId);
        if (success) {
          allListeningTabs.add(tabId);
        }
      }
    }, 500);
  }
});

// Helper function to check if a page is restricted
function isRestrictedPage(url) {
  if (!url) return true;
  
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
