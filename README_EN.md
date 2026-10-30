# One-Click Batch Export All Gemini Chat History — No More Copying One by One

[![License](https://img.shields.io/github/license/AXIRYYYY/gemini-chat-export-enhanced)](https://github.com/AXIRYYYY/gemini-chat-export-enhanced/blob/main/LICENSE)
[![Stars](https://img.shields.io/github/stars/AXIRYYYY/gemini-chat-export-enhanced)](https://github.com/AXIRYYYY/gemini-chat-export-enhanced/stargazers)
[![Version](https://img.shields.io/badge/version-13.13.3-brightgreen)](https://github.com/AXIRYYYY/gemini-chat-export-enhanced)
[![Tampermonkey](https://img.shields.io/badge/Tampermonkey-✓-brightgreen)](https://www.tampermonkey.net/)

[简体中文](./README.md) | English | [繁體中文](./README_CHT.md)

**Gemini Chat Export Enhanced** is a [Tampermonkey userscript](https://www.tampermonkey.net/). Once installed in your browser, a backup panel appears on the right side of the Gemini page. Click to export the current conversation as Markdown / JSON / TXT files. It also supports **one-click scanning of all conversations in the sidebar and automatic batch export**, completely eliminating the pain of manually copying them one by one.

The panel can be collapsed; on `gemini.google.com/usage`, a flat usage alert card appears in the bottom-right corner (5-hour / weekly, reads the current page only, no extra requests).

Deeply customized from an early version of [Sxuan-Coder/gemini_chat_export](https://github.com/Sxuan-Coder/gemini_chat_export), fully adapted for the new Gemini UI.

---

## 📸 Preview

> 🚧 Screenshots coming soon. Contributions welcome — a 30-second demo recording would be great.

| To See | Suggested Screenshot |
|--------|---------------------|
| Backup Panel | The export panel appearing on the right side of Gemini, with all buttons visible |
| Single Chat Export | The download popup after clicking "Export Current Chat" |
| Batch Export Flow | Click "Scan/Accumulate" → Click "Export Queue (N)" → Auto-export one by one |
| Usage Alert Card | The flat alert card in the bottom-right corner of the Gemini usage page (/usage) |

*(Place screenshots in the `screenshots/` folder at the repo root)*

---

## ✨ Features

### Core Features
- 📄 Supports **Markdown / JSON / TXT** export formats
- 🔄 Auto-scroll to load and capture complete chat history (including long conversations)
- 🎨 Export Canvas drawings, code blocks, and document content
- 🧠 AI thinking process (Thinking) capture and export
- 📊 Full HTML table parsing to Markdown format

### 🔥 Enhanced Features (Exclusive to This Edition)
- 🗂️ **Batch Export**: Scan the sidebar conversation list and auto-export all conversations one by one
- ⏸️ **Pause/Resume**: Pause and resume batch processing at any time
- ⚡ **Interrupt & Save**: "Stop immediately and export current chat" or "Abort task" during processing
- 🧠 **Smart Title Extraction**: Adapted for the new Gemini UI with multiple fallback logic for correct titles
- ⚙️ **Adjustable Parameters**: Tune scroll delay and history loading delay directly in the UI (adapts to different network conditions)
- ⌨️ **Alt+Q Shortcut**: Quickly hide/show the backup panel
- 🪟 **Collapsible Panel**: Click "－" in the title bar to shrink it to a small `G` tab in the top-right corner; click the tab or press `Alt+W` to expand; the collapsed state is remembered
- 📊 **Gemini Usage Alert**: Only on `gemini.google.com/usage`; reads the page's 5-hour / weekly usage, turns yellow at ≥90% and red at 100%, and forecasts whether the quota will run out before reset (the page has only these two pools, no monthly quota)
- 🎨 **Dark Theme Panel**: Fixed dark UI that blends well with Gemini

---

## 🛠️ Installation

### Method 1: Direct Link Installation (Recommended, supports auto-update)

1. Install a userscript manager (e.g. [Tampermonkey](https://www.tampermonkey.net/))
2. Click the following link — Tampermonkey will automatically open the installation window:  
   https://raw.githubusercontent.com/AXIRYYYY/gemini-chat-export-enhanced/main/gemini-chat-export-enhanced.user.js
3. Click **Install**
4. Open [Google Gemini](https://gemini.google.com/app) and the backup panel will appear on the right

> 💡 After direct link installation, Tampermonkey will periodically check for updates and notify you when a new version is available.

### Method 2: Manual Installation

1. Install a userscript manager (e.g. [Tampermonkey](https://www.tampermonkey.net/))
2. Download the [`gemini-chat-export-enhanced.user.js`](./gemini-chat-export-enhanced.user.js) file from this repo
3. Open it with a text editor, select all and copy
4. In Tampermonkey, click "Create a new script" and paste the code
5. Save and enable the script (press `Ctrl+S`)

---

## 🚀 Usage

### Single Chat Export
1. Open Gemini chat page — the **backup panel** will appear on the right
2. Switch the export format at the top of the panel (**MD** / JSON / TXT)
3. Click **📜 Export Current Chat**
4. The script will automatically scroll up to load the full history, then generate a download file

### Batch Export All Conversations
1. Manually scroll down in the Gemini **sidebar** to load all conversation entries
2. In the backup panel, click **🔍 Scan/Accumulate** to collect all conversation entries
3. The button text will show the number of collected conversations, e.g. `🗂️ Export Queue (15)`
4. Click that button, confirm, and the script will **automatically click through each conversation** and export it
5. During batch processing, you can use **⏸️ Pause** and **🛑 Stop Remaining**

> 💡 Do **not touch the mouse** during batch export — let the script do its work.

### Collapse / Expand the Panel
1. Click **－** in the title bar; the panel shrinks to a small `G` tab in the top-right corner
2. Click the tab or press **Alt + W** to expand
3. The collapsed state is remembered after a page reload

### Usage Alert (on /usage only)
1. Open `https://gemini.google.com/usage`
2. A flat usage card appears in the bottom-right corner (60% of the page width)
3. It shows the 5-hour / weekly percentages, reset times, and a forecast of whether the quota will run out before reset
4. The left stripe turns yellow/red when there is risk; hover over long text to see the full message; click **✕** to dismiss this alert
5. The card only appears on /usage — chat pages never show potentially stale usage numbers

### Keyboard Shortcuts
| Shortcut | Function |
|----------|----------|
| **Alt + Q** | Hide/Show the backup panel |
| **Alt + W** | Collapse/Expand the backup panel |

---

## 🔄 Version Updates

This script uses the standard Tampermonkey `@version` field for version management.

### Auto-Update (Recommended)

If you installed via **Method 1 (Direct Link)**, Tampermonkey handles updates automatically:

1. Tampermonkey periodically checks the script's `@version` field
2. When the version on GitHub > your local version, you'll see an update prompt
3. Click "Update" to upgrade to the latest version
4. You can also manually click **"Check for updates"** in the Tampermonkey dashboard

### Manual Update

If you installed via **Method 2 (Manual)**:

1. Visit this repo and download the latest `gemini-chat-export-enhanced.user.js`
2. In Tampermonkey, open the script and replace all content with the new version
3. Save (press `Ctrl+S`)

### Versioning Scheme

Current version: **v13.13.3** (`@version 13.13.3`)

Version format: `major.minor.patch`:
- New features → increment minor version
- Bug fixes → increment patch version
- Breaking changes → increment major version

---

## 📄 License & Copyright

This project is open-sourced under the [Apache License 2.0](./LICENSE).

- Original code copyright belongs to [Sxuan-Coder](https://github.com/Sxuan-Coder)
- Modifications and new features copyright belong to [AXIRYYYY](https://github.com/AXIRYYYY)
- This license does not grant permission to use the original author's trademarks, service marks, or product names

---

## 🤝 Contributing

Issues and PRs are welcome for bug reports, feature suggestions, or code contributions. See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

---

## 🔗 Related Links

| Project | Link |
|------|------|
| This Repository | [AXIRYYYY/gemini-chat-export-enhanced](https://github.com/AXIRYYYY/gemini-chat-export-enhanced) |
| Original (Userscript) | [Sxuan-Coder/gemini_chat_export](https://github.com/Sxuan-Coder/gemini_chat_export) |
| Original Author's Chrome Extension | [AIhubEnhenced Releases](https://github.com/Sxuan-Coder/AIhubEnhenced/releases) |

> ℹ️ If you need multi-platform support (Gemini / GPT / Grok), check out the original author's [AIhubEnhenced Chrome Extension](https://github.com/Sxuan-Coder/AIhubEnhenced/releases). This script focuses on providing a solution for users who prefer Tampermonkey userscripts and need batch export of Gemini conversations.

---

💡 **Disclaimer**: This script is intended for users to back up their **own** chat records. Do not use it for illegal scraping of others' private data.
