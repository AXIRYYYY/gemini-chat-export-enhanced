// ==UserScript==
// @name         Gemini 全量备份工具增强版 (Gemini Chat Export Enhanced)
// @namespace    http://tampermonkey.net/
// @version      13.11.0
// @description  基于 Sxuan-Coder/gemini_chat_export 早期版本深度定制，新增批量导出/暂停/中断/可调参数/表格渲染等功能。适配 Gemini 新版 UI。
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

    const UI = {
        root: null, statusEl: null, logEl: null, batchBtn: null,
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

            const h = DOM.el('div', { display: 'flex', justifyContent: 'space-between', marginBottom: '12px' });
            h.appendChild(DOM.el('span', { fontWeight: 'bold', fontSize: '14px' }, 'Gemini 备份 v13.11'));
            const close = DOM.el('span', { cursor: 'pointer', opacity: '0.7' }, '✕');
            close.onclick = () => p.style.display = 'none';
            h.appendChild(close);
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
            logBox.innerText = '>> v13.11 修复队列与放弃逻辑版。\n>> 队列改用<a>链接导航+等待内容加载。\n';
            p.appendChild(logBox);
            UI.logEl = logBox;

            UI.statusEl = DOM.el('div', { textAlign: 'center', color: '#8e918f', fontSize: '12px', marginTop: '5px' }, 'Alt+Q 隐藏/显示');
            p.appendChild(UI.statusEl);

            document.body.appendChild(p);
            UI.root = p;
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
                const p = document.getElementById('gemini-backup-panel');
                if (!p) UI.create();
                else p.style.display = p.style.display === 'none' ? 'block' : 'none';
            }
        });
        new MutationObserver(() => { if (!document.getElementById('gemini-backup-panel')) UI.create(); })
            .observe(document.body, { childList: true, subtree: true });
    };
    setTimeout(init, 2000);
})();
