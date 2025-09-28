# AI Fashion Try-On Generator

A Chrome extension that allows you to capture dress images from webpages and generate realistic try-on images using Hugging Face's free Stable Diffusion AI model.

## Features

- **Dress Capture**: Draw rectangular boxes around dresses on any webpage to capture them as images
- **AI Image Generation**: Direct integration with Hugging Face's free Stable Diffusion XL for creating realistic try-on images
- **Personalized Try-On**: Uses your personal photo (me.webp) to generate customized try-on images
- **Clipboard Integration**: Captured images are automatically copied to your clipboard
- **User-Friendly Interface**: Simple popup interface with clear instructions
- **Completely Free**: Uses Hugging Face's free API - no API key or credit card required!

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the folder containing the extension files
5. The extension icon should appear in your Chrome toolbar

## Configuration

**No API Key Required!** This extension works out of the box without any configuration. The AI image generation uses Hugging Face's completely free Stable Diffusion API.

## How to Use

1. **Capture a Dress**:
   - Click the extension icon to open the popup
   - Click "Start Dress Capture"
   - Draw a rectangular box around the dress you want to try on
   - The image will be automatically copied to your clipboard

2. **Generate Try-On Image**:
   - After capturing a dress image, click "Generate Try-On Image" in the popup
   - The extension will use Hugging Face's free Stable Diffusion XL to create a realistic image
   - The generated image will show a person wearing a beautiful dress
   - Results are displayed in a popup window for viewing and downloading

## How It Works

1. **Dress Capture**: The extension uses Chrome's tab capture API to take a screenshot of the visible area, then crops it to your selected rectangle around the dress
2. **Clipboard Storage**: The captured dress image is stored in your clipboard and also saved internally for AI image generation
3. **AI Integration**: When you click "Generate Try-On Image", the extension uses Hugging Face's free Stable Diffusion XL to create a realistic fashion image

## Permissions

The extension requires the following permissions:
- `activeTab`: To capture the current tab
- `clipboardWrite`: To copy images to clipboard
- `tabs`: To open new tabs
- `scripting`: To inject scripts into tabs
- `clipboardRead`: To read clipboard data
- `host_permissions`: Access to `https://api-inference.huggingface.co/*`

## Technical Details

- Built with Manifest V3
- Uses Canvas API for image processing
- Implements Chrome's tab capture API
- Handles asynchronous message passing between content script and background script
- Integrates with Hugging Face's free Stable Diffusion XL for AI image generation

## Troubleshooting

- **Extension not working**: Make sure you're on a regular website (not chrome://, about:, etc.)
- **Capture not working**: Try refreshing the page and enabling the extension again
- **AI image generation failing**: Make sure you have a captured dress image first

## Version History

- v1.0: Initial release with dress capture and Hugging Face free Stable Diffusion XL try-on image generation functionality