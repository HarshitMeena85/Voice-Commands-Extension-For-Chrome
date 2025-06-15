let isGlobalListening = false;
let primaryListeningTabId = null;
let allListeningTabs = new Set();

chrome.runtime.onInstalled.addListener(() => {
  console.log('Voice Tab Controller installed');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startGlobalListening') {
    startGlobalListening(sender.tab?.id)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'stopGlobalListening') {
    stopGlobalListening()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'getPrimaryTabId') {
    sendResponse({ primaryTabId: primaryListeningTabId });
    return true;
  }

  if (request.action === 'whoAmI') {
    sendResponse({ tabId: sender.tab?.id });
    return true;
  }

  if (request.action === 'executeCommand') {
    executeVoiceCommand(request.command, sender.tab?.id)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  if (request.action === 'isGlobalListening') {
  sendResponse({ listening: isGlobalListening });
  return true;
  }


  return false;
});

async function waitForContentScript(tabId, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      if (response && response.success) return true;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return false;
}

async function startListeningOnTab(tabId) {
  const isReady = await waitForContentScript(tabId);
  if (isReady) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        action: 'startListening',
        tabId: tabId   // 👉 pass tabId directly
      });
      return response && response.success;
    } catch {}
  }
  return false;
}


async function startGlobalListening(initiatingTabId) {
  isGlobalListening = true;
  primaryListeningTabId = initiatingTabId;
  allListeningTabs.clear();

  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!isRestrictedPage(tab.url)) {
      allListeningTabs.add(tab.id);
      if (tab.id === initiatingTabId) await startListeningOnTab(tab.id);
    }
  }
  console.log('Global listening started on tab:', initiatingTabId);
}

async function stopGlobalListening() {
  isGlobalListening = false;
  for (const tabId of allListeningTabs) {
    try {
      await chrome.tabs.sendMessage(tabId, { action: 'stopListening' });
    } catch {}
  }
  allListeningTabs.clear();
  primaryListeningTabId = null;
  console.log('Global listening stopped');
}

async function executeVoiceCommand(command, currentTabId) {
  const lowerCommand = (command || '').toLowerCase().trim();
  if (!lowerCommand) throw new Error('Invalid command');

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (lowerCommand.includes('stop listening')) return stopGlobalListening();
  if (lowerCommand.includes('new tab')) return chrome.tabs.create({});
  if (lowerCommand.includes('close tab') && activeTab) return chrome.tabs.remove(activeTab.id);

  if (lowerCommand.includes('next tab') || lowerCommand.includes('previous tab') || lowerCommand.includes('prev tab')) {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    if (!activeTab) return;
    const currentIndex = tabs.findIndex(tab => tab.id === activeTab.id);
    const newIndex = lowerCommand.includes('next') ? (currentIndex + 1) % tabs.length : (currentIndex - 1 + tabs.length) % tabs.length;
    return chrome.tabs.update(tabs[newIndex].id, { active: true });
  }

  if (lowerCommand.includes('new window')) return chrome.windows.create({});
  if (lowerCommand.includes('close window')) {
    const currentWindow = await chrome.windows.getCurrent();
    const allWindows = await chrome.windows.getAll();
    if (allWindows.length === 1) await chrome.windows.create({});
    return chrome.windows.remove(currentWindow.id);
  }

  if (lowerCommand.includes('reload') || lowerCommand.includes('refresh')) {
    if (activeTab) return chrome.tabs.reload(activeTab.id);
  }

  if (lowerCommand.includes('duplicate tab')) {
    if (activeTab) return chrome.tabs.duplicate(activeTab.id);
  }

  if (lowerCommand.includes('pin tab')) {
    if (activeTab) {
      const tab = await chrome.tabs.get(activeTab.id);
      return chrome.tabs.update(tab.id, { pinned: !tab.pinned });
    }
  }

  if (lowerCommand.includes('mute tab')) {
    if (activeTab) {
      const tab = await chrome.tabs.get(activeTab.id);
      return chrome.tabs.update(tab.id, { muted: !tab.mutedInfo?.muted });
    }
  }

  throw new Error(`Unknown command: ${command}`);
}

chrome.tabs.onCreated.addListener((tab) => {
  if (isGlobalListening && !isRestrictedPage(tab.url)) {
    setTimeout(async () => {
      if (tab.id !== primaryListeningTabId) return;
      const success = await startListeningOnTab(tab.id);
      if (success) allListeningTabs.add(tab.id);
    }, 1500);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  allListeningTabs.delete(tabId);
  if (primaryListeningTabId === tabId) primaryListeningTabId = null;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (isGlobalListening && changeInfo.status === 'complete' && !isRestrictedPage(tab.url)) {
    setTimeout(async () => {
      if (tabId === primaryListeningTabId && !allListeningTabs.has(tabId)) {
        const success = await startListeningOnTab(tabId);
        if (success) allListeningTabs.add(tabId);
      }
    }, 500);
  }
});

function isRestrictedPage(url) {
  const restrictedPrefixes = [
    'chrome://', 'chrome-extension://', 'edge://', 'about:', 'moz-extension://', 'safari-extension://'
  ];
  return !url || restrictedPrefixes.some(prefix => url.startsWith(prefix));
}
