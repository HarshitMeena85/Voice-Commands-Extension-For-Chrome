let isGlobalListening = false;
let primaryListeningTabId = null;
let allListeningTabs = new Set();
let customCommands = {};

chrome.runtime.onInstalled.addListener(() => {
  console.log('Voice Tab Controller installed');
  loadCustomCommands();
});

chrome.runtime.onStartup.addListener(() => {
  loadCustomCommands();
});

function loadCustomCommands() {
  chrome.storage.sync.get('customCommands', (data) => {
    customCommands = data.customCommands || {};
  });
}

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

  if (request.action === 'isGlobalListening') {
    sendResponse({ listening: isGlobalListening });
    return true;
  }

  if (request.action === 'saveCustomCommands') {
    customCommands = request.commands || {};
    chrome.storage.sync.set({ customCommands });
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'executeCommand') {
    executeVoiceCommand(request.command, sender.tab?.id)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
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
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

async function startListeningOnTab(tabId) {
  const isReady = await waitForContentScript(tabId);
  if (isReady) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: 'startListening', tabId });
      if (response && response.success) return true;
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
}

async function stopGlobalListening() {
  isGlobalListening = false;

  const stopPromises = Array.from(allListeningTabs).map(tabId =>
    chrome.tabs.sendMessage(tabId, { action: 'stopListening' }).catch(() => {})
  );

  await Promise.allSettled(stopPromises);
  allListeningTabs.clear();
  primaryListeningTabId = null;
}

async function executeVoiceCommand(command, tabId) {
  const cmd = command.toLowerCase().trim();
  const actTabs = await chrome.tabs.query({ active: true, currentWindow: true });

  // ✅ Custom command match
  if (customCommands[cmd]) {
    return chrome.tabs.create({ url: customCommands[cmd] });
  }

  if (cmd.includes('stop listening')) return stopGlobalListening();
  if (cmd.includes('new tab')) return chrome.tabs.create({});
  if (cmd.includes('close tab') && actTabs.length > 0) return chrome.tabs.remove(actTabs[0].id);
  if (cmd.includes('next tab') && actTabs.length > 0) {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const idx = tabs.findIndex(t => t.id === actTabs[0].id);
    return chrome.tabs.update(tabs[(idx + 1) % tabs.length].id, { active: true });
  }
  if ((cmd.includes('previous tab') || cmd.includes('prev tab')) && actTabs.length > 0) {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const idx = tabs.findIndex(t => t.id === actTabs[0].id);
    const prev = idx === 0 ? tabs.length - 1 : idx - 1;
    return chrome.tabs.update(tabs[prev].id, { active: true });
  }
  if (cmd.includes('new window')) return chrome.windows.create({});
  if (cmd.includes('close window')) {
    const win = await chrome.windows.getCurrent();
    return chrome.windows.remove(win.id);
  }
  if (cmd.includes('reload') || cmd.includes('refresh'))
    return chrome.tabs.reload(actTabs[0].id);
  if (cmd.includes('duplicate tab'))
    return chrome.tabs.duplicate(actTabs[0].id);
  if (cmd.includes('pin tab')) {
    const tab = await chrome.tabs.get(actTabs[0].id);
    return chrome.tabs.update(tab.id, { pinned: !tab.pinned });
  }
  if (cmd.includes('mute tab')) {
    const tab = await chrome.tabs.get(actTabs[0].id);
    return chrome.tabs.update(tab.id, { muted: !tab.mutedInfo?.muted });
  }

  throw new Error('Unknown command: ' + command);
}

chrome.tabs.onCreated.addListener((tab) => {
  if (isGlobalListening && tab.id === primaryListeningTabId && !isRestrictedPage(tab.url)) {
    setTimeout(() => startListeningOnTab(tab.id), 1500);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  allListeningTabs.delete(tabId);
  if (primaryListeningTabId === tabId) primaryListeningTabId = null;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (isGlobalListening && changeInfo.status === 'complete' && !isRestrictedPage(tab.url)) {
    if (tabId === primaryListeningTabId) {
      setTimeout(() => startListeningOnTab(tabId), 500);
    }
  }
});

function isRestrictedPage(url) {
  return [
    'chrome://', 'chrome-extension://', 'edge://', 'about:', 'moz-extension://', 'safari-extension://'
  ].some(prefix => url?.startsWith(prefix));
}
