# 贡献指南

首先，感谢你对这个项目感兴趣！🎉

Gemini Chat Export Enhanced 是一个油猴脚本，代码量不大但功能实用。无论你是想报告 Bug、提新功能建议，还是直接贡献代码——都非常欢迎。

---

## 🐛 报告 Bug

发现了问题？请通过 [GitHub Issues](https://github.com/AXIRYYYY/gemini-chat-export-enhanced/issues) 提交 Bug 报告。

一个好的 Bug 报告应包含：

1. **描述问题**：发生了什么？预期应该发生什么？
2. **复现步骤**：一步步说明如何触发这个 Bug
3. **环境信息**：
   - 浏览器名称和版本
   - Tampermonkey 版本
   - Gemini Chat Export Enhanced 版本（可在 Tampermonkey 管理面板查看）
4. **截图或日志**（如果方便）：浏览器的 Console 日志（按 F12 → Console 查看）

---

## 💡 提功能建议

有想法？同样通过 [GitHub Issues](https://github.com/AXIRYYYY/gemini-chat-export-enhanced/issues) 提交。

提建议时请说明：
- 你想解决什么问题
- 你期望的效果是什么样的
- 有什么可以参考的竞品或类似功能

---

## 💻 贡献代码

### 项目结构

本项目是单文件用户脚本，没有构建工具：

```
gemini-chat-export-enhanced.user.js   ← 唯一需要改的代码文件
AGENTS.md                             ← 开发约定（工具使用说明）
```

### 开发流程

1. **Fork** 本仓库
2. **克隆**你的 fork 到本地
3. 用文本编辑器打开 `gemini-chat-export-enhanced.user.js`
4. 修改后在 Tampermonkey 中**本地加载副本**进行测试
5. 确认功能正常后，提交 PR 到 `main` 分支

### 代码风格

- 使用 `'use strict'` 严格模式
- 缩进：4 空格
- 变量命名：驼峰式（`camelCase`）
- 发送前确保 Tab 格式一致（不要混用 Tab 和空格）

### 测试

目前没有自动化测试。请在提交前手工验证：

- [ ] 在 Gemini 页面上备份面板能正常显示
- [ ] 单个对话导出功能正常（MD / JSON / TXT）
- [ ] 批量扫描和导出功能正常
- [ ] 暂停/继续/放弃功能正常
- [ ] 没有破坏现有功能
- [ ] 浏览器 Console 中没有新增错误

---

## 🏷️ Good First Issue

如果你是第一次参与开源，我们有一些简单的任务适合入手，标记了 `good first issue` 标签。

---

## 📄 许可

贡献的代码将遵循 [Apache License 2.0](./LICENSE)。
