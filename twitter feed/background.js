// Import CryptoJS for HMAC-SHA1 signing
importScripts('crypto-js.min.js');

// OAuth configuration - REPLACE WITH YOUR ACTUAL CREDENTIALS
const OAUTH_CONFIG = {
  consumerKey: 'aQVH5ya7KiH3K6LyBJVjadXNx',
  consumerSecret: 'DdsQWPJt7uGXkK6r4LHBax8GBvOAPTqvNMyct48M90OZb7hPw4',
  callbackUrl: 'https://x.com/oauth/callback',
  requestTokenUrl: 'https://api.twitter.com/oauth/request_token',
  accessTokenUrl: 'https://api.twitter.com/oauth/access_token',
  authorizeUrl: 'https://api.twitter.com/oauth/authorize'
};

// Generate OAuth nonce
function generateNonce() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Generate OAuth timestamp
function generateTimestamp() {
  return Math.floor(Date.now() / 1000).toString();
}

// Percent encode according to RFC 3986
function percentEncode(str) {
  return encodeURIComponent(str)
    .replace(/[!'()*]/g, function(c) {
      return '%' + c.charCodeAt(0).toString(16).toUpperCase();
    });
}

// Generate OAuth signature using HMAC-SHA1
function generateOAuthSignature(method, url, params, consumerSecret, tokenSecret = '') {
  // Create parameter string
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join('&');
  
  // Create signature base string
  const baseString = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(sortedParams)
  ].join('&');
  
  // Create signing key
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  
  // Generate HMAC-SHA1 signature
  const signature = CryptoJS.HmacSHA1(baseString, signingKey);
  
  // Return base64 encoded signature
  return signature.toString(CryptoJS.enc.Base64);
}

// Generate OAuth authorization header
function generateOAuthHeader(method, url, params, consumerSecret, tokenSecret = '') {
  const signature = generateOAuthSignature(method, url, params, consumerSecret, tokenSecret);
  
  // Add signature to params
  const allParams = { ...params, oauth_signature: signature };
  
  // Create authorization header
  const headerParams = Object.keys(allParams)
    .filter(key => key.startsWith('oauth_'))
    .sort()
    .map(key => `${key}="${percentEncode(allParams[key])}"`)
    .join(', ');
  
  return `OAuth ${headerParams}`;
}

