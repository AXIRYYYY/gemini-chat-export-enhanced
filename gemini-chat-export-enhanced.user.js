// ==UserScript==
// @name         Gemini 全量备份工具增强版 (Gemini Chat Export Enhanced)
// @namespace    http://tampermonkey.net/
// @version      13.13.3
// @description  基于 Sxuan-Coder/gemini_chat_export 早期版本深度定制，新增批量导出/暂停/中断/可调参数/表格渲染等功能。适配 Gemini 新版 UI。新增悬浮面板折叠；新增 Gemini 用量预警（仅 /usage，读页面数据，不发请求）。
// @author       Sxuan-Coder (Original) / AXIRYYYY (Enhanced Fork)
// @match        https://gemini.google.com/*
// @grant        GM_addStyle
// @icon         https://www.gstatic.com/images/branding/product/1x/gemini_gradient_icon_48dp.png
// @license      Apache-2.0
// @homepage     https://github.com/AXIRYYYY/gemini-chat-export-enhanced
// @supportURL   https://github.com/Sxuan-Coder/AIhubEnhenced/releases
// @updateURL    https://raw.githubusercontent.com/AXIRYYYY/gemini-chat-export-enhanced/main/gemini-chat-export-enhanced.user.js
// @downloadURL  https://raw.githubusercontent.com/AXIRYYYY/gemini-chat-export-enhanced/main/gemini-chat-export-enhanced.user.js
// ==/UserScript==

