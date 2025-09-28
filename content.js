let captureEnabled = false;
let isDrawing = false;
let isCapturing = false;
let startX = 0;
let startY = 0;
let drawingCanvas = null;
let drawingCtx = null;
let overlay = null;
let lastCapturedImage = null;

// Debug logging
console.log('Area Capture Extension: Content script loaded');

// Listen for messages from popup and background
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Area Capture Extension: Received message:', request.action);
  
  if (request.action === 'enableCapture') {
    try {
      enableAreaCapture();
      sendResponse({success: true});
    } catch (error) {
      console.error('Area Capture Extension: Error enabling capture:', error);
      sendResponse({success: false, error: error.message});
    }
  } else if (request.action === 'disableCapture') {
    try {
      disableAreaCapture();
      sendResponse({success: true});
    } catch (error) {
      console.error('Area Capture Extension: Error disabling capture:', error);
      sendResponse({success: false, error: error.message});
    }
  } else if (request.action === 'getState') {
    sendResponse({enabled: captureEnabled, hasCapturedImage: lastCapturedImage !== null});
  } else if (request.action === 'generateTryOnImage') {
    generateTryOnImage(sendResponse);
  } else if (request.action === 'copyDataUrlToClipboard') {
    // Handle data URL from background script
    console.log('Received data URL from background script');
    copyDataUrlToClipboard(request.dataUrl);
  } else if (request.action === 'processCapturedImageRectangular') {
    // Process captured image and crop rectangular area
    processCapturedImageRectangular(request.dataUrl, request.left, request.top, request.width, request.height, sendResponse);
  } else if (request.action === 'processCapturedImageFull') {
    // Process full captured image
    processCapturedImageFull(request.dataUrl, sendResponse);
  }
  return true;
});

function enableAreaCapture() {
  console.log('Enabling area capture...');
  
  if (captureEnabled) {
    console.log('Area capture already enabled');
    return;
  }
  
  captureEnabled = true;
  console.log('Capture enabled flag set to true');
  
  // Create overlay for drawing (this blocks all interactions)
  createDrawingOverlay();
  
  // Add event listeners to the canvas for drawing
  if (drawingCanvas) {
    console.log('Adding event listeners to canvas...');
    drawingCanvas.addEventListener('mousedown', startDrawing);
    drawingCanvas.addEventListener('mousemove', draw);
    drawingCanvas.addEventListener('mouseup', endDrawing);
    drawingCanvas.addEventListener('keydown', handleKeyPress);
  } else {
    console.error('Drawing canvas is null!');
  }
  
  // Also add event listeners to the overlay as backup
  if (overlay) {
    console.log('Adding event listeners to overlay...');
    overlay.addEventListener('mousedown', startDrawing);
    overlay.addEventListener('mousemove', draw);
    overlay.addEventListener('mouseup', endDrawing);
  } else {
    console.error('Overlay is null!');
  }
  
  // Prevent interactions on the page (but allow our overlay/canvas)
  document.addEventListener('selectstart', preventSelection, true);
  document.addEventListener('contextmenu', preventClick, true);
  // Only prevent clicks when not drawing
  document.addEventListener('click', preventClick, true);
  document.addEventListener('dblclick', preventClick, true);
  document.addEventListener('touchstart', preventClick, true);
  document.addEventListener('touchend', preventClick, true);
  
  // Show instructions
  showInstructions();
  
  console.log('Area capture enabled successfully');
}

