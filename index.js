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

    // 欢迎页（v23 起没有封面了，她说看不出用处）：只记一下是不是在欢迎页
    const home = () => !!doc.querySelector('#chat .welcomePanel');
    const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

    // 侧面的签：样张卡，和三个最常开的抽屉
    const drawer = (id) => () => doc.querySelector(`#${id} > .drawer-toggle`)?.click();
    const SIDES = [
        ['s1', 'style', '调色、换图、换字体', () => stylePanel(!body.classList.contains('ar-styling'))],
        ['s2', 'lore', '世界书', drawer('WI-SP-button')],
        ['s3', 'preset', 'AI 设置', drawer('ai-config-button')],
        ['s4', 'persona', '人设', drawer('persona-management-button')],
    ];

    // 三枚签：从后往前 characters（角色）、records（聊天记录）、archive（全部图标）
    const TABS = [
        { cls: 't3', label: 'characters', act: () => doc.getElementById('rightNavDrawerIcon')?.click() },
        {
            // records：聊天里打开这位的聊天记录；欢迎页上展开 / 收起更早的聊天
            cls: 't2', label: 'records', act: () => {
                if (home()) doc.querySelector('#chat .welcomePanel .showMoreChats')?.click();
                else doc.getElementById('option_select_chat')?.click();
            },
        },
        { cls: 't1', label: 'archive', act: () => open(!body.classList.contains('ar-open')) },
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
        // 手机上侧签压在消息纸下面只露一条边：手指一碰（或点了它）就浮到纸上面来，过一会儿自己落回去
        let upTimer = 0;
        const up = () => {
            sides.classList.add('up');
            clearTimeout(upTimer);
            upTimer = setTimeout(() => sides.classList.remove('up'), 2800);
        };
        sides.addEventListener('pointerdown', up, true);
        sides.addEventListener('click', up, true);
        // 夹子：从左边夹住整叠纸；垫在纸下面的波点纸（上面盖一张硫酸纸）。样子都在主题里
        const clip = doc.createElement('div');
        clip.id = 'ar-clip';
        sheld.append(clip);
        const under = doc.createElement('div');
        under.id = 'ar-under';
        // 放在 #sheld 最前面（三枚签后面）：不依赖 #chat 一定是 #sheld 的直接子元素
        sheld.insertBefore(under, tabs.nextSibling);
        // 侧签排在垫纸后面、#chat 前面：手机上它和消息纸同一层，靠这个顺序被纸盖住
        sheld.insertBefore(sides, under.nextSibling);
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
        doc.getElementById('ar-under')?.remove();
        doc.getElementById('ar-sides')?.remove();
        doc.getElementById('ar-clip')?.remove();
        for (const f of doc.querySelectorAll('.ar-folio, .ar-scratch, .ar-exq, .ar-fs')) f.remove();
        body.classList.remove('ar-immersive');
        texFixed = false;
        clearFixTex();
        for (const x of doc.querySelectorAll('#chat p[data-ar-ind]')) x.removeAttribute('data-ar-ind');
        for (const x of doc.querySelectorAll('#chat > .mes')) { x.style.removeProperty('--ar-foot'); x.style.removeProperty('--ar-kh'); }
        doc.getElementById('ar-cover')?.remove();
        delete doc.documentElement.dataset.arPv;
        doc.documentElement.style.removeProperty('--ar-vh');
        doc.documentElement.style.removeProperty('--ar-top');
        if (themeColor0 !== null) doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor0);
        topKey = '';
        doc.getElementById('ar-fonts-cn')?.remove();
        doc.getElementById('ar-fonts')?.remove();
        doc.getElementById('ar-style')?.remove();
        clearStyle();
        tabs = null;
        body.classList.remove('ar-tab', 'ar-open', 'ar-memo', 'ar-home', 'ar-styling');
        doc.documentElement.style.removeProperty('--ar-wall');
    }

    // 主题可能随时被换掉，过一会儿看一次
    function sync() {
        if (themeOn()) {
            // 记号：主题靠它知道插件是不是这一版（不是的话签下面会出一张提醒更新的小条）
            doc.documentElement.dataset.arPv = '18';
            mount();
            body.classList.add('ar-tab');
            // 主题里的三种字体由这里加载（主题本身不引外部样式表，导入时酒馆就不会弹确认框）
            loadCss('https://fonts.loli.net/css2?family=Courier+Prime&family=Inter+Tight:wght@400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=Playfair+Display+SC&display=swap', 'ar-fonts');
            loadCss('https://fontsapi.zeoseven.com/309/main/result.css', 'ar-fonts-cn');
            // 一进来就有面板开着（比如被钉住的世界书），图标要露出来，才点得到它把它关掉
            if (doc.querySelector('#top-settings-holder .drawer-content.openDrawer')) open(true);
            body.classList.toggle('ar-home', home());
            gatherTools();
            dress();
            scratch();
            indents();
            folio();
            fsMarks();
            fixTex();
            wall();
            topColor();
            cover();
            letters();
        } else if (body.classList.contains('ar-tab')) {
            unmount();
        }
    }

    // 欢迎页出现或离开时马上换（每次回到欢迎页都先看封面）
    const chatEl = doc.getElementById('chat');
    if (chatEl) {
        new MutationObserver(() => {
            if (!body.classList.contains('ar-tab')) return;
            body.classList.toggle('ar-home', home());
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

    function wall() {
        const root = doc.documentElement.style;
        if (!store()?.bgST) { root.removeProperty('--ar-wall'); return; }
        const img = getComputedStyle(doc.getElementById('bg1') ?? body).backgroundImage;
        if (img && img !== 'none') root.setProperty('--ar-wall', img);
        else root.removeProperty('--ar-wall');
    }

    // 手机状态栏那一条（时间、电量后面）：网页在浏览器里没法把图片画到那里，那一条只跟着页面的底色走。
    // 所以取壁纸最上面一条的平均色当底色（--ar-top），看起来就是壁纸一直铺上去；同时写进 theme-color。
    // 另外加一个 meta：以后「添加到主屏幕」打开时，页面真的能铺到状态栏底下，那时候就是壁纸本身了
    let topKey = '', themeColor0 = null;
    function topColor() {
        const root = doc.documentElement;
        const m = getComputedStyle(root).backgroundImage.match(/url\(["']?(.*?)["']?\)/);
        const key = `${m?.[1]?.slice(0, 200) ?? ''}|${m?.[1]?.length ?? 0}|${innerWidth}x${innerHeight}`;
        if (key === topKey) return;
        topKey = key;
        const meta = doc.querySelector('meta[name="theme-color"]');
        if (meta && themeColor0 === null) themeColor0 = meta.getAttribute('content');
        if (!doc.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')) {
            const sb = doc.createElement('meta');
            sb.name = 'apple-mobile-web-app-status-bar-style';
            sb.content = 'black-translucent';
            doc.head.append(sb);
        }
        // iOS 从主屏幕图标打开、状态栏透明时，100dvh 比屏幕矮一条状态栏：把真正的屏幕高度写给主题
        const probe = doc.createElement('i');
        probe.style.cssText = 'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top,0px)';
        doc.documentElement.append(probe);
        const sat = parseFloat(getComputedStyle(probe).paddingTop) || 0;
        probe.remove();
        if (navigator.standalone === true && sat > 0) {
            const portrait = matchMedia('(orientation: portrait)').matches;
            const full = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
            root.style.setProperty('--ar-vh', `${full}px`);
        } else root.style.removeProperty('--ar-vh');
        if (!m) { root.style.removeProperty('--ar-top'); return; }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                // 和 html 的背景一样的裁法：cover，横向 30%、纵向 50%
                const sc = Math.max(innerWidth / img.width, innerHeight / img.height);
                const cw = innerWidth / sc, chh = innerHeight / sc;
                const sx = (img.width - cw) * .3, sy = (img.height - chh) * .5;
                const cv = doc.createElement('canvas');
                cv.width = 16; cv.height = 4;
                const g = cv.getContext('2d');
                g.drawImage(img, sx, sy, cw, Math.max(1, chh * .05), 0, 0, 16, 4);
                const px = g.getImageData(0, 0, 16, 4).data;
                let r = 0, gg = 0, b = 0;
                for (let i = 0; i < px.length; i += 4) { r += px[i]; gg += px[i + 1]; b += px[i + 2]; }
                const n = px.length / 4;
                const col = `rgb(${Math.round(r / n)}, ${Math.round(gg / n)}, ${Math.round(b / n)})`;
                if (topKey !== key) return;
                root.style.setProperty('--ar-top', col);
                meta?.setAttribute('content', col);
            } catch { root.style.removeProperty('--ar-top'); }
        };
        img.onerror = () => root.style.removeProperty('--ar-top');
        img.src = m[1];
    }

    // ── 角色抽屉的索引：按名字排序时，每组第一个角色左边写拼音首字母（主题用 data-ar-l 显示） ──
    // 汉字的首字母：和每个字母的第一个汉字比大小（浏览器自带的拼音排序规则）
    const PY_LETTERS = 'ABCDEFGHJKLMNOPQRSTWXYZ';
    const PY_BOUND = '阿八嚓哒妸发旮哈讥咔垃妈拏噢妑七呥仨他穵夕丫帀';
    let pyColl = null;
    try { pyColl = new Intl.Collator('zh-Hans-CN-u-co-pinyin'); } catch { pyColl = null; }
    function initial(name) {
        const ch = String(name ?? '').trim().replace(/^[\s《「『（(【\[“"'〈<]+/, '').charAt(0);
        if (!ch) return '#';
        if (/[a-z]/i.test(ch)) return ch.toUpperCase();
        if (!/[\u3400-\u9fff]/.test(ch) || !pyColl) return '#';
        let r = '#';
        for (let i = 0; i < PY_BOUND.length; i++) {
            if (pyColl.compare(ch, PY_BOUND[i]) >= 0) r = PY_LETTERS[i]; else break;
        }
        return r;
    }
    function letters() {
        const list = doc.getElementById('rm_print_characters_block');
        if (!list) return;
        const opt = doc.getElementById('character_sort_order')?.selectedOptions?.[0];
        const byName = !!opt && opt.dataset.field === 'name' && opt.dataset.order !== 'random';
        let last = null;
        for (const el of list.querySelectorAll(':scope > .character_select, :scope > .group_select')) {
            if (!byName || !body.classList.contains('ar-tab')) { el.removeAttribute('data-ar-l'); continue; }
            const L = initial(el.querySelector('.ch_name')?.textContent);
            if (L !== last) el.setAttribute('data-ar-l', L); else el.removeAttribute('data-ar-l');
            last = L;
        }
    }
    const charList = doc.getElementById('rm_print_characters_block');
    if (charList) new MutationObserver(() => letters()).observe(charList, { childList: true });
    doc.getElementById('character_sort_order')?.addEventListener('change', () => setTimeout(letters, 50));

    // ── style 卡：配色（能存成自己的方案）、版式、几行可以改的字、图片、字体 ──
    const VARS = [
        ['--ar-paper', '纸（消息、抽屉、弹窗）'], ['--ar-ink', '字'], ['--ar-mute', '旁白（灰字）'], ['--ar-accent', '文件夹和签'],
        ['--ar-accent-ink', '签上的字'], ['--ar-hi', '强调（加粗的字）'], ['--ar-desk', '台面（壁纸没盖住的地方）'],
        // 这两个自带的配色方案里没有：不调就跟着纸色和字色走
        ['--ar-underc', '垫纸（最下面那张）'], ['--ar-dotc', '垫纸上的波点'],
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
    const fontKeys = {};
    const TW_FONTS = [
        ['Courier Prime', '"Courier Prime", "KingHwaOldSong", "Courier New", monospace', ''],
        ['Special Elite', '"Special Elite", "KingHwaOldSong", "Courier New", monospace', 'https://fonts.loli.net/css2?family=Special+Elite&display=swap'],
        ['IBM Plex Mono', '"IBM Plex Mono", "KingHwaOldSong", "Courier New", monospace', 'https://fonts.loli.net/css2?family=IBM+Plex+Mono:wght@300;400&display=swap'],
    ];
    // 纸纹：名字、叠在纸上的一层图案（--ar-pat）、换掉棉纸纹理（--ar-cotton；'none' 是不要纹理）
    const GRID = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Cpath d='M0 .3H16M.3 0V16' stroke='%231D1D1C' stroke-opacity='.09' stroke-width='.6' fill='none'/%3E%3C/svg%3E\") 0 0 / 16px 16px";
    const PAPERS = [
        ['棉纸', '', ''],
        ['点阵', 'radial-gradient(circle, rgba(29, 29, 28, .2) .85px, transparent 1.25px) 0 0 / 14px 14px', ''],
        ['方格', GRID, ''],
        ['横线', 'repeating-linear-gradient(transparent 0 27px, rgba(29, 29, 28, .08) 27px 27.6px)', ''],
        ['素白', '', 'none'],
        ['自己上传', '', 'upload'],
        // 后加的排在最后（存的是序号，前面的不能动）；style 卡里按 PAPER_ORDER 排
        ['书纸', '', '--ar-book'],
        ['布纹信纸', '', '--ar-linen', '190px 190px'],
    ];
    const PAPER_ORDER = [0, 6, 7, 1, 2, 3, 4, 5];
    // 每种版式默认配的纸：图录页 棉纸、刊物 书纸、信 布纹信纸、答卷 素白；在哪种版式下选的纸只记给那种版式
    const PAPER_DEF = [0, 6, 7, 4];
    const paperOf = (s) => s?.papers?.[s.lay ?? 0] ?? PAPER_DEF[s?.lay ?? 0] ?? 0;
    // 每张纸的版式：名字、body 上的 class
    const LAYOUTS = [
        ['图录页', ''],
        ['刊物', 'ar-lay-b'],
        ['信', 'ar-lay-c'],
        ['答卷', 'ar-lay-d'],
    ];
    const IMAGES = [
        ['--ar-shadow', 'desk', '底图（台面）', 1600],
        ['--ar-photo', 'photo', '封面上那张拍立得', 700],
        ['--ar-cv1', 'cv1', '封面后面露出的相片 一', 700],
        ['--ar-cv2', 'cv2', '封面后面露出的相片 二', 700],
        ['--ar-mood1', 'mood1', '氛围图 一', 600],
        ['--ar-mood2', 'mood2', '氛围图 二', 600],
        ['--ar-wash', 'wash', '输入标签下面晕开的图', 500],
    ];
    // 自己上传的纸纹单独存（不在「图片」那一栏里，在「纸纹」那一栏）
    // 可以改的几行字：键、说明、默认值、是不是多行
    const TEXTS = [
        ['title', '刊物的标题', '无题', false, 1],
        ['epi', '刊物的题记（署名下面那一小段，留空就没有）', '草在结它的种子，风在摇它的叶子，我们站着，不说话，就十分美好。', true, 1],
        ['addr', '角色来信的地址', '19 Rue des Archives, 75004 Paris', false, 2],
        ['addr2', '你回信的地址', '7 Rue Barbette, 75003 Paris', false, 2],
        ['dear', '信的称呼（{name} 是对方的名字）', 'Dear {name},', false, 2],
        ['open1', '角色来信的开场白', '在我所感与我所写之间，永远横亘着一道无法跨越的距离。所以如果这封信显得有些笨拙，请原谅。', true, 2],
        ['close1', '角色来信的落款', 'Nothing new...\nEver yours,', true, 2],
        ['open2', '你回信的开场白', '我想作诗，写雨，写夜的相思，写你，写不出。', true, 2],
        ['close2', '你回信的落款', 'Yours ever, fair Star,', true, 2],
        ['exam', '答卷的考试名称（前面自动加年份，比如 高三第三次模拟考试、高二期末考试）', '高三第三次模拟考试', false, 3],
        ['idle', '输入框收起时的那一句', '从前的日色变得慢，车，马，邮件都慢', false, -1],
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
        // 0.10.1：信头地址的默认值从 Private Archive 换成真的地址，旧的默认值别留着
        if (s.texts?.addr === 'Private Archive') delete s.texts.addr;
        // 0.18：纸纹库。以前只存一张 paperTex：把它放进库里
        if (s.paperTex && !(s.texLib ?? []).includes(s.paperTex)) s.texLib = [s.paperTex, ...(s.texLib ?? [])];
        // 0.13：刊物标题的默认值从「Page {n}」换成「无题」（她说 Page Zero 绝对不可以），旧的默认值别留着
        if (s.texts?.title === 'Page {n}') delete s.texts.title;
        // 0.15.3：答卷的考试名称默认从「语文周测」换成模考，旧的默认值别留着
        if (s.texts?.exam === '语文周测') delete s.texts.exam;
        // 0.11：纸纹改成每种版式各记各的。旧的那一个选择：是「自己上传」就留给现在的版式，别的不留（三种版式各用新的默认纸）
        if (s.paper !== undefined) {
            if (s.paper === 5) { s.papers ??= {}; s.papers[s.lay ?? 0] ??= 5; }
            delete s.paper;
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
    const PROPS = ['--ar-no', '--ar-date', '--ar-time', '--ar-stamp', '--ar-datel', '--ar-sheet', '--ar-title', '--ar-dear', '--ar-open', '--ar-close', '--ar-name', '--ar-addr', '--ar-pic'];
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
                q(user ? t.addr2 : t.addr),
                img?.getAttribute('src') ? `url("${fullPic(img.getAttribute('src'))}")` : 'none',
            ];
            const sig = v.join('|');
            if (el.dataset.arSig === sig) continue;
            el.dataset.arSig = sig;
            PROPS.forEach((k, i) => el.style.setProperty(k, v[i]));
        }
    }
    // 翻页：杂志的页码。最后一张角色的纸右下角一排页码，现在这一稿是 .on；
    // 正停在最后一稿时，后面多一个淡的号码 .new（点它 = 酒馆的右翻 = 重新生成）。稿多时只列现在这一稿前后五个
    function folio() {
        const c = ctx();
        if (!c || !Array.isArray(c.chat)) return;
        const on = body.classList.contains('ar-tab') && !body.classList.contains('hideAllSwipeButtons');
        for (const el of doc.querySelectorAll('#chat > .mes[mesid]')) {
            const m = c.chat[Number(el.getAttribute('mesid'))];
            let f = el.querySelector(':scope > .ar-folio');
            const show = on && m && el.classList.contains('last_mes') && el.getAttribute('is_user') !== 'true' && el.matches('.swipes_visible, .last_swipe');
            if (!show) { f?.remove(); continue; }
            const sw = Array.isArray(m.swipes) && m.swipes.length ? m.swipes.length : 1;
            const si = Math.min(m.swipe_id ?? 0, sw - 1);
            const more = el.classList.contains('last_swipe') && si === sw - 1;
            const sig = `${si}/${sw}/${more}`;
            if (f?.dataset.sig === sig) continue;
            if (!f) {
                f = doc.createElement('div');
                f.className = 'ar-folio';
                el.appendChild(f);
            }
            f.dataset.sig = sig;
            const n2 = (n) => String(n).padStart(2, '0');
            let list = [];
            if (sw <= 7) list = Array.from({ length: sw }, (_, i) => i);
            else {
                // 首、尾、现在这一稿和它前后各一稿；不相邻的地方放一个 -1（画成「…」）
                const keep = [...new Set([0, si - 1, si, si + 1, sw - 1])].filter((i) => i >= 0 && i < sw).sort((a, b) => a - b);
                keep.forEach((i, k) => { if (k && i - keep[k - 1] > 1) list.push(-1); list.push(i); });
            }
            let h = '';
            for (const i of list) {
                h += i < 0
                    ? '<button type="button" class="gap" data-jump title="全部稿">…</button>'
                    : `<button type="button" data-i="${i}"${i === si ? ' class="on" aria-current="page"' : ''}>${n2(i + 1)}</button>`;
            }
            if (more) h += `<button type="button" class="new" data-i="${sw}">${n2(sw + 1)}</button>`;
            f.innerHTML = h;
        }
    }
    // 页码平时是藏着的：点到那一条（号码这时点不到）先让它出现，过几秒自己收回去
    const folioTimers = new WeakMap();
    const showFolio = (f) => {
        f.classList.add('show');
        clearTimeout(folioTimers.get(f));
        folioTimers.set(f, setTimeout(() => f.classList.remove('show'), 8000));
    };
    doc.addEventListener('click', (e) => {
        const f = e.target.closest?.('.ar-folio');
        if (f && !e.target.closest('.ar-folio button')) { e.preventDefault(); e.stopPropagation(); showFolio(f); return; }
        const b = e.target.closest?.('.ar-folio button');
        if (!b) return;
        showFolio(b.closest('.ar-folio'));
        e.preventDefault();
        e.stopPropagation();
        const el = b.closest('.mes');
        const c = ctx();
        const m = c?.chat?.[Number(el?.getAttribute('mesid'))];
        if (!m) return;
        const cur = m.swipe_id ?? 0;
        if (b.dataset.jump !== undefined) {
            // 酒馆自己的「全部稿」：列出每一稿的开头，点哪个跳哪个。老版本没有的话，问一个数字
            const pick = el.querySelector('.mes_swipe_picker');
            if (pick) { pick.click(); return; }
            const total = m.swipes?.length ?? 1;
            Promise.resolve(c.callGenericPopup?.(`跳到第几稿？（1–${total}）`, c.POPUP_TYPE?.INPUT ?? 3, String(cur + 1))).then((v) => {
                const k = Math.round(Number(v)) - 1;
                if (Number.isFinite(k) && k >= 0 && k < total && k !== cur) c.swipe?.to?.(null, k > cur ? 'right' : 'left', { forceSwipeId: k, source: 'swipe_picker' });
            });
            return;
        }
        const n = Number(b.dataset.i);
        if (n === cur) return;
        const dir = n > cur ? 'right' : 'left';
        // 相邻的一稿（包括重新生成）：按酒馆自己的箭头；隔着几稿：直接跳过去
        if (Math.abs(n - cur) === 1 || typeof c.swipe?.to !== 'function') {
            el.querySelector(dir === 'right' ? '.swipe_right' : '.swipe_left')?.click();
        } else {
            c.swipe.to(null, dir, { forceSwipeId: n, source: 'swipe_picker' });
        }
    }, true);

    // ── 版式四 · 答卷：语文试卷里的现代文阅读。正文是要读的文字，后面三道小题（宽泛的，不提具体情节和名字），十八道轮着出 ──
    // 问法照高考语文「文学类文本阅读」的主观题
    const EXAM_Q = [
        '请简要分析文中主要人物的心理变化过程。（6 分）',
        '文中的环境描写有什么作用？请结合文本简要分析。（4 分）',
        '文本在叙述上有什么特点？请结合内容简要分析。（6 分）',
        '文中人物之间的对话有什么特点？对表现人物关系有什么作用？（4 分）',
        '结尾部分有怎样的艺术效果？请结合全文谈谈你的理解。（6 分）',
        '文中多次写到人物的动作细节，请任选一处，分析其表达效果。（4 分）',
        '有人认为，文中“没有说出口的话”比说出口的话更重要。你是否同意？请结合文本说明理由。（6 分）',
        '请从“距离”的角度，分析文中人物之间关系的变化。（6 分）',
        '文本的语言有什么特色？请举例简要赏析。（4 分）',
        '文中的沉默与停顿有什么作用？请简要分析。（4 分）',
        '文中人物的言行与内心是否一致？请结合具体内容分析。（6 分）',
        '文本是如何营造氛围的？请简要分析。（4 分）',
        '请简要概括本文的情节，并分析其结构上的特点。（6 分）',
        '文中哪一处细节最能体现人物性格？请指出并分析。（4 分）',
        '文本中时间的流动是怎样表现的？这样处理有什么好处？（6 分）',
        '请分析文中有关“目光”的描写在文本中的作用。（4 分）',
        '如果为本文拟一个标题，你会怎样拟？请说明理由。（4 分）',
        '文中的叙述视角有什么特点？这种视角对读者的感受有什么影响？（6 分）',
    ];
    // 注意事项：照模考卷的写法
    const EXAM_NOTES = [
        '1. 答卷前，考生务必将自己的姓名、准考证号填写在答题卡上。',
        '2. 回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号涂黑。如需改动，用橡皮擦干净后，再选涂其他答案标号。回答非选择题时，将答案写在答题卡上。写在本试卷上无效。',
        '3. 考试结束后，将本试卷和答题卡一并交回。',
    ];
    // 角色的每一条 = 一张完整的试卷（卷头、注意事项、大题小题标题、「阅读下面的文字……」，正文是阅读材料）；
    // 你的每一条 = 一张答题卡（上面印着前一张试卷的三道题，正文是你的作答，框在答题区域里）。题号按角色的条数往下排
    function scratch() {
        const on = body.classList.contains('ar-tab') && body.classList.contains('ar-lay-d');
        const c = ctx();
        const chat = Array.isArray(c?.chat) ? c.chat : [];
        const p2 = (n) => String(n).padStart(2, '0');
        // 第 i 条之前有几条角色的消息（i 是角色的话，它就是第几张试卷，从 0 数）
        const before = [];
        let papers = 0;
        for (let i = 0; i < chat.length; i++) { before[i] = papers; if (!chat[i]?.is_user && !chat[i]?.is_system) papers++; }
        const name = text('exam').trim() || '高三第三次模拟考试';
        for (const el of doc.querySelectorAll('#chat > .mes[mesid]')) {
            let sc = el.querySelector(':scope > .ar-scratch');
            for (const x of el.querySelectorAll('.mes_block > .ar-exq')) x.remove();
            if (!on) {
                sc?.remove();
                el.style.removeProperty('--ar-foot');
                el.style.removeProperty('--ar-kh');
                continue;
            }
            const id = Number(el.getAttribute('mesid'));
            const user = el.getAttribute('is_user') === 'true';
            const d = chat[id] ? when(c, chat[id]) : null;
            const year = d ? d.getFullYear() : new Date().getFullYear();
            // 试卷：这是第 k 张；答题卡：答的是它前面那一张（前面还没有试卷时答第一张）
            const k = user ? Math.max(0, (before[id] ?? 1) - 1) : (before[id] ?? 0);
            const n0 = k * 3 + 1;
            const pages = Math.max(papers, k + 1);
            el.style.setProperty('--ar-foot', q(user ? `语文答题卡　第 ${k + 1} 页` : `语文试题　第 ${k + 1} 页（共 ${pages} 页）`));
            el.style.setProperty('--ar-kh', q(`${year}${p2((d ? d.getMonth() : 0) + 1)}${p2((k % 48) + 1)}`));
            const key = `${id}|${user ? 'u' : 'c'}|${k}|${year}|${name}|${pages}`;
            if (sc?.dataset.id === key) continue;
            if (!sc) {
                sc = doc.createElement('div');
                sc.className = 'ar-scratch';
                el.insertBefore(sc, el.querySelector(':scope > .mes_block') ?? null);
            }
            sc.dataset.id = key;
            const qs = [0, 1, 2].map((t) => `<p class="q">${n0 + t}. ${EXAM_Q[(k * 3 + t) % EXAM_Q.length]}</p>`).join('');
            sc.innerHTML = user
                ? `<div class="hd"><em>语文答题卡</em><p class="ds">请在各题目的答题区域内作答，超出黑色矩形边框限定区域的答案无效。</p></div>${qs}`
                : `<div class="hd"><b>${year} 年${esc(name)}</b><em>语文试卷</em>` +
                    `<p class="ds">（本试卷共 ${pages} 页，满分 150 分，考试时间 150 分钟。）</p>` +
                    `<u>注意事项：</u>${EXAM_NOTES.map((t) => `<p class="nt">${t}</p>`).join('')}</div>` +
                    `<p class="sec">一、现代文阅读（35 分）</p><p class="sub">（一）现代文阅读 I（本题共 3 小题，18 分）</p>` +
                    `<p class="a">阅读下面的文字，完成 ${n0}～${n0 + 2} 题。</p>`;
        }
    }

    // ── 段首缩进：主题给每段空两格；模型自己已经在段首打了空格的段落标出来，主题就不再空（不然变成四格） ──
    function indents() {
        for (const p of doc.querySelectorAll('#chat .mes .mes_text p')) {
            const t = p.firstChild?.nodeType === 3 ? p.firstChild.nodeValue : p.textContent;
            const own = /^[\u3000\u2003\u2002\u00a0 ]{2,}|^\u3000/.test(t ?? '');
            if (own) p.setAttribute('data-ar-ind', ''); else p.removeAttribute('data-ar-ind');
        }
    }

    // ── 聊天记录（records）：酒馆把条数写成「12 💬)」，把数字取出来放在 data-ar-n 上，主题印成「12 条」 ──
    function records() {
        for (const el of doc.querySelectorAll('#select_chat_div .chat_messages_num:not([data-ar-n])')) {
            const n = parseInt(el.textContent, 10);
            if (Number.isFinite(n)) el.dataset.arN = String(n);
        }
    }
    const recList = doc.getElementById('select_chat_div');
    if (recList) new MutationObserver(() => { if (body.classList.contains('ar-tab')) records(); }).observe(recList, { childList: true, subtree: true });

    // ── 封面：打开酒馆时先看到桌上一只合着的文件夹（样子在主题里），点一下进去；点拍立得可以放大看。每次打开页面只出现一次 ──
    let coverDone = false;
    function cover() {
        if (coverDone) return;
        coverDone = true;
        if (store()?.cover === false || doc.getElementById('ar-cover')) return;
        const d = new Date();
        const p2 = (n) => String(n).padStart(2, '0');
        const el = doc.createElement('div');
        el.id = 'ar-cover';
        el.innerHTML = `<div class="cv">
            <div class="bk bk1"><i></i></div><div class="bk bk2"><i></i></div>
            <div class="sh"><div class="tb"><b>archive</b></div><div class="fd"></div></div>
            <div class="lb lb1">PHOTOGRAPHS \u00b7 DO NOT BEND</div>
            <div class="ph"><i></i><span class="lb">${p2(d.getDate())} . ${p2(d.getMonth() + 1)} . ${d.getFullYear()}</span></div>
        </div>`;
        el.addEventListener('click', (e) => {
            if (e.target.closest('.bk')) return;
            const ph = e.target.closest('.ph');
            if (ph) { ph.classList.toggle('zoom'); return; }
            if (el.querySelector('.ph.zoom')) { el.querySelector('.ph.zoom').classList.remove('zoom'); return; }
            el.classList.add('out');
            setTimeout(() => el.remove(), 600);
        });
        // 挂在 <html> 下面而不是 body 里：酒馆的 body 自己没有高度还会裁掉超出的部分，放在里面的满屏元素整个看不见
        doc.documentElement.append(el);
    }

    // ── 双击原地修改：卷头、标题、题记、称呼、开场白、落款、地址、输入框那一句，在纸上双击就地改；
    //    图片（氛围图、封面上的照片、桌面、输入标签下面晕开的图）双击就换一张。改完和在 style 卡里改是同一份设置 ──
    const TEXT_NAME = Object.fromEntries(TEXTS.map(([k, n]) => [k, n.replace(/（.*$/, '')]));
    function editTarget(t, x, y) {
        const lay = (LAYOUTS[store()?.lay ?? 0] ?? LAYOUTS[0])[1];
        const mes = t.closest?.('#chat > .mes');
        const user = mes?.getAttribute('is_user') === 'true';
        const r = (el) => el?.getBoundingClientRect();
        // 封面
        if (t.closest?.('#ar-cover .ph')) return { img: 'photo' };
        if (t.closest?.('#ar-cover .bk1')) return { img: 'cv1' };
        if (t.closest?.('#ar-cover .bk2')) return { img: 'cv2' };
        // 输入框收着时中间那一句；打开时晕开的那张图
        if (t.closest?.('#send_form') && !t.closest('textarea, button, .menu_button, .fa-solid, #ar-tools')) {
            const open = body.classList.contains('ar-memo') || !empty();
            return open ? { img: 'wash' } : { text: 'idle' };
        }
        // 桌面（纸外面露出来的壁纸）
        if (t === doc.documentElement || t === body || t.id === 'bg1' || t.id === 'bg_custom' || t.id === 'sheld') return { img: 'desk' };
        if (!mes) return null;
        if (t.closest('.ar-scratch .hd b')) return { text: 'exam' };
        if (lay === 'ar-lay-b') {
            const av = mes.querySelector('.mesAvatarWrapper');
            if (t.closest('.mesAvatarWrapper') && x > (r(av.querySelector('.avatar'))?.right ?? 1e9)) return { img: user ? 'mood2' : 'mood1' };
            if (t.closest('.mes_reasoning_header')) return { text: 'title' };
            const nm = r(mes.querySelector('.ch_name'));
            if (t.classList.contains('mes_block') && nm && y < nm.top) return { text: 'title' };
            const txt = mes.querySelector('.mes_text');
            const first = r(txt?.firstElementChild);
            if (t === txt && first && y < first.top) return { text: 'epi' };
        }
        if (lay === 'ar-lay-c') {
            const av = r(mes.querySelector('.mesAvatarWrapper .avatar'));
            if (t.closest('.mesAvatarWrapper') && av) {
                if (x < av.left) return { img: user ? 'mood2' : 'mood1' };
                if (x > av.right) return { img: user ? 'mood1' : 'mood2' };
            }
            if (t.classList.contains('name_text')) {
                const fs = parseFloat(getComputedStyle(t).fontSize) || 14;
                if (y > r(t).top + fs * 1.1) return { text: user ? 'addr2' : 'addr' };
            }
            if (t.closest('.mes_reasoning_header')) return { text: 'dear' };
            const nt = r(mes.querySelector('.name_text'));
            if (t.classList.contains('ch_name') && nt && y > nt.bottom + 6) return { text: 'dear' };
            const txt = mes.querySelector('.mes_text');
            const tr = r(txt);
            if (t.classList.contains('mes_block') && tr) {
                if (y < tr.top) return { text: user ? 'open2' : 'open1' };
            }
            const last = r(txt?.lastElementChild);
            if (t === txt && last && y > last.bottom) return { text: user ? 'close2' : 'close1' };
        }
        return null;
    }
    function editText(key, x, y) {
        doc.getElementById('ar-edit')?.remove();
        const multi = TEXTS.find((t) => t[0] === key)?.[3];
        const box = doc.createElement('div');
        box.id = 'ar-edit';
        box.innerHTML = `<small>${esc(TEXT_NAME[key] ?? '')}</small>${multi ? '<textarea rows="3"></textarea>' : '<input type="text">'}<span><button data-a="0">作罢</button><button data-a="1">定稿</button></span>`;
        const inp = box.querySelector('textarea, input');
        inp.value = text(key);
        doc.documentElement.append(box);
        const W = innerWidth, H = innerHeight;
        const bw = Math.min(360, W - 24);
        box.style.width = `${bw}px`;
        box.style.left = `${Math.max(12, Math.min(W - bw - 12, x - bw / 2))}px`;
        box.style.top = `${Math.max(12, Math.min(H - 170, y + 14))}px`;
        inp.focus();
        inp.select?.();
        const done = (ok) => {
            if (ok) {
                const st = store();
                st.texts ??= {};
                st.texts[key] = inp.value;
                applyStyle();
                dress();
                scratch();
                save();
                stylePanel.sync?.();
            }
            box.remove();
        };
        box.addEventListener('click', (e) => { const a = e.target.closest('button')?.dataset.a; if (a !== undefined) done(a === '1'); });
        inp.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') done(false);
            if (e.key === 'Enter' && (!multi || e.ctrlKey || e.metaKey)) { e.preventDefault(); done(true); }
        });
    }
    function editImage(key) {
        const inp = doc.createElement('input');
        inp.type = 'file';
        inp.accept = 'image/*';
        inp.addEventListener('change', async () => {
            const f = inp.files?.[0];
            if (!f) return;
            const max = IMAGES.find((x) => x[1] === key)?.[3] ?? 1200;
            const st = store();
            st.images ??= {};
            st.images[key] = await shrink(f, max);
            applyStyle();
            save();
        });
        inp.click();
    }
    doc.addEventListener('dblclick', (e) => {
        if (!body.classList.contains('ar-tab')) return;
        if (e.target.closest?.('#ar-edit, #ar-style, textarea, input, .mes_text p, .mes_text li')) return;
        const hit = editTarget(e.target, e.clientX, e.clientY);
        if (!hit) return;
        e.preventDefault();
        e.stopPropagation();
        doc.getSelection?.()?.removeAllRanges();
        if (hit.text) editText(hit.text, e.clientX, e.clientY);
        else if (hit.img) editImage(hit.img);
    }, true);

    // ── 全屏：整个聊天界面铺满屏幕——文件夹、签、夹子、垫纸、顶栏都收起来，只剩一叠消息纸和输入框，桌面是壁纸。
    //    每张纸右上角的记号（两个对角）进出；电脑和安卓同时让浏览器本身全屏，iPhone 不支持浏览器全屏，就只铺满页面。Esc 也能退出 ──
    function immersive(on) {
        on = on ?? !body.classList.contains('ar-immersive');
        body.classList.toggle('ar-immersive', on);
        const de = doc.documentElement;
        try {
            if (on && !doc.fullscreenElement && de.requestFullscreen) de.requestFullscreen().catch(() => {});
            if (!on && doc.fullscreenElement && doc.exitFullscreen) doc.exitFullscreen().catch(() => {});
        } catch { /* 有的浏览器没有全屏接口，只铺满页面 */ }
        setTimeout(() => fixTex(true), 60);
    }
    function fsMarks() {
        for (const el of doc.querySelectorAll('#chat > .mes[mesid] .mes_buttons')) {
            if (el.querySelector(':scope > .ar-fs')) continue;
            const b = doc.createElement('div');
            b.className = 'mes_button ar-fs';
            b.title = '全屏';
            b.setAttribute('role', 'button');
            el.insertBefore(b, el.firstChild);
        }
    }
    doc.addEventListener('click', (e) => {
        if (!body.classList.contains('ar-tab')) return;
        const b = e.target.closest?.('.ar-fs');
        if (b) { e.preventDefault(); e.stopPropagation(); immersive(); }
    }, true);
    doc.addEventListener('keydown', (e) => { if (e.key === 'Escape' && body.classList.contains('ar-immersive') && !doc.fullscreenElement) immersive(false); });
    // 浏览器自己退出全屏（按 Esc、手势）时，界面也跟着退出
    doc.addEventListener('fullscreenchange', () => { if (!doc.fullscreenElement && body.classList.contains('ar-immersive')) body.classList.remove('ar-immersive'); });

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
        // 自己的字体（下拉框最后一项）：上传的文件或贴的链接
        const userFont = (slot, fallback) => {
            const uf = s.uf?.[slot];
            if (!uf?.src) return null;
            const fam = `ArUser-${slot}`;
            const isFile = /\.(ttf|otf|woff2?)(\?|#|$)/i.test(uf.src) || uf.src.startsWith('/user/files/');
            if (isFile) {
                const key = `${slot}|${uf.src}`;
                if (fontKeys[slot] !== key) {
                    fontKeys[slot] = key;
                    try {
                        const ff = new FontFace(fam, `url("${uf.src}")`);
                        ff.load().then((f) => { doc.fonts.add(f); }).catch(() => toastr?.warning?.('这个字体文件读不出来，换一个试试'));
                    } catch { /* 很老的浏览器没有 FontFace */ }
                }
                return `"${fam}", ${fallback}`;
            }
            loadCss(uf.src, `ar-font-u-${slot}-${uf.src.length}`);
            return uf.name ? `"${uf.name}", ${fallback}` : null;
        };
        const cnU = s.cn === CN_FONTS.length ? userFont('cn', CN_FONTS[0][1]) : null;
        const twU = s.tw === TW_FONTS.length ? userFont('tw', TW_FONTS[0][1]) : null;
        if (cnU) root.setProperty('--ar-cn', cnU);
        else if (s.cn && s.cn < CN_FONTS.length) { root.setProperty('--ar-cn', cn[1]); loadCss(cn[2], `ar-font-cn-${s.cn}`); } else root.removeProperty('--ar-cn');
        if (twU) root.setProperty('--ar-tw', twU);
        else if (s.tw && s.tw < TW_FONTS.length) { root.setProperty('--ar-tw', tw[1]); loadCss(tw[2], `ar-font-tw-${s.tw}`); } else root.removeProperty('--ar-tw');
        // 版式、底图用不用酒馆自己的背景、信头的地址行
        for (const [, cls] of LAYOUTS) if (cls) body.classList.toggle(cls, (LAYOUTS[s.lay ?? 0] ?? LAYOUTS[0])[1] === cls);
        body.classList.toggle('ar-bg-st', !!s.bgST);
        root.setProperty('--ar-idle', q(text('idle')));
        if (text('epi').trim()) root.setProperty('--ar-epi', q(text('epi'))); else root.removeProperty('--ar-epi');
        // 纸纹
        const pp = PAPERS[paperOf(s)] ?? PAPERS[0];
        if (pp[1]) root.setProperty('--ar-pat', pp[1]); else root.removeProperty('--ar-pat');
        if (pp[2] === 'none') root.setProperty('--ar-cotton', 'none');
        else if (pp[2].startsWith('--')) root.setProperty('--ar-cotton', `var(${pp[2]})`);
        else if (pp[2] === 'upload' && s.paperTex) {
            // 自己上传的纸纹：宽度对齐每张纸（只会缩小、不会放大，所以不糊）；
            // 纸比图长的部分，接这张图上下翻过来的样子，接缝是对称的，看不出断开
            const src = s.paperTex;
            const k = Math.min(1, Math.max(.05, (s.texK ?? 100) / 100));
            // 固定在屏幕上（默认）：像毛玻璃美化的背景一样，图铺满一屏、不动，纸从上面滑过——纸再长也只露出这一屏的样子，永远不重复。
            // 不固定：图跟着每张纸走，纸比图长的部分接上下翻转的同一张
            const fixed = s.texFix !== false;
            const mode = fixed ? 'f' : 'm';
            if (texSrc !== `${mode}|${k}|${src}` || !texURL) {
                // 新的一块还没做好时：先用原图（浓淡还没算进去），但别从别的图闪一下
                if (!texSrc?.endsWith(`|${src}`)) root.setProperty('--ar-cotton', `url("${src}")`);
            } else root.setProperty('--ar-cotton', `url("${texURL}")`);
            if (fixed) {
                root.setProperty('--ar-cr', 'no-repeat');
                texFixed = true;
                fixTex();
            } else {
                texFixed = false;
                clearFixTex();
                root.setProperty('--ar-cs', '100% auto');
                root.setProperty('--ar-pp', '50% 0');
                root.setProperty('--ar-cr', 'repeat-y');
            }
            paperTile(src, k, fixed).then((u) => {
                const now = store() ?? {};
                if (now.paperTex === src && (now.texK ?? 100) / 100 === (s.texK ?? 100) / 100 && (now.texFix !== false) === fixed && (PAPERS[paperOf(now)] ?? PAPERS[0])[2] === 'upload') {
                    root.setProperty('--ar-cotton', `url("${u}")`);
                    if (fixed) fixTex(true);
                }
            });
        }
        else root.removeProperty('--ar-cotton');
        if (pp[2] !== 'upload' || !s.paperTex) {
            for (const v of ['--ar-cs', '--ar-pp', '--ar-cr']) root.removeProperty(v);
            texFixed = false;
            clearFixTex();
        }
        // 有的纸纹要铺得比棉纸细（布纹的织纹）
        if (pp[3]) root.setProperty('--ar-cs', pp[3]);
        wall();
        dress();
    }

    function clearStyle() {
        const root = doc.documentElement.style;
        for (const [v] of VARS) root.removeProperty(v);
        for (const [v] of IMAGES) root.removeProperty(v);
        for (const v of ['--ar-cn', '--ar-tw', '--ar-idle', '--ar-epi', '--ar-vh', '--ar-nextno', '--ar-pat', '--ar-cotton', '--ar-cs', '--ar-pp', '--ar-cr', '--ar-wall']) root.removeProperty(v);
        for (const [, cls] of LAYOUTS) if (cls) body.classList.remove(cls);
        body.classList.remove('ar-bg-st');
        undress();
    }

    // 上传的纸纹做成一块竖着的纸：横图先转成竖的（纸纹不分方向），下面接一份上下翻转的，
    // 这样纸比图长时接上去的地方是镜像对称的，没有一道接缝，也不是同一个方向的复制
    // k 是浓淡（0.05–1）：图上蒙一层白，k 越小越淡——花哨的图（壁纸之类）调淡了才不抢正文
    let texURL = null, texSrc = null, texJob = null, texAspect = 1;
    function paperTile(src, k = 1, fixed = false) {
        const key = `${fixed ? 'f' : 'm'}|${k}|${src}`;
        if (texSrc === key && texURL) return Promise.resolve(texURL);
        if (texJob?.src === key) return texJob.p;
        const job = { src: key };
        job.p = new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                // 固定在屏幕上时：原样一张（不转、不接），只调浓淡
                const land = !fixed && img.width > img.height;
                const w = land ? img.height : img.width;
                const h = land ? img.width : img.height;
                if (fixed) texAspect = w / h;
                const cv = doc.createElement('canvas');
                cv.width = w;
                cv.height = fixed ? h : h * 2;
                const c = cv.getContext('2d');
                // 调淡：先降饱和度（彩色的图先变素），再蒙白；蒙白的量按 1 - k^1.5，往淡的那头走得快一些
                if (k < 1) c.filter = `saturate(${k.toFixed(2)})`;
                const draw = () => {
                    if (!land) { c.drawImage(img, 0, 0); return; }
                    c.save(); c.translate(w, 0); c.rotate(Math.PI / 2); c.drawImage(img, 0, 0); c.restore();
                };
                draw();
                if (!fixed) { c.save(); c.translate(0, h * 2); c.scale(1, -1); draw(); c.restore(); }
                c.filter = 'none';
                if (k < 1) { c.fillStyle = `rgba(255,255,255,${(1 - k ** 1.5).toFixed(3)})`; c.fillRect(0, 0, w, cv.height); }
                cv.toBlob((b) => {
                    if (!b) return resolve(src);
                    if (texURL) URL.revokeObjectURL(texURL);
                    texURL = URL.createObjectURL(b);
                    texSrc = key;
                    resolve(texURL);
                }, 'image/jpeg', 0.92);
            };
            img.onerror = () => resolve(src);
            img.src = src;
        });
        texJob = job;
        return job.p;
    }

    // 纸纹固定在屏幕上：图按屏幕大小铺满（cover），每张纸只露出它正好盖住的那一块。
    // 浏览器自带的 background-attachment: fixed 在 iPhone 上不管用，所以自己算：每张纸的图往回挪它自己在屏幕上的位置
    let texFixed = false, fixRaf = 0;
    function fixTex(force = false) {
        if (!texFixed) return;
        if (fixRaf && !force) return;
        // 页面在后台时 requestAnimationFrame 不走，换成定时器（不然切回来之前纸纹都对不上）
        const later = doc.hidden ? (f) => setTimeout(f, 16) : requestAnimationFrame;
        fixRaf = later(() => {
            fixRaf = 0;
            const W = innerWidth, H = innerHeight;
            const a = texAspect || 1;
            const sw = W / H > a ? W : H * a;
            const sh = W / H > a ? W / a : H;
            const ox = (W - sw) / 2, oy = (H - sh) / 2;
            const root = doc.documentElement.style;
            root.setProperty('--ar-cs', `${sw.toFixed(1)}px ${sh.toFixed(1)}px`);
            root.setProperty('--ar-pp', `${ox.toFixed(1)}px ${oy.toFixed(1)}px`);
            for (const el of doc.querySelectorAll('#chat > .mes')) {
                const r = el.getBoundingClientRect();
                if (r.bottom < -40 || r.top > H + 40) continue;
                el.style.setProperty('--ar-pp', `${(ox - r.left).toFixed(1)}px ${(oy - r.top).toFixed(1)}px`);
            }
        });
    }
    function clearFixTex() {
        for (const el of doc.querySelectorAll('#chat > .mes')) el.style.removeProperty('--ar-pp');
    }
    doc.getElementById('chat')?.addEventListener('scroll', () => fixTex(), { passive: true });
    addEventListener('resize', () => fixTex(true));

    // 把文件存到酒馆服务器上（user/files），返回能直接用的地址；存不了就返回 null
    async function putFile(name, base64) {
        try {
            const c = ctx();
            const r = await fetch('/api/files/upload', {
                method: 'POST',
                headers: c?.getRequestHeaders?.() ?? { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, data: base64 }),
            });
            if (!r.ok) return null;
            const j = await r.json();
            return j?.path ? '/' + String(j.path).replace(/^\/+/, '') : null;
        } catch { return null; }
    }
    const fileB64 = (file) => new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result).split(',')[1] ?? '');
        fr.onerror = rej;
        fr.readAsDataURL(file);
    });
    const stamp = () => Date.now().toString(36);

    // 上传的图先缩小再存，免得设置文件太大
    function shrink(file, max, quality = 0.82) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const k = Math.min(1, max / Math.max(img.width, img.height));
                const cv = doc.createElement('canvas');
                cv.width = Math.round(img.width * k);
                cv.height = Math.round(img.height * k);
                cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
                URL.revokeObjectURL(img.src);
                resolve(cv.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }

    // 变量现在的颜色：有的是 color-mix() 算出来的，让浏览器算成真正的颜色再读
    const current = (v) => {
        const pr = doc.createElement('i');
        pr.style.cssText = `display:none;color:var(${v})`;
        body.append(pr);
        const c = getComputedStyle(pr).color;
        pr.remove();
        return c;
    };
    const hex = (c) => {
        // color input 只认 #rrggbb
        const h2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
        let m = c.match(/^#([0-9a-f]{3})$/i);
        if (m) return '#' + [...m[1]].map((x) => x + x).join('');
        if (/^#[0-9a-f]{6}$/i.test(c)) return c;
        m = c.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
        if (m) return '#' + h2(+m[1]) + h2(+m[2]) + h2(+m[3]);
        m = c.match(/^color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)/i);
        if (m) return '#' + h2(m[1] * 255) + h2(m[2] * 255) + h2(m[3] * 255);
        return '#000000';
    };
    const swatch = (colors) => `<span>${colors.slice(0, 4).map((x) => `<i style="background:${esc(x)}"></i>`).join('')}</span>`;

    function buildPanel() {
        let p = doc.getElementById('ar-style');
        if (p) return p;
        p = doc.createElement('div');
        p.id = 'ar-style';
        p.innerHTML = `
            <header><b>style</b><small>插件 0.18</small><i class="ar-x" role="button" title="收起">×</i></header>
            <section><h4>配色</h4>
                <div class="ar-presets"></div>
                <div class="ar-save"><input type="text" maxlength="12" placeholder="给现在这套配色起个名字"><button class="ar-btn" data-savescheme>存成方案</button></div>
                <div class="ar-colors">${VARS.map(([v, n]) => `<label><input type="color" data-v="${v}"><span>${n}</span></label>`).join('')}</div>
            </section>
            <section><h4>纸纹</h4>
                <div class="ar-papers">${PAPER_ORDER.map((i) => `<button data-paper="${i}"><i class="p${i}"></i><em>${PAPERS[i][0]}</em></button>`).join('')}</div>
                <div class="ar-lib"></div>
                <div class="ar-img ar-row" data-k="paperTex"><span>上传一张纸纹（越大越清楚；传过的都留在上面，点一下就换回去）</span><label class="ar-btn">选图<input type="file" accept="image/*" hidden></label></div>
                <label class="ar-row ar-texk"><span>纸纹浓淡</span><input type="range" min="5" max="100" step="5" data-texk></label>
                <label class="ar-row ar-check ar-texk"><input type="checkbox" data-texfix><span>纸纹固定在屏幕上，纸从上面滑过（图案不会重复）</span></label>
            </section>
            <section><h4>版式</h4>
                <div class="ar-lays">${LAYOUTS.map(([n], i) => `<button data-lay="${i}"><em>${n}</em></button>`).join('')}</div>
            </section>
            <section><h4>文字</h4>
                ${TEXTS.map(([k, n, , multi, lay]) => `<label class="ar-text" data-lay-only="${lay}"><span>${n}</span>${multi ? `<textarea rows="2" data-t="${k}"></textarea>` : `<input type="text" data-t="${k}">`}</label>`).join('')}
            </section>
            <section><h4>图片</h4>
                <label class="ar-row ar-check"><input type="checkbox" data-bgst><span>底图用酒馆自己的背景</span></label>
                <label class="ar-row ar-check"><input type="checkbox" data-cover><span>打开酒馆时先看封面</span></label>
                ${IMAGES.map(([, key, n]) => `<div class="ar-img ar-row" data-k="${key}"><span>${n}</span><label class="ar-btn">换一张<input type="file" accept="image/*" hidden></label><button class="ar-btn" data-reset="${key}">还原</button></div>`).join('')}
            </section>
            <section><h4>字体</h4>
                <label class="ar-row"><span>中文</span><select data-f="cn">${CN_FONTS.map(([n], i) => `<option value="${i}">${n}</option>`).join('')}<option value="${CN_FONTS.length}">自己的字体</option></select></label>
                <div class="ar-uf" data-uf="cn"><input type="text" data-ufurl="cn" placeholder="贴字体链接（.ttf .otf .woff2 文件，或者字体网站给的 css 链接）"><input type="text" data-ufname="cn" placeholder="字体名（css 链接时填，文件可不填）"><label class="ar-btn">上传字体文件<input type="file" accept=".ttf,.otf,.woff,.woff2,font/*" data-uffile="cn" hidden></label></div>
                <label class="ar-row"><span>打字机字</span><select data-f="tw">${TW_FONTS.map(([n], i) => `<option value="${i}">${n}</option>`).join('')}<option value="${TW_FONTS.length}">自己的字体</option></select></label>
                <div class="ar-uf" data-uf="tw"><input type="text" data-ufurl="tw" placeholder="贴字体链接（.ttf .otf .woff2 文件，或者字体网站给的 css 链接）"><input type="text" data-ufname="tw" placeholder="字体名（css 链接时填，文件可不填）"><label class="ar-btn">上传字体文件<input type="file" accept=".ttf,.otf,.woff,.woff2,font/*" data-uffile="tw" hidden></label></div>
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
        // 纸纹库：上传过的每一张一个小格，点了换成它，右上角 × 删掉
        const lib = () => {
            const st = store();
            const list = st?.texLib ?? [];
            const on = (PAPERS[paperOf(st)] ?? PAPERS[0])[2] === 'upload';
            p.querySelector('.ar-lib').innerHTML = list.map((u, i) =>
                `<button data-lib="${i}" class="${on && st?.paperTex === u ? 'on' : ''}"><i style="background-image:url('${esc(u)}')"></i><i class="ar-del" role="button" data-libdel="${i}" title="删掉这张">×</i></button>`).join('');
        };
        const sync = () => {
            presets();
            lib();
            for (const inp of p.querySelectorAll('input[type=color]')) inp.value = hex(current(inp.dataset.v));
            for (const sel of p.querySelectorAll('select')) sel.value = String(store()?.[sel.dataset.f] ?? 0);
            for (const box of p.querySelectorAll('[data-uf]')) {
                const slot = box.dataset.uf;
                box.hidden = (store()?.[slot] ?? 0) !== (slot === 'cn' ? CN_FONTS.length : TW_FONTS.length);
                const uf = store()?.uf?.[slot] ?? {};
                const u = box.querySelector('[data-ufurl]'); if (u && doc.activeElement !== u) u.value = uf.src?.startsWith('/user/files/') ? '' : (uf.src ?? '');
                const n = box.querySelector('[data-ufname]'); if (n && doc.activeElement !== n) n.value = uf.name ?? '';
                u.placeholder = uf.src?.startsWith('/user/files/') ? `已上传：${uf.file ?? '字体文件'}（也可以贴链接换掉）` : '贴字体链接（.ttf .otf .woff2 文件，或者字体网站给的 css 链接）';
            }
            for (const b of p.querySelectorAll('[data-lay]')) b.classList.toggle('on', Number(b.dataset.lay) === (store()?.lay ?? 0));
            for (const b of p.querySelectorAll('[data-paper]')) b.classList.toggle('on', Number(b.dataset.paper) === paperOf(store()));
            for (const inp of p.querySelectorAll('[data-t]')) inp.value = text(inp.dataset.t);
            const bg = p.querySelector('[data-bgst]');
            if (bg) bg.checked = !!store()?.bgST;
            const cvb = p.querySelector('[data-cover]');
            if (cvb) cvb.checked = store()?.cover !== false;
            for (const row of p.querySelectorAll('[data-lay-only]')) {
                const l = Number(row.dataset.layOnly);
                row.hidden = l !== -1 && l !== (store()?.lay ?? 0);
            }
            const tk = p.querySelector('[data-texk]');
            if (tk) tk.value = String(store()?.texK ?? 100);
            for (const row of p.querySelectorAll('.ar-texk')) row.hidden = !store()?.paperTex;
            const tf = p.querySelector('[data-texfix]');
            if (tf) tf.checked = store()?.texFix !== false;
        };
        let texTimer = 0;
        p.addEventListener('input', (e) => {
            const st = store();
            if (!st) return;
            const v = e.target.dataset?.v;
            const t = e.target.dataset?.t;
            if (e.target.dataset?.texk !== undefined) {
                // 拖动时每次都重做一整张图太慢：停下来 120ms 再算
                st.texK = Number(e.target.value);
                clearTimeout(texTimer);
                texTimer = setTimeout(() => { applyStyle(); save(); }, 120);
                return;
            }
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
            if (e.target.dataset?.texfix !== undefined) {
                st.texFix = e.target.checked;
                applyStyle();
                save();
            }
            if (e.target.dataset?.cover !== undefined) {
                st.cover = e.target.checked;
                save();
            }
            if (e.target.dataset?.bgst !== undefined) {
                st.bgST = e.target.checked;
                applyStyle();
                save();
            }
            if (e.target.dataset?.f) {
                st[e.target.dataset.f] = Number(e.target.value);
                applyStyle();
                save();
                p.syncInputs?.();
            }
            // 自己的字体：贴链接 / 字体名
            if (e.target.dataset?.ufurl !== undefined || e.target.dataset?.ufname !== undefined) {
                const slot = e.target.dataset.ufurl ?? e.target.dataset.ufname;
                st.uf ??= {};
                st.uf[slot] ??= {};
                if (e.target.dataset.ufurl !== undefined) { st.uf[slot].src = e.target.value.trim(); delete st.uf[slot].file; }
                else st.uf[slot].name = e.target.value.trim();
                applyStyle();
                save();
            }
            // 自己的字体：上传文件（存到酒馆服务器上）
            if (e.target.dataset?.uffile !== undefined && e.target.files?.[0]) {
                const slot = e.target.dataset.uffile;
                const f = e.target.files[0];
                const ext = (f.name.match(/\.(ttf|otf|woff2?)$/i)?.[1] ?? 'ttf').toLowerCase();
                toastr?.info?.('字体文件比较大，上传要一会儿');
                const url = await putFile(`archive-font-${slot}-${stamp()}.${ext}`, await fileB64(f));
                if (!url) { toastr?.error?.('字体没存上，可以改用贴链接'); return; }
                st.uf ??= {};
                st.uf[slot] = { src: url, file: f.name };
                e.target.value = '';
                applyStyle();
                save();
                p.syncInputs?.();
            }
            if (e.target.type === 'file' && e.target.files?.[0]) {
                const key = e.target.closest('.ar-img').dataset.k;
                if (key === 'paperTex') {
                    // 自己的纸纹：缩到最长边 2400，存到酒馆服务器上（存不了就存在设置里），放进纸纹库，并直接换成它
                    const data = await shrink(e.target.files[0], 2400, 0.9);
                    const url = (await putFile(`archive-paper-${stamp()}.jpg`, data.split(',')[1])) ?? data;
                    st.texLib = [url, ...(st.texLib ?? []).filter((x) => x !== url)].slice(0, 12);
                    st.paperTex = url;
                    delete st.texK;
                    st.papers ??= {};
                    st.papers[st.lay ?? 0] = PAPERS.findIndex((x) => x[2] === 'upload');
                } else {
                    const max = IMAGES.find((x) => x[1] === key)[3];
                    st.images ??= {};
                    st.images[key] = await shrink(e.target.files[0], max);
                }
                e.target.value = '';
                applyStyle();
                save();
                p.syncInputs?.();
            }
        });
        p.addEventListener('click', (e) => {
            const st = store();
            const b = e.target.closest('button, .ar-x, .ar-del');
            if (!b || !st) return;
            if (b.classList.contains('ar-x')) { stylePanel(false); return; }
            if (b.dataset.libdel !== undefined) {
                const u = st.texLib?.[Number(b.dataset.libdel)];
                st.texLib?.splice(Number(b.dataset.libdel), 1);
                if (u && st.paperTex === u) delete st.paperTex;
                if (u && u.startsWith('/user/files/')) fetch('/api/files/delete', { method: 'POST', headers: ctx()?.getRequestHeaders?.(), body: JSON.stringify({ path: u.slice(1) }) }).catch(() => {});
                applyStyle(); save(); sync(); return;
            }
            if (b.dataset.lib !== undefined) {
                st.paperTex = st.texLib?.[Number(b.dataset.lib)];
                delete st.texK;
                st.papers ??= {};
                st.papers[st.lay ?? 0] = PAPERS.findIndex((x) => x[2] === 'upload');
                applyStyle(); save(); sync(); return;
            }
            if (b.dataset.del !== undefined) {
                st.schemes?.splice(Number(b.dataset.del), 1);
            } else if (b.dataset.p !== undefined) {
                st.colors = Object.fromEntries(VARS.map(([v], i) => [v, PRESETS[b.dataset.p][1][i]]).filter(([, c]) => c));
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
            } else if (b.dataset.paper !== undefined) {
                st.papers ??= {};
                st.papers[st.lay ?? 0] = Number(b.dataset.paper);
                // 选了「自己上传」但还没传过图：直接弹出选图
                if (PAPERS[paperOf(st)][2] === 'upload' && !st.paperTex) p.querySelector('[data-k="paperTex"] input')?.click();
            } else if (b.dataset.reset) {
                if (st.images) delete st.images[b.dataset.reset];
            } else if (b.dataset.all !== undefined) {
                // 自己存的配色方案留着，别的都回到默认
                delete st.colors; delete st.images; delete st.cn; delete st.tw; delete st.lay; delete st.bgST; delete st.texts; delete st.papers; delete st.texK;
            } else return;
            applyStyle();
            save();
            sync();
        });
        p.syncInputs = sync;
        stylePanel.sync = sync;
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
            if (et[k]) es.on(et[k], () => { sync(); fill(); setTimeout(() => { dress(); scratch(); indents(); folio(); fsMarks(); fixTex(true); }, 60); });
        }
        // 发出去之后、换聊天时把工具格收起来
        for (const k of ['MESSAGE_SENT', 'CHAT_CHANGED']) {
            if (et[k]) es.on(et[k], () => { if (empty()) memo(false); });
        }
    }

    sync();
    // 刚打开酒馆时主题样式可能晚一点点才到：前十秒每 150ms 看一次，封面能多早出来就多早出来
    {
        let n = 0;
        const early = setInterval(() => {
            if (doc.getElementById('ar-cover') || coverDone || ++n > 66) { clearInterval(early); return; }
            if (themeOn()) sync();
        }, 150);
    }
    setInterval(sync, 1500);
})();
