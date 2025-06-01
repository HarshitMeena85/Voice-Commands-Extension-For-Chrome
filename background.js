chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.command === "next_tab") {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      const activeIndex = tabs.findIndex(tab => tab.active);
      const nextTab = tabs[(activeIndex + 1) % tabs.length];
      chrome.tabs.update(nextTab.id, { active: true });
    });
  }

  if (request.command === "close_youtube") {
    chrome.tabs.query({ url: "*://*.youtube.com/*" }, (tabs) => {
      for (let tab of tabs) {
        chrome.tabs.remove(tab.id);
      }
    });
  }
});