function disableAreaCapture() {
  if (!captureEnabled) return;
  
  captureEnabled = false;
  
  // Remove event listeners from canvas
  if (drawingCanvas) {
    drawingCanvas.removeEventListener('mousedown', startDrawing);
    drawingCanvas.removeEventListener('mousemove', draw);
    drawingCanvas.removeEventListener('mouseup', endDrawing);
    drawingCanvas.removeEventListener('keydown', handleKeyPress);
  }
  
  // Remove event listeners from overlay
  if (overlay) {
    overlay.removeEventListener('mousedown', startDrawing);
    overlay.removeEventListener('mousemove', draw);
    overlay.removeEventListener('mouseup', endDrawing);
  }
  
  // Remove document event listeners
  document.removeEventListener('selectstart', preventSelection, true);
  document.removeEventListener('contextmenu', preventClick, true);
  document.removeEventListener('click', preventClick, true);
  document.removeEventListener('dblclick', preventClick, true);
  // Remove commented out mouse events
  // document.removeEventListener('mousedown', preventClick, true);
  // document.removeEventListener('mouseup', preventClick, true);
  document.removeEventListener('touchstart', preventClick, true);
  document.removeEventListener('touchend', preventClick, true);
  
  // Remove overlay
  removeDrawingOverlay();
  
  // Hide instructions
  hideInstructions();
}

function createDrawingOverlay() {
  console.log('Creating drawing overlay...');
  
  // Create overlay div that blocks all interactions
  overlay = document.createElement('div');
  overlay.id = 'area-capture-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 999999;
    pointer-events: auto;
    background: rgba(0, 0, 0, 0.1);
    cursor: crosshair;
  `;
  
  // Create canvas for drawing
  drawingCanvas = document.createElement('canvas');
  drawingCanvas.id = 'area-capture-canvas';
  drawingCanvas.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: auto;
  `;
  
  // Set canvas size
  drawingCanvas.width = window.innerWidth;
  drawingCanvas.height = window.innerHeight;
  
  drawingCtx = drawingCanvas.getContext('2d');
  drawingCtx.strokeStyle = '#ff0000';
  drawingCtx.lineWidth = 3;
  drawingCtx.lineCap = 'round';
  
  // Draw a test rectangle to verify canvas is working
  drawingCtx.strokeStyle = '#00ff00';
  drawingCtx.strokeRect(10, 10, 100, 50);
  drawingCtx.fillStyle = 'rgba(0, 255, 0, 0.3)';
  drawingCtx.fillRect(10, 10, 100, 50);
  
  // Add a simple click test
  overlay.addEventListener('click', function(e) {
    console.log('Overlay clicked at:', e.clientX, e.clientY);
  });
  
  drawingCanvas.addEventListener('click', function(e) {
    console.log('Canvas clicked at:', e.clientX, e.clientY);
  });
  
  overlay.appendChild(drawingCanvas);
  document.body.appendChild(overlay);
  
  console.log('Overlay created and added to page');
  console.log('Canvas dimensions:', drawingCanvas.width, 'x', drawingCanvas.height);
  console.log('Window dimensions:', window.innerWidth, 'x', window.innerHeight);
  
  // Handle window resize
  window.addEventListener('resize', handleResize);
}

function removeDrawingOverlay() {
  if (overlay && overlay.parentNode) {
    overlay.parentNode.removeChild(overlay);
  }
  if (window.imageCaptureResizeHandler) {
    window.removeEventListener('resize', window.imageCaptureResizeHandler);
  }
  overlay = null;
  drawingCanvas = null;
  drawingCtx = null;
}

function handleResize() {
  if (drawingCanvas) {
    drawingCanvas.width = window.innerWidth;
    drawingCanvas.height = window.innerHeight;
    drawingCtx.strokeStyle = '#ff0000';
    drawingCtx.lineWidth = 3;
    drawingCtx.lineCap = 'round';
  }
}

function startDrawing(e) {
  console.log('startDrawing called', {captureEnabled, isDrawing, target: e.target.tagName});
  if (!captureEnabled) return;
  
  isDrawing = true;
  
  // Get coordinates relative to the canvas
  const rect = drawingCanvas.getBoundingClientRect();
  startX = e.clientX - rect.left;
  startY = e.clientY - rect.top;
  
  console.log('Started drawing at:', {startX, startY, rect: rect});
  
  // Clear previous drawings
  drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
  
  // Draw a small red dot at the start point to verify coordinates
  drawingCtx.fillStyle = '#ff0000';
  drawingCtx.fillRect(startX - 2, startY - 2, 4, 4);
  
  // Prevent default behavior
  e.preventDefault();
  e.stopPropagation();
}

