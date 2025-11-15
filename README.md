10-11-2025 Fixed youtube url summary function

# OWUI Sidebar Extension

A Chrome/Edge(tested)/Brave extension that integrates Open WebUI (OWUI) directly into your browser's sidebar, providing seamless access to AI chat capabilities while preserving your browsing context and authentication.

## Recent Updates

- Default internal/external URLs now point to `https://chat.foo.bar`, so new installs work immediately until you swap in your own hostnames.
- The options UI hides everything except the summary language/prompt override controls to keep fork merges clean; API and URL fields still exist but are hidden until needed.
- Site-specific handlers for Jira and Confluence (Data Center v9) reuse the browser session to fetch REST metadata and drop sanitized `.txt` files instead of raw HTML.
- Added a Jira ignore list (hardcoded in `site_handlers/jira.js`) so you can skip status-bot or noisy system users when exporting comments.
- Plain-text drops share the same sanitized pipeline as PDFs/HTML, preventing non-ASCII issues for custom handlers.
- Keyboard shortcut updated to `Ctrl+Alt+H` (same on macOS) to open the sidebar instantly; configure via `chrome://extensions/shortcuts` if needed.
**Key advantages**: Smart dual-URL routing avoids tunnel overhead (Tailscale/Cloudflare) when using internal URLs, and content extraction ensures authenticated pages remain accessible to OWUI (unlike URL-only attachment).

## Overview

The OWUI Sidebar Extension allows you to:
- Access Open WebUI in a convenient sidebar panel without leaving your current tab
- Interact with web content through AI-powered chat and summarization

- Upload documents to knowledge collections for RAG (Retrieval-Augmented Generation)
- Maintain full Open WebUI functionality within the sidebar

## Key Features


### 📝 Content Interaction Buttons

#### Chat with Tab
- **Function**: Extracts the current tab's HTML content and sends it to Open WebUI as a file attachment
- **Use case**: Analyze, discuss, or ask questions about the current tab content
- **How it works**: Captures the full HTML including text, structure, and metadata while preserving the page context
- **Why extraction instead of URL**: The extension extracts the actual content rather than just passing the URL to OWUI (as with the default "Attach URL" functionality) to ensure that content requiring authentication or specific credentials remains accessible. This prevents OWUI from receiving empty or error pages when it cannot access protected content directly.

#### Summarize Tab
- **Function**: Extracts the current tab's HTML and automatically requests a summary
- **Use case**: Quickly get key points from long articles, documentation, or reports
- **How it works**: Combines content extraction with an automatic summarization prompt
- **Content preservation**: Like "Chat with Tab", this extracts the actual content to ensure authenticated or private content can be properly summarized

#### RAG (Retrieval-Augmented Generation)
A dropdown menu with knowledge management options:
- **Upload File to Default**: Quickly upload documents (PDF, DOC, TXT, etc.) to your default knowledge collection
- **Upload to...**: Choose a specific knowledge collection for targeted document organization
- **Manage Collections**: Direct link to Open WebUI's knowledge management interface

**Note**: The RAG button only appears after you have entered your API key in the extension settings.

### 🔗 Smart URL Handling

The extension intelligently manages different URL types to ensure optimal connectivity:

#### Internal vs External URLs
- **Internal URL Your local or private Open WebUI instance (e.g., `http://localhost:3000`)
- **External URL  Public or remote Open WebUI instance (e.g., `https://openwebui.example.com`)

The extension automatically:
1. Checks if your internal URL is reachable
2. Falls back to the external URL if the internal one is unavailable
3. Displays a status indicator showing which URL is currently active

#### Why This Matters
This dual-URL approach ensures that:
- **Authentication is preserved**: Your login sessions, cookies, and user context remain intact
- **Content consistency**: You see the same content as in your regular browser session
- **Private access works**: Internal tools, localhost servers, and VPN-protected resources remain accessible
- **Seamless fallback**: If you're away from your local network, the extension automatically uses your external URL
- **Optimized performance**: When you have access to the internal URL, queries are processed directly without going through tunnels (Tailscale, Cloudflare, etc.), resulting in faster response times and reduced latency

