// 档案 archive 的配套插件（试作）
// 只在「档案」主题生效时工作：
// · 隔页上凸出三枚签：archive（点它露出顶栏图标）、records（聊天记录）、index（角色）
// · 输入栏平时收在磨砂袋里，点袋子就抽出来（抽出、收回的动画在主题里）
// · 欢迎页先是封面（磨砂档案袋里抽出最近那位的名字卡和相纸），records 签翻到最近聊天
// 没装这个插件时，主题照样能用：图标一直显示，只有一枚签，输入栏点中间也能抽出来。

(() => {
    const doc = document;
    const body = doc.body;
    let tabs = null;
    let hadDrawerOpen = false;

    // 主题有没有生效：看主题定义的变量在不在（不能看 --ar-paper：调色时插件自己会在 <html> 上写它）
    const themeOn = () => getComputedStyle(doc.documentElement).getPropertyValue('--ar-clip').trim() !== '';

    const ctx = () => {
        try { return globalThis.SillyTavern?.getContext?.() ?? null; } catch { return null; }
    };

    // 顶栏图标的开合
    function open(on) {
        body.classList.toggle('ar-open', on);
        tabs?.querySelector('.t1')?.setAttribute('aria-expanded', String(on));
    }

    // ── 欢迎页：封面和插袋格两面，用签切换 ──
    // 封面：一只磨砂档案袋，袋口抽出最近聊过的那位的名字卡和相纸
    // 插袋格：最近聊天（主题里的样式）
    let view = 'cover';
    const home = () => !!doc.querySelector('#chat .welcomePanel');
    const latest = () => doc.querySelector('#chat .welcomePanel .recentChat');

    function setView(v) {
        view = v;
        paint();
    }

    function paint() {
        const h = home();
        const cover = h && view === 'cover' && !!latest();
        body.classList.toggle('ar-home', h);
        body.classList.toggle('ar-cover', cover);
        if (tabs) {
            tabs.querySelector('.t1')?.classList.toggle('on', cover);
            tabs.querySelector('.t2')?.classList.toggle('on', h && !cover);
        }
    }

    const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

    function buildCover() {
        const sheld = doc.getElementById('sheld');
        const rc = latest();
        let el = doc.getElementById('ar-cover');
        if (!sheld || !home() || !rc) { el?.remove(); paint(); return; }
        const key = [rc.dataset.avatar, rc.dataset.group, rc.dataset.file].join('|');
        if (el && el.dataset.key === key) { paint(); return; }

        const name = rc.querySelector('.characterName')?.textContent.trim() ?? '';
        const date = rc.querySelector('.chatDate')?.textContent.trim() ?? '';
        // 最后一句里可能带着 HTML（比如系统消息），只留字
        const mes = (rc.querySelector('.chatMessage')?.textContent ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        const avatar = rc.dataset.avatar;
        // 立绘用原图，群聊没有单人原图就用缩略图
        const img = avatar ? `characters/${encodeURIComponent(avatar)}` : (rc.querySelector('.avatar img')?.getAttribute('src') ?? '');
        const records = doc.querySelectorAll('#chat .welcomePanel .recentChat').length;
        const chars = ctx()?.characters?.length ?? 0;
        const pad = (n) => String(n).padStart(2, '0');

        el?.remove();
        el = doc.createElement('div');
        el.id = 'ar-cover';
        el.dataset.key = key;
        el.innerHTML = `
            <div class="ar-cv-back"></div>
            <div class="ar-cv-sheet"></div>
            <div class="ar-cv-dots"></div>
            <div class="ar-cv-card" role="button"><small>PRIVATE ARCHIVE</small><h2>${esc(name)}</h2><em>${esc(date)}</em></div>
            <div class="ar-cv-photo" role="button"><img alt="" src="${esc(img)}"></div>
            <div class="ar-cv-pic"></div>
            <div class="ar-cv-slip">
                <p><span>LAST ENTRY</span><span>${esc(date)}</span></p>
                <p><span>RECORDS</span><span>${pad(records)}</span></p>
                <p><span>INDEX</span><span>${pad(chars)}</span></p>
                <blockquote>${esc(mes)}</blockquote>
            </div>
            <div class="ar-cv-front" role="button"><b>archive</b></div>`;
        // 点名字卡或相纸：打开这段聊天；点袋子：翻到插袋格
        const openIt = () => { passClick = true; latest()?.click(); passClick = false; };
        el.querySelector('.ar-cv-card').addEventListener('click', openIt);
        el.querySelector('.ar-cv-photo').addEventListener('click', openIt);
        el.querySelector('.ar-cv-front').addEventListener('click', () => setView('records'));
        sheld.append(el);
        paint();
    }

    // 三枚签：从后往前 index、records、archive
    // 在欢迎页上，records 和 archive 是在插袋格和封面之间翻；封面上再点 archive 才露出图标
    const TABS = [
        { cls: 't3', label: 'index', act: () => doc.getElementById('rightNavDrawerIcon')?.click() },
        {
            cls: 't2', label: 'records', act: () => {
                if (home()) setView('records');
                else doc.getElementById('option_select_chat')?.click();
            },
        },
        {
            cls: 't1', label: 'archive', act: () => {
                if (home() && latest() && view !== 'cover') { setView('cover'); return; }
                open(!body.classList.contains('ar-open'));
            },
        },
    ];

    // 签上的字：跟着当前角色走
    function fill() {
        const c = ctx();
        let name = '';
        let count = 0;
        if (c) {
            if (c.groupId && Array.isArray(c.groups)) {
                name = c.groups.find(g => g.id === c.groupId)?.name ?? '';
            } else if (c.characterId !== undefined && c.characterId !== null && c.characters?.[c.characterId]) {
                name = c.name2 ?? c.characters[c.characterId].name ?? '';
            }
            count = Array.isArray(c.chat) ? c.chat.length : 0;
        }
        if (tabs) {
            const no = count ? String(count).padStart(4, '0') : '';
            tabs.querySelector('.t1 span').textContent = [name, no].filter(Boolean).join(' · ');
        }
    }

    function mount() {
        const sheld = doc.getElementById('sheld');
        if (!sheld || doc.getElementById('ar-tabs')) return;
        tabs = doc.createElement('div');
        tabs.id = 'ar-tabs';
        for (const t of TABS) {
            const el = doc.createElement('div');
            el.className = `ar-t ${t.cls}`;
            el.setAttribute('role', 'button');
            el.innerHTML = t.cls === 't1' ? '<b>archive</b><span></span>' : `<b>${t.label}</b>`;
            el.addEventListener('click', t.act);
            tabs.append(el);
        }
        sheld.prepend(tabs);
        // 隔页右边的竖签：样张卡（调色、换图、换字体）
        const side = doc.createElement('div');
        side.id = 'ar-side';
        side.setAttribute('role', 'button');
        side.title = '调色、换图、换字体';
        side.innerHTML = '<b>style</b>';
        side.addEventListener('click', () => stylePanel(!body.classList.contains('ar-styling')));
        sheld.append(side);
        fill();
        applyStyle();
    }

    // ── 工具格：别的插件塞进输入栏的按钮、快速回复，搬进 MEMO 卡的第二行 ──
    // 只留在原处的：+、✳、发送、停止、脚本的三个键
    const KEEP = new Set(['options_button', 'extensionsMenuButton', 'send_but', 'mes_stop']);
    const keep = (el) => KEEP.has(el.id) || el.classList.contains('stscript_btn');

    function gatherTools() {
        const card = doc.getElementById('nonQRFormItems');
        if (!card) return;
        let tools = doc.getElementById('ar-tools');
        if (!tools) {
            tools = doc.createElement('div');
            tools.id = 'ar-tools';
            tools.innerHTML = '<div class="ar-tq"></div><div class="ar-ti"></div>';
            card.append(tools);
        }
        const tq = tools.querySelector('.ar-tq');
        const ti = tools.querySelector('.ar-ti');
        const qr = doc.getElementById('qr--bar');
        if (qr && qr.parentElement !== tq) tq.append(qr);
        for (const id of ['leftSendForm', 'rightSendForm']) {
            for (const el of [...(doc.getElementById(id)?.children ?? [])]) {
                if (!keep(el)) ti.append(el);
            }
        }
        measure();
    }

    function releaseTools() {
        const tools = doc.getElementById('ar-tools');
        if (!tools) return;
        const form = doc.getElementById('send_form');
        const right = doc.getElementById('rightSendForm');
        const qr = doc.getElementById('qr--bar');
        if (qr && form) form.prepend(qr);
        for (const el of [...tools.querySelectorAll('.ar-ti > *')]) right?.insertBefore(el, doc.getElementById('send_but'));
        tools.remove();
    }

    // 卡片抽出来要露出多少：第一行 + 工具格（不算下面那截横线格），再加袋口上沿的 14px
    function measure() {
        const card = doc.getElementById('nonQRFormItems');
        if (!card) return;
        const pad = parseFloat(getComputedStyle(card).paddingBottom) || 0;
        const h = card.offsetHeight - pad;
        if (h > 0) doc.documentElement.style.setProperty('--ar-pull', `${Math.round(h + 14)}px`);
    }

    // 滚动时浮出滚动条，停下一会儿再藏
    let scrollTimer = 0;
    doc.addEventListener('scroll', (e) => {
        if (e.target?.id !== 'chat' || !body.classList.contains('ar-tab')) return;
        body.classList.add('ar-scrolling');
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => body.classList.remove('ar-scrolling'), 900);
    }, true);

    function unmount() {
        releaseTools();
        doc.documentElement.style.removeProperty('--ar-pull');
        doc.getElementById('ar-tabs')?.remove();
        doc.getElementById('ar-cover')?.remove();
        doc.getElementById('ar-side')?.remove();
        doc.getElementById('ar-style')?.remove();
        clearStyle();
        tabs = null;
        body.classList.remove('ar-tab', 'ar-open', 'ar-memo', 'ar-home', 'ar-cover', 'ar-styling');
    }

    // 主题可能随时被换掉，过一会儿看一次
    function sync() {
        if (themeOn()) {
            mount();
            body.classList.add('ar-tab');
            buildCover();
            gatherTools();
        } else if (body.classList.contains('ar-tab')) {
            unmount();
        }
    }

    // 欢迎页出现或离开时马上换（每次回到欢迎页都先看封面）
    const chatEl = doc.getElementById('chat');
    if (chatEl) {
        let wasHome = false;
        new MutationObserver(() => {
            if (!body.classList.contains('ar-tab')) return;
            const h = home();
            if (h && !wasHome) view = 'cover';
            wasHome = h;
            buildCover();
        }).observe(chatEl, { childList: true });
    }

    // 点到图标和面板以外的地方，且没有面板开着，就把图标收回去
    doc.addEventListener('pointerdown', (e) => {
        if (!body.classList.contains('ar-open')) return;
        if (e.target.closest('#ar-tabs, #top-settings-holder')) return;
        if (doc.querySelector('.drawer-content.openDrawer')) return;
        open(false);
    }, true);

    // 输入栏：点袋子或开始打字时抽出来（body.ar-memo）；框里没字、点到别处时沉回去
    // 卡片抽出来时纸的下边会多留一截（主题里），原来停在最底下的话就跟着滚到底
    const memo = (on) => {
        if (body.classList.contains('ar-memo') === on) return;
        const chat = doc.getElementById('chat');
        const atBottom = chat && chat.scrollHeight - chat.scrollTop - chat.clientHeight < 40;
        if (on) measure();
        body.classList.toggle('ar-memo', on);
        if (atBottom) requestAnimationFrame(() => { chat.scrollTop = chat.scrollHeight; });
    };
    const textarea = () => doc.getElementById('send_textarea');
    const empty = () => !(textarea()?.value ?? '').trim();
    doc.addEventListener('pointerdown', (e) => {
        if (!body.classList.contains('ar-tab')) return;
        const form = e.target.closest('#send_form');
        if (form) {
            const wasOpen = body.classList.contains('ar-memo');
            memo(true);
            // 收着的时候点到哪儿都只是把它抽出来，光标放进输入框
            if (!wasOpen && !e.target.closest('#send_textarea')) {
                e.preventDefault();
                setTimeout(() => textarea()?.focus(), 0);
            }
            return;
        }
        // 点到别处：框里没字就收回去（弹出的菜单里点不算）
        if (e.target.closest('#options, #extensionsMenu, .list-group, .popup')) return;
        if (empty()) memo(false);
    }, true);
    // 字多了输入框变高，抽出的距离跟着变
    doc.addEventListener('input', (e) => { if (e.target === textarea()) requestAnimationFrame(measure); }, true);
    doc.addEventListener('keydown', (e) => {
        if (e.target === textarea() && !e.ctrlKey && !e.metaKey && e.key !== 'Tab') memo(true);
    }, true);

    // 打开过的面板关上之后，图标也收回去
    const holder = doc.getElementById('top-settings-holder');
    if (holder) {
        new MutationObserver(() => {
            const any = !!holder.querySelector('.drawer-content.openDrawer');
            if (hadDrawerOpen && !any) setTimeout(() => open(false), 250);
            hadDrawerOpen = any;
        }).observe(holder, { subtree: true, attributes: true, attributeFilter: ['class'] });
    }

    // ── 欢迎页那叠档案：手机上第一次点只把那份抽出来，再点才打开（电脑上鼠标移上去就算抽出来了） ──
    let passClick = false;
    doc.addEventListener('click', (e) => {
        if (passClick || !body.classList.contains('ar-tab')) return;
        const rc = e.target.closest?.('#chat .welcomePanel .recentChat');
        if (!rc || e.target.closest('.chatActions')) return;
        if (matchMedia('(hover: hover)').matches) return;
        if (rc.classList.contains('ar-pulled')) return;
        e.stopPropagation();
        e.preventDefault();
        doc.querySelectorAll('#chat .recentChat.ar-pulled').forEach((x) => x.classList.remove('ar-pulled'));
        rc.classList.add('ar-pulled');
    }, true);

    // ── 调色 / 换图 / 换字体：隔页右边凸出的一枚竖签，点开是一张样张卡 ──
    const VARS = [
        ['--ar-paper', '纸'], ['--ar-ink', '墨'], ['--ar-mute', '旁白'], ['--ar-accent', '隔页'],
        ['--ar-accent-ink', '隔页上的字'], ['--ar-dotp', '波点纸'], ['--ar-dot', '波点'], ['--ar-desk', '台面'],
    ];
    const PRESETS = [
        ['冷白灰蓝', ['#FAFAF9', '#1D1D1C', '#8f8d88', '#C6D3D7', '#3f4648', '#EEEEED', '#8a8b8c', '#E3E4E5']],
        ['象牙枯玫瑰', ['#F4EFE6', '#2B2420', '#9C8F84', '#D8C3BD', '#4A3632', '#EAE2D6', '#A8998B', '#DCD5CA']],
        ['浅灰纯黑', ['#E9EAEB', '#111214', '#7C7F84', '#1F2023', '#E6E7E8', '#D6D8DA', '#5E6166', '#C4C6C9']],
        ['炭黑雾蓝', ['#222325', '#E4E3DF', '#8A8B8E', '#4C5A63', '#E8ECEE', '#2E3033', '#6A6D72', '#141516']],
    ];
    // 中文正文字体；css 为空表示用系统自带的
    const CN_FONTS = [
        ['思源黑体 细', '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif', ''],
        ['思源宋体', '"Noto Serif SC", "Songti SC", "SimSun", serif', 'https://fonts.loli.net/css2?family=Noto+Serif+SC:wght@300;400&display=swap'],
        ['霞鹜文楷', '"LXGW WenKai", "Kaiti SC", "KaiTi", serif', 'https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/style.css'],
        ['系统字体', 'system-ui, "PingFang SC", "Microsoft YaHei", sans-serif', ''],
    ];
    const TW_FONTS = [
        ['Courier Prime', '"Courier Prime", "Courier New", monospace', ''],
        ['Special Elite', '"Special Elite", "Courier New", monospace', 'https://fonts.loli.net/css2?family=Special+Elite&display=swap'],
        ['IBM Plex Mono', '"IBM Plex Mono", "Courier New", monospace', 'https://fonts.loli.net/css2?family=IBM+Plex+Mono:wght@300;400&display=swap'],
    ];
    const IMAGES = [
        ['--ar-shadow', 'desk', '台面的光影', 1400],
        ['--ar-photo', 'photo', '袋中的照片', 700],
    ];

    const store = () => {
        const c = ctx();
        if (!c?.extensionSettings) return null;
        c.extensionSettings.archive ??= {};
        return c.extensionSettings.archive;
    };
    const save = () => ctx()?.saveSettingsDebounced?.();

    function loadCss(href, id) {
        if (!href || doc.getElementById(id)) return;
        const l = doc.createElement('link');
        l.rel = 'stylesheet';
        l.href = href;
        l.id = id;
        doc.head.append(l);
    }

    // 把存下来的设置写到 <html> 上（盖过主题里的默认值）
    function applyStyle() {
        const s = store();
        const root = doc.documentElement.style;
        if (!s) return;
        for (const [v] of VARS) {
            if (s.colors?.[v]) root.setProperty(v, s.colors[v]);
            else root.removeProperty(v);
        }
        for (const [v, key] of IMAGES) {
            if (s.images?.[key]) root.setProperty(v, `url("${s.images[key]}")`);
            else root.removeProperty(v);
        }
        const cn = CN_FONTS[s.cn ?? 0];
        const tw = TW_FONTS[s.tw ?? 0];
        if (s.cn) { root.setProperty('--ar-cn', cn[1]); loadCss(cn[2], `ar-font-cn-${s.cn}`); } else root.removeProperty('--ar-cn');
        if (s.tw) { root.setProperty('--ar-tw', tw[1]); loadCss(tw[2], `ar-font-tw-${s.tw}`); } else root.removeProperty('--ar-tw');
    }

    function clearStyle() {
        const root = doc.documentElement.style;
        for (const [v] of VARS) root.removeProperty(v);
        for (const [v] of IMAGES) root.removeProperty(v);
        root.removeProperty('--ar-cn');
        root.removeProperty('--ar-tw');
    }

    // 上传的图先缩小再存，免得设置文件太大
    function shrink(file, max) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const k = Math.min(1, max / Math.max(img.width, img.height));
                const cv = doc.createElement('canvas');
                cv.width = Math.round(img.width * k);
                cv.height = Math.round(img.height * k);
                cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
                URL.revokeObjectURL(img.src);
                resolve(cv.toDataURL('image/jpeg', 0.82));
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }

    const current = (v) => getComputedStyle(doc.documentElement).getPropertyValue(v).trim();
    const hex = (c) => {
        // color input 只认 #rrggbb
        const m = c.match(/^#([0-9a-f]{3})$/i);
        if (m) return '#' + [...m[1]].map((x) => x + x).join('');
        return /^#[0-9a-f]{6}$/i.test(c) ? c : '#000000';
    };

    function buildPanel() {
        let p = doc.getElementById('ar-style');
        if (p) return p;
        const s = store() ?? {};
        p = doc.createElement('div');
        p.id = 'ar-style';
        p.innerHTML = `
            <header><b>style</b><small>SWATCH CARD</small><i class="ar-x" role="button" title="收起">×</i></header>
            <section><h4>配色</h4>
                <div class="ar-presets">${PRESETS.map(([n, c], i) => `<button data-p="${i}" title="${n}"><span>${c.slice(0, 4).map((x) => `<i style="background:${x}"></i>`).join('')}</span><em>${n}</em></button>`).join('')}</div>
                <div class="ar-colors">${VARS.map(([v, n]) => `<label><input type="color" data-v="${v}"><span>${n}</span></label>`).join('')}</div>
            </section>
            <section><h4>图片</h4>
                ${IMAGES.map(([, key, n]) => `<div class="ar-img" data-k="${key}"><span>${n}</span><label class="ar-btn">换一张<input type="file" accept="image/*" hidden></label><button class="ar-btn" data-reset="${key}">还原</button></div>`).join('')}
            </section>
            <section><h4>字体</h4>
                <label class="ar-row"><span>正文</span><select data-f="cn">${CN_FONTS.map(([n], i) => `<option value="${i}">${n}</option>`).join('')}</select></label>
                <label class="ar-row"><span>打字机字</span><select data-f="tw">${TW_FONTS.map(([n], i) => `<option value="${i}">${n}</option>`).join('')}</select></label>
            </section>
            <footer><button class="ar-btn" data-all>全部还原</button></footer>`;
        doc.body.append(p);

        const sync = () => {
            for (const inp of p.querySelectorAll('input[type=color]')) inp.value = hex(current(inp.dataset.v));
            for (const sel of p.querySelectorAll('select')) sel.value = String(store()?.[sel.dataset.f] ?? 0);
        };
        p.addEventListener('input', (e) => {
            const v = e.target.dataset?.v;
            if (!v) return;
            const st = store();
            if (!st) return;
            st.colors ??= {};
            st.colors[v] = e.target.value;
            applyStyle();
            save();
        });
        p.addEventListener('change', async (e) => {
            const st = store();
            if (!st) return;
            if (e.target.dataset?.f) {
                st[e.target.dataset.f] = Number(e.target.value);
                applyStyle();
                save();
            }
            if (e.target.type === 'file' && e.target.files?.[0]) {
                const key = e.target.closest('.ar-img').dataset.k;
                const max = IMAGES.find((x) => x[1] === key)[3];
                st.images ??= {};
                st.images[key] = await shrink(e.target.files[0], max);
                e.target.value = '';
                applyStyle();
                save();
            }
        });
        p.addEventListener('click', (e) => {
            const st = store();
            const b = e.target.closest('button, .ar-x');
            if (!b || !st) return;
            if (b.classList.contains('ar-x')) { stylePanel(false); return; }
            if (b.dataset.p !== undefined) {
                st.colors = Object.fromEntries(VARS.map(([v], i) => [v, PRESETS[b.dataset.p][1][i]]));
            } else if (b.dataset.reset) {
                if (st.images) delete st.images[b.dataset.reset];
            } else if (b.dataset.all !== undefined) {
                delete st.colors; delete st.images; delete st.cn; delete st.tw;
            } else return;
            applyStyle();
            save();
            sync();
        });
        p.syncInputs = sync;
        return p;
    }

    function stylePanel(on) {
        const p = buildPanel();
        if (on) p.syncInputs();
        body.classList.toggle('ar-styling', on);
    }

    // 点到样张卡和竖签以外的地方就收起来（颜色选择器弹出来时不算）
    doc.addEventListener('pointerdown', (e) => {
        if (!body.classList.contains('ar-styling')) return;
        if (e.target.closest('#ar-style, #ar-side')) return;
        stylePanel(false);
    }, true);

    const c = ctx();
    const es = c?.eventSource;
    const et = c?.eventTypes ?? c?.event_types ?? {};
    if (es?.on) {
        for (const k of ['CHAT_CHANGED', 'MESSAGE_SENT', 'MESSAGE_RECEIVED', 'MESSAGE_DELETED', 'CHARACTER_EDITED']) {
            if (et[k]) es.on(et[k], () => { sync(); fill(); });
        }
        // 发出去之后输入栏先沉回袋子（生成回复时会再浮上来露出 STOP）；换聊天也收回去
        for (const k of ['MESSAGE_SENT', 'CHAT_CHANGED']) {
            if (et[k]) es.on(et[k], () => { if (empty()) memo(false); });
        }
    }

    sync();
    setInterval(sync, 1500);
})();