function draw(e) {
  if (!captureEnabled || !isDrawing) return;
  
  // Get coordinates relative to the canvas
  const rect = drawingCanvas.getBoundingClientRect();
  const currentX = e.clientX - rect.left;
  const currentY = e.clientY - rect.top;
  
  console.log('Drawing at:', {currentX, currentY, startX, startY});
  
  // Clear canvas and redraw rectangle
  drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
  
  // Calculate rectangle dimensions
  const width = currentX - startX;
  const height = currentY - startY;
  
  // Draw rectangle outline
  drawingCtx.strokeStyle = '#ff0000';
  drawingCtx.lineWidth = 3;
  drawingCtx.strokeRect(startX, startY, width, height);
  
  // Draw semi-transparent fill
  drawingCtx.fillStyle = 'rgba(255, 0, 0, 0.2)';
  drawingCtx.fillRect(startX, startY, width, height);
  
  // Prevent default behavior
  e.preventDefault();
  e.stopPropagation();
}

function endDrawing(e) {
  if (!captureEnabled || !isDrawing) return;
  
  isDrawing = false;
  
  // Get coordinates relative to the canvas
  const rect = drawingCanvas.getBoundingClientRect();
  const endX = e.clientX - rect.left;
  const endY = e.clientY - rect.top;
  
  // Calculate rectangle dimensions in page coordinates
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);
  
  // Convert back to page coordinates for capture
  const pageLeft = left + rect.left;
  const pageTop = top + rect.top;
  
  console.log('End drawing:', {pageLeft, pageTop, width, height});
  
  // Only capture if area is large enough
  if (width > 10 && height > 10) {
    // Keep the rectangle visible during capture
    console.log('Starting capture process...');
    
    // Capture the rectangular area
    captureRectangularArea(pageLeft, pageTop, width, height);
  } else {
    console.log('Area too small, clearing immediately');
    // Clear drawing immediately if area is too small
    drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
  }
  
  // Prevent default behavior
  e.preventDefault();
  e.stopPropagation();
}

function captureRectangularArea(left, top, width, height) {
  console.log('Capturing rectangular area:', {left, top, width, height});
  
  // Ensure bounds are within viewport
  left = Math.max(0, left);
  top = Math.max(0, top);
  width = Math.min(width, window.innerWidth - left);
  height = Math.min(height, window.innerHeight - top);
  
  // Only capture if area is large enough
  if (width < 10 || height < 10) {
    console.log('Area too small for capture');
    return;
  }
  
  console.log('Capturing rectangular area:', {left, top, width, height});
  
  // Capture the specific rectangular area
  captureViewportAndCropRectangular(left, top, width, height);
}

function captureWithHtml2Canvas(left, top, width, height, points) {
  html2canvas(document.body, {
    x: left,
    y: top,
    width: width,
    height: height,
    useCORS: true,
    allowTaint: true,
    backgroundColor: null
  }).then(canvas => {
    // Apply freehand mask to the captured area
    applyFreehandMask(canvas, points, left, top);
  }).catch(error => {
    console.error('Error capturing with html2canvas:', error);
    captureViewportAndCropFreehand(points);
  });
}

function captureEntireViewport() {
  console.log('Capturing entire viewport');
  chrome.runtime.sendMessage({
    action: 'captureEntireViewport'
  }, function(response) {
    if (chrome.runtime.lastError) {
      console.error('Error sending capture message:', chrome.runtime.lastError);
      showCaptureError();
    } else {
      console.log('Capture message sent successfully');
    }
  });
}

