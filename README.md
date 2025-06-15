# Voice Tab Controller

**Voice Tab Controller** is a Chrome extension that lets you control your browser with your voice — including customizable commands to open any website.

---

## Features

- Start/stop global voice control across all tabs
- Voice commands like:
  - `"new tab"` – Open a new tab
  - `"close tab"` – Close the current tab
  - `"next tab"` / `"previous tab"` – Navigate tabs
  - `"new window"` / `"close window"` – Manage windows
  - `"reload"` / `"refresh"` – Reload current tab
  - `"duplicate tab"` – Duplicate the tab
  - `"pin tab"` – Pin/unpin the tab
  - `"mute tab"` – Mute/unmute the tab
- Add custom voice commands mapped to specific URLs

---

## How It Works

1. The extension uses the **Web Speech API** for voice recognition.
2. A content script listens for your voice input.
3. Recognized commands are sent to the background service worker.
4. Matching actions (like switching tabs) are performed.
5. You can manage custom commands directly in the popup interface.

---

## Installation

1. Clone or download this repository.
2. Go to `chrome://extensions` in your Chrome browser.
3. Enable **Developer Mode**.
4. Click **Load Unpacked** and select the project folder.
5. Grant microphone access when prompted.

---

## Project Structure

- `background.js`: Handles command execution and tab control

- `content.js`: Handles voice recognition in the tab

- `manifest.json`: Chrome extension metadata

- `popup.html`: Extension popup UI

- `popup.js`: Handles UI interaction and state

- `popup.css`: Styling for popup

- `icons/`: Extension icons

---

## Example Custom Command

You can set a custom command like:

- **Phrase:** `Open youtube`
- **URL:** `https://youtube.com`

When you say *"open youtube"*, it will open the link in a new tab.

---

## Limitations

- Voice control may not work on restricted pages like:
  - `chrome://*`
  - `chrome-extension://*`
- Requires microphone permission
- Works best on Chromium-based browsers with Speech Recognition support

---

## Permissions Used

- `"tabs"` – To manipulate browser tabs
- `"storage"` – To store custom commands
- `"scripting"` – For content script injection
- `"activeTab"` – For controlling the current tab
- `<all_urls>` – To run on any webpage

---

## Feedback / Contributions

Suggestions and pull requests are welcome! Open an issue or create a PR if you have ideas to enhance this extension.


