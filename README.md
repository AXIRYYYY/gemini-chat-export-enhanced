# 一键批量导出所有 Gemini 聊天记录，再也不用一条条复制了

[![License](https://img.shields.io/github/license/AXIRYYYY/gemini-chat-export-enhanced)](https://github.com/AXIRYYYY/gemini-chat-export-enhanced/blob/main/LICENSE)
[![Stars](https://img.shields.io/github/stars/AXIRYYYY/gemini-chat-export-enhanced)](https://github.com/AXIRYYYY/gemini-chat-export-enhanced/stargazers)
[![Version](https://img.shields.io/badge/version-13.11-brightgreen)](https://github.com/AXIRYYYY/gemini-chat-export-enhanced)
[![Tampermonkey](https://img.shields.io/badge/Tampermonkey-✓-brightgreen)](https://www.tampermonkey.net/)

简体中文 | [English](./README_EN.md) | [繁體中文](./README_CHT.md)

**Gemini Chat Export Enhanced** 是一个 [Tampermonkey 油猴脚本](https://www.tampermonkey.net/)，安装在浏览器后，Gemini 页面右侧会出现一个备份面板。点击即可将当前对话导出为 Markdown / JSON / TXT 文件。更支持**一键扫描侧边栏所有对话，自动逐条批量导出**，彻底告别手动逐条复制的痛苦。

基于 [Sxuan-Coder/gemini_chat_export](https://github.com/Sxuan-Coder/gemini_chat_export) 早期版本深度定制，针对 Gemini 新版 UI 做了全面适配。

---

## 📸 效果预览

> 🚧 截图即将更新。欢迎贡献——录一段 30 秒的操作演示即可。

| 想看到 | 建议截图内容 |
|--------|-------------|
| 备份面板 | Gemini 页面右侧出现的导出面板，展开显示各按钮 |
| 单对话导出 | 点击"导出当前对话"后弹出下载文件的画面 |
| 批量导出流程 | 点击"扫描/累积"→ 点"导出队列 (N)"→ 自动逐个导出 |

*（截图放在仓库根目录 `screenshots/` 文件夹，README 会自动引用）*

---

## ✨ 功能特性

### 核心功能
- 📄 支持 **Markdown / JSON / TXT** 三种导出格式
- 🔄 自动滚动加载并捕获完整对话历史（含长对话场景）
- 🎨 导出 Canvas 绘图、代码块、文档内容
- 🧠 AI 思考过程（Thinking）捕获和导出
- 📊 完整解析 HTML 表格为 Markdown 格式

### 🔥 增强功能（本版本独有）
- 🗂️ **批量导出**：扫描侧边栏对话列表，一键自动逐条导出所有对话
- ⏸️ **暂停/继续**：批量处理过程中可随时暂停和恢复
- ⚡ **中断保存**：处理过程中支持"立即停止并导出当前对话"或"放弃任务"
- 🧠 **智能标题提取**：适配 Gemini 新版 UI，多种备选逻辑确保标题正确
- ⚙️ **可调参数**：界面内直接调节滚动延迟和历史加载延迟（适配不同网络环境）
- ⌨️ **Alt+Q 快捷键**：快速隐藏/显示备份面板
- 🎨 **暗色主题面板**：固定暗色 UI，与 Gemini 界面协调

---

## 🛠️ 安装方法

### 方法一：直链安装（推荐，支持自动更新）

1. 安装浏览器脚本管理器（如 [Tampermonkey](https://www.tampermonkey.net/)）
2. 点击以下链接，Tampermonkey 会自动弹出安装窗口：  
   https://raw.githubusercontent.com/AXIRYYYY/gemini-chat-export-enhanced/main/gemini-chat-export-enhanced.user.js
3. 点击 **安装** 即可
4. 打开 [Google Gemini](https://gemini.google.com/app) 即可看到右侧备份面板

> 💡 直链安装后，Tampermonkey 会定期检查更新，当有新版本时自动提示升级。

### 方法二：手动安装

1. 安装浏览器脚本管理器（如 [Tampermonkey](https://www.tampermonkey.net/)）
2. 下载本仓库的 [`gemini-chat-export-enhanced.user.js`](./gemini-chat-export-enhanced.user.js) 文件
3. 用文本编辑器打开，全选复制全部代码
4. 在 Tampermonkey 中点击"创建新脚本"，粘贴代码
5. 保存并启用脚本（按 `Ctrl+S`）

---

## 🚀 使用教程

### 单个对话导出
1. 打开 Gemini 聊天页面，右侧会出现**备份面板**
2. 在面板顶部点击切换导出格式（**MD** / JSON / TXT）
3. 点击 **📜 导出当前对话** 按钮
4. 脚本会自动向上滚动加载全部历史记录，然后生成下载文件

### 批量导出所有对话
1. 在 Gemini **侧边栏**中手动向下滚动，让所有对话列表都加载出来
2. 在备份面板中点击 **🔍 扫描/累积** 按钮，采集所有对话条目
3. 按钮文字会显示采集到的对话数量，如 `🗂️ 导出队列 (15)`
4. 点击该按钮，确认后脚本会**逐个自动点击**每个对话并导出
5. 在批量过程中可以使用 **⏸️ 暂停** 和 **🛑 停止后续任务**

> 💡 批量导出时请**不要操作鼠标**，让脚本自动完成。

### 快捷键
| 快捷键 | 功能 |
|--------|------|
| **Alt + Q** | 隐藏/显示备份面板 |

---

## 🔄 版本更新

本脚本使用油猴标准的 `@version` 字段进行版本管理。

### 自动更新（推荐）

如果你使用**方法一（直链安装）**，Tampermonkey 会自动处理更新：

1. Tampermonkey 每隔一段时间自动检查脚本的 `@version` 字段
2. 当 GitHub 上的版本号 > 你本地的版本号时，会弹出更新提示
3. 点击"更新"即可升级到最新版
4. 也可以在 Tampermonkey 管理面板中手动点击 **"检查更新"**

### 手动更新

如果你使用**方法二（手动安装）**：

1. 访问本仓库，下载最新的 `gemini-chat-export-enhanced.user.js`
2. 在 Tampermonkey 中打开该脚本，全选替换为新内容
3. 保存即可（按 `Ctrl+S`）

### 版本号规则

当前版本：**v13.11**（对应 `@version 13.11.0`）

版本号格式为 `主版本.次版本.修订号`：
- 新功能 → 递增次版本号
- Bug 修复 → 递增修订号
- 不兼容的大改动 → 递增主版本号

---

## 📄 许可证与版权

本项目基于 [Apache License 2.0](./LICENSE) 开源。

- 原始代码版权归 [Sxuan-Coder](https://github.com/Sxuan-Coder) 所有
- 修改和新增功能版权归 [AXIRYYYY](https://github.com/AXIRYYYY) 所有
- 本 License 不授权使用原作者的商标、服务标志或产品名称

---

## 🤝 参与贡献

欢迎提 Issue 报告 Bug 或建议新功能，也欢迎直接提 PR 参与开发。详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

---

## 🔗 相关链接

| 项目 | 链接 |
|------|------|
| 本项目仓库 | [AXIRYYYY/gemini-chat-export-enhanced](https://github.com/AXIRYYYY/gemini-chat-export-enhanced) |
| 原项目（用户脚本版） | [Sxuan-Coder/gemini_chat_export](https://github.com/Sxuan-Coder/gemini_chat_export) |
| 原作者的 Chrome 插件版 | [AIhubEnhenced Releases](https://github.com/Sxuan-Coder/AIhubEnhenced/releases) |

> ℹ️ 如果你需要多平台支持（Gemini / GPT / Grok），推荐试试原作者的 [AIhubEnhenced Chrome 插件](https://github.com/Sxuan-Coder/AIhubEnhenced/releases)。本脚本专注于为偏好 Tampermonkey 用户脚本和需要批量导出 Gemini 对话的用户提供解决方案。

---

💡 **免责声明**：本脚本旨在方便用户备份**自己的**聊天记录，请勿用于非法抓取他人隐私数据。
