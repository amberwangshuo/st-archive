// 档案 archive 的配套插件（试作）
// 只在「档案」主题生效时工作：
// · 隔页上凸出三枚签：archive（点它露出顶栏图标）、records（聊天记录）、index（角色）
// · 输入栏是隔页下沿口袋里的一张 MEMO 卡，点口袋抽出来；别的插件的按钮、快速回复收在卡片第二行
// · 侧面四枚签：style（调色换图换字体）、lore（世界书）、preset（AI 设置）、persona（人设）
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

    // 侧面的签：样张卡，和三个最常开的抽屉
    const drawer = (id) => () => doc.querySelector(`#${id} > .drawer-toggle`)?.click();
    const SIDES = [
        ['s1', 'style', '调色、换图、换字体', () => stylePanel(!body.classList.contains('ar-styling'))],
        ['s2', 'lore', '世界书', drawer('WI-SP-button')],
        ['s3', 'preset', 'AI 设置', drawer('ai-config-button')],
        ['s4', 'persona', '人设', drawer('persona-management-button')],
    ];

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
            doc.documentElement.style.setProperty('--ar-nextno', count ? `"N\u00B0 ${count}"` : '""');
            // 书眉第一张小方图：当前角色的头像（群聊就不放，用默认那张）
            const ch = !c.groupId && c.characterId != null ? c.characters?.[c.characterId] : null;
            if (ch?.avatar) doc.documentElement.style.setProperty('--ar-ava', `url("/thumbnail?type=avatar&file=${encodeURIComponent(ch.avatar)}")`);
            else doc.documentElement.style.removeProperty('--ar-ava');
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
        // 侧面的四枚签：各长在一张隔页上
        const sides = doc.createElement('div');
        sides.id = 'ar-sides';
        for (const [cls, label, title, act] of SIDES) {
            const el = doc.createElement('div');
            el.className = `ar-s ${cls}`;
            el.setAttribute('role', 'button');
            el.title = title;
            el.innerHTML = `<b>${label}</b>`;
            el.addEventListener('click', act);
            sides.append(el);
        }
        sheld.append(sides);
        // 夹子：咬在文件夹上沿，样子在主题里
        const clip = doc.createElement('div');
        clip.id = 'ar-clip';
        sheld.append(clip);
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
        doc.documentElement.style.removeProperty('--ar-ava');
        doc.getElementById('ar-tabs')?.remove();
        doc.getElementById('ar-cover')?.remove();
        doc.getElementById('ar-sides')?.remove();
        doc.getElementById('ar-clip')?.remove();
        doc.getElementById('ar-fonts-cn')?.remove();
        doc.getElementById('ar-fonts')?.remove();
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
            // 主题里的三种字体由这里加载（主题本身不引外部样式表，导入时酒馆就不会弹确认框）
            loadCss('https://fonts.loli.net/css2?family=Courier+Prime&family=Inter+Tight:wght@400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=Playfair+Display+SC&display=swap', 'ar-fonts');
            loadCss('https://fontsapi.zeoseven.com/309/main/result.css', 'ar-fonts-cn');
            // 一进来就有面板开着（比如被钉住的世界书），图标要露出来，才点得到它把它关掉
            if (doc.querySelector('#top-settings-holder .drawer-content.openDrawer')) open(true);
            buildCover();
            gatherTools();
            dress();
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
            dress();
        }).observe(chatEl, { childList: true });
    }

    // 点到图标和面板以外的地方，且没有面板开着，就把图标收回去
    doc.addEventListener('pointerdown', (e) => {
        if (!body.classList.contains('ar-open')) return;
        if (e.target.closest('#ar-tabs, #top-settings-holder')) return;
        if (doc.querySelector('.drawer-content.openDrawer')) return;
        open(false);
    }, true);

    // MEMO 卡：点口袋或开始打字时抽出来（body.ar-memo）；框里没字、点到别处时沉回去
    // 卡片升上来时上面那页纸会让出位置（变矮），原来停在最底下的话就跟着滚到底
    const memo = (on) => {
        if (body.classList.contains('ar-memo') === on) return;
        const chat = doc.getElementById('chat');
        const atBottom = chat && chat.scrollHeight - chat.scrollTop - chat.clientHeight < 40;
        body.classList.toggle('ar-memo', on);
        // 卡片是慢慢升上来的，等它停了再滚一次
        if (atBottom) for (const t of [0, 250, 550]) setTimeout(() => { chat.scrollTop = chat.scrollHeight; }, t);
    };
    const textarea = () => doc.getElementById('send_textarea');
    const empty = () => !(textarea()?.value ?? '').trim();
    doc.addEventListener('pointerdown', (e) => {
        if (!body.classList.contains('ar-tab')) return;
        const form = e.target.closest('#send_form');
        if (form) {
            const wasOpen = body.classList.contains('ar-memo');
            memo(true);
            // 收着的时候点口袋只是把卡片抽出来，光标放进输入框
            if (!wasOpen && !e.target.closest('#send_textarea')) {
                e.preventDefault();
                setTimeout(() => textarea()?.focus(), 0);
            }
            return;
        }
        // 点到别处：框里没字就把工具格收回去（弹出的菜单里点不算）
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

    // ── 欢迎页那叠档案：手机上第一次点只把那份提起来，再点才打开
    //    （电脑上鼠标移上去就算提起来了） ──
    let passClick = false;
    const PILES = [
        ['#chat .welcomePanel .recentChat', '.chatActions'],
    ];
    doc.addEventListener('click', (e) => {
        if (passClick || !body.classList.contains('ar-tab')) return;
        if (matchMedia('(hover: hover)').matches) return;
        for (const [sel, skip] of PILES) {
            const it = e.target.closest?.(sel);
            if (!it || e.target.closest(skip)) continue;
            if (it.classList.contains('ar-pulled')) return;
            e.stopPropagation();
            e.preventDefault();
            doc.querySelectorAll('.ar-pulled').forEach((x) => x.classList.remove('ar-pulled'));
            it.classList.add('ar-pulled');
            return;
        }
    }, true);

    // ── style 卡：配色（能存成自己的方案）、版式、几行可以改的字、图片、字体 ──
    const VARS = [
        ['--ar-paper', '纸'], ['--ar-ink', '墨'], ['--ar-mute', '旁白'], ['--ar-accent', '文件夹'],
        ['--ar-accent-ink', '文件夹上的字'], ['--ar-hi', '强调'], ['--ar-desk', '台面'],
    ];
    const PRESETS = [
        ['冷白灰蓝', ['#FCFCFB', '#1D1D1C', '#8f8d88', '#70899A', '#FFFFFF', '#4E6A7D', '#DADBDC']],
        ['象牙枯玫瑰', ['#F6F1E8', '#2B2420', '#9C8F84', '#B49A93', '#FFFFFF', '#8A5D55', '#DCD5CA']],
        ['浅灰纯黑', ['#F2F2F1', '#111214', '#7C7F84', '#2A2B2E', '#F2F2F1', '#111214', '#C9CBCE']],
        ['炭黑雾蓝', ['#2A2B2D', '#E4E3DF', '#8A8B8E', '#4C5A63', '#E8ECEE', '#9DB4C2', '#141516']],
    ];
    // 中文字体；第一种是主题默认的，css 为空表示不用另外加载
    const CN_FONTS = [
        ['京華老宋体', '"KingHwaOldSong", "Songti SC", "STSong", "SimSun", serif', ''],
        ['思源宋体', '"Noto Serif SC", "Songti SC", "SimSun", serif', 'https://fonts.loli.net/css2?family=Noto+Serif+SC:wght@300;400&display=swap'],
        ['思源黑体 细', '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif', 'https://fonts.loli.net/css2?family=Noto+Sans+SC:wght@200;300;400&display=swap'],
        ['霞鹜文楷', '"LXGW WenKai", "Kaiti SC", "KaiTi", serif', 'https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/style.css'],
        ['系统字体', 'system-ui, "PingFang SC", "Microsoft YaHei", sans-serif', ''],
    ];
    const TW_FONTS = [
        ['Courier Prime', '"Courier Prime", "KingHwaOldSong", "Courier New", monospace', ''],
        ['Special Elite', '"Special Elite", "KingHwaOldSong", "Courier New", monospace', 'https://fonts.loli.net/css2?family=Special+Elite&display=swap'],
        ['IBM Plex Mono', '"IBM Plex Mono", "KingHwaOldSong", "Courier New", monospace', 'https://fonts.loli.net/css2?family=IBM+Plex+Mono:wght@300;400&display=swap'],
    ];
    // 每张纸的版式：名字、body 上的 class
    const LAYOUTS = [
        ['图录页', ''],
        ['刊物', 'ar-lay-b'],
        ['信', 'ar-lay-c'],
    ];
    const IMAGES = [
        ['--ar-shadow', 'desk', '底图（台面）', 1600],
        ['--ar-photo', 'photo', '封面袋里的照片', 700],
        ['--ar-mood1', 'mood1', '氛围图 一', 600],
        ['--ar-mood2', 'mood2', '氛围图 二', 600],
        ['--ar-wash', 'wash', '输入标签下面晕开的图', 500],
    ];
    // 可以改的几行字：键、说明、默认值、是不是多行
    const TEXTS = [
        ['title', '刊物的标题（{n} 是英文数字，{no} 是阿拉伯数字）', 'Page {n}', false],
        ['addr', '信头的地址行', 'Private Archive', false],
        ['dear', '信的称呼（{name} 是对方的名字）', 'Dear {name},', false],
        ['open1', '角色来信的开场白', '在我所感与我所写之间，永远横亘着一道无法跨越的距离。所以如果这封信显得有些笨拙，请原谅。', true],
        ['close1', '角色来信的落款', 'Nothing new...\nEver yours,', true],
        ['open2', '你回信的开场白', '我想作诗，写雨，写夜的相思，写你，写不出。', true],
        ['close2', '你回信的落款', 'Yours ever, fair Star,', true],
    ];

    const store = () => {
        const c = ctx();
        if (!c?.extensionSettings) return null;
        c.extensionSettings.archive ??= {};
        const s = c.extensionSettings.archive;
        // 0.8 起颜色、版式、字体的定义都换了：旧版存下来的这几样不再适用
        if (s.v !== 2) {
            delete s.colors; delete s.lay; delete s.cn; delete s.tw;
            if (s.images) { delete s.images.sq1; delete s.images.sq2; }
            s.v = 2;
        }
        return s;
    };
    const save = () => ctx()?.saveSettingsDebounced?.();
    const text = (k) => store()?.texts?.[k] ?? TEXTS.find((t) => t[0] === k)[2];

    function loadCss(href, id) {
        if (!href || doc.getElementById(id)) return;
        const l = doc.createElement('link');
        l.rel = 'stylesheet';
        l.href = href;
        l.id = id;
        doc.head.append(l);
    }

    // ── 每张纸上的字：编号、日期、标题、称呼、开场白、落款、原图头像。
    //    算好写在每条消息自己的 --ar-* 变量里，主题用伪元素把它们排到版式里 ──
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const ONES = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const words = (n) => {
        n = Math.max(0, Math.floor(n));
        if (n < 20) return ONES[n];
        if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
        if (n < 1000) return ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + words(n % 100) : '');
        if (n < 10000) return words(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + words(n % 1000) : '');
        return String(n);
    };
    // 写进 CSS 的 content 里的字符串
    const q = (s) => '"' + String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\A ') + '"';
    // 酒馆给消息用的是缩略图，这里换成原图的地址
    const fullPic = (src) => {
        const m = /[?&]type=(avatar|persona)&file=([^&]+)/.exec(src ?? '');
        if (!m) return src || '';
        return (m[1] === 'avatar' ? '/characters/' : '/User%20Avatars/') + m[2];
    };
    function when(c, m) {
        let d = null;
        try { d = c.timestampToMoment?.(m.send_date)?.toDate?.() ?? null; } catch { d = null; }
        if (!d || isNaN(d)) {
            const t = Date.parse(String(m.send_date ?? '').replace(/(\d)(am|pm)/i, '$1 $2'));
            d = isNaN(t) ? null : new Date(t);
        }
        return d;
    }
    const PROPS = ['--ar-no', '--ar-date', '--ar-time', '--ar-stamp', '--ar-datel', '--ar-sheet', '--ar-title', '--ar-dear', '--ar-open', '--ar-close', '--ar-name', '--ar-prev', '--ar-next', '--ar-pic'];
    function dress() {
        if (!body.classList.contains('ar-tab')) return;
        const c = ctx();
        if (!c || !Array.isArray(c.chat)) return;
        const t = Object.fromEntries(TEXTS.map(([k]) => [k, text(k)]));
        const p2 = (n) => String(n).padStart(2, '0');
        for (const el of doc.querySelectorAll('#chat > .mes[mesid]')) {
            const id = Number(el.getAttribute('mesid'));
            const m = c.chat[id];
            if (!m) continue;
            const user = el.getAttribute('is_user') === 'true';
            const to = user ? (c.name2 || '') : (c.name1 || '');
            const d = when(c, m);
            const date = d ? `${p2(d.getDate())} ${MON[d.getMonth()]} ${d.getFullYear()}` : '';
            const time = d ? `${p2(d.getHours())}:${p2(d.getMinutes())}` : '';
            const sw = Array.isArray(m.swipes) && m.swipes.length ? m.swipes.length : 1;
            const si = m.swipe_id ?? 0;
            const last = el.classList.contains('last_mes') && !user;
            const img = el.querySelector('.mesAvatarWrapper .avatar img');
            const v = [
                q(id), q(date), q(time),
                q(d ? `${date.toUpperCase()} · ${time}` : ''),
                q(d ? `${MON[d.getMonth()]}. ${d.getDate()}, ${d.getFullYear()} · ${time}` : ''),
                q(`${si + 1} / ${sw}`),
                q(t.title.replaceAll('{n}', words(id)).replaceAll('{no}', String(id))),
                q(t.dear.replaceAll('{name}', to)),
                q(user ? t.open2 : t.open1),
                q(user ? t.close2 : t.close1),
                q(el.getAttribute('ch_name') || ''),
                q(last && si > 0 ? si : ''),
                q(last && si + 1 < sw ? si + 2 : ''),
                img?.getAttribute('src') ? `url("${fullPic(img.getAttribute('src'))}")` : 'none',
            ];
            const sig = v.join('|');
            if (el.dataset.arSig === sig) continue;
            el.dataset.arSig = sig;
            PROPS.forEach((k, i) => el.style.setProperty(k, v[i]));
        }
    }
    function undress() {
        for (const el of doc.querySelectorAll('#chat > .mes[data-ar-sig]')) {
            delete el.dataset.arSig;
            for (const k of PROPS) el.style.removeProperty(k);
        }
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
        const cn = CN_FONTS[s.cn ?? 0] ?? CN_FONTS[0];
        const tw = TW_FONTS[s.tw ?? 0] ?? TW_FONTS[0];
        if (s.cn) { root.setProperty('--ar-cn', cn[1]); loadCss(cn[2], `ar-font-cn-${s.cn}`); } else root.removeProperty('--ar-cn');
        if (s.tw) { root.setProperty('--ar-tw', tw[1]); loadCss(tw[2], `ar-font-tw-${s.tw}`); } else root.removeProperty('--ar-tw');
        // 版式、底图用不用酒馆自己的背景、信头的地址行
        for (const [, cls] of LAYOUTS) if (cls) body.classList.toggle(cls, (LAYOUTS[s.lay ?? 0] ?? LAYOUTS[0])[1] === cls);
        body.classList.toggle('ar-bg-st', !!s.bgST);
        root.setProperty('--ar-addr', q(text('addr')));
        dress();
    }

    function clearStyle() {
        const root = doc.documentElement.style;
        for (const [v] of VARS) root.removeProperty(v);
        for (const [v] of IMAGES) root.removeProperty(v);
        for (const v of ['--ar-cn', '--ar-tw', '--ar-addr', '--ar-nextno']) root.removeProperty(v);
        for (const [, cls] of LAYOUTS) if (cls) body.classList.remove(cls);
        body.classList.remove('ar-bg-st');
        undress();
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
    const swatch = (colors) => `<span>${colors.slice(0, 4).map((x) => `<i style="background:${esc(x)}"></i>`).join('')}</span>`;

    function buildPanel() {
        let p = doc.getElementById('ar-style');
        if (p) return p;
        p = doc.createElement('div');
        p.id = 'ar-style';
        p.innerHTML = `
            <header><b>style</b><small>SWATCH CARD</small><i class="ar-x" role="button" title="收起">×</i></header>
            <section><h4>配色</h4>
                <div class="ar-presets"></div>
                <div class="ar-save"><input type="text" maxlength="12" placeholder="给现在这套配色起个名字"><button class="ar-btn" data-savescheme>存成方案</button></div>
                <div class="ar-colors">${VARS.map(([v, n]) => `<label><input type="color" data-v="${v}"><span>${n}</span></label>`).join('')}</div>
            </section>
            <section><h4>版式</h4>
                <div class="ar-lays">${LAYOUTS.map(([n], i) => `<button data-lay="${i}"><i class="l${i}"></i><em>${n}</em></button>`).join('')}</div>
            </section>
            <section><h4>文字</h4>
                ${TEXTS.map(([k, n, , multi]) => `<label class="ar-text"><span>${n}</span>${multi ? `<textarea rows="2" data-t="${k}"></textarea>` : `<input type="text" data-t="${k}">`}</label>`).join('')}
            </section>
            <section><h4>图片</h4>
                <label class="ar-row ar-check"><input type="checkbox" data-bgst><span>底图用酒馆自己的背景</span></label>
                ${IMAGES.map(([, key, n]) => `<div class="ar-img ar-row" data-k="${key}"><span>${n}</span><label class="ar-btn">换一张<input type="file" accept="image/*" hidden></label><button class="ar-btn" data-reset="${key}">还原</button></div>`).join('')}
            </section>
            <section><h4>字体</h4>
                <label class="ar-row"><span>中文</span><select data-f="cn">${CN_FONTS.map(([n], i) => `<option value="${i}">${n}</option>`).join('')}</select></label>
                <label class="ar-row"><span>打字机字</span><select data-f="tw">${TW_FONTS.map(([n], i) => `<option value="${i}">${n}</option>`).join('')}</select></label>
            </section>
            <footer><button class="ar-btn" data-all>全部还原</button></footer>`;
        doc.body.append(p);

        // 配色方案：四套自带的，后面跟着自己存的（右上角 × 删掉）
        const presets = () => {
            const mine = store()?.schemes ?? [];
            p.querySelector('.ar-presets').innerHTML =
                PRESETS.map(([n, c], i) => `<button data-p="${i}" title="${esc(n)}">${swatch(c)}<em>${esc(n)}</em></button>`).join('') +
                mine.map((sc, i) => `<button data-sp="${i}" title="${esc(sc.name)}">${swatch(VARS.map(([v]) => sc.colors[v] ?? '#000'))}<em>${esc(sc.name)}</em><i class="ar-del" role="button" data-del="${i}" title="删掉这套">×</i></button>`).join('');
        };
        const sync = () => {
            presets();
            for (const inp of p.querySelectorAll('input[type=color]')) inp.value = hex(current(inp.dataset.v));
            for (const sel of p.querySelectorAll('select')) sel.value = String(store()?.[sel.dataset.f] ?? 0);
            for (const b of p.querySelectorAll('[data-lay]')) b.classList.toggle('on', Number(b.dataset.lay) === (store()?.lay ?? 0));
            for (const inp of p.querySelectorAll('[data-t]')) inp.value = text(inp.dataset.t);
            const bg = p.querySelector('[data-bgst]');
            if (bg) bg.checked = !!store()?.bgST;
        };
        p.addEventListener('input', (e) => {
            const st = store();
            if (!st) return;
            const v = e.target.dataset?.v;
            const t = e.target.dataset?.t;
            if (v) {
                st.colors ??= {};
                st.colors[v] = e.target.value;
            } else if (t) {
                st.texts ??= {};
                st.texts[t] = e.target.value;
            } else return;
            applyStyle();
            save();
        });
        p.addEventListener('change', async (e) => {
            const st = store();
            if (!st) return;
            if (e.target.dataset?.bgst !== undefined) {
                st.bgST = e.target.checked;
                applyStyle();
                save();
            }
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
            const b = e.target.closest('button, .ar-x, .ar-del');
            if (!b || !st) return;
            if (b.classList.contains('ar-x')) { stylePanel(false); return; }
            if (b.dataset.del !== undefined) {
                st.schemes?.splice(Number(b.dataset.del), 1);
            } else if (b.dataset.p !== undefined) {
                st.colors = Object.fromEntries(VARS.map(([v], i) => [v, PRESETS[b.dataset.p][1][i]]));
            } else if (b.dataset.sp !== undefined) {
                const sc = st.schemes?.[Number(b.dataset.sp)];
                if (sc) st.colors = { ...sc.colors };
            } else if (b.dataset.savescheme !== undefined) {
                // 把现在看到的七个颜色存成一套
                const inp = p.querySelector('.ar-save input');
                st.schemes ??= [];
                const name = inp.value.trim() || `方案 ${st.schemes.length + 1}`;
                st.schemes.push({ name, colors: Object.fromEntries(VARS.map(([v]) => [v, hex(current(v))])) });
                inp.value = '';
            } else if (b.dataset.lay !== undefined) {
                st.lay = Number(b.dataset.lay);
            } else if (b.dataset.reset) {
                if (st.images) delete st.images[b.dataset.reset];
            } else if (b.dataset.all !== undefined) {
                // 自己存的配色方案留着，别的都回到默认
                delete st.colors; delete st.images; delete st.cn; delete st.tw; delete st.lay; delete st.bgST; delete st.texts;
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
        if (e.target.closest('#ar-style, #ar-sides')) return;
        stylePanel(false);
    }, true);

    const c = ctx();
    const es = c?.eventSource;
    const et = c?.eventTypes ?? c?.event_types ?? {};
    if (es?.on) {
        for (const k of ['CHAT_CHANGED', 'MESSAGE_SENT', 'MESSAGE_RECEIVED', 'MESSAGE_DELETED', 'CHARACTER_EDITED', 'MESSAGE_SWIPED', 'MESSAGE_EDITED', 'MESSAGE_UPDATED', 'CHARACTER_MESSAGE_RENDERED', 'USER_MESSAGE_RENDERED', 'MORE_MESSAGES_LOADED']) {
            if (et[k]) es.on(et[k], () => { sync(); fill(); setTimeout(dress, 60); });
        }
        // 发出去之后、换聊天时把工具格收起来
        for (const k of ['MESSAGE_SENT', 'CHAT_CHANGED']) {
            if (et[k]) es.on(et[k], () => { if (empty()) memo(false); });
        }
    }

    sync();
    setInterval(sync, 1500);
})();
