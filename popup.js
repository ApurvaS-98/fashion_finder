document.addEventListener('DOMContentLoaded', function() {
  const toggleBtn = document.getElementById('toggleBtn');
  const statusDiv = document.getElementById('status');
  let isEnabled = false;

  // Check current state when popup opens
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (chrome.runtime.lastError) {
      console.error('Error querying tabs:', chrome.runtime.lastError);
      showStatus('Error: Cannot access current tab.', 'error');
      return;
    }
    
    if (!tabs || tabs.length === 0) {
      showStatus('Error: No active tab found.', 'error');
      return;
    }
    
    const currentTab = tabs[0];
    
    // Check if we can run content scripts on this page
    if (currentTab.url.startsWith('chrome://') || 
        currentTab.url.startsWith('chrome-extension://') || 
        currentTab.url.startsWith('moz-extension://') ||
        currentTab.url.startsWith('edge://') ||
        currentTab.url.startsWith('about:') ||
        currentTab.url.startsWith('view-source:')) {
      showStatus('Extension cannot run on this page. Try a regular website.', 'error');
      toggleBtn.disabled = true;
      return;
    }
    
    chrome.tabs.sendMessage(currentTab.id, {action: 'getState'}, function(response) {
      if (chrome.runtime.lastError) {
        console.error('Error sending message:', chrome.runtime.lastError);
        showStatus('Error: Cannot communicate with page. Try refreshing the page.', 'error');
        return;
      }
      
      if (response && response.enabled) {
        isEnabled = true;
        toggleBtn.textContent = 'Stop Area Capture';
        toggleBtn.classList.add('active');
        showStatus('Area capture is active. Draw any shape around the area to capture it.', 'info');
      }
    });
  });

  toggleBtn.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (chrome.runtime.lastError) {
        console.error('Error querying tabs:', chrome.runtime.lastError);
        showStatus('Error: Cannot access current tab.', 'error');
        return;
      }
      
      if (!tabs || tabs.length === 0) {
        showStatus('Error: No active tab found.', 'error');
        return;
      }
      
      const currentTab = tabs[0];
      
      // Check if we can run content scripts on this page
      if (currentTab.url.startsWith('chrome://') || 
          currentTab.url.startsWith('chrome-extension://') || 
          currentTab.url.startsWith('moz-extension://') ||
          currentTab.url.startsWith('edge://') ||
          currentTab.url.startsWith('about:') ||
          currentTab.url.startsWith('view-source:')) {
        showStatus('Extension cannot run on this page. Try a regular website.', 'error');
        return;
      }
      
      if (!isEnabled) {
        // Enable area capture
        chrome.tabs.sendMessage(currentTab.id, {action: 'enableCapture'}, function(response) {
          if (chrome.runtime.lastError) {
            console.error('Error sending message:', chrome.runtime.lastError);
            showStatus('Error: Cannot communicate with page. Try refreshing the page.', 'error');
            return;
          }
          
          if (response && response.success) {
            isEnabled = true;
            toggleBtn.textContent = 'Stop Area Capture';
            toggleBtn.classList.add('active');
            showStatus('Area capture enabled! Draw any shape around the area to capture it.', 'success');
            // Close popup to let user interact with the page
            window.close();
          } else {
            const errorMsg = response && response.error ? response.error : 'Unknown error';
            showStatus('Failed to enable area capture: ' + errorMsg, 'error');
          }
        });
      } else {
        // Disable area capture
        chrome.tabs.sendMessage(currentTab.id, {action: 'disableCapture'}, function(response) {
          if (chrome.runtime.lastError) {
            console.error('Error sending message:', chrome.runtime.lastError);
            showStatus('Error: Cannot communicate with page. Try refreshing the page.', 'error');
            return;
          }
          
          if (response && response.success) {
            isEnabled = false;
            toggleBtn.textContent = 'Start Area Capture';
            toggleBtn.classList.remove('active');
            showStatus('Area capture disabled.', 'info');
          } else {
            const errorMsg = response && response.error ? response.error : 'Unknown error';
            showStatus('Failed to disable area capture: ' + errorMsg, 'error');
          }
        });
      }
    });
  });

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    
    // Hide status after 5 seconds for errors
    const timeout = type === 'error' ? 5000 : 3000;
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, timeout);
  }
}); 