(function () {
    'use strict';

    // --- ⚙️ 配置中心 ---
    const CONFIG = {
        mainScrollStep: 1.5,
        batchPageLoad: 4000,
        uiZIndex: 999999
    };

    const State = {
        isWorking: false,
        stopSignal: false,
        pauseSignal: false, // [MODIFIED] 新增暂停状态
        abandonSignal: false, // [v13.11] 放弃任务标志，置 true 时跳过所有下载
        collectedData: new Map(),
        sidebarQueue: new Map(),
        format: 'md',
        scrollDelay: 300,
        historyDelay: 1500
    };

    const DOM = {
        el: (tag, styles = {}, text = '') => {
            const el = document.createElement(tag);
            Object.assign(el.style, styles);
            if (text) el.innerText = text;
            return el;
        },

        // --- 🔥 核心引擎：递归 DOM 解析器 (v13.7 Fix) 🔥 ---
        recursiveParse: (node) => {
            if (!node) return "";

            // 1. 文本节点
            if (node.nodeType === Node.TEXT_NODE) {
                return node.textContent;
            }

            // 2. 元素节点
            if (node.nodeType === Node.ELEMENT_NODE) {
                const tag = node.tagName.toLowerCase();

                // 代码块
                if (tag === 'code-block' || tag === 'pre') {
                    const lang = node.getAttribute('data-language') || '';
                    return `\n\n\`\`\`${lang}\n${node.textContent.trim()}\n\`\`\`\n\n`;
                }

                // --- 表格处理 ---
                if (tag === 'table') {
                    let tableMd = "\n\n";
                    // 穿透抓取所有行
                    const rows = Array.from(node.querySelectorAll('tr'));

                    if (rows.length === 0) return "";

                    rows.forEach((tr, rowIndex) => {
                        const cells = Array.from(tr.querySelectorAll('td, th'));

                        const rowContent = "| " + cells.map(c => {
                            // 递归解析单元格 (此时 c 是 td/th，下面必须允许递归)
                            let cellText = DOM.recursiveParse(c).trim();
                            cellText = cellText.replace(/\|/g, '\\|');
                            cellText = cellText.replace(/[\r\n]+/g, '<br>');
                            return cellText;
                        }).join(" | ") + " |";

                        tableMd += rowContent + "\n";

                        if (rowIndex === 0) {
                            const separator = "| " + cells.map(() => "---").join(" | ") + " |";
                            tableMd += separator + "\n";
                        }
                    });
                    return tableMd + "\n";
                }

                // 递归子节点
                let childrenText = "";
                Array.from(node.childNodes).forEach(child => {
                    // 🔥 关键修复：从黑名单中移除 td 和 th
                    // 只有 tr, thead, tbody 这些纯结构标签不需要在这里递归（因为 table 逻辑已经处理了它们）
                    // td 和 th 必须递归，否则无法读取里面的 span/text
                    if (!['tr', 'thead', 'tbody', 'table'].includes(tag)) {
                        childrenText += DOM.recursiveParse(child);
                    }
                });

                // --- 标签转换 ---

                if (tag === 'strong' || tag === 'b') {
                    const trimmed = childrenText.trim();
                    if (!trimmed) return "";
                    const prefix = childrenText.match(/^\s*/) ? childrenText.match(/^\s*/)[0] : "";
                    const suffix = childrenText.match(/\s*$/) ? childrenText.match(/\s*$/)[0] : "";
                    return `${prefix}**${trimmed}**${suffix}`;
                }

                if (tag === 'em' || tag === 'i') {
                    const trimmed = childrenText.trim();
                    if (!trimmed) return "";
                    return ` *${trimmed}* `;
                }

                if (tag === 'a') {
                    const href = node.getAttribute('href');
                    if (href) return ` [${childrenText.trim()}](${href}) `;
                    return childrenText;
                }

                if (/^h[1-6]$/.test(tag)) {
                    const level = parseInt(tag[1]);
                    return `\n\n${'#'.repeat(level)} ${childrenText.trim()}\n\n`;
                }

                if (tag === 'p') return `\n\n${childrenText.trim()}\n\n`;
                if (tag === 'li') return `\n- ${childrenText.trim()}\n`;
                if (tag === 'br') return '  \n';

                return childrenText;
            }
            return "";
        },

        parseMarkdown: (rootNode) => {
            if (!rootNode) return "";
            let text = DOM.recursiveParse(rootNode);

            // 后期清洗
            text = text.replace(/^\s*-\s+[\r\n]+/gm, '- ');
            text = text.replace(/\n{3,}/g, '\n\n');

            return text.trim();
        },

        // ============================================================
        // [v13.92 修改] 适配 Gemini 新 UI 的侧边栏对话列表选择器
        // 旧 UI: 对话项使用 .conversation 类，标题使用 .conversation-title 类
        // 新 UI: 对话项使用 gem-nav-list-item[data-test-id="conversation"] 自定义元素
        //        标题使用 .title-text 类
        // ============================================================
        getChatItems: (debug = false) => {
            // [v13.92] 修改选择器: .conversation → gem-nav-list-item[data-test-id="conversation"]
            const items = Array.from(document.querySelectorAll('gem-nav-list-item[data-test-id="conversation"]'));
            const results = [];
            items.forEach((el, index) => {
                // [v13.92] 修改标题选择器: .conversation-title → .title-text
                if (!el.querySelector('.title-text')) return;
                const titleEl = el.querySelector('.title-text');
                let title = titleEl ? titleEl.innerText : "未命名对话";
                title = title.replace(/[\r\n]/g, "").trim();
                const jslog = el.getAttribute('jslog') || "";
                const idMatch = jslog.match(/c_[a-f0-9]+/);
                let baseId = idMatch ? idMatch[0] : "unknown";
                const uniqueFingerprint = `${baseId}_${title.substring(0, 5)}_${index}`;
                if (debug) el.style.border = "2px solid #00ff00";
                const linkEl = el.querySelector('a');
                results.push({ el: el, linkEl: linkEl, id: uniqueFingerprint, title: title });
            });
            return results;
        },

        findMainScroller: () => {
            // [v13.12] 从对话元素向上遍历，退路启发式扫描，绝不返回 window
            const chatEl = document.querySelector('user-query, model-response');
            if (chatEl) {
                let el = chatEl.parentElement;
                while (el && el !== document.body) {
                    const s = window.getComputedStyle(el);
                    if (['auto', 'scroll'].includes(s.overflowY) && el.scrollHeight > el.clientHeight + 50) {
                        return el;
                    }
                    el = el.parentElement;
                }
            }
            // 退路：启发式扫描所有容器，找最大的非侧边栏可滚动元素
            let max = 0, target = null;
            document.querySelectorAll('div, main, infinite-scroller').forEach(el => {
                if (el.offsetParent && el.scrollHeight > el.clientHeight + 50) {
                    const s = window.getComputedStyle(el);
                    if (['auto', 'scroll'].includes(s.overflowY)) {
                        const rect = el.getBoundingClientRect();
                        if (rect.left > 200 && el.scrollHeight > max) { max = el.scrollHeight; target = el; }
                    }
                }
            });
            return target || document.documentElement;
        },

        // ============================================================
        // [v13.9 修改] 适配 Gemini 新 UI 的"当前选中对话"选择器
        // 旧 UI: 当前对话使用 .conversation.selected 类
        // 新 UI: 当前对话的 <a> 链接上同时有 is-active 和 aria-current="page"
        //        is-active 在 <a> 元素上，不在父级 gem-nav-list-item 上
        //        标题使用 .title-text 类
        // ============================================================
        getTitle: () => {
            // [v13.9] 选择器改为查找 <a> 标签上的 is-active + aria-current="page"
            // 因为 is-active 类在 <a> 元素上，而非父级 gem-nav-list-item
            const selectedItem = document.querySelector('a.is-active[aria-current="page"]');
            if (selectedItem) {
                // [v13.92] 标题选择器: .conversation-title → .title-text（保持不变）
                const titleEl = selectedItem.querySelector('.title-text');
                if (titleEl) return titleEl.innerText.trim();
            }
            return null;
        }
    };

    const Core = {
        wait: ms => new Promise(r => setTimeout(r, ms)),

        extractNodes: () => {
            const nodes = document.querySelectorAll('user-query, model-response');
            let count = 0;
            nodes.forEach((node) => {
                if (!State.collectedData.has(node)) {
                    const role = node.tagName.toLowerCase() === 'user-query' ? 'user' : 'model';
                    let content = '', thought = '';

                    if (role === 'user') {
                        content = DOM.parseMarkdown(node);
                    } else {
                        const tNode = node.querySelector('model-thoughts');
                        if (tNode) {
                            thought = DOM.parseMarkdown(tNode).replace(/Thinking Process|显示思路/gi, '').trim();
                        }
                        const txtNode = node.querySelector('.model-response-text') || node;
                        content = DOM.parseMarkdown(txtNode);
                    }

                    if (content || thought) {
                        State.collectedData.set(node, { el: node, role, content, thought });
                        count++;
                    }
                }
            });
            return count;
        },

        captureCurrentChat: async () => {
            State.collectedData.clear();
            // [v13.12] 等新对话内容渲染到位再找 scroller，防止导航后空白期导致退路命中 window
            let waitAttempts = 0;
            while (!document.querySelector('user-query, model-response') && waitAttempts < 10 && !State.stopSignal) {
                await Core.wait(300);
                waitAttempts++;
            }
            const scroller = DOM.findMainScroller();
            const isWindow = scroller === window || scroller === document.documentElement;

            UI.log(`🔄 追溯历史 (延迟: ${State.historyDelay}ms)...`);
            let noChangeCount = 0;
            let lastScrollHeight = isWindow ? document.documentElement.scrollHeight : scroller.scrollHeight;
            let loopCount = 0;

            while (loopCount < 100 && !State.stopSignal) {
                if (isWindow) window.scrollTo(0, 0); else scroller.scrollTop = 0;
                await Core.wait(State.historyDelay);

                const currentScrollHeight = isWindow ? document.documentElement.scrollHeight : scroller.scrollHeight;

                if (currentScrollHeight > lastScrollHeight + 100) {
                    const diff = currentScrollHeight - lastScrollHeight;
                    UI.log(`📜 历史加载成功 (+${diff}px)...`);
                    lastScrollHeight = currentScrollHeight;
                    noChangeCount = 0;
                } else {
                    noChangeCount++;
                    UI.log(`⚠️ 未变化 (${noChangeCount}/10)，执行深蹲...`);

                    if (isWindow) window.scrollBy(0, 300); else scroller.scrollBy(0, 300);
                    await Core.wait(300);
                    if (isWindow) window.scrollTo(0, 0); else scroller.scrollTop = 0;

                    if (noChangeCount >= 10) {
                        UI.log('✅ 历史已全部加载');
                        break;
                    }
                }
                loopCount++;
            }

            if (!State.stopSignal) {
                UI.log('🚀 极速抓取中...');
                let sameH = 0;
                while (!State.stopSignal) {
                    const newFound = Core.extractNodes();
                    if (newFound > 0) UI.log(`📦 新增 ${newFound} 条...`);

                    const top = isWindow ? window.scrollY : scroller.scrollTop;
                    const total = isWindow ? document.documentElement.scrollHeight : scroller.scrollHeight;
                    const view = isWindow ? window.innerHeight : scroller.clientHeight;

                    if (top + view >= total - 50) {
                        sameH++; if (sameH > 3) break;
                    } else {
                        sameH = 0;
                        const step = view * CONFIG.mainScrollStep;
                        if (isWindow) window.scrollBy({ top: step, behavior: 'auto' });
                        else scroller.scrollBy({ top: step, behavior: 'auto' });
                    }
                    await Core.wait(State.scrollDelay);
                }
            } else {
                UI.log('⚡ 已中断，准备保存...');
            }

            if (!State.abandonSignal) Core.extractNodes();
            UI.log(`✅ 抓取结束 (共 ${State.collectedData.size} 条)`);
        },

        download: (customTitle = null) => {
            if (State.abandonSignal) {
                UI.log('🛑 任务已放弃，跳过下载');
                return;
            }
            if (State.collectedData.size === 0) {
                UI.log('⚠️ 内容为空，跳过');
                return;
            }

            const list = Array.from(State.collectedData.values()).sort((a, b) => {
                const pos = a.el.compareDocumentPosition(b.el);
                if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
                if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
                return 0;
            });

            let finalTitle = customTitle || DOM.getTitle();
            if (!finalTitle || finalTitle.includes("未命名") || finalTitle === "Gemini" || finalTitle.length < 2) {
                const firstUser = list.find(x => x.role === 'user');
                finalTitle = firstUser ? firstUser.content.substring(0, 20).replace(/[\r\n]/g, '') : "Gemini_Backup";
            }

            finalTitle = finalTitle.replace(/[\\/:\*\?"<>\|]/g, '_').substring(0, 60);
            const now = new Date();
            const time = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

            let str = '', mime = '', ext = '';

            if (State.format === 'json') {
                str = JSON.stringify({ title: finalTitle, date: time, data: list }, null, 2);
                mime = 'application/json'; ext = 'json';
            } else if (State.format === 'txt') {
                mime = 'text/plain'; ext = 'txt';
                str = `Title: ${finalTitle}\nDate: ${time}\n\n`;
                list.forEach(d => str += `[${d.role}]\n${d.thought ? `{Thought: ${d.thought}}\n` : ''}${d.content}\n\n---\n\n`);
            } else {
                mime = 'text/markdown'; ext = 'md';
                str = `# ${finalTitle}\n\n> Date: ${time}\n\n`;
                list.forEach(d => {
                    const r = d.role === 'user' ? 'User' : 'Gemini';
                    if (d.thought) str += `<details><summary>🧠 Thinking</summary>\n\n${d.thought}\n\n</details>\n\n`;
                    str += `### **${r}**\n\n${d.content}\n\n---\n\n`;
                });
            }

            const blob = new Blob([str], { type: mime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${finalTitle}_${time}.${ext}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            UI.log(`💾 已保存: ${finalTitle}`);
        },

        accumulateScan: () => {
            const items = DOM.getChatItems(true);
            let newCount = 0;
            items.forEach(item => {
                if (!State.sidebarQueue.has(item.id)) {
                    State.sidebarQueue.set(item.id, item);
                    newCount++;
                }
            });
            UI.log(`🔍 扫描: 新增 ${newCount} 个，队列总计: ${State.sidebarQueue.size} 个`);
            UI.updateBatchBtn();
        },

        runBatchFromQueue: async () => {
            if (State.isWorking) return;
            if (State.sidebarQueue.size === 0) {
                Core.accumulateScan();
                if (State.sidebarQueue.size === 0) {
                    alert('队列为空。请先手动滚动侧边栏，然后点击【🔍 扫描】。');
                    return;
                }
            }

            const allChats = Array.from(State.sidebarQueue.values());
            const confirmed = confirm(`📦 队列中共有 ${allChats.length} 个对话。\n\n点击【确定】开始导出。\n(脚本将自动点击每个对话，请勿操作鼠标)`);
            if (!confirmed) return;

            State.isWorking = true; State.stopSignal = false; State.pauseSignal = false; State.abandonSignal = false;
            UI.clearLog();
            UI.updateUiState('working_batch');

            for (let i = 0; i < allChats.length; i++) {
                if (State.stopSignal) break;

                // [MODIFIED] 增加暂停循环
                while (State.pauseSignal && !State.stopSignal) {
                    await Core.wait(500); // 暂停时每半秒检查一次状态
                }
                if (State.stopSignal) break; // 从暂停中恢复后再次检查停止信号

                const chat = allChats[i];
                let safeTitle = chat.title;

                UI.log(`\n▶️ [${i + 1}/${allChats.length}] 处理: ${safeTitle.substring(0, 15)}...`);

                // [v13.12] 点击 <a> 导航，用旧节点消失 + 新节点出现确认切换成功
                const isActive = chat.linkEl && chat.linkEl.classList.contains('is-active');
                if (isActive || chat.el.classList.contains('selected')) {
                    UI.log(`ℹ️ 跳过切换 (当前已选中)...`);
                } else {
                    const oldFirstNode = document.querySelector('user-query');
                    const clickTarget = chat.linkEl || chat.el;
                    clickTarget.click();
                    if (oldFirstNode) {
                        // 等旧 DOM 被移除 = 真正切换了
                        const waitStart = Date.now();
                        while (Date.now() - waitStart < CONFIG.batchPageLoad) {
                            if (!document.contains(oldFirstNode)) break;
                            await Core.wait(300);
                        }
                    }
                    // 等新内容出现
                    const contentStart = Date.now();
                    while (Date.now() - contentStart < CONFIG.batchPageLoad) {
                        if (document.querySelector('user-query')) break;
                        await Core.wait(300);
                    }
                }

                await Core.captureCurrentChat();
                Core.download(safeTitle);
                await Core.wait(1000);
            }

            State.isWorking = false;
            State.stopSignal = false;
            State.pauseSignal = false;
            State.abandonSignal = false;
            UI.updateUiState('idle');
            if (!State.stopSignal && !State.abandonSignal) alert('🎉 队列备份完成！');
        }
    };

    // =====================================================================
    // 📊 用量预警（仅在 gemini.google.com/usage 页面生效）
    // - 数据来源：页面自身 DOM（[data-testid="current-usage"] / ["weekly-usage"]），
    //   读不到时回退到页面 SSR 预载的 relay JSON。
    // - 不发起任何网络请求，不读 cookie；页面显示多少就用多少。
    // - 只在有风险时渲染提示卡，避免打扰。
    // =====================================================================
    const USAGE_CFG = {
        WARN_AT: 90,                 // ≥90% 黄色
        CARD_ID: 'gemini-usage-alert',
        HISTORY_KEY: 'gemini-usage-history-v1',
        HISTORY_KEEP_MS: 14 * 86400e3,
        VEL_LOOKBACK_MS: 24 * 3600e3,
        VEL_MIN_SPAN_MS: 3 * 3600e3,
        WEEK_MS: 7 * 86400e3,
        REFRESH_MS: 60e3,
        DAY_MS: 86400e3
    };

    // 兼容 /usage、/usage/、/u/1/usage、/u/1/usage/
    const isUsagePage = () => /^\/(?:u\/\d+\/)?usage\/?$/.test(location.pathname);

    const clampPct = (n) => Math.min(100, Math.max(0, n));

    // 把「11月3日16:35」/「20:35」解析成本地时间戳；解析不出或已过期返回 null
    // allowTimeOnly=true 只给 5 小时窗口用（每周必须有日期，避免把随便一个时间当成重置）
    const parseResetAt = (text, now, allowTimeOnly) => {
        // 英文 12 小时制（8:35 PM）不要用 24 小时正则硬解析，交给 relay 的 ISO 时间
        if (/\b(?:AM|PM)\b/i.test(text)) return null;

        // 1) 中文带日期「11月3日16:35」或「2026年11月3日16:35」
        let m = text.match(/(?:(\d{4})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*(\d{1,2}):(\d{2})/);
        if (m) {
            const hasYear = !!m[1];
            const year = hasYear ? +m[1] : now.getFullYear();
            let d = new Date(year, +m[2] - 1, +m[3], +m[4], +m[5], 0, 0);
            if (!hasYear && d.getTime() < now.getTime() - 86400e3) {
                d = new Date(year + 1, +m[2] - 1, +m[3], +m[4], +m[5], 0, 0); // 跨年
            }
            return d.getTime() > now.getTime() ? d.getTime() : null;
        }

        // 2) 斜杠/点号日期「2026/11/3 16:35」或「11/3 16:35」
        m = text.match(/(?:(\d{4})[\/.\-]\s*)?(\d{1,2})[\/.\-](\d{1,2})\s+(\d{1,2}):(\d{2})/);
        if (m) {
            const hasYear = !!m[1];
            const year = hasYear ? +m[1] : now.getFullYear();
            let d = new Date(year, +m[2] - 1, +m[3], +m[4], +m[5], 0, 0);
            if (!hasYear && d.getTime() < now.getTime() - 86400e3) {
                d = new Date(year + 1, +m[2] - 1, +m[3], +m[4], +m[5], 0, 0);
            }
            return d.getTime() > now.getTime() ? d.getTime() : null;
        }

        // 3) 只有时间「1:35」= 5 小时窗口；重置最多在 5 小时后
        if (!allowTimeOnly) return null;
        m = text.match(/(\d{1,2}):(\d{2})/);
        if (m) {
            let d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), +m[1], +m[2], 0, 0);
            // 时间已过（例如 22:03 看到 1:35）就试“明天同一时刻”
            if (d.getTime() <= now.getTime()) d = new Date(d.getTime() + 86400e3);
            const ahead = d.getTime() - now.getTime();
            // 超过 5.5 小时说明不是当前窗口（页面数据过期），不要硬猜
            return ahead > 0 && ahead <= 5.5 * 3600e3 ? d.getTime() : null;
        }
        return null;
    };

    // 读取一张用量卡（5 小时或每周）
    const parsePool = (el, now, allowTimeOnly) => {
        const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        const pm = text.match(/([\d.]+)\s*%/);
        if (!pm) return null;
        const pct = parseFloat(pm[1]);
        if (!Number.isFinite(pct)) return null;

        // 有些版本把绝对时间放在 span[title] 里，优先用它
        let resetAt = null;
        const titleEl = el.querySelector('span[title]');
        if (titleEl) {
            const t = Date.parse(String(titleEl.getAttribute('title')).replace(/\//g, '-'));
            if (Number.isFinite(t) && t > now.getTime()) resetAt = t;
        }
        if (resetAt == null) resetAt = parseResetAt(text, now, allowTimeOnly);

        return { percent: clampPct(pct), resetAt: resetAt };
    };

    // DOM 读取：最贴近用户眼前看到的数字
    const readDomUsage = () => {
        const cur = document.querySelector('[data-testid="current-usage"]');
        const wk = document.querySelector('[data-testid="weekly-usage"]');
        if (!cur && !wk) return null;
        const now = new Date();
        const updatedEl = document.querySelector('[data-testid="usage-updated"]');
        return {
            // 5 小时可能只显示时间；每周必须有日期，允许 relay 兜底
            fiveHour: cur ? parsePool(cur, now, true) : null,
            weekly: wk ? parsePool(wk, now, false) : null,
            updatedText: updatedEl ? (updatedEl.textContent || '').trim() : ''
        };
    };

    // 递归找包含 getUsageInfo 的对象（relay JSON 结构可能变，别写死路径）
    const deepFind = (node, pred, depth) => {
        depth = depth || 0;
        if (!node || typeof node !== 'object' || depth > 12) return null;
        if (pred(node)) return node;
        for (const k of Object.keys(node)) {
            const r = deepFind(node[k], pred, depth + 1);
            if (r) return r;
        }
        return null;
    };

    // relay 兜底：页面 SSR 预载的精确数据（不额外请求）
    const readRelayUsage = () => {
        const scripts = Array.from(document.querySelectorAll('script[type="application/json"][data-bg3-relay-preload]'));
        if (!scripts.length) return null;

        // 关键：chunk 是按 id 分片的，必须按顺序拼接后再 parse
        const byId = new Map();
        for (const s of scripts) {
            let obj;
            try { obj = JSON.parse(s.textContent || '{}'); } catch (e) { continue; }
            const events = Array.isArray(obj.events) ? obj.events : [];
            for (const ev of events) {
                if (ev && ev.kind === 'chunk' && ev.id) {
                    byId.set(ev.id, (byId.get(ev.id) || '') + String(ev.chunk || ''));
                }
            }
        }

        for (const raw of byId.values()) {
            let arr;
            try { arr = JSON.parse(raw); } catch (e) { continue; }
            const holder = deepFind(arr, (o) => o && typeof o === 'object' && o.getUsageInfo);
            const info = holder && holder.getUsageInfo;
            if (!info || !Array.isArray(info.pools)) continue;

            const out = { fiveHour: null, weekly: null, updatedText: '' };
            for (const p of info.pools) {
                if (!p) continue;
                const pct = Number(p.percentageUsed) * 100; // 0-1 → 0-100
                const at = Date.parse(p && p.gxu && p.gxu.windowRefreshesAt);
                if (!Number.isFinite(pct)) continue;
                const item = {
                    percent: clampPct(pct),
                    resetAt: Number.isFinite(at) && at > Date.now() ? at : null
                };
                if (p.poolType === 'GXU_FIVE_HOURLY') out.fiveHour = item;
                if (p.poolType === 'GXU_WEEKLY') out.weekly = item;
            }
            if (out.fiveHour || out.weekly) return out;
        }
        return null;
    };

    // 合并：百分比信 DOM；DOM 没解析出重置时间时用 relay 的精确 ISO 补
    const mergePool = (domPool, relayPool) => {
        if (!domPool) return relayPool;
        if (!relayPool) return domPool;
        return { percent: domPool.percent, resetAt: domPool.resetAt || relayPool.resetAt };
    };

    const readUsage = () => {
        const dom = readDomUsage();
        const relay = readRelayUsage();
        if (dom && relay) {
            return {
                fiveHour: mergePool(dom.fiveHour, relay.fiveHour),
                weekly: mergePool(dom.weekly, relay.weekly),
                updatedText: dom.updatedText || relay.updatedText || ''
            };
        }
        return dom || relay;
    };

    // ---- 历史样本 & 速度（localStorage 不可用时静默跳过，平均速度兜底） ----
    const loadHistory = () => {
        try {
            const d = JSON.parse(localStorage.getItem(USAGE_CFG.HISTORY_KEY) || '[]');
            return Array.isArray(d) ? d.filter(p => p && Number.isFinite(p.t)) : [];
        } catch (e) { return []; }
    };

    const recordHistory = (u) => {
        try {
            const h = loadHistory();
            const now = Date.now();
            const pt = {
                t: now,
                fiveHour: u.fiveHour ? u.fiveHour.percent : null,
                weekly: u.weekly ? u.weekly.percent : null
            };
            const last = h[h.length - 1];
            if (!last || now - last.t >= 5 * 60e3) h.push(pt);
            const cutoff = now - USAGE_CFG.HISTORY_KEEP_MS;
            localStorage.setItem(USAGE_CFG.HISTORY_KEY, JSON.stringify(h.filter(p => p.t >= cutoff).slice(-3000)));
        } catch (e) { /* ignore */ }
    };

    // 最小二乘；窗口重置（百分比大幅下降）时切断历史
    const velocity = (key) => {
        const h = loadHistory().filter(p => Number.isFinite(p[key]));
        if (h.length < 2) return null;

        const now = Date.now();
        let start = 0;
        for (let i = h.length - 1; i > 0; i--) {
            if (h[i - 1][key] - h[i][key] > 5) { start = i; break; }
        }
        const seg = h.slice(start);
        const target = now - USAGE_CFG.VEL_LOOKBACK_MS;
        let ai = 0;
        for (let i = 0; i < seg.length; i++) { if (seg[i].t <= target) ai = i; else break; }
        const pts = seg.slice(ai);
        if (pts.length < 2) return null;

        const t0 = pts[0].t;
        let sx = 0, sy = 0, sxx = 0, sxy = 0;
        for (const p of pts) {
            const x = (p.t - t0) / USAGE_CFG.DAY_MS;
            const y = p[key];
            sx += x; sy += y; sxx += x * x; sxy += x * y;
        }
        const n = pts.length;
        const denom = n * sxx - sx * sx;
        if (pts[n - 1].t - pts[0].t < USAGE_CFG.VEL_MIN_SPAN_MS || !(denom > 0)) return null;
        return { v: (n * sxy - sx * sy) / denom };
    };

    // ---- 格式化 ----
    const fmtClock = (ts) => new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    const fmtDateTime = (ts) => new Date(ts).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    const fmtLeft = (ts) => {
        const ms = ts - Date.now();
        if (!Number.isFinite(ms) || ms <= 0) return '即将重置';
        const mins = Math.ceil(ms / 60000);
        const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
        if (d > 0) return d + ' 天' + (h > 0 ? ' ' + h + ' 小时' : '');
        if (h > 0) return h + ' 小时' + (m > 0 ? ' ' + m + ' 分' : '');
        return m + ' 分钟';
    };
    const fmtSpan = (ms) => {
        const mins = Math.max(1, Math.round(ms / 60000));
        const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60);
        if (d > 0) return d + ' 天' + (h > 0 ? ' ' + h + ' 小时' : '');
        if (h > 0) return h + ' 小时';
        return mins + ' 分钟';
    };
    const resetHint = (ts) => {
        const s = fmtLeft(ts);
        return s === '即将重置' ? '即将重置' : '约 ' + s + '后';
    };
    const pctText = (p) => (Math.round(p * 10) / 10).toFixed(1).replace(/\.0$/, '') + '%';

    // ---- 核心预警规则（只针对 Gemini 的 5 小时 / 每周两档） ----
    const analyzeUsage = (u) => {
        const alerts = [];
        const now = Date.now();
        const f5 = u && u.fiveHour;
        const w = u && u.weekly;

        if (f5) {
            if (f5.percent >= 100) {
                alerts.push({ rule: 'f5-full', level: 'red', text: '5 小时额度已用完（100%）' + (f5.resetAt ? '，' + fmtClock(f5.resetAt) + ' 恢复（' + resetHint(f5.resetAt) + '）' : '') + '——期间新对话可能被限流' });
            } else if (f5.percent >= USAGE_CFG.WARN_AT) {
                alerts.push({ rule: 'f5-warn', level: 'yellow', text: '5 小时额度已用 ' + pctText(f5.percent) + (f5.resetAt ? '，' + fmtClock(f5.resetAt) + ' 重置（' + resetHint(f5.resetAt) + '）' : '') + '，省着用' });
            }
        }

        if (w) {
            if (w.percent >= 100) {
                alerts.push({ rule: 'w-full', level: 'red', text: '本周额度已用完（100%）' + (w.resetAt ? '，' + fmtDateTime(w.resetAt) + ' 重置（' + resetHint(w.resetAt) + '）' : '') + '——期间会被限流' });
            } else if (w.percent >= USAGE_CFG.WARN_AT) {
                alerts.push({ rule: 'w-warn', level: 'yellow', text: '本周额度已用 ' + pctText(w.percent) + (w.resetAt ? '，' + fmtDateTime(w.resetAt) + ' 重置（' + resetHint(w.resetAt) + '）' : '') + '，省着用' });
            }

            // 周额度会不会在重置前用完——用户最关心的场景
            if (w.percent < 100 && w.resetAt && w.resetAt > now) {
                const hist = velocity('weekly');
                const leftDays = (w.resetAt - now) / USAGE_CFG.DAY_MS;
                const elapsedDays = Math.max(0.25, (now - (w.resetAt - USAGE_CFG.WEEK_MS)) / USAGE_CFG.DAY_MS);
                const avgRate = w.percent / elapsedDays; // 本周平均，第一次打开页面也能算
                // 近 24h 速度 <=0（最近没怎么用/历史不足）时，回退到本周平均速度；
                // 否则“最近停手”会把预测压成 0，反而不提醒周额度会在重置前用完。
                const useHist = hist && hist.v > 0;
                const rate = useHist ? hist.v : avgRate;
                const basis = useHist ? '近 24 小时' : '本周平均';
                if (rate > 0) {
                    const projected = w.percent + rate * leftDays;
                    if (projected > 100) {
                        const hitAt = now + (100 - w.percent) / rate * USAGE_CFG.DAY_MS;
                        // 至少提前 1 小时才算“会卡住”，避免临界噪音
                        if (hitAt < w.resetAt - 3600e3) {
                            const budget = (100 - w.percent) / Math.max(0.25, leftDays);
                            alerts.push({
                                rule: 'w-forecast',
                                level: 'red',
                                text: '按' + basis + '速度（每天约 ' + rate.toFixed(1) + '%），周额度预计 ' + fmtDateTime(hitAt) + ' 用完，比 ' + fmtDateTime(w.resetAt) + ' 重置早约 ' + fmtSpan(w.resetAt - hitAt) + '；本周还剩 ' + leftDays.toFixed(1) + ' 天，建议每天不超过 ' + budget.toFixed(1) + '%'
                            });
                        }
                    }
                }
            }
        }
        return alerts;
    };

    // ---- 提示卡渲染 ----
    let usageActive = false;
    let usageTimer = null;
    let dismissedKey = '';
    let lastCardKey = '';
    let dataReadAt = 0;
    let lastUpdatedText = '';
    let usagePadEl = null;
    let usagePadOld = '';

    const barColor = (p) => p >= 90 ? '#ef4444' : (p >= 70 ? '#f59e0b' : '#22c55e');

    // 小工具：创建一个带内联样式的 div
    const makeDiv = (style) => {
        const el = document.createElement('div');
        if (style) el.setAttribute('style', style);
        return el;
    };

    // 扁平的指标项：`5 小时 33% · 1:35 重置`
    const buildMetric = (label, item, weekly) => {
        const wrap = document.createElement('span');
        wrap.setAttribute('style', 'display:inline-flex;align-items:baseline;gap:4px;white-space:nowrap;');
        const name = document.createElement('span');
        name.textContent = label;
        name.setAttribute('style', 'color:#6b7280;');
        const pct = document.createElement('strong');
        if (!item) {
            pct.textContent = '未读到';
            pct.setAttribute('style', 'color:#9ca3af;font-weight:600;');
        } else {
            pct.textContent = pctText(item.percent);
            pct.setAttribute('style', 'color:' + barColor(item.percent) + ';font-size:13px;');
        }
        wrap.appendChild(name);
        wrap.appendChild(pct);
        if (item && item.resetAt) {
            const reset = document.createElement('span');
            reset.textContent = '· ' + (weekly ? fmtDateTime(item.resetAt) : fmtClock(item.resetAt)) + ' 重置';
            reset.setAttribute('style', 'color:#9ca3af;font-size:11px;');
            wrap.appendChild(reset);
        }
        return wrap;
    };

    // 一行的预警文字（过长用省略号，悬停看全文），保持卡片扁平
    const buildAlertLine = (u, alerts) => {
        const line = makeDiv('margin-top:3px;font-size:12px;line-height:1.4;white-space:normal;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;');
        if (!alerts.length) {
            line.textContent = u.weekly && u.weekly.resetAt
                ? '✓ 暂无风险：按当前速度不会在重置前用完。'
                : '✓ 暂无风险；本周重置时间未识别，无法预测。';
            line.setAttribute('style', line.getAttribute('style') + 'color:#166534;');
            return line;
        }
        line.textContent = alerts.map(a => a.text).join(' | ');
        line.title = line.textContent;
        line.setAttribute('style', line.getAttribute('style') + 'color:' + (alerts.some(a => a.level === 'red') ? '#b91c1c' : '#92400e') + ';font-weight:600;');
        return line;
    };

    const renderUsageCard = (u, alerts) => {
        const old = document.getElementById(USAGE_CFG.CARD_ID);

        // 关闭后是否重新出现，用“稳定的告警规则（或 ok）+ 整数百分比 + 重置时间”判断，
        // 不能用含倒计时分钟的 text，否则每分钟都会重新弹出来。
        const key = (alerts.length ? alerts.map(a => a.rule).sort().join('|') : 'ok') + '|'
            + Math.round((u.weekly && u.weekly.percent) || 0) + '|'
            + Math.round((u.fiveHour && u.fiveHour.percent) || 0) + '|'
            + ((u.weekly && u.weekly.resetAt) || 0) + '|'
            + ((u.fiveHour && u.fiveHour.resetAt) || 0);
        if (key === dismissedKey) { if (old) old.remove(); return; }

        // 内容没变（按分钟桶）不重绘；用 DOM API 而不用 innerHTML：
        // Gemini 页面启用了 Trusted Types，innerHTML 会被浏览器直接拒绝。
        const renderKey = key + '|' + (u.updatedText || '') + '|' + Math.floor(Date.now() / 60000);
        if (old && document.body.contains(old) && renderKey === lastCardKey) return;

        const box = old || document.createElement('div');
        box.id = USAGE_CFG.CARD_ID;
        box.setAttribute('aria-live', 'polite');
        const severe = alerts.length ? (alerts.some(a => a.level === 'red') ? '#ef4444' : '#f59e0b') : '#22c55e';
        box.setAttribute('style', 'position:fixed;right:0;bottom:0;width:60vw;max-width:100vw;box-sizing:border-box;z-index:2147483000;background:#fff;color:#1b2334;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:12.5px;border-radius:12px 0 0 0;border-left:4px solid ' + severe + ';box-shadow:0 -6px 24px rgba(0,0,0,.18);padding:8px 12px;');
        box.title = '数据来自本页显示，仅供估算；刷新页面可更新数字。';

        // 清空旧内容（不使用 innerHTML）
        while (box.firstChild) box.removeChild(box.firstChild);

        const header = makeDiv('display:flex;align-items:center;gap:8px;');
        const title = document.createElement('span');
        title.textContent = (alerts.length ? '⚠ 用量预警' : '✓ 用量正常')
            + (u.updatedText ? ' · ' + u.updatedText : '')
            + '（读取于 ' + fmtClock(dataReadAt || Date.now()) + '）';
        title.setAttribute('style', 'flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#6b7280;font-size:11.5px;');

        const close = document.createElement('button');
        close.type = 'button';
        close.title = '本次关闭';
        close.textContent = '✕';
        close.setAttribute('style', 'border:0;background:transparent;color:#6b7280;font-size:15px;cursor:pointer;padding:0 2px;line-height:1;');
        close.onclick = () => { dismissedKey = key; lastCardKey = ''; box.remove(); };

        header.appendChild(title);
        header.appendChild(close);
        box.appendChild(header);

        const metrics = makeDiv('display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin-top:2px;');
        metrics.appendChild(buildMetric('5 小时', u.fiveHour, false));
        metrics.appendChild(buildMetric('本周', u.weekly, true));
        box.appendChild(metrics);
        box.appendChild(buildAlertLine(u, alerts));

        lastCardKey = renderKey;
        if (!old || !document.body.contains(box)) document.body.appendChild(box);
    };

    // 卡片固定在底部右侧；给页面滚动容器补 96px 底部内边距，
    // 让原本压在卡片下面的内容可以滚到卡片上方，不被遮住。
    const reserveUsageSpace = () => {
        if (usagePadEl && !document.contains(usagePadEl)) { usagePadEl = null; usagePadOld = ''; }
        if (usagePadEl) {
            if (usagePadEl.style.paddingBottom !== '96px') usagePadEl.style.paddingBottom = '96px';
            return;
        }
        let el = null;
        const anchor = document.querySelector('[data-testid="weekly-usage"]');
        if (anchor) {
            el = anchor.parentElement;
            while (el && el !== document.body) {
                const cs = getComputedStyle(el);
                if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 4) break;
                el = el.parentElement;
            }
        }
        if (!el || el === document.body) el = document.scrollingElement || document.documentElement;
        usagePadEl = el;
        usagePadOld = el.style.paddingBottom || '';
        el.style.paddingBottom = '96px';
    };

    const tickUsage = () => {
        if (!usageActive || !isUsagePage()) return;
        try {
            const u = readUsage();
            if (!u || (!u.fiveHour && !u.weekly)) return; // 一个数字都没读到就不要渲染空卡
            reserveUsageSpace();
            recordHistory(u);
            if (!dataReadAt || (u.updatedText && u.updatedText !== lastUpdatedText)) {
                dataReadAt = Date.now();          // 页面更新了“X 分钟前”文本，就刷新读取时间
                lastUpdatedText = u.updatedText || '';
            }
            renderUsageCard(u, analyzeUsage(u));
        } catch (e) {
            // 单次解析失败不要打断整个定时器；Console 里留线索
            try { console.warn('[Gemini 用量预警]', e); } catch (_) { /* ignore */ }
        }
    };

    const startUsage = () => {
        if (usageActive) return;
        usageActive = true;
        dismissedKey = '';
        [1200, 4000, 8000].forEach(t => setTimeout(tickUsage, t)); // 等 Angular 渲染
        usageTimer = setInterval(tickUsage, USAGE_CFG.REFRESH_MS);
        document.addEventListener('visibilitychange', onUsageVisibility);
        tickUsage();
    };

    const stopUsage = () => {
        usageActive = false;
        if (usageTimer) { clearInterval(usageTimer); usageTimer = null; }
        document.removeEventListener('visibilitychange', onUsageVisibility);
        dismissedKey = '';
        lastCardKey = '';
        dataReadAt = 0;
        lastUpdatedText = '';
        if (usagePadEl) {
            try { usagePadEl.style.paddingBottom = usagePadOld; } catch (e) { /* ignore */ }
            usagePadEl = null;
            usagePadOld = '';
        }
        const c = document.getElementById(USAGE_CFG.CARD_ID);
        if (c) c.remove();
    };

    const onUsageVisibility = () => {
        if (document.visibilityState === 'visible') tickUsage();
    };

    const UI = {
        root: null, statusEl: null, logEl: null, batchBtn: null,
        collapsed: false, mini: null,
        buttons: {}, // [MODIFIED] 统一管理按钮句柄
        create: () => {
            if (document.getElementById('gemini-backup-panel')) return;
            const p = DOM.el('div', {
                position: 'fixed', top: '80px', right: '20px', width: '8%',
                background: '#131314', border: '1px solid #444', borderRadius: '12px',
                zIndex: CONFIG.uiZIndex, padding: '16px', color: '#e3e3e3',
                fontFamily: 'sans-serif', fontSize: '13px', boxShadow: '0 8px 30px rgba(0,0,0,0.6)'
            });
            p.id = 'gemini-backup-panel';

            // 标题栏：左侧标题 + 右侧「折叠/关闭」按钮组
            // 用 actions 容器包住，避免 justify-content:space-between 把「－」挤到中间
            const h = DOM.el('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' });
            h.appendChild(DOM.el('span', { fontWeight: 'bold', fontSize: '14px' }, 'Gemini 备份 v13.13.3'));
            const actions = DOM.el('div', { display: 'flex', alignItems: 'center', gap: '8px' });

            const collapse = DOM.el('span', { cursor: 'pointer', opacity: '0.7' }, '－');
            collapse.title = '折叠面板（Alt+W）';
            collapse.onclick = () => UI.setCollapsed(true);
            actions.appendChild(collapse);

            const close = DOM.el('span', { cursor: 'pointer', opacity: '0.7' }, '✕');
            close.onclick = () => p.style.display = 'none';
            actions.appendChild(close);

            h.appendChild(actions);
            p.appendChild(h);

            const fDiv = DOM.el('div', { display: 'flex', gap: '5px', marginBottom: '10px' });
            ['md', 'json', 'txt'].forEach(fmt => {
                const b = DOM.el('button', {
                    flex: 1, background: State.format === fmt ? '#a8c7fa' : '#333', border: 'none',
                    color: State.format === fmt ? '#000' : '#aaa', padding: '5px', borderRadius: '4px', cursor: 'pointer'
                }, fmt.toUpperCase());
                b.onclick = () => {
                    State.format = fmt;
                    Array.from(fDiv.children).forEach(c => { c.style.background = '#333'; c.style.color = '#aaa'; });
                    b.style.background = '#a8c7fa'; b.style.color = '#000';
                };
                fDiv.appendChild(b);
            });
            p.appendChild(fDiv);

            const createInput = (label, val, onChange) => {
                const d = DOM.el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px', fontSize: '11px', color: '#aaa' });
                const l = DOM.el('span', {}, label);
                const i = DOM.el('input', {
                    width: '50px', background: '#222', border: '1px solid #444', color: '#fff',
                    borderRadius: '4px', padding: '2px 4px', textAlign: 'center'
                });
                i.type = 'number'; i.value = val; i.onchange = onChange;
                d.appendChild(l); d.appendChild(i);
                return d;
            };
            p.appendChild(createInput('滚动延迟(ms):', State.scrollDelay, (e) => {
                State.scrollDelay = Math.max(50, parseInt(e.target.value));
                UI.log(`⚙️ 滚动延迟: ${State.scrollDelay}ms`);
            }));
            p.appendChild(createInput('历史延迟(ms):', State.historyDelay, (e) => {
                State.historyDelay = Math.max(500, parseInt(e.target.value));
                UI.log(`⚙️ 历史延迟: ${State.historyDelay}ms`);
            }));

            const b1 = DOM.el('button', {
                width: '100%', padding: '10px', marginTop: '10px', marginBottom: '8px', background: '#444746',
                color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600'
            }, '📜 导出当前对话');
            b1.onclick = async () => {
                if (State.isWorking) return;
                State.isWorking = true; State.stopSignal = false; State.abandonSignal = false;
                UI.clearLog();
                UI.updateUiState('working_single');
                await Core.captureCurrentChat();
                Core.download();
                State.isWorking = false; State.stopSignal = false; State.abandonSignal = false;
                UI.updateUiState('idle');
            }; p.appendChild(b1);
            UI.buttons.exportCurrent = b1;

            const bScan = DOM.el('button', {
                width: '100%', padding: '10px', marginBottom: '8px', background: '#333', border: '1px dashed #666',
                color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: '600'
            }, '🔍 扫描/累积 (先滚再点)');
            bScan.onclick = Core.accumulateScan;
            p.appendChild(bScan);
            UI.buttons.scan = bScan;

            const bBatch = DOM.el('button', {
                width: '100%', padding: '10px', marginBottom: '8px', background: '#a8c7fa',
                color: '#062e6f', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600'
            }, '🗂️ 导出队列中所有对话');
            bBatch.onclick = Core.runBatchFromQueue;
            p.appendChild(bBatch);
            UI.batchBtn = bBatch;
            UI.buttons.exportBatch = bBatch;

            // [MODIFIED] 新增暂停按钮
            const bPause = DOM.el('button', {
                width: '100%', padding: '10px', marginBottom: '8px', background: '#3c78d8',
                color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', display: 'none'
            }, '⏸️ 暂停');
            bPause.onclick = () => {
                State.pauseSignal = !State.pauseSignal;
                if (State.pauseSignal) {
                    UI.log('⏸️ 已暂停，等待继续...');
                    UI.updateUiState('paused');
                } else {
                    UI.log('▶️ 继续执行...');
                    UI.updateUiState('working_batch');
                }
            };
            p.appendChild(bPause);
            UI.buttons.pause = bPause;

            const bSaveNow = DOM.el('button', {
                width: '100%', padding: '10px', marginBottom: '8px', background: '#ff9800',
                color: '#000', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', display: 'none'
            }, '⚡ 立即停止并导出');
            bSaveNow.onclick = () => {
                if (State.isWorking) {
                    UI.log('⚡ 用户请求中断，将在当前任务完成后停止...');
                    State.stopSignal = true;
                }
            };
            p.appendChild(bSaveNow);
            UI.buttons.stopAndSave = bSaveNow;

            const bStop = DOM.el('button', {
                width: '100%', padding: '10px', marginBottom: '8px', background: '#f28b82',
                color: '#601410', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', display: 'none'
            }, '⏹ 放弃任务');
            bStop.onclick = () => {
                State.stopSignal = true;
                State.abandonSignal = true; // [v13.11] 放弃标志，阻止 download
                State.collectedData.clear(); // 放弃任务时清空已收集的数据
                UI.log('🛑 正在放弃，数据已清空...');
            };
            p.appendChild(bStop);
            UI.buttons.abandon = bStop;

            const logBox = DOM.el('div', {
                height: '100px', overflowY: 'auto', background: '#000', border: '1px solid #333',
                marginTop: '10px', fontSize: '11px', fontFamily: 'monospace', padding: '8px',
                color: '#0f0', whiteSpace: 'pre-wrap', borderRadius: '4px'
            });
            logBox.id = 'gemini-log-box';
            logBox.innerText = '>> v13.13.3 折叠与用量预警版。\n>> 队列改用<a>链接导航+等待内容加载。\n';
            p.appendChild(logBox);
            UI.logEl = logBox;

            UI.statusEl = DOM.el('div', { textAlign: 'center', color: '#8e918f', fontSize: '12px', marginTop: '5px' }, 'Alt+Q 隐藏/显示 · Alt+W 折叠');
            p.appendChild(UI.statusEl);

            document.body.appendChild(p);
            UI.root = p;

            // 折叠后的迷你入口：不显示任何用量数字，避免展示过期数据
            const oldMini = document.getElementById('gemini-backup-mini');
            if (oldMini) oldMini.remove();
            const mini = DOM.el('div', {
                position: 'fixed', top: '80px', right: '0', width: '44px', height: '44px',
                background: '#131314', border: '1px solid #444', borderRadius: '12px 0 0 12px',
                zIndex: CONFIG.uiZIndex, color: '#e3e3e3', display: 'none',
                alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                boxShadow: '0 8px 30px rgba(0,0,0,0.6)', fontSize: '18px', fontWeight: 'bold'
            }, 'G');
            mini.id = 'gemini-backup-mini';
            mini.title = '展开 Gemini 备份（Alt+W）';
            mini.onclick = () => UI.setCollapsed(false);
            document.body.appendChild(mini);
            UI.mini = mini;

            // 恢复上次折叠状态（localStorage 在沙箱里可能抛错，必须 try/catch）
            let collapsed = false;
            try { collapsed = localStorage.getItem('gemini-panel-collapsed') === '1'; } catch (e) { /* ignore */ }
            UI.setCollapsed(collapsed);
        },

        // [MODIFIED] 采用专业的"环形缓冲区"模式重构日志函数，并优化滚动逻辑
        log: (msg) => {
            if (!UI.logEl) return;

            const MAX_LOG_LINES = 200; // 定义日志区域最多保留的DOM节点数

            // 1. 创建新的日志行元素
            const time = new Date().toLocaleTimeString();
            const logLine = document.createElement('div');
            logLine.textContent = `[${time}] ${msg}`;

            // 2. 将新日志行追加到末尾
            UI.logEl.appendChild(logLine);

            // 3. 检查并移除超出的旧日志行（维护缓冲区大小）
            while (UI.logEl.childElementCount > MAX_LOG_LINES) {
                UI.logEl.removeChild(UI.logEl.firstChild);
            }

            // 4. 平滑滚动到底部
            // 使用 requestAnimationFrame 可以确保滚动操作在下一次浏览器绘制前执行，更平滑
            requestAnimationFrame(() => {
                UI.logEl.scrollTop = UI.logEl.scrollHeight;
            });
        },
        updateBatchBtn: () => {
            if (UI.batchBtn) UI.batchBtn.innerText = `🗂️ 导出队列 (${State.sidebarQueue.size})`;
        },
        clearLog: () => { if (UI.logEl) UI.logEl.innerText = '>> 开始任务...\n'; },

        // 折叠 / 展开：隐藏完整面板，显示右上角迷你入口
        setCollapsed: (v) => {
            UI.collapsed = !!v;
            if (UI.root) UI.root.style.display = v ? 'none' : 'block';
            if (UI.mini) UI.mini.style.display = v ? 'flex' : 'none';
            try { localStorage.setItem('gemini-panel-collapsed', v ? '1' : '0'); } catch (e) { /* ignore */ }
        },

        // Alt+Q：按当前形态隐藏/显示（展开时切面板，折叠时切迷你入口）
        toggleVisible: () => {
            if (!UI.root) return;
            const rootShown = UI.root.style.display !== 'none';
            const miniShown = UI.mini && UI.mini.style.display !== 'none';
            if (rootShown || miniShown) {
                UI.root.style.display = 'none';
                if (UI.mini) UI.mini.style.display = 'none';
            } else if (UI.collapsed) {
                if (UI.mini) UI.mini.style.display = 'flex';
            } else {
                UI.root.style.display = 'block';
            }
        },

        // [MODIFIED] 统一UI状态管理器
        updateUiState: (state) => {
            const { exportCurrent, scan, exportBatch, pause, stopAndSave, abandon } = UI.buttons;

            // 默认隐藏所有控制按钮
            Object.values(UI.buttons).forEach(btn => btn.style.display = 'none');

            switch (state) {
                case 'working_single':
                    stopAndSave.innerText = '⚡ 立即停止并导出';
                    stopAndSave.style.display = 'block';
                    abandon.style.display = 'block';
                    break;
                case 'working_batch':
                    pause.innerText = '⏸️ 暂停';
                    stopAndSave.innerText = '🛑 停止后续任务';
                    pause.style.display = 'block';
                    stopAndSave.style.display = 'block';
                    abandon.style.display = 'block';
                    break;
                case 'paused':
                    pause.innerText = '▶️ 继续';
                    stopAndSave.innerText = '🛑 停止后续任务';
                    pause.style.display = 'block';
                    stopAndSave.style.display = 'block';
                    abandon.style.display = 'block';
                    break;
                case 'idle':
                default:
                    exportCurrent.style.display = 'block';
                    scan.style.display = 'block';
                    exportBatch.style.display = 'block';
                    if (state === 'idle') UI.log('>> 任务结束。');
                    break;
            }
        },
    };

    const init = () => {
        UI.create();
        document.addEventListener('keydown', e => {
            if (e.altKey && e.code === 'KeyQ') {
                e.preventDefault();
                if (!document.getElementById('gemini-backup-panel')) {
                    UI.create();          // 刚重建不要立刻又隐藏
                } else {
                    UI.toggleVisible();
                }
            }
            if (e.altKey && e.code === 'KeyW') {
                e.preventDefault();
                if (!document.getElementById('gemini-backup-panel')) {
                    UI.create();          // 重建时 setCollapsed 会恢复上次状态
                } else {
                    UI.setCollapsed(!UI.collapsed);
                }
            }
        });

        // 用量预警：只在 /usage 页启动；SPA 路由变化用轮询检测（不劫持 history）
        let lastUsageRoute = isUsagePage();
        if (lastUsageRoute) startUsage();
        setInterval(() => {
            const nowRoute = isUsagePage();
            if (nowRoute === lastUsageRoute) return;
            lastUsageRoute = nowRoute;
            if (nowRoute) startUsage(); else stopUsage();
        }, 1500);

        new MutationObserver(() => { if (!document.getElementById('gemini-backup-panel')) UI.create(); })
            .observe(document.body, { childList: true, subtree: true });
    };
    setTimeout(init, 2000);
})();
