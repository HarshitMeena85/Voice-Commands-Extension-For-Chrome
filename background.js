chrome.runtime.onInstalled.addListener(() => {
  console.log('Voice Tab Controller installed');
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'executeCommand') {
    executeVoiceCommand(request.command, sender.tab.id);
  }
});

async function executeVoiceCommand(command, currentTabId) {
  const lowerCommand = command.toLowerCase().trim();
  
  try {
    if (lowerCommand.includes('new tab')) {
      await chrome.tabs.create({});
    }
    else if (lowerCommand.includes('close tab')) {
      await chrome.tabs.remove(currentTabId);
    }
    else if (lowerCommand.includes('next tab')) {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const currentIndex = tabs.findIndex(tab => tab.id === currentTabId);
      const nextIndex = (currentIndex + 1) % tabs.length;
      await chrome.tabs.update(tabs[nextIndex].id, { active: true });
    }
    else if (lowerCommand.includes('previous tab') || lowerCommand.includes('prev tab')) {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const currentIndex = tabs.findIndex(tab => tab.id === currentTabId);
      const prevIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
      await chrome.tabs.update(tabs[prevIndex].id, { active: true });
    }
    else if (lowerCommand.includes('new window')) {
      await chrome.windows.create({});
    }
    else if (lowerCommand.includes('close window')) {
      const currentWindow = await chrome.windows.getCurrent();
      await chrome.windows.remove(currentWindow.id);
    }
    else if (lowerCommand.includes('reload') || lowerCommand.includes('refresh')) {
      await chrome.tabs.reload(currentTabId);
    }
    else if (lowerCommand.includes('duplicate tab')) {
      const tab = await chrome.tabs.get(currentTabId);
      await chrome.tabs.create({ url: tab.url });
    }
    else if (lowerCommand.includes('pin tab')) {
      const tab = await chrome.tabs.get(currentTabId);
      await chrome.tabs.update(currentTabId, { pinned: !tab.pinned });
    }
    else if (lowerCommand.includes('mute tab')) {
      const tab = await chrome.tabs.get(currentTabId);
      await chrome.tabs.update(currentTabId, { muted: !tab.mutedInfo.muted });
    }
  } catch (error) {
    console.error('Error executing command:', error);
  }
}
