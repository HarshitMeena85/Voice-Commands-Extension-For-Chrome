// Handle OAuth callback on Twitter/X pages
(function() {
  'use strict';
  
  // Check if we're on an OAuth callback page
  if (window.location.href.includes('oauth/callback')) {
    console.log('OAuth callback detected');
    
    const urlParams = new URLSearchParams(window.location.search);
    const oauthToken = urlParams.get('oauth_token');
    const oauthVerifier = urlParams.get('oauth_verifier');
    const denied = urlParams.get('denied');
    
    if (denied) {
      // User denied authorization
      console.log('OAuth authorization denied');
      chrome.runtime.sendMessage({
        action: 'authDenied',
        denied: denied
      });
      
      // Show user-friendly message
      document.body.innerHTML = `
        <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h2>Authorization Cancelled</h2>
          <p>You can close this tab and try again from the extension.</p>
          <button onclick="window.close()" style="padding: 10px 20px; background: #1da1f2; color: white; border: none; border-radius: 5px; cursor: pointer;">Close Tab</button>
        </div>
      `;
      
    } else if (oauthToken && oauthVerifier) {
      // Successful authorization
      console.log('OAuth tokens received, completing authentication...');
      
      // Show loading message
      document.body.innerHTML = `
        <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h2>Completing Authentication...</h2>
          <p>Please wait while we finish setting up your account.</p>
          <div style="margin: 20px;">
            <div style="border: 4px solid #f3f3f3; border-top: 4px solid #1da1f2; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
          </div>
          <style>
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
        </div>
      `;
      
      // Send tokens to background script
      chrome.runtime.sendMessage({
        action: 'completeAuth',
        token: oauthToken,
        verifier: oauthVerifier
      }, (response) => {
        if (response && response.success) {
          // Success message
          document.body.innerHTML = `
            <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2 style="color: #1da1f2;">✓ Authentication Successful!</h2>
              <p>Account <strong>@${response.user.username}</strong> has been added successfully.</p>
              <p>You can now close this tab and use the extension.</p>
              <button onclick="window.close()" style="padding: 10px 20px; background: #1da1f2; color: white; border: none; border-radius: 5px; cursor: pointer; margin-top: 20px;">Close Tab</button>
            </div>
          `;
          
          // Auto-close after 3 seconds
          setTimeout(() => {
            window.close();
          }, 3000);
          
        } else {
          // Error message
          document.body.innerHTML = `
            <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2 style="color: #e0245e;">Authentication Failed</h2>
              <p>Error: ${response ? response.error : 'Unknown error occurred'}</p>
              <p>Please try again from the extension.</p>
              <button onclick="window.close()" style="padding: 10px 20px; background: #e0245e; color: white; border: none; border-radius: 5px; cursor: pointer;">Close Tab</button>
            </div>
          `;
        }
      });
      
    } else {
      // Invalid callback
      console.log('Invalid OAuth callback parameters');
      document.body.innerHTML = `
        <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h2 style="color: #e0245e;">Invalid Callback</h2>
          <p>The authentication callback is missing required parameters.</p>
          <button onclick="window.close()" style="padding: 10px 20px; background: #657786; color: white; border: none; border-radius: 5px; cursor: pointer;">Close Tab</button>
        </div>
      `;
    }
  }
})();
