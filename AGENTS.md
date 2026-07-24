# AGENTS.md — Gemini 全量备份工具 项目开发约定

## 1 文件架构

```
Gemini 全量备份工具 (vX.X 描述).user.js  ← 版本归档（本地，gitignore）
gemini-chat-export-enhanced.user.js     ← 发布文件（git 跟踪，直链安装用）
```

- **版本归档**：每次改功能前 `Copy-Item` 旧版。文件名含版本号 + 功能描述。
- **发布文件**：始终是 `gemini-chat-export-enhanced.user.js`，由最新版 `Copy-Item` + `edit` 替换 header 得到。

## 2 版本号 & 头部约定

- `@name` 不写版本号（Tampermonkey 靠 `@name + @namespace` 识别脚本，名字含版本号会断掉自动更新）
- `@version` 用 semver：`主.次.修订`
- 发布文件额外需要 `@updateURL` / `@downloadURL` 直链

```
// ⚠️ 发布文件 header → 增强版字段
// @name         Gemini 全量备份工具增强版 (Gemini Chat Export Enhanced)
// @version      13.11.0
// @description  基于 Sxuan-Coder/...深度定制，新增批量导出/...。适配 Gemini 新版 UI。
// @author       Sxuan-Coder (Original) / AXIRYYYY (Enhanced Fork)
// @homepage     https://github.com/AXIRYYYY/gemini-chat-export-enhanced
// @updateURL    https://raw.githubusercontent.com/AXIRYYYY/.../main/gemini-chat-export-enhanced.user.js
// @downloadURL  （同上）
```

## 3 PowerShell 编码铁律

**永远不要用 `Set-Content` 写含中文的 `.user.js` 文件。**

PowerShell 5.1 默认 `Set-Content` 用 ANSI 编码，会把 UTF-8 中文字符全毁成 `�`。

### 正确操作

| 目的 | 方法 |
|------|------|
| 复制版本文件 | `Copy-Item`（保留原始编码） |
| 改代码 | 用 `edit` 工具（保留编码） |
| 重建发布文件 | `Copy-Item` 最新版 → enhanced，再用 `edit` 换 header |
| 写新文件（如 CHANGELOG.md） | 用 `write` 工具 |

### 验证方法

```powershell
$bytes = [IO.File]::ReadAllBytes("path")
$bad = 0
for ($i = 0; $i -lt ($bytes.Length - 2); $i++) {
    if ($bytes[$i] -eq 0xEF -and $bytes[$i+1] -eq 0xBF -and $bytes[$i+2] -eq 0xBD) { $bad++ }
}
# bad 必须为 0
```

## 4 SPA 导航等待（队列导出核心）

队列导出中点击侧边栏后，SPA 异步切换 DOM：**旧对话节点还在但即将被移除**。

### ❌ 错误做法

```javascript
clickTarget.click();
// 旧对话的 user-query 还挂在 DOM → 秒退，从未等新内容
while (timeout) { if (document.querySelector('user-query')) break; }
```

### ✅ 正确做法

```javascript
const oldNode = document.querySelector('user-query');  // 存引用
clickTarget.click();
// 等旧节点被 DOM 移除 = 真·导航完成
while (timeout) { if (!document.contains(oldNode)) break; await wait(300); }
// 再等新内容出现
while (timeout) { if (document.querySelector('user-query')) break; await wait(300); }
```

## 5 滚动容器检测

### ❌ 错误做法

```javascript
return window;  // 回退到 window 会导致整个页面抖动
```

### ✅ 正确做法（v13.12）

```
1. 从 user-query/model-response 向上遍历找 overflow-y: auto/scroll 的父节点
2. 启发式扫描 div/main/infinite-scroller 找最大的可滚动容器（left > 200 排除侧边栏）
3. document.documentElement（最后底线，绝不返回 window）
```

### ⚡ 配合 getCaptureCurrentChat 的前等待

```javascript
// 在 findMainScroller 调用前，先异步等对话内容渲染
let n = 0;
while (!document.querySelector('user-query, model-response') && n < 10 && !stopSignal) {
    await Core.wait(300);
    n++;
}
// 现在才调 findMainScroller，保证不会因为页面空白而进退路
```

## 6 同步 busy-wait 禁令

```javascript
// ❌ 禁止：同步 while 循环会卡死 UI
while (!el && retries < 10) {
    el = document.querySelector(...);
    let t = Date.now(); while (Date.now() - t < 200) {}
}
// ✅ 正确：用 async/await
while (!el && retries < 10) {
    el = document.querySelector(...);
    await Core.wait(200);
}
```
> `findMainScroller` 本身是 sync 函数，不能 `await`，所以它不做重试，由调用方 `captureCurrentChat`（async）在调用前做重试。

## 7 Git 工作流

### .gitignore 白名单

```
*                         ← 默认屏蔽所有
!.gitignore
!LICENSE
!README.md
!CHANGELOG.md
!AGENTS.md
!gemini-chat-export-enhanced.user.js
```

- 版本文件 `Gemini 全量备份工具 (vX.X...).user.js` 本地保留，不进 git
- 只有增强版发布文件进 git

### 版本发布流程

1. `Copy-Item` 旧版 → 新版（保留编码）
2. `edit` 工具改代码
3. `Copy-Item` 新版 → `gemini-chat-export-enhanced.user.js`
4. `edit` 替换 header（增强版 `@name` `@author` `@updateURL` 等）
5. 更新 `CHANGELOG.md`
6. 更新 `README.md` 版本号
7. `git add ... && git commit -m "..." && git push origin main`

### amend / force push

修改推送后发现问题：`git commit --amend && git push --force origin main`
（覆盖远端最后一次 commit，对单人 repo 安全可用）

## 8 边界情况清单

- [ ] `findMainScroller` 有没有 fallback 到 `window`？→ 不能
- [ ] 队列导航后有等到旧 DOM 被移除？→ `document.contains(oldNode)`
- [ ] `captureCurrentChat` 开头有没有等内容？→ 10 × 300ms
- [ ] 发布文件 header 的 `@name` 有没有版本号？→ 不能有
- [ ] `Set-Content` 有没有用于写 `.user.js`？→ 不能用
- [ ] `abandonSignal` 在 task 开始/结束有没有重置？→ 两端都要 `= false`
