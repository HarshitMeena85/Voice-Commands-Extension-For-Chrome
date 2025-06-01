const startButton = document.createElement('button');
startButton.textContent = "🎤 Start Voice Commands";
startButton.style.position = 'fixed';
startButton.style.zIndex = 9999;
startButton.style.padding = '10px';
startButton.style.fontSize = '16px';
startButton.style.cursor = 'move';
startButton.style.backgroundColor = '#6200ea';
startButton.style.color = 'white';
startButton.style.border = 'none';
startButton.style.borderRadius = '8px';
startButton.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
document.body.appendChild(startButton);

// 🧠 Load saved position
const savedX = localStorage.getItem('voice_button_x');
const savedY = localStorage.getItem('voice_button_y');
if (savedX && savedY) {
  startButton.style.left = savedX + 'px';
  startButton.style.top = savedY + 'px';
} else {
  startButton.style.top = '10px';
  startButton.style.right = '10px';
}

// 🖱️ Make the button draggable
let isDragging = false;
let offsetX, offsetY;

startButton.addEventListener('mousedown', (e) => {
  isDragging = true;
  offsetX = e.clientX - startButton.getBoundingClientRect().left;
  offsetY = e.clientY - startButton.getBoundingClientRect().top;
  startButton.style.transition = 'none';
  e.preventDefault(); // prevent text selection
});

document.addEventListener('mousemove', (e) => {
  if (isDragging) {
    const x = e.clientX - offsetX;
    const y = e.clientY - offsetY;
    startButton.style.left = `${x}px`;
    startButton.style.top = `${y}px`;
    startButton.style.right = 'auto';

    // Save position in localStorage
    localStorage.setItem('voice_button_x', x);
    localStorage.setItem('voice_button_y', y);
  }
});

document.addEventListener('mouseup', () => {
  isDragging = false;
  startButton.style.transition = '';
});

// 🎙️ Speech Recognition Setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();

recognition.continuous = true;
recognition.interimResults = true; // ✅ for fast reaction
recognition.lang = 'en-US';

let lastCommand = "";

startButton.onclick = () => {
  recognition.start();
  console.log("Voice recognition started");
};

recognition.onresult = (event) => {
  const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
  console.log("Heard:", transcript);

  if (transcript === lastCommand) return;
  lastCommand = transcript;

  if (transcript.includes("next tab")) {
    chrome.runtime.sendMessage({ command: "next_tab" });
  } else if (transcript.includes("close youtube")) {
    chrome.runtime.sendMessage({ command: "close_youtube" });
  }
};
recognition.onstart = () => {
  console.log("🎤 Voice recognition has started listening.");
  startButton.textContent = "🎤 Listening...";
};
recognition.onerror = (e) => {
  console.error("Speech recognition error:", e);
};

recognition.onend = () => {
  console.log("🛑 Voice recognition restarted.");
  startButton.textContent = "🎤 Start Voice Commands";
  recognition.start(); // keep listening
};