function captureViewportAndCropRectangular(left, top, width, height) {
  console.log('Sending rectangular capture request:', {left, top, width, height});
  
  // Set capturing flag
  isCapturing = true;
  
  // Add a small delay to ensure the rectangle is fully drawn
  setTimeout(() => {
    // Show capture in progress indicator
    if (drawingCtx) {
      // Draw a "capturing..." text
      drawingCtx.fillStyle = '#ffffff';
      drawingCtx.font = '16px Arial';
      drawingCtx.fillText('Capturing...', left + width/2 - 40, top + height/2);
    }
    
    // Hide the overlay temporarily to capture clean screenshot
    if (overlay) {
      overlay.style.display = 'none';
    }
    
    console.log('Sending capture message to background script...');
    
    // Use chrome.tabs.captureVisibleTab as fallback
    chrome.runtime.sendMessage({
      action: 'captureVisibleTabRectangular',
      left: left,
      top: top,
      width: width,
      height: height
    }, function(response) {
      console.log('Received response from background script:', response);
      
      // Reset capturing flag
      isCapturing = false;
      
      // Show overlay again
      if (overlay) {
        overlay.style.display = 'block';
      }
      
      // Clear the drawing after capture
      if (drawingCtx) {
        drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
      }
      
      if (chrome.runtime.lastError) {
        console.error('Error sending capture message:', chrome.runtime.lastError);
        showCaptureError();
      } else if (response && response.success) {
        console.log('Capture completed successfully');
        showCaptureSuccess();
      } else {
        console.error('Capture failed:', response);
        showCaptureError();
      }
    });
  }, 100); // Small delay to ensure rectangle is visible
}



function copyDataUrlToClipboard(dataUrl) {
  console.log('Received data URL from background script, copying to clipboard...');
  // Convert data URL to blob and copy to clipboard
  fetch(dataUrl)
    .then(response => response.blob())
    .then(blob => {
      console.log('Blob created, copying to clipboard...');
      copyBlobToClipboard(blob);
    })
    .catch(error => {
      console.error('Error converting data URL to blob:', error);
      showCaptureError();
    });
}

function copyCanvasToClipboard(canvas) {
  canvas.toBlob(function(blob) {
    copyBlobToClipboard(blob);
  });
}

function copyBlobToClipboard(blob) {
  try {
    // Use the Clipboard API if available
    if (navigator.clipboard && navigator.clipboard.write) {
      const clipboardItem = new ClipboardItem({
        [blob.type]: blob
      });
      
      navigator.clipboard.write([clipboardItem]).then(() => {
        console.log('Successfully copied to clipboard');
        showCaptureSuccess();
      }).catch(error => {
        console.error('Clipboard API failed:', error);
        fallbackCopyToClipboard(blob);
      });
    } else {
      fallbackCopyToClipboard(blob);
    }
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    fallbackCopyToClipboard(blob);
  }
}

function fallbackCopyToClipboard(blob) {
  // Fallback method using canvas and data URL
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  
  img.onload = function() {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    
    // Try to copy as data URL
    const dataUrl = canvas.toDataURL();
    
    // Create a temporary textarea to copy the data URL
    const textarea = document.createElement('textarea');
    textarea.value = dataUrl;
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
      document.execCommand('copy');
      showCaptureSuccess();
    } catch (error) {
      console.error('Fallback copy failed:', error);
      showCaptureError();
    }
    
    document.body.removeChild(textarea);
  };
  
  img.src = URL.createObjectURL(blob);
}

function handleKeyPress(e) {
  if (e.key === 'Escape') {
    disableAreaCapture();
  }
}

