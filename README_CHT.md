# 一鍵批量匯出所有 Gemini 聊天記錄，再也不用一條條複製了

[![License](https://img.shields.io/github/license/AXIRYYYY/gemini-chat-export-enhanced)](https://github.com/AXIRYYYY/gemini-chat-export-enhanced/blob/main/LICENSE)
[![Stars](https://img.shields.io/github/stars/AXIRYYYY/gemini-chat-export-enhanced)](https://github.com/AXIRYYYY/gemini-chat-export-enhanced/stargazers)
[![Version](https://img.shields.io/badge/version-13.11-brightgreen)](https://github.com/AXIRYYYY/gemini-chat-export-enhanced)
[![Tampermonkey](https://img.shields.io/badge/Tampermonkey-✓-brightgreen)](https://www.tampermonkey.net/)

[简体中文](./README.md) | [English](./README_EN.md) | 繁體中文

**Gemini Chat Export Enhanced** 是一個 [Tampermonkey 油猴腳本](https://www.tampermonkey.net/)，安裝在瀏覽器後，Gemini 頁面右側會出現一個備份面板。點擊即可將當前對話匯出為 Markdown / JSON / TXT 檔案。更支援**一鍵掃描側邊欄所有對話，自動逐條批量匯出**，徹底告別手動逐條複製的痛苦。

基於 [Sxuan-Coder/gemini_chat_export](https://github.com/Sxuan-Coder/gemini_chat_export) 早期版本深度定製，針對 Gemini 新版 UI 做了全面適配。

---

## 📸 效果預覽

> 🚧 截圖即將更新。歡迎貢獻——錄一段 30 秒的操作演示即可。

| 想看到 | 建議截圖內容 |
|--------|-------------|
| 備份面板 | Gemini 頁面右側出現的匯出面板，展開顯示各按鈕 |
| 單對話匯出 | 點擊「匯出當前對話」後彈出下載檔案的畫面 |
| 批量匯出流程 | 點擊「掃描/累積」→ 點「匯出隊列 (N)」→ 自動逐個匯出 |

*（截圖放在倉庫根目錄 `screenshots/` 資料夾，README 會自動引用）*

---

## ✨ 功能特性

### 核心功能
- 📄 支援 **Markdown / JSON / TXT** 三種匯出格式
- 🔄 自動捲動載入並捕獲完整對話歷史（含長對話場景）
- 🎨 匯出 Canvas 繪圖、程式碼區塊、文件內容
- 🧠 AI 思考過程（Thinking）捕獲和匯出
- 📊 完整解析 HTML 表格為 Markdown 格式

### 🔥 增強功能（本版本獨有）
- 🗂️ **批量匯出**：掃描側邊欄對話列表，一鍵自動逐條匯出所有對話
- ⏸️ **暫停/繼續**：批量處理過程中可隨時暫停和恢復
- ⚡ **中斷儲存**：處理過程中支援「立即停止並匯出當前對話」或「放棄任務」
- 🧠 **智慧標題提取**：適配 Gemini 新版 UI，多種備選邏輯確保標題正確
- ⚙️ **可調參數**：介面內直接調節捲動延遲和歷史載入延遲（適配不同網路環境）
- ⌨️ **Alt+Q 快捷鍵**：快速隱藏/顯示備份面板
- 🎨 **暗色主題面板**：固定暗色 UI，與 Gemini 介面協調

---

## 🛠️ 安裝方法

### 方法一：直連安裝（推薦，支援自動更新）

1. 安裝瀏覽器腳本管理器（如 [Tampermonkey](https://www.tampermonkey.net/)）
2. 點擊以下連結，Tampermonkey 會自動彈出安裝視窗：  
   https://raw.githubusercontent.com/AXIRYYYY/gemini-chat-export-enhanced/main/gemini-chat-export-enhanced.user.js
3. 點擊 **安裝** 即可
4. 開啟 [Google Gemini](https://gemini.google.com/app) 即可看到右側備份面板

> 💡 直連安裝後，Tampermonkey 會定期檢查更新，當有新版本時自動提示升級。

### 方法二：手動安裝

1. 安裝瀏覽器腳本管理器（如 [Tampermonkey](https://www.tampermonkey.net/)）
2. 下載本倉庫的 [`gemini-chat-export-enhanced.user.js`](./gemini-chat-export-enhanced.user.js) 檔案
3. 用文字編輯器開啟，全選複製全部程式碼
4. 在 Tampermonkey 中點擊「建立新腳本」，貼上程式碼
5. 儲存並啟用腳本（按 `Ctrl+S`）

---

## 🚀 使用教學

### 單個對話匯出
1. 開啟 Gemini 聊天頁面，右側會出現**備份面板**
2. 在面板頂部點擊切換匯出格式（**MD** / JSON / TXT）
3. 點擊 **📜 匯出當前對話** 按鈕
4. 腳本會自動向上捲動載入全部歷史記錄，然後生成下載檔案

### 批量匯出所有對話
1. 在 Gemini **側邊欄**中手動向下捲動，讓所有對話列表都載入出來
2. 在備份面板中點擊 **🔍 掃描/累積** 按鈕，採集所有對話條目
3. 按鈕文字會顯示採集到的對話數量，如 `🗂️ 匯出隊列 (15)`
4. 點擊該按鈕，確認後腳本會**逐個自動點擊**每個對話並匯出
5. 在批量過程中可以使用 **⏸️ 暫停** 和 **🛑 停止後續任務**

> 💡 批量匯出時請**不要操作滑鼠**，讓腳本自動完成。

### 快捷鍵
| 快捷鍵 | 功能 |
|--------|------|
| **Alt + Q** | 隱藏/顯示備份面板 |

---

## 🔄 版本更新

本腳本使用油猴標準的 `@version` 欄位進行版本管理。

### 自動更新（推薦）

如果你使用**方法一（直連安裝）**，Tampermonkey 會自動處理更新：

1. Tampermonkey 每隔一段時間自動檢查腳本的 `@version` 欄位
2. 當 GitHub 上的版本號 > 你本地的版本號時，會彈出更新提示
3. 點擊「更新」即可升級到最新版
4. 也可以在 Tampermonkey 管理面板中手動點擊 **「檢查更新」**

### 手動更新

如果你使用**方法二（手動安裝）**：

1. 訪問本倉庫，下載最新的 `gemini-chat-export-enhanced.user.js`
2. 在 Tampermonkey 中開啟該腳本，全選替換為新內容
3. 儲存即可（按 `Ctrl+S`）

### 版本號規則

目前版本：**v13.11**（對應 `@version 13.11.0`）

版本號格式為 `主版本.次版本.修訂號`：
- 新功能 → 遞增次版本號
- Bug 修復 → 遞增修訂號
- 不相容的大改動 → 遞增主版本號

---

## 📄 授權與版權

本專案基於 [Apache License 2.0](./LICENSE) 開源。

- 原始程式碼版權歸 [Sxuan-Coder](https://github.com/Sxuan-Coder) 所有
- 修改和新增功能版權歸 [AXIRYYYY](https://github.com/AXIRYYYY) 所有
- 本 License 不授權使用原作者的商標、服務標誌或產品名稱

---

## 🤝 參與貢獻

歡迎提 Issue 報告 Bug 或建議新功能，也歡迎直接提 PR 參與開發。詳見 [CONTRIBUTING.md](./CONTRIBUTING.md)。

---

## 🔗 相關連結

| 專案 | 連結 |
|------|------|
| 本專案倉庫 | [AXIRYYYY/gemini-chat-export-enhanced](https://github.com/AXIRYYYY/gemini-chat-export-enhanced) |
| 原專案（使用者腳本版） | [Sxuan-Coder/gemini_chat_export](https://github.com/Sxuan-Coder/gemini_chat_export) |
| 原作者的 Chrome 擴充套件版 | [AIhubEnhenced Releases](https://github.com/Sxuan-Coder/AIhubEnhenced/releases) |

> ℹ️ 如果你需要多平台支援（Gemini / GPT / Grok），推薦試試原作者的 [AIhubEnhenced Chrome 擴充套件](https://github.com/Sxuan-Coder/AIhubEnhenced/releases)。本腳本專注於為偏好 Tampermonkey 使用者腳本和需要批量匯出 Gemini 對話的使用者提供解決方案。

---

💡 **免責聲明**：本腳本旨在方便使用者備份**自己的**聊天記錄，請勿用於非法抓取他人隱私資料。
