// DOM elements
const authBtn = document.getElementById('authBtn');
const authStatus = document.getElementById('authStatus');
const userList = document.getElementById('userList');
const feedContainer = document.getElementById('feedContainer');

// State management
let currentUsers = [];
let currentFeedUser = null;
let isLoading = false;

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  console.log('X Feed Viewer popup loaded');
  loadUsers();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  authBtn.addEventListener('click', handleAuth);
}

// Handle authentication
async function handleAuth() {
  if (isLoading) return;
  
  setLoading(true);
  showStatus('Starting authentication...', 'info');
  
  try {
    const response = await chrome.runtime.sendMessage({ action: 'startAuth' });
    
    if (response.success) {
      showStatus('Redirecting to X for authorization...', 'success');
      // The background script will open a new tab
    } else {
      showStatus(`Authentication failed: ${response.error}`, 'error');
    }
  } catch (error) {
    console.error('Auth error:', error);
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

// Load users from storage
async function loadUsers() {
  try {
    const data = await chrome.storage.local.get(['users']);
    currentUsers = data.users || [];
    renderUsers();
  } catch (error) {
    console.error('Error loading users:', error);
    showStatus('Error loading accounts', 'error');
  }
}

// Render users list - CSP compliant version
function renderUsers() {
  if (currentUsers.length === 0) {
    userList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👤</div>
        <p>No accounts connected yet</p>
        <p style="font-size: 12px; margin-top: 5px;">Click "Connect X Account" to get started</p>
      </div>
    `;
    return;
  }
  
  userList.innerHTML = '';
  
  currentUsers.forEach(user => {
    const userItem = document.createElement('div');
    userItem.className = 'user-item';
    
    // Create user info section
    const userInfo = document.createElement('div');
    userInfo.className = 'user-info';
    
    const userName = document.createElement('div');
    userName.className = 'user-name';
    
    const statusIndicator = document.createElement('span');
    statusIndicator.className = 'status-indicator status-online';
    
    const nameText = document.createTextNode(user.username || 'Unknown User');
    userName.appendChild(statusIndicator);
    userName.appendChild(nameText);
    
    const userHandle = document.createElement('div');
    userHandle.className = 'user-handle';
    userHandle.textContent = `@${user.username || user.id}`;
    
    userInfo.appendChild(userName);
    userInfo.appendChild(userHandle);
    
    // Create actions section
    const userActions = document.createElement('div');
    userActions.className = 'user-actions';
    
    // View Profile button (changed from View Feed)
    const viewBtn = document.createElement('button');
    viewBtn.className = 'btn btn-small';
    viewBtn.innerHTML = '👤 View Profile';
    viewBtn.addEventListener('click', () => viewProfile(user.id));
    
    // Verify button
    const verifyBtn = document.createElement('button');
    verifyBtn.className = 'btn btn-small';
    verifyBtn.innerHTML = '✓ Verify';
    verifyBtn.addEventListener('click', () => verifyUser(user.id));
    
    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn-small btn-danger';
    removeBtn.innerHTML = '🗑️ Remove';
    removeBtn.addEventListener('click', () => removeUser(user.id));
    
    // Append buttons to actions
    userActions.appendChild(viewBtn);
    userActions.appendChild(verifyBtn);
    userActions.appendChild(removeBtn);
    
    // Append sections to user item
    userItem.appendChild(userInfo);
    userItem.appendChild(userActions);
    
    // Append user item to list
    userList.appendChild(userItem);
  });
}

// View user profile (replaces viewFeed function)
async function viewProfile(userId) {
  if (isLoading) return;
  
  setLoading(true);
  currentFeedUser = userId;
  
  const user = currentUsers.find(u => u.id === userId);
  const username = user ? user.username : userId;
  
  feedContainer.innerHTML = `
    <div class="loading">
      <div class="loading-spinner"></div>
      Loading @${username}'s profile...
    </div>
  `;
  
  try {
    console.log('Requesting user profile for:', userId);
    const response = await chrome.runtime.sendMessage({
      action: 'getCurrentUser',
      userId: userId
    });
    
    console.log('User profile response:', response);
    
    if (response && response.success) {
      displayUserProfile(response.user, username);
    } else {
      console.error('Profile error:', response ? response.error : 'No response');
      feedContainer.innerHTML = `
        <div class="error">
          <strong>Failed to load profile</strong><br>
          Error: ${response ? response.error : 'No response from background script'}<br>
          <small>This may be due to Twitter API limitations with Free tier access</small>
        </div>
      `;
    }
  } catch (error) {
    console.error('Profile request failed:', error);
    feedContainer.innerHTML = `
      <div class="error">
        <strong>Request failed</strong><br>
        ${error.message}<br>
        <small>Check browser console for more details</small>
      </div>
    `;
  } finally {
    setLoading(false);
  }
}

// Display user profile information
function displayUserProfile(userInfo, username) {
  if (!userInfo || !userInfo.data) {
    feedContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">❌</div>
        <p>No profile data available for @${username}</p>
        <p style="font-size: 12px; margin-top: 5px; color: #657786;">This may be due to API access limitations</p>
      </div>
    `;
    return;
  }
  
  const userData = userInfo.data;
  
  feedContainer.innerHTML = '';
  
  // Create profile container
  const profileContainer = document.createElement('div');
  profileContainer.className = 'user-profile';
  profileContainer.style.cssText = `
    padding: 20px;
    background: #f7f9fa;
    border-radius: 12px;
    margin-bottom: 15px;
  `;
  
  // Profile header
  const profileHeader = document.createElement('div');
  profileHeader.style.cssText = `
    text-align: center;
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid #e1e8ed;
  `;
  
  const profileTitle = document.createElement('h3');
  profileTitle.textContent = 'User Profile';
  profileTitle.style.cssText = `
    color: #1da1f2;
    margin-bottom: 10px;
    font-size: 18px;
  `;
  
  profileHeader.appendChild(profileTitle);
  profileContainer.appendChild(profileHeader);
  
  // Profile details
  const profileDetails = [
    { label: 'Name', value: userData.name || 'N/A', icon: '👤' },
    { label: 'Username', value: `@${userData.username || username}`, icon: '🔗' },
    { label: 'User ID', value: userData.id || 'N/A', icon: '🆔' },
    { label: 'Verified', value: userData.verified ? 'Yes ✅' : 'No', icon: '✓' },
    { label: 'Account Created', value: userData.created_at ? new Date(userData.created_at).toLocaleDateString() : 'N/A', icon: '📅' }
  ];
  
  // Add metrics if available
  if (userData.public_metrics) {
    profileDetails.push(
      { label: 'Followers', value: userData.public_metrics.followers_count?.toLocaleString() || 'N/A', icon: '👥' },
      { label: 'Following', value: userData.public_metrics.following_count?.toLocaleString() || 'N/A', icon: '➡️' },
      { label: 'Tweets', value: userData.public_metrics.tweet_count?.toLocaleString() || 'N/A', icon: '🐦' },
      { label: 'Listed', value: userData.public_metrics.listed_count?.toLocaleString() || 'N/A', icon: '📋' }
    );
  }
  
  profileDetails.forEach(detail => {
    const detailRow = document.createElement('div');
    detailRow.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #e1e8ed;
    `;
    
    const detailLabel = document.createElement('span');
    detailLabel.style.cssText = `
      font-weight: bold;
      color: #14171a;
    `;
    detailLabel.innerHTML = `${detail.icon} ${detail.label}:`;
    
    const detailValue = document.createElement('span');
    detailValue.style.cssText = `
      color: #657786;
      font-family: monospace;
    `;
    detailValue.textContent = detail.value;
    
    detailRow.appendChild(detailLabel);
    detailRow.appendChild(detailValue);
    profileContainer.appendChild(detailRow);
  });
  
  // Add description if available
  if (userData.description) {
    const descriptionContainer = document.createElement('div');
    descriptionContainer.style.cssText = `
      margin-top: 15px;
      padding: 15px;
      background: #ffffff;
      border-radius: 8px;
      border: 1px solid #e1e8ed;
    `;
    
    const descriptionLabel = document.createElement('h4');
    descriptionLabel.textContent = '📝 Bio:';
    descriptionLabel.style.cssText = `
      margin-bottom: 8px;
      color: #14171a;
    `;
    
    const descriptionText = document.createElement('p');
    descriptionText.textContent = userData.description;
    descriptionText.style.cssText = `
      line-height: 1.4;
      color: #14171a;
      margin: 0;
    `;
    
    descriptionContainer.appendChild(descriptionLabel);
    descriptionContainer.appendChild(descriptionText);
    profileContainer.appendChild(descriptionContainer);
  }
  
  // Add note about limitations
  const limitationNote = document.createElement('div');
  limitationNote.style.cssText = `
    margin-top: 15px;
    padding: 10px;
    background: #fff3cd;
    border: 1px solid #ffeaa7;
    border-radius: 6px;
    font-size: 12px;
    color: #856404;
  `;
  limitationNote.innerHTML = `
    <strong>ℹ️ Note:</strong> Due to Twitter's Free tier limitations, only basic profile information is available. 
    Timeline access requires a paid subscription ($100/month).
  `;
  
  profileContainer.appendChild(limitationNote);
  feedContainer.appendChild(profileContainer);
}

// Verify user credentials
async function verifyUser(userId) {
  if (isLoading) return;
  
  const user = currentUsers.find(u => u.id === userId);
  const username = user ? user.username : userId;
  
  showStatus(`Verifying @${username}...`, 'info');
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'verifyCredentials',
      userId: userId
    });
    
    if (response && response.success) {
      showStatus(`✓ @${username} verified successfully`, 'success');
    } else {
      showStatus(`✗ Verification failed for @${username}: ${response ? response.error : 'No response'}`, 'error');
    }
  } catch (error) {
    console.error('Verification error:', error);
    showStatus(`Error verifying @${username}`, 'error');
  }
}

// Remove user
async function removeUser(userId) {
  const user = currentUsers.find(u => u.id === userId);
  const username = user ? user.username : userId;
  
  if (!confirm(`Remove @${username} from the extension?`)) {
    return;
  }
  
  try {
    const updatedUsers = currentUsers.filter(u => u.id !== userId);
    await chrome.storage.local.set({ users: updatedUsers });
    
    currentUsers = updatedUsers;
    renderUsers();
    
    // Clear feed if it was showing this user
    if (currentFeedUser === userId) {
      feedContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">👤</div>
          <p>Select an account to view their profile</p>
        </div>
      `;
      currentFeedUser = null;
    }
    
    showStatus(`@${username} removed successfully`, 'success');
  } catch (error) {
    console.error('Remove user error:', error);
    showStatus(`Error removing @${username}`, 'error');
  }
}

// Utility functions
function setLoading(loading) {
  isLoading = loading;
  authBtn.disabled = loading;
  
  if (loading) {
    authBtn.innerHTML = `
      <div style="width: 16px; height: 16px; border: 2px solid #ffffff; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      Connecting...
    `;
  } else {
    authBtn.innerHTML = `
      <span>🔐</span>
      Connect X Account
    `;
  }
}

function showStatus(message, type = 'info') {
  const className = type === 'error' ? 'error' : type === 'success' ? 'success' : 'info';
  authStatus.innerHTML = `<div class="${className}">${escapeHtml(message)}</div>`;
  
  // Auto-clear after 5 seconds
  setTimeout(() => {
    authStatus.innerHTML = '';
  }, 5000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  
  return date.toLocaleDateString();
}

// Listen for storage changes (when auth completes)
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.users) {
    loadUsers();
  }
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'authCompleted') {
    showStatus('✓ Authentication completed successfully!', 'success');
    loadUsers();
  } else if (message.action === 'authFailed') {
    showStatus(`✗ Authentication failed: ${message.error}`, 'error');
  }
});
