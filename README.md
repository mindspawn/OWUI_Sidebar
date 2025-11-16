# OWUI Sidebar Extension

OWUI Sidebar is a Chrome/Edge/Brave side-panel extension that keeps Open WebUI a single click away. It proxies your authenticated browser session into the OWUI iframe, adds page-aware helpers (Jira, Confluence, PDFs, YouTube, etc.), and gives you fast knowledge base/RAG uploads without jumping between tabs.

## Highlights
- Dual internal/external URL routing: the service worker pings both URLs, caches the reachable one, and shows status icons so you always know where traffic is going.
- One-click tab capture: `Chat with Tab` and `Summarize` dump a sanitized HTML snapshot of the active page (or a PDF/text fallback) straight into Open WebUI.
- RAG/knowledge workflows: upload current tabs or local files into Open WebUI collections, list/create collections, and manage them from the sidebar once an API key is stored.
- Site-specific automations: registry-driven handlers for Jira and Confluence reuse the user's web session to pull REST data and drop cleaned summaries/text files into OWUI.
- Background health checks: URL reachability tests run at startup, install, settings changes, and on-demand via sidebar actions so stale hosts recover automatically.
- Keyboard-driven: assign your own shortcut at `chrome://extensions/shortcuts` (default suggestion `Ctrl+Shift+H` / `⌘+Shift+H`) to focus the OWUI side panel instantly.

## What's New
- **Oct 2025** – Fixed the YouTube summarization workflow by switching to the `?load-url=` parameter so the iframe can ingest and summarize videos without reloading OWUI.
- Added URL defaults + Jira/Confluence host arrays to `urlConfig.js`, making forks easier by changing a single file.
- The Knowledge dropdown now exposes `Upload Tab to Default`, `Upload File to Default`, `Upload to…` (modal selector + optional current tab capture), and `Settings/Manage Knowledge`.
- Knowledge helpers reside in `OWUI_Knowledge_tools.js` (list/create knowledge bases, upload files, attach them to a collection) and are shared by the options page and the side panel.
- Jira handlers skip noisy accounts via an ignore list, sanitize comments to ASCII, and resolve linked issues inline; Confluence handlers capture page metadata and drop text bundles instead of raw HTML.
- Plain-text drops share the same sanitization pipeline as HTML/PDF attachments, eliminating UTF-8 issues that previously hit custom handlers.

## Requirements
- Chromium-based browser with the Side Panel API (Chrome/Edge/Brave 120+ recommended).
- Developer Mode enabled under `chrome://extensions`.
- Access to an Open WebUI instance (internal + optional external URL).
- Optional: Open WebUI API key/JWT for knowledge uploads.

## Quick Start
1. **Clone the repo**
   ```bash
   git clone https://github.com/<your-org>/OWUI_Sidebar.git
   cd OWUI_Sidebar
   ```
2. **Set default hosts in `urlConfig.js`**
   - `sidebarUrl` should be the on-network/internal OWUI base.
   - `externalUrl` should be the VPN/tunnel/public host to fall back to.
   - Populate `jiraHosts` / `confluenceHosts` arrays so the handlers know which domains to watch.
3. **Load the extension**
   - Navigate to `chrome://extensions`, toggle *Developer Mode*, click *Load unpacked*, and select this folder.
4. **(Optional) Configure runtime settings**
   - Open the **Extension options** link from the extension card (or right-click the toolbar icon → *Options*).
   - Summary language/prompt overrides are visible by default.
   - URL/API fields are intentionally hidden to avoid leaking secrets in forks; temporarily remove the `hidden` class in `options.html` or via DevTools if you need to edit them from the UI. Otherwise, rely on `urlConfig.js`.
5. **Pin the action icon** (so the browser shortcut can focus the side panel) and verify the status indicator shows either the internal or external icon.

## Configuration Details
### URL defaults (`urlConfig.js`)
`urlConfig.js` is loaded by every runtime context (service worker + DOM). Editing the file is the safest way to ship organization-specific defaults without storing credentials elsewhere.

