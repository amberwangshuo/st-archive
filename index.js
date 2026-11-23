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

    // 主题有没有生效：看主题定义的变量在不在
    const themeOn = () => getComputedStyle(doc.documentElement).getPropertyValue('--ar-paper').trim() !== '';

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
        const openIt = () => latest()?.click();
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
        fill();
    }

    function unmount() {
        doc.getElementById('ar-tabs')?.remove();
        doc.getElementById('ar-cover')?.remove();
        tabs = null;
        body.classList.remove('ar-tab', 'ar-open', 'ar-memo', 'ar-home', 'ar-cover');
    }

    // 主题可能随时被换掉，过一会儿看一次
    function sync() {
        if (themeOn()) {
            mount();
            body.classList.add('ar-tab');
            buildCover();
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
    const memo = (on) => body.classList.toggle('ar-memo', on);
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