// Step 1: Get request token
async function getRequestToken() {
  const oauthParams = {
    oauth_callback: OAUTH_CONFIG.callbackUrl,
    oauth_consumer_key: OAUTH_CONFIG.consumerKey,
    oauth_nonce: generateNonce(),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: generateTimestamp(),
    oauth_version: '1.0'
  };
  
  const authHeader = generateOAuthHeader(
    'POST',
    OAUTH_CONFIG.requestTokenUrl,
    oauthParams,
    OAUTH_CONFIG.consumerSecret
  );
  
  try {
    const response = await fetch(OAUTH_CONFIG.requestTokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const responseText = await response.text();
    const params = new URLSearchParams(responseText);
    
    const requestToken = params.get('oauth_token');
    const requestTokenSecret = params.get('oauth_token_secret');
    const callbackConfirmed = params.get('oauth_callback_confirmed');
    
    if (!requestToken || !requestTokenSecret || callbackConfirmed !== 'true') {
      throw new Error('Invalid response from Twitter API');
    }
    
    return { requestToken, requestTokenSecret };
    
  } catch (error) {
    console.error('Request token error:', error);
    throw error;
  }
}

// Step 2: Start OAuth authentication flow
async function startOAuth() {
  try {
    const { requestToken, requestTokenSecret } = await getRequestToken();
    
    // Store request token data
    await chrome.storage.local.set({
      requestToken,
      requestTokenSecret,
      oauthInProgress: true
    });
    
    // Redirect user to authorization page
    const authUrl = `${OAUTH_CONFIG.authorizeUrl}?oauth_token=${requestToken}`;
    chrome.tabs.create({ url: authUrl });
    
    return { success: true };
    
  } catch (error) {
    console.error('OAuth start error:', error);
    return { success: false, error: error.message };
  }
}

// Step 3: Complete OAuth flow with access token
async function completeOAuth(oauthToken, oauthVerifier) {
  try {
    const stored = await chrome.storage.local.get(['requestToken', 'requestTokenSecret']);
    
    if (!stored.requestToken || !stored.requestTokenSecret) {
      throw new Error('No request token found');
    }
    
    if (stored.requestToken !== oauthToken) {
      throw new Error('Token mismatch');
    }
    
    const oauthParams = {
      oauth_consumer_key: OAUTH_CONFIG.consumerKey,
      oauth_nonce: generateNonce(),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: generateTimestamp(),
      oauth_token: oauthToken,
      oauth_verifier: oauthVerifier,
      oauth_version: '1.0'
    };
    
    const authHeader = generateOAuthHeader(
      'POST',
      OAUTH_CONFIG.accessTokenUrl,
      oauthParams,
      OAUTH_CONFIG.consumerSecret,
      stored.requestTokenSecret
    );
    
    const response = await fetch(OAUTH_CONFIG.accessTokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const responseText = await response.text();
    const params = new URLSearchParams(responseText);
    
    const accessToken = params.get('oauth_token');
    const accessTokenSecret = params.get('oauth_token_secret');
    const userId = params.get('user_id');
    const screenName = params.get('screen_name');
    
    if (!accessToken || !accessTokenSecret) {
      throw new Error('Invalid access token response');
    }
    
    // Store user data
    const userData = {
      id: userId,
      username: screenName,
      accessToken,
      accessTokenSecret,
      addedAt: new Date().toISOString()
    };
    
    // Get existing users and add new one
    const existingData = await chrome.storage.local.get(['users']);
    const users = existingData.users || [];
    
    // Remove existing user with same ID if any
    const filteredUsers = users.filter(user => user.id !== userId);
    filteredUsers.push(userData);
    
    await chrome.storage.local.set({
      users: filteredUsers,
      currentUser: userData,
      oauthInProgress: false
    });
    
    // Clean up request tokens
    await chrome.storage.local.remove(['requestToken', 'requestTokenSecret']);
    
    return { success: true, user: userData };
    
  } catch (error) {
    console.error('OAuth completion error:', error);
    return { success: false, error: error.message };
  }
}

// Get current user info (only available free endpoint)
async function getCurrentUser(userId) {
  try {
    const data = await chrome.storage.local.get(['users']);
    const users = data.users || [];
    const user = users.find(u => u.id === userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    const userUrl = 'https://api.twitter.com/2/users/me';
    
    const oauthParams = {
      oauth_consumer_key: OAUTH_CONFIG.consumerKey,
      oauth_nonce: generateNonce(),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: generateTimestamp(),
      oauth_token: user.accessToken,
      oauth_version: '1.0'
    };
    
    const authHeader = generateOAuthHeader(
      'GET',
      userUrl,
      oauthParams,
      OAUTH_CONFIG.consumerSecret,
      user.accessTokenSecret
    );
    
    const response = await fetch(userUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }
    
    const userData = await response.json();
    return { success: true, user: userData };
    
  } catch (error) {
    console.error('User info error:', error);
    return { success: false, error: error.message };
  }
}


// Verify credentials
async function verifyCredentials(userId) {
  try {
    const data = await chrome.storage.local.get(['users']);
    const users = data.users || [];
    const user = users.find(u => u.id === userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    const verifyUrl = 'https://api.twitter.com/1.1/account/verify_credentials.json';
    
    const oauthParams = {
      oauth_consumer_key: OAUTH_CONFIG.consumerKey,
      oauth_nonce: generateNonce(),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: generateTimestamp(),
      oauth_token: user.accessToken,
      oauth_version: '1.0'
    };
    
    const authHeader = generateOAuthHeader(
      'GET',
      verifyUrl,
      oauthParams,
      OAUTH_CONFIG.consumerSecret,
      user.accessTokenSecret
    );
    
    const response = await fetch(verifyUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader
      }
    });
    
    if (!response.ok) {
      throw new Error(`Verification failed: ${response.status}`);
    }
    
    const userData = await response.json();
    return { success: true, user: userData };
    
  } catch (error) {
    console.error('Verification error:', error);
    return { success: false, error: error.message };
  }
}

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'startAuth':
      startOAuth().then(sendResponse);
      return true;
      
    case 'completeAuth':
      completeOAuth(request.token, request.verifier).then(sendResponse);
      return true;
      
    case 'getTimeline':
      getTimeline(request.userId).then(sendResponse);
      return true;
      
    case 'getCurrentUser':  // Add this case
      getCurrentUser(request.userId).then(sendResponse);
      return true;
      
    case 'verifyCredentials':
      verifyCredentials(request.userId).then(sendResponse);
      return true;
      
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('X Feed Viewer extension installed');
});