```js
const OWUI_URL_CONFIG = {
    sidebarUrl: 'https://chat.foo.bar',
    externalUrl: 'https://chat.foo.bar',
    jiraHosts: ['jira.foo.bar'],
    confluenceHosts: ['confluence.foo.bar']
};
```
- Set `sidebarUrl` and `externalUrl` to fully qualified origins. The background worker will HEAD both URLs (5s timeout) and remember the healthy one in `chrome.storage.local`.
- Host arrays accept multiple domains. They power the Jira/Confluence site handlers and can be extended with additional hosts or self-managed domains.

### Runtime options (`options.html` / `options.js`)
Even if the UI hides most fields, `options.js` reads/writes:
- `sidebarUrl` / `externalUrl` (override the defaults at runtime).
- `summaryLanguage` (`en` or `ko` currently) and optional `customPrompt`.
- `enableApiAccess`, `owuiApiKey`, and `knowledgeCollection`.
- Knowledge helpers (`validateUrlAndLoadCollections`, `createKnowledge`) which hit `/api/v1/knowledge` on your OWUI host.

> **Tip:** Keep API keys out of source control. Use the Extension Options UI (after temporarily unhiding the form controls) or run `chrome.storage.sync.set` from the console to seed secrets locally.

### Knowledge workflows
After `enableApiAccess` and `owuiApiKey` are set, the sidebar:
- Shows the **Knowledge** dropdown.
- Lists collections via `GET /api/v1/knowledge`.
- Uploads local files with `POST /api/v1/files` and attaches them twice: file upload + `POST /api/v1/knowledge/{id}/file/add`.
- Lets you create a new collection from the options page (name + description) before uploading.

### Summary prompt overrides
- The default summarization prompt is language-aware (English + Korean supported in the UI). Additional languages can be introduced by editing the option dropdown and the `languageNames` map inside `sidepanel.js`.
- Toggling *Override default Summary Prompt* unlocks a custom prompt textbox. Saved prompts are stored in sync storage and used by the `Summarize` action and YouTube handler.

## Using the Sidebar
### Opening & status
- The extension registers `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`, so clicking the toolbar icon (or invoking the keyboard shortcut) opens the side panel in the current window.
- Internal/external icons (`icons/Internal_url.png`, `icons/External_url.png`) flip based on the stored `activeUrlSource`.
- When no URL is configured the iframe renders a friendly setup prompt with a button that opens the Options page.

### Tab actions

| Control | What it does | Notes |
| --- | --- | --- |
| `Chat with Tab` | Captures the active tab's DOM (main/article/content) -> cleans scripts/media -> writes semantic HTML -> simulates a drag/drop so the OWUI chat receives a `.html` attachment. | Falls back to placeholder text if extraction fails; runs through `dropTextFileToChat` to guarantee ASCII-safe payloads. |
| `Summarize` | Same as above but immediately types/sends a summary request using the saved prompt/language. | Honors custom prompt when enabled; defaults to a language-specific summary instruction otherwise. |
| `Knowledge` dropdown | Upload the current tab or a local file into a knowledge collection, or open the settings/manage screen. | Hidden until `enableApiAccess` + API key are stored. The modal (`Upload to…`) offers an optional “Upload current tab” checkbox so you can mix captured HTML with local documents. |

### Smart URL selection
- `background.js` runs `determineActiveUrl` on startup, install, keyboard command, and whenever `sidebarUrl`/`externalUrl` changes.
- The worker uses `fetch(url, {method: 'HEAD', mode: 'no-cors'})` with a 5s abort to test reachability. Results are stored in `chrome.storage.local` along with the timestamp and `activeUrlSource`.
- Side panel loads whichever URL was last marked active. If none exist it requests a fresh check from the worker, then falls back to any stored sync value or the defaults from `urlConfig.js`.

### Site-aware automation
- **Jira Data Center** (`site_handlers/jira.js`): Watches hosts listed in `jiraHosts`, fetches issue data via `/rest/api/2/issue/<key>` using the browser session, strips ignored bot authors, resolves linked keys, and drops a clean `.txt` file summarizing fields/comments. Perfect for attaching existing tickets to OWUI chats or knowledge uploads.
- **Confluence Data Center** (`site_handlers/confluence.js`): Captures Confluence page content/macro text, handles attachments, and again emits sanitized text so OWUI can read it without iframe CSP blockers.
- Handlers register themselves through `site_handlers/registry.js`. To add your own, create a file that calls `window.CustomSiteHandlers.register({ id, matches(url), handle(context) })` and include it from `sidepanel.html`.

