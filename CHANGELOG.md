# Changelog

## [13.13.3] — 2026-10-30

### Changed
- 用量卡改为扁平的右下角横条：贴右侧、宽 60vw、指标一行 + 预警一行（过长省略，悬停看全文）
- 给页面滚动容器补 96px 底部内边距，卡片只占底部一条，不遮住原本内容

## [13.13.2] — 2026-10-30

### Fixed
- 修复 Gemini 启用 Trusted Types（`require-trusted-types-for 'script'`）后用量提示卡不显示：浏览器拒绝 `innerHTML` 赋值（报 `Failed to set the 'innerHTML' property ... requires 'TrustedHTML'`），改用 `document.createElement` + `textContent` 构建卡片，不再触发 Trusted Types

## [13.13.1] — 2026-10-30

### Fixed
- `/usage` 无风险时也显示一行紧凑状态（13.13.0 只在有风险时出现，容易误判为“卡片没生效”）
- 5 小时重置只有时间时（例如 22:03 看到「1:35」），按“下一次且不超过 5.5 小时”解析，修复跨午夜时间被丢弃
- 周额度预测在近 24 小时速度为 0/负数时回退到“本周平均速度”，避免最近没怎么用就完全不预警

## [13.13.0] — 2026-10-30

### Added
- 悬浮面板支持折叠：标题栏「－」收起为右上角 44px 图标，点击图标或 Alt+W 展开，折叠状态记忆
- 新增 Gemini 用量预警卡：仅在 gemini.google.com/usage 显示；读取页面自身的 5 小时 / 每周额度，按 90% 阈值与速度预测是否会在重置前用完

### Changed
- 面板标题与日志版本号更新到 v13.13

## [13.11.0] — 2026-07-24

### Fixed
- 队列导出点击 `gem-nav-list-item` 不触发导航，内容始终是同一对话 → 改用内部 `<a>` 标签点击 + DOM 轮询等待新对话内容加载
- 放弃任务仍触发下载（`captureCurrentChat` 末尾无条件 `Core.extractNodes()` 重新装填数据）→ 新增 `abandonSignal` 标志，三层防护：放弃按钮设标志、capture 末行加 guard、download 开头提前返回
- `abandonSignal` 在任务开始/结束时正确重置

## [13.10.0] — 2026-07-24

### Fixed
- 重写 `findMainScroller`：放弃启发式猜元素方式，改为从 `user-query` / `model-response` 对话元素向上遍历父节点，找第一个 `overflow-y: auto/scroll` 的可滚动容器，杜绝页面级抖动

## [13.9.0] — 2026-07

### Changed
- 适配 Gemini UI 更新后的侧边栏对话列表选择器：`gem-nav-list-item[data-test-id="conversation"]` 替代 `.conversation`
- 适配当前选中对话选择器：`a.is-active[aria-current="page"]` 替代 `.conversation.selected`
- 标题选择器：`.title-text` 替代 `.conversation-title`

### Fixed
- 解决当前对话名称无法更新的问题

## [13.8.0] — 2026-07

### Added
- 批量导出暂停/继续功能（`pauseSignal` + 暂停循环）
- 统一 UI 状态管理器 `updateUiState`，杜绝按钮在错误状态下显示或隐藏

### Changed
- 重构任务流程控制，引入 `working_single` / `working_batch` / `paused` / `idle` 四种 UI 状态
- 优化日志系统，采用环形缓冲区模式（`MAX_LOG_LINES = 200`）

## [13.7.0] — 2026-07

### Fixed
- 修正 `recursiveParse` 递归解析逻辑中错误屏蔽 `<td>` / `<th>` 子节点的问题
- 解决表格结构存在但单元格内容始终为空的核心 Bug
- 完美支持 Gemini 的复杂表格结构

## 13.4.0 — 13.6.0

内部迭代版本，未归档。

## [13.3.0] — 2026-06

### Added
- 首个归档版本
- 核心大改：对 AI 回复模拟点击官方"复制"按钮并读取剪贴板，获取 100% 原生 Markdown 格式
- TXT / JSON / Markdown 三种导出格式
- 自动滚动加载并捕获完整对话历史
- Canvas / 代码块 / 文档内容导出
- AI 思考过程（Thinking）捕获和导出