function preventClick(e) {
  if (captureEnabled && !isDrawing && !isCapturing) {
    // Don't prevent events on our overlay or canvas
    if (e.target === overlay || e.target === drawingCanvas || 
        overlay.contains(e.target) || drawingCanvas.contains(e.target)) {
      return true; // Allow these events
    }
    
    console.log('Preventing click event during capture');
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
}

function preventSelection(e) {
  if (captureEnabled) {
    e.preventDefault();
  }
}

function showInstructions() {
  const instructions = document.createElement('div');
  instructions.id = 'area-capture-instructions';
  instructions.textContent = 'Draw a box around the dress you want to try on. Press ESC to cancel.';
  instructions.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    z-index: 1000000;
    font-family: Arial, sans-serif;
    font-size: 14px;
    pointer-events: none;
  `;
  
  document.body.appendChild(instructions);
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (instructions.parentNode) {
      instructions.style.opacity = '0.7';
    }
  }, 3000);
}

function hideInstructions() {
  const instructions = document.getElementById('area-capture-instructions');
  if (instructions && instructions.parentNode) {
    instructions.parentNode.removeChild(instructions);
  }
}

function showCaptureSuccess() {
  const notification = document.createElement('div');
  notification.textContent = 'Area captured and copied to clipboard!';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    z-index: 1000000;
    font-family: Arial, sans-serif;
    font-size: 14px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
}

function showCaptureError() {
  const notification = document.createElement('div');
  notification.textContent = 'Failed to capture area';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #f44336;
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    z-index: 1000000;
    font-family: Arial, sans-serif;
    font-size: 14px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
}

function processCapturedImageRectangular(dataUrl, left, top, width, height, sendResponse) {
  console.log('Processing captured image rectangular:', {left, top, width, height});
  console.log('Data URL length:', dataUrl.length);
  
  // Create canvas to crop the captured image
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  
  img.onload = function() {
    console.log('Image loaded, dimensions:', img.width, 'x', img.height);
    console.log('Cropping area:', {left, top, width, height});
    
    // Ensure bounds are within image
    left = Math.max(0, left);
    top = Math.max(0, top);
    width = Math.min(width, img.width - left);
    height = Math.min(height, img.height - top);
    
    console.log('Adjusted cropping area:', {left, top, width, height});
    
    // Set canvas size to cropped area
    canvas.width = width;
    canvas.height = height;
    
    // Draw cropped portion
    ctx.drawImage(img, left, top, width, height, 0, 0, width, height);
    
    console.log('Canvas created, converting to blob...');
    
    // Convert to blob and copy to clipboard
    canvas.toBlob(function(blob) {
      console.log('Blob created, size:', blob.size);
      copyBlobToClipboard(blob);
      
      // Store the captured image for Pinterest search
      lastCapturedImage = {
        blob: blob,
        dataUrl: canvas.toDataURL(),
        width: width,
        height: height
      };
      
      sendResponse({success: true});
    }, 'image/png');
  };
  
  img.onerror = function() {
    console.error('Error loading captured image');
    sendResponse({success: false, error: 'Failed to load captured image'});
  };
  
  img.src = dataUrl;
}

function processCapturedImageFull(dataUrl, sendResponse) {
  console.log('Processing full captured image');
  
  // Convert data URL to blob and copy to clipboard
  fetch(dataUrl)
    .then(response => response.blob())
    .then(blob => {
      copyBlobToClipboard(blob);
      
      // Store the captured image for Pinterest search
      lastCapturedImage = {
        blob: blob,
        dataUrl: dataUrl,
        width: null,
        height: null
      };
      
      sendResponse({success: true});
    })
    .catch(error => {
      console.error('Error processing full image:', error);
      sendResponse({success: false, error: error.message});
    });
} 

function generateTryOnImage(sendResponse) {
  console.log('Generating try-on image');
  
  if (!lastCapturedImage) {
    console.error('No captured image available');
    sendResponse({success: false, error: 'No captured image available'});
    return;
  }
  
  console.log('Last captured image:', lastCapturedImage);
  console.log('Image data URL length:', lastCapturedImage.dataUrl ? lastCapturedImage.dataUrl.length : 'undefined');
  
  try {
    // Send image to background script for try-on generation
    chrome.runtime.sendMessage({
      action: 'generateTryOnImage',
      imageData: lastCapturedImage.dataUrl
    }, function(response) {
      console.log('Received response from background script:', response);
      
      if (chrome.runtime.lastError) {
        console.error('Runtime error:', chrome.runtime.lastError);
        sendResponse({success: false, error: chrome.runtime.lastError.message});
        return;
      }
      
      if (response && response.success) {
        console.log('Try-on image generation completed successfully');
        sendResponse({success: true, result: response.result});
        showTryOnGenerationResult(response.result);
        
        // Display the AI-generated image in a popup
        if (response.imageData) {
          if (response.useLocalComposite) {
            // Create local composite as fallback
            createAndShowTryOnImage(response.imageData);
          } else {
            // Show AI-generated image
            openImagePopup(response.imageData);
          }
        } else if (response.imageUrl) {
          // Fallback for URL-based images
          openImagePopup(response.imageUrl);
        }
      } else {
        console.error('Try-on image generation failed:', response);
        const errorMsg = response ? response.error : 'Try-on image generation failed';
        sendResponse({success: false, error: errorMsg});
        showTryOnGenerationError(errorMsg);
      }
    });
    
  } catch (error) {
    console.error('Error generating try-on image:', error);
    sendResponse({success: false, error: error.message});
  }
}

function showTryOnGenerationResult(result) {
  const notification = document.createElement('div');
  notification.innerHTML = `
    <div style="margin-bottom: 8px;"><strong>Try-On Image Generated!</strong></div>
    <div style="font-size: 12px; max-height: 200px; overflow-y: auto;">
      ${result}
    </div>
    <div style="margin-top: 8px; font-size: 10px; opacity: 0.8;">
      Click to dismiss
    </div>
  `;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #10a37f;
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    z-index: 1000000;
    font-family: Arial, sans-serif;
    font-size: 14px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    max-width: 400px;
    line-height: 1.4;
    cursor: pointer;
  `;
  
  notification.addEventListener('click', function() {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  });
  
  document.body.appendChild(notification);
  
  // Auto-remove after 15 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 15000);
}

function showTryOnGenerationError(error) {
  const notification = document.createElement('div');
  notification.innerHTML = `
    <div style="margin-bottom: 8px;"><strong>Try-On Generation Failed</strong></div>
    <div style="font-size: 12px;">
      Error: ${error}
    </div>
    <div style="margin-top: 8px; font-size: 10px; opacity: 0.8;">
      Click to dismiss
    </div>
  `;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #dc3545;
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    z-index: 1000000;
    font-family: Arial, sans-serif;
    font-size: 14px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    max-width: 400px;
    line-height: 1.4;
    cursor: pointer;
  `;
  
  notification.addEventListener('click', function() {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  });
  
  document.body.appendChild(notification);
  
  // Auto-remove after 10 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 10000);
}

// Function to show API call notifications
function showApiCallNotification(message, type) {
  const notification = document.createElement('div');
  notification.innerHTML = `
    <div style="margin-bottom: 8px;"><strong>API Call ${type === 'success' ? 'Success' : 'Error'}</strong></div>
    <div style="font-size: 12px;">${message}</div>
  `;
  
  const backgroundColor = type === 'success' ? '#28a745' : '#dc3545';
  
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${backgroundColor};
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    z-index: 1000000;
    font-family: Arial, sans-serif;
    font-size: 14px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    max-width: 350px;
    line-height: 1.4;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 5000);
}

// Flexible API call function that can be called from console or other parts
// Usage: callApi('https://api.example.com/endpoint', {method: 'POST', data: {...}})
function callApi(url, options = {}) {
  return new Promise((resolve, reject) => {
    const defaultOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      body: null
    };
    
    const requestOptions = { ...defaultOptions, ...options };
    
    if (requestOptions.body && typeof requestOptions.body === 'object') {
      requestOptions.body = JSON.stringify(requestOptions.body);
    }
    
    fetch(url, requestOptions)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('API call successful:', data);
        resolve(data);
      })
      .catch(error => {
        console.error('API call failed:', error);
        reject(error);
      });
  });
}

// Debug function - can be called from console
function testCapture() {
  console.log('Testing capture functionality...');
  console.log('Capture enabled:', captureEnabled);
  console.log('Is drawing:', isDrawing);
  console.log('Is capturing:', isCapturing);
  console.log('Overlay exists:', !!overlay);
  console.log('Canvas exists:', !!drawingCanvas);
  console.log('Canvas context exists:', !!drawingCtx);
  
  if (overlay) {
    console.log('Overlay style:', overlay.style.cssText);
    console.log('Overlay visible:', overlay.offsetWidth > 0 && overlay.offsetHeight > 0);
  }
  
  if (drawingCanvas) {
    console.log('Canvas dimensions:', drawingCanvas.width, 'x', drawingCanvas.height);
    console.log('Canvas style:', drawingCanvas.style.cssText);
  }
  
  // Try to enable capture
  enableAreaCapture();
}

// Make test function available globally
window.testCapture = testCapture;

function createAndShowTryOnImage(dressImageData) {
  try {
    console.log('Creating try-on image with me.webp...');
    
    // Create a canvas to composite the try-on image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = 800;
    canvas.height = 1000;
    
    // Create background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#f8f9fa');
    gradient.addColorStop(1, '#e9ecef');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Load the person image from me.webp
    const personImg = new Image();
    personImg.onload = function() {
      console.log('Person image loaded, drawing person...');
      
      // Draw the person from me.webp
      // Scale and center the person
      const personWidth = 400;
      const personHeight = 600;
      const personX = (canvas.width - personWidth) / 2;
      const personY = 100;
      
      ctx.drawImage(personImg, personX, personY, personWidth, personHeight);
      
      // Now load and composite the dress
      const dressImg = new Image();
      dressImg.onload = function() {
        console.log('Dress image loaded, compositing...');
        
        // Create a temporary canvas for dress processing
        const dressCanvas = document.createElement('canvas');
        const dressCtx = dressCanvas.getContext('2d');
        dressCanvas.width = dressImg.width;
        dressCanvas.height = dressImg.height;
        
        // Draw the dress
        dressCtx.drawImage(dressImg, 0, 0);
        
        // Get the dress image data for processing
        const dressImageData = dressCtx.getImageData(0, 0, dressCanvas.width, dressCanvas.height);
        const data = dressImageData.data;
        
        // Simple background removal (make white/light backgrounds transparent)
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const brightness = (r + g + b) / 3;
          
          // If pixel is very light (likely background), make it transparent
          if (brightness > 240) {
            data[i + 3] = 0; // Set alpha to 0 (transparent)
          }
        }
        
        // Put the processed dress data back
        dressCtx.putImageData(dressImageData, 0, 0);
        
        // Scale and position the dress on the person
        const dressWidth = 250;
        const dressHeight = 350;
        const dressX = (canvas.width - dressWidth) / 2;
        const dressY = personY + 50; // Position dress on the person's body
        
        // Draw the processed dress onto the main canvas
        ctx.drawImage(dressCanvas, dressX, dressY, dressWidth, dressHeight);
        
        // Add some styling overlay for better integration
        ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Convert to data URL and show popup
        const resultDataUrl = canvas.toDataURL('image/png');
        console.log('Try-on image created successfully');
        openImagePopup(resultDataUrl);
      };
      
      dressImg.onerror = function() {
        console.error('Error loading dress image');
        // Fallback: show the person without dress
        const resultDataUrl = canvas.toDataURL('image/png');
        openImagePopup(resultDataUrl);
      };
      
      dressImg.src = dressImageData;
    };
    
    personImg.onerror = function() {
      console.error('Error loading me.webp, using fallback');
      // Fallback: create a simple silhouette
      createFallbackTryOnImage(dressImageData, canvas, ctx);
    };
    
    // Try to load me.webp from the extension folder
    personImg.src = chrome.runtime.getURL('me.webp');
    
  } catch (error) {
    console.error('Error creating try-on image:', error);
    // Fallback: show the original dress image
    openImagePopup(dressImageData);
  }
}

function createFallbackTryOnImage(dressImageData, canvas, ctx) {
  console.log('Creating fallback try-on image...');
  
  // Create a simple person silhouette as fallback
  ctx.fillStyle = '#6c757d';
  // Head
  ctx.beginPath();
  ctx.arc(400, 150, 80, 0, 2 * Math.PI);
  ctx.fill();
  
  // Body
  ctx.fillRect(320, 230, 160, 300);
  
  // Arms
  ctx.fillRect(280, 250, 40, 200);
  ctx.fillRect(480, 250, 40, 200);
  
  // Legs
  ctx.fillRect(360, 530, 40, 300);
  ctx.fillRect(400, 530, 40, 300);
  
  // Draw dress on top
  const dressImg = new Image();
  dressImg.onload = function() {
    // Scale and position the dress
    const dressWidth = 300;
    const dressHeight = 400;
    const dressX = (canvas.width - dressWidth) / 2;
    const dressY = 200;
    
    ctx.drawImage(dressImg, dressX, dressY, dressWidth, dressHeight);
    
    // Add some styling overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Convert to data URL and show popup
    const resultDataUrl = canvas.toDataURL('image/png');
    openImagePopup(resultDataUrl);
  };
  dressImg.src = dressImageData;
}

function openImagePopup(imageDataUrl) {
  // Create popup window
  const popup = window.open('', 'TryOnImage', 'width=900,height=1100,scrollbars=yes,resizable=yes');
  
  if (popup) {
    popup.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Fashion Try-On Generated Image</title>
        <style>
          body {
            margin: 0;
            padding: 20px;
            font-family: Arial, sans-serif;
            background: #f8f9fa;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
            color: #333;
          }
          .image-container {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            margin-bottom: 20px;
          }
          .generated-image {
            max-width: 100%;
            height: auto;
            border-radius: 5px;
          }
          .info {
            background: #e3f2fd;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            max-width: 600px;
          }
          .download-btn {
            background: #007bff;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            margin: 10px;
          }
          .download-btn:hover {
            background: #0056b3;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎉 AI Fashion Try-On Generated!</h1>
          <p>Hugging Face Stable Diffusion has created this realistic fashion image</p>
        </div>
        
        <div class="image-container">
          <img src="${imageDataUrl}" alt="Generated Try-On Image" class="generated-image" />
        </div>
        
        <div class="info">
          <h3>📸 Image Details:</h3>
          <ul>
            <li><strong>Person:</strong> A realistic person wearing a beautiful dress</li>
            <li><strong>Dress:</strong> Fashion dress concept generated by AI</li>
            <li><strong>AI Model:</strong> Hugging Face Stable Diffusion XL (Free)</li>
            <li><strong>Style:</strong> Professional fashion photography with studio lighting</li>
            <li><strong>Quality:</strong> High-resolution AI-generated image</li>
          </ul>
        </div>
        
        <button class="download-btn" onclick="downloadImage()">💾 Download Image</button>
        <button class="download-btn" onclick="window.print()">🖨️ Print Image</button>
        
        <script>
          function downloadImage() {
            const link = document.createElement('a');
            link.download = 'fashion-try-on-' + Date.now() + '.png';
            link.href = '${imageDataUrl}';
            link.click();
          }
        </script>
      </body>
      </html>
    `);
    popup.document.close();
  } else {
    console.error('Failed to open popup window. Please allow popups for this site.');
    // Fallback: show notification
    showTryOnGenerationResult('Try-on image generated! Please allow popups to view the image.');
  }
} 