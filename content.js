let captureEnabled = false;
let isDrawing = false;
let isCapturing = false;
let startX = 0;
let startY = 0;
let drawingCanvas = null;
let drawingCtx = null;
let overlay = null;

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
    sendResponse({enabled: captureEnabled});
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
  if (captureEnabled) return;
  
  captureEnabled = true;
  
  // Create overlay for drawing (this blocks all interactions)
  createDrawingOverlay();
  
  // Add event listeners to the canvas for drawing
  drawingCanvas.addEventListener('mousedown', startDrawing);
  drawingCanvas.addEventListener('mousemove', draw);
  drawingCanvas.addEventListener('mouseup', endDrawing);
  drawingCanvas.addEventListener('keydown', handleKeyPress);
  
  // Also add event listeners to the overlay as backup
  overlay.addEventListener('mousedown', startDrawing);
  overlay.addEventListener('mousemove', draw);
  overlay.addEventListener('mouseup', endDrawing);
  
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
  instructions.textContent = 'Draw any shape around the area to capture it. Press ESC to cancel.';
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
      sendResponse({success: true});
    })
    .catch(error => {
      console.error('Error processing full image:', error);
      sendResponse({success: false, error: error.message});
    });
} 