### Other helpers
- **YouTube**: `handleYouTubeVideo` encodes the current `youtube.com` URL and reloads OWUI with `?load-url=<video>` so transcripts can be summarized even when YouTube blocks iframes.
- **PDFs**: `dropPDFFromUrl` fetches the PDF (with a no-cors fallback that generates a placeholder PDF if needed) and simulates dropping it into the OWUI composer.
- **Text drops**: `sanitizePlainTextContent` removes control chars/non-ASCII before dropping text via `dropTextFileToChat`, keeping OWUI uploads tidy.

## Custom Site Handlers
1. Add your handler file in `site_handlers/`.
2. Import it from `sidepanel.html` after `registry.js`.
3. Inside the handler, call `window.CustomSiteHandlers.register({ id, matches(urlObj) => boolean, handle(context) => Promise<{handled: boolean}> })`.
4. Use the provided context helpers:
   - `context.dropTextFile(text, filename)` to attach sanitized text.
   - `context.showStatusMessage(message, isError)` for sidebar toasts.
   - `context.shouldSummarize` to reuse logic between Chat vs Summarize flows.

Handlers run inside the sidebar, so they can still leverage `chrome.scripting.executeScript` to pull data from the active tab when needed.

## Repository Layout
```
OWUI_Sidebar/
├── manifest.json             # MV3 definition (side panel + commands + permissions)
├── background.js             # Service worker for URL checks, storage listeners, and keyboard commands
├── urlConfig.js              # Centralized defaults (OWUI hosts + Jira/Confluence lists)
├── sidepanel.html/.js        # UI chrome, iframe loader, tab actions, knowledge controls, handlers
├── content_script.js         # Injected into all frames to simulate drops for HTML/PDF/text
├── OWUI_Knowledge_tools.js   # Shared knowledge API client (list/create/upload/attach)
├── options.html/.js          # Settings UI (mostly hidden), summary prompt overrides, API key entry
├── site_handlers/
│   ├── registry.js           # Minimal registry so handlers can self-register
│   ├── jira.js               # Jira issue exporter/cleaner
│   └── confluence.js         # Confluence page exporter
├── icons/                    # Toolbar & status icons (16…128px + internal/external indicators)
└── license.txt               # MIT license text
```

## Troubleshooting
- **Extension not loading**: Confirm Developer Mode is on and the folder contains `manifest.json`. Chrome will show errors inline if syntax is invalid.
- **Blank iframe / setup prompt**: Means no URL is stored anywhere. Update `urlConfig.js` or unhide the options form, save, and reopen the side panel.
- **Stuck on external/internal URL**: Check `chrome://extensions → OWUI Sidebar → Inspect views → Service Worker` to view reachability logs. The worker writes `lastReachabilityCheck` to sync storage.
- **Knowledge dropdown missing**: Ensure `enableApiAccess` is checked and both `owuiApiKey` + at least one OWUI URL are saved. Also verify the API host allows CORS for `/api/v1/knowledge`.
- **File drops silently fail**: Some sites block `contenteditable` access. Open DevTools on the OWUI iframe to confirm the drop events reach the composer. As a fallback, drag the generated file from the browser downloads bar into OWUI manually.
- **Jira/Confluence errors**: The handlers rely on same-origin REST endpoints. Make sure you're logged into the site in the same browser profile and that the hostnames you visit match the ones configured in `urlConfig.js`.
- **Audio (TTS/STT) missing**: Chromium blocks microphone/speaker APIs in side-panel iframes. Use the full OWUI tab for voice interactions.

## Privacy & Security
- All requests stay within the URLs you configure; there is no third-party telemetry.
- The extension never stores API keys outside of `chrome.storage.sync` (local to your browser profile). Secrets are not committed unless you edit files directly.
- Knowledge uploads reuse your OWUI API token, and site handlers reuse your authenticated browser session—no passwords or cookies leave your machine.

## License
OWUI Sidebar is distributed under the MIT License (see `license.txt`).

---
Questions or ideas? File an issue/PR in this repo, or open the Chrome extension's background worker console to capture logs when reporting bugs.
