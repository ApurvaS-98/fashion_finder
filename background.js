// Listen for messages from content script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'captureVisibleTab') {
    captureVisibleTabAndCrop(request.centerX, request.centerY, request.radius, sender.tab.id, sendResponse);
  } else if (request.action === 'captureVisibleTabRectangular') {
    captureVisibleTabAndCropRectangular(request.left, request.top, request.width, request.height, sender.tab.id, sendResponse);
  } else if (request.action === 'captureEntireViewport') {
    captureEntireViewport(sender.tab.id, sendResponse);
  }
  
  // Return true to indicate we will send a response asynchronously
  return true;
});

function captureVisibleTabAndCrop(centerX, centerY, radius, tabId, sendResponse) {
  chrome.tabs.captureVisibleTab(null, {format: 'png'}, function(dataUrl) {
    if (chrome.runtime.lastError) {
      console.error('Error capturing visible tab:', chrome.runtime.lastError);
      sendResponse({success: false, error: chrome.runtime.lastError.message});
      return;
    }
    
    // Send the data URL to content script for processing
    chrome.tabs.sendMessage(tabId, {
      action: 'processCapturedImage',
      dataUrl: dataUrl,
      centerX: centerX,
      centerY: centerY,
      radius: radius
    }, function(response) {
      if (chrome.runtime.lastError) {
        console.error('Error sending to content script:', chrome.runtime.lastError);
        sendResponse({success: false, error: chrome.runtime.lastError.message});
      } else {
        sendResponse(response);
      }
    });
  });
}

function captureVisibleTabAndCropRectangular(left, top, width, height, tabId, sendResponse) {
  console.log('Starting rectangular capture:', {left, top, width, height});
  chrome.tabs.captureVisibleTab(null, {format: 'png'}, function(dataUrl) {
    if (chrome.runtime.lastError) {
      console.error('Error capturing visible tab:', chrome.runtime.lastError);
      sendResponse({success: false, error: chrome.runtime.lastError.message});
      return;
    }
    
    console.log('Successfully captured visible tab, data URL length:', dataUrl.length);
    
    // Send the data URL to content script for processing
    chrome.tabs.sendMessage(tabId, {
      action: 'processCapturedImageRectangular',
      dataUrl: dataUrl,
      left: left,
      top: top,
      width: width,
      height: height
    }, function(response) {
      console.log('Received response from content script:', response);
      if (chrome.runtime.lastError) {
        console.error('Error sending to content script:', chrome.runtime.lastError);
        sendResponse({success: false, error: chrome.runtime.lastError.message});
      } else {
        sendResponse(response);
      }
    });
  });
}

function captureEntireViewport(tabId, sendResponse) {
  console.log('Capturing entire viewport');
  chrome.tabs.captureVisibleTab(null, {format: 'png'}, function(dataUrl) {
    if (chrome.runtime.lastError) {
      console.error('Error capturing visible tab:', chrome.runtime.lastError);
      sendResponse({success: false, error: chrome.runtime.lastError.message});
      return;
    }
    
    console.log('Successfully captured entire viewport');
    
    // Send the data URL to content script for processing
    chrome.tabs.sendMessage(tabId, {
      action: 'processCapturedImageFull',
      dataUrl: dataUrl
    }, function(response) {
      if (chrome.runtime.lastError) {
        console.error('Error sending to content script:', chrome.runtime.lastError);
        sendResponse({success: false, error: chrome.runtime.lastError.message});
      } else {
        sendResponse(response);
      }
    });
  });
} 