Both internal and external URL defaults are preset to `https://chat.foo.bar`. Update them from the options page (or via sync storage) when pointing at a different OWUI deployment.

Without this approach, you might encounter:
- Login prompts when already authenticated
- Different content due to missing session context
- Inability to access private or internal resources
- Broken functionality for sites requiring specific cookies or tokens
- Unnecessary network overhead when routing local traffic through external tunnels

### 🔍 Status Indicators

The extension displays visual indicators to show the current connection status:
- **Green I** ![Internal] Connected to internal/local Open WebUI instance
- **Green O* ![External] Connected to external/remote Open WebUI instance
- **Status messages**: Temporary notifications for successful operations or errors

### 🧠 Site-Aware Extraction (Jira & Confluence)

- **Jira Data Center v9**: When you’re on `jira.foo.bar`, the extension calls `/rest/api/2/issue/{key}` using your authenticated browser session. It exports summary, status, assignee, reporter, timestamps, epic, description, and comment history. Mentions like `[~jon.doe]` become human-readable names, and each comment is printed as:

  ```
  comment by Jon Doe on 5/22/2025:
  Comment body here
  ```
  Edit the `IGNORED_JIRA_USERS` array inside `site_handlers/jira.js` to omit bot/system commenters (use lowercase usernames/account IDs).

- **Confluence Data Center v9**: On `confluence.foo.bar`, the extension calls `/rest/api/content/{pageId}?expand=body.view,...` to capture headings, labels, space info, and the rendered body. Mentions and user chips resolve to display names automatically.

Both handlers are registered separately (see `site_handlers/`) to keep the core capture logic untouched, and they emit clean ASCII `.txt` files dropped via the same drag-and-drop pipeline the chat frame already understands.

### ⌨ Keyboard Shortcut

Use `Ctrl+Alt+H` to open the OWUI sidebar from anywhere. Visit `chrome://extensions/shortcuts` if you’d like to customize or confirm the binding after loading the extension.

## Installation Instructions

### Prerequisites
- Google Chrome or Chromium-based browser (Edge, Brave, etc.)
- Access to an Open WebUI instance (local or remote)

### Step-by-Step Installation

1. **Download the Extension**
   - Download or clone this repository to your local machine
   - Extract the files to a folder if downloaded as a ZIP

2. **Prepare the Extension Directory**
   ```
   ⚠️ IMPORTANT: Choose a permanent location for the extension folder.
   This directory must remain in place after installation.
   Moving or deleting it will break the extension.
   
   Recommended locations:
   - Windows: C:\Users\[YourName]\Documents\Extensions\owui-sidebar
   - Mac: ~/Documents/Extensions/owui-sidebar
   - Linux: ~/extensions/owui-sidebar
   ```

3. **Open Chrome Extension Management**
   - Open Chrome/Edge/Brave browser
   - Navigate to the extensions page:
     - Chrome: `chrome://extensions`
     - Edge: `edge://extensions`
     - Brave: `brave://extensions`
   - Or use the menu: **Three dots menu → Extensions → Manage Extensions**

4. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner of the extensions page
   - This allows you to install unpacked extensions

5. **Load the Extension**
   - Click the "Load unpacked" button
   - Navigate to and select the extension folder containing `manifest.json`
   - The extension should appear in your extensions list

6. **Configure the Extension**
   - Click on the extension icon in the toolbar (you may need to pin it from the extensions menu)
   - If you haven't configured a URL yet, you'll see a welcome message with a button to open settings
   - Right-click the extension icon and select "Options" or click "Details" → "Extension options"
   - Internal/external URLs default to `https://chat.foo.bar`. Update them (even though the fields are hidden by default) if your OWUI instance lives elsewhere. Only the summary language and prompt override controls stay visible to reduce merge noise.
   - (Optional) Reveal the knowledge/API settings if you plan to use RAG uploads; the API/JWT key still lives there.

7. **Access the Sidebar**
   - Click the extension icon to open the Open WebUI sidebar
   - If no URL is configured, you'll see a welcome screen with a direct link to settings
   - Once configured, the sidebar will automatically connect to the appropriate URL
   - You can now use all features while browsing

### Post-Installation Notes

- **Do not delete the extension folder**: The folder you selected during "Load unpacked" must remain in place
- **Updates**: To update the extension, replace the files in the folder and click the refresh icon in the extensions page
- **Permissions**: The extension requires various permissions to function properly:
  - `storage`: Save your configuration
  - `sidePanel`: Display the sidebar interface
  - `activeTab`: Interact with the current tab
  - `scripting`: Extract page content for chat/summarization

## Technical Details

### URL Processing Methods

The extension uses sophisticated methods to handle different types of URLs:

1. **Direct HTML Extraction**: For standard web pages, the extension extracts the full HTML content, preserving structure and context

2. **YouTube URLs**: YouTube video URLs are sent directly to Open WebUI without extraction:
   - The URL itself is passed to OWUI's chat interface (not the content)
   - Open WebUI can then process the video using its built-in YouTube handling capabilities
   - This allows for video transcription, summarization, and Q&A features
   - YouTube URLs are an exception to content extraction since they are publicly accessible

3. **PDF Handling**: For PDF URLs, the extension:
   - Extracts the actual PDF content when possible to preserve authentication context
   - Attempts to fetch the PDF with appropriate credentials
   - Falls back to creating a reference if direct access fails
   - Maintains the original filename for clarity

4. **Authentication Preservation**: By loading Open WebUI in an iframe within the extension context:
   - Cookies and session data are maintained
   - Login states persist across browser sessions
   - Private resources remain accessible with proper authentication

### File Structure

```
owui-sidebar/
├── manifest.json          # Extension configuration
├── background.js          # Service worker for URL checking and message handling
├── content_script.js      # Injected script for page interaction
├── sidepanel.html        # Sidebar UI structure
├── sidepanel.js          # Sidebar functionality
├── options.html          # Settings page structure
├── options.js            # Settings functionality
├── OWUI_Knowledge_tools.js # Knowledge API integration
├── site_handlers/
│   ├── registry.js        # Lightweight registry for per-site handlers
│   ├── jira.js            # Jira Data Center v9 handler
│   └── confluence.js      # Confluence Data Center v9 handler
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   ├── icon128.png
│   ├── Internal_url.png  # Internal URL indicator
│   └── External_url.png # External URL indicator
```

## Troubleshooting

### Extension Not Loading
- Ensure Developer Mode is enabled
- Check that all files are present in the extension folder
- Verify the manifest.json file is not corrupted

### First Time Setup
- If you see a welcome message instead of Open WebUI, click the "Open Settings" button
- This appears when no URL has been configured yet
- After configuring your URLs in settings, reload the sidebar

### Sidebar Not Connecting
- Verify your Open WebUI URLs in the extension options
- Check that your Open WebUI instance is running
- Ensure your API key is correct if using knowledge features

### Content Extraction Not Working
- Some websites may block content extraction due to security policies
- Try refreshing the page and attempting again
- Check the browser console for specific error messages

### Knowledge Upload Failing
- Verify your API key has the necessary permissions
- Ensure the API URL matches your Open WebUI instance
- Check that the file type is supported (PDF, DOC, TXT, etc.)

## Privacy & Security

- The extension only connects to the URLs you configure
- No data is sent to third parties
- All processing happens locally in your browser
- Your Open WebUI credentials and session data remain secure

## Support

For issues, feature requests, or contributions, please:
1. Check the troubleshooting section above
2. Review existing issues in the repository
3. Create a new issue with detailed information about your problem

## Known Limitations

- **Text-to-Speech (TTS) and Speech-to-Text (STT)**: These features do not currently work within the extension due to browser security restrictions on iframe audio permissions. You'll need to use the main Open WebUI interface for voice features.

## License & Usage

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

**Note**: This extension retains full Open WebUI functionality in the sidebar (except for TTS/STT features), meaning most features available in your Open WebUI instance will work seamlessly within the extension interface.
