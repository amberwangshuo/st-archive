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
    // 主题开着没有：看酒馆放主题样式的那个 <style> 里有没有档案的变量。v50 以前读整页的计算样式，
    // 页面上只要有一点没算完的变化，这一读就逼浏览器当场把整页样式重算一遍（每 1.5 秒 50–100 毫秒）
    // 酒馆换主题时整段重写这个 <style>（里面的文字节点会换一个），所以只认节点：节点没换就不读——
    // 每次都取全文的话，每 1.5 秒复制一段 20 万字的字符串，攒多了触发内存回收，停顿 50–90 毫秒
    let themeNode, themeIs = false;
    const themeOn = () => {
        const n = doc.getElementById('custom-style')?.firstChild ?? null;
        if (n !== themeNode) { themeNode = n; themeIs = !!n && n.data.includes('--ar-clip:'); }
        return themeIs;
    };

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
            setRoot('--ar-nextno', count ? `"N\u00B0 ${count}"` : '""');
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


    function unmount() {
        releaseTools();
        doc.documentElement.style.removeProperty('--ar-ava');
        doc.getElementById('ar-tabs')?.remove();
        doc.getElementById('ar-under')?.remove();
        doc.getElementById('ar-sides')?.remove();
        doc.getElementById('ar-clip')?.remove();
        for (const f of doc.querySelectorAll('.ar-folio, .ar-scratch, .ar-fs')) f.remove();
        body.classList.remove('ar-immersive');
        for (const x of doc.querySelectorAll('#chat p[data-ar-ind]')) x.removeAttribute('data-ar-ind');
        for (const x of doc.querySelectorAll('#chat > .mes')) { x.style.removeProperty('--ar-foot'); x.style.removeProperty('--ar-kh'); }
        doc.getElementById('ar-cover')?.remove();
        delete doc.documentElement.dataset.arPv;
        doc.documentElement.style.removeProperty('--ar-vh');
        doc.documentElement.style.removeProperty('--ar-top');
        doc.documentElement.style.removeProperty('--ar-topink');
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

    // 整页重算（信头、透字、缩进、页码……）：只在酒馆发事件、聊天区换了消息时做，短时间里来好几次只算一次。
    // v49 以前每 1.5 秒把这些全做一遍，消息多、卡里带大段 HTML 时手机上很卡（她说导入两张卡后点什么都迟钝）
    let refreshT = 0;
    function refresh(delay = 60) {
        clearTimeout(refreshT);
        refreshT = setTimeout(() => {
            if (!body.classList.contains('ar-tab')) return;
            dress();
            scratch();
            indents();
            folio();
            fsMarks();
        }, delay);
    }
    // 写到 <html> 上的变量：值没变就不写（写一次整页都要重新算样式）
    const setRoot = (k, v) => { const st = doc.documentElement.style; if (st.getPropertyValue(k) !== v) st.setProperty(k, v); };
    // ── 主屏幕模式的刘海（v51）：从 iPhone 主屏幕图标打开、页面铺到了状态栏底下时，顶栏要让出刘海那一条。
    //    正常情况下 iPhone 会告诉网页安全区多高（env(safe-area-inset-top)），档案主题按它让位；
    //    但她说所有美化在主屏幕模式下图标都顶到摄像头那一排、点不到——要么安全区报的是 0，要么别的美化根本没让。
    //    所以插件自己看：主屏幕模式、竖屏、页面高度等于整块屏幕（铺到了状态栏底下）时，取安全区；安全区报 0 就按机型估一个
    //    （灵动岛 59、刘海 47、其他 20），写进 --ar-sat。档案主题的样式都用它；别的美化开着时，插件另外加一小段样式把酒馆的顶栏往下挪。
    //    只在打开、转屏、换主题时量一次（量的时候要读计算样式）。
    let safeOn = null;
    function safeTop() {
        const root = doc.documentElement;
        const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
        const portrait = innerHeight >= innerWidth;
        const screenH = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
        const covers = standalone && portrait && Math.abs(screenH - innerHeight) < 24;
        let pad = 0;
        if (covers) {
            const probe = doc.createElement('i');
            probe.style.cssText = 'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top,0px)';
            root.append(probe);
            const sat = parseFloat(getComputedStyle(probe).paddingTop) || 0;
            probe.remove();
            pad = sat > 0 ? sat : (screenH >= 852 ? 59 : screenH >= 812 ? 47 : 20);
        }
        if (pad) setRoot('--ar-sat', `${pad}px`); else root.style.removeProperty('--ar-sat');
        // 别的美化：把酒馆的顶栏整体往下挪（酒馆所有「顶栏多高」都用 --topBarBlockSize）
        let fix = doc.getElementById('ar-safe-fix');
        const need = pad > 0 && !themeOn();
        if (need && !fix) {
            fix = doc.createElement('style');
            fix.id = 'ar-safe-fix';
            doc.head.append(fix);
        }
        if (need) fix.textContent = `:root{--topBarBlockSize:calc(var(--topBarIconSize) + var(--topBarBlockPadding) + ${pad}px) !important}#top-settings-holder{box-sizing:border-box;padding-top:${pad}px !important}#top-bar{height:var(--topBarBlockSize) !important}`;
        else fix?.remove();
    }
    addEventListener('resize', () => safeTop());
    addEventListener('orientationchange', () => setTimeout(safeTop, 300));
    // 主题可能随时被换掉，过一会儿看一次；这里只放便宜的检查
    function sync() {
        const on = themeOn();
        if (on !== safeOn) { safeOn = on; safeTop(); }
        if (on) {
            const first = !body.classList.contains('ar-tab');
            // 记号：主题靠它知道插件是不是这一版（不是的话签下面会出一张提醒更新的小条）
            if (doc.documentElement.dataset.arPv !== '23') doc.documentElement.dataset.arPv = '23';
            mount();
            // 已经有就别再 add：classList.add 即使没变也算改了一次 class，挂在 body 上的监听（酒馆和别的扩展的）每次都被叫醒，
            // v49 及以前这样每 1.5 秒白白花 60–90 毫秒
            if (first) body.classList.add('ar-tab');
            // 主题里的三种字体由这里加载（主题本身不引外部样式表，导入时酒馆就不会弹确认框）
            loadCss('https://fonts.loli.net/css2?family=Courier+Prime&family=Inter+Tight:wght@400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=Playfair+Display+SC&display=swap', 'ar-fonts');
            loadCss('https://fontsapi.zeoseven.com/309/main/result.css', 'ar-fonts-cn');
            // 一进来就有面板开着（比如被钉住的世界书），图标要露出来，才点得到它把它关掉
            if (doc.querySelector('#top-settings-holder .drawer-content.openDrawer')) open(true);
            body.classList.toggle('ar-home', home());
            flags();
            gatherTools();
            wall();
            topColor();
            cover();
            if (first) { letters(); refresh(0); }
        } else if (body.classList.contains('ar-tab')) {
            unmount();
        }
    }

    function flags() {
        const tb = doc.getElementById('extensionTopBar');
        const tbOn = !!tb && !tb.classList.contains('displayNone');
        const prof = !!doc.querySelector('#extensionConnectionProfiles.visible');
        body.classList.toggle('ar-tb1', tbOn && !prof);
        body.classList.toggle('ar-tb2', tbOn && prof);
        body.classList.toggle('ar-drawer', !!doc.querySelector('#top-settings-holder .drawer-content.openDrawer'));
    }
    // Chat Top Bar 的插头一点，连接配置那一条就出来或收起：马上让纸挪位，不等下一次检查
    doc.addEventListener('click', (e) => {
        if (e.target.closest?.('#extensionTopBarToggleConnectionProfiles, #extensionTopBarToggleSidebar')) setTimeout(flags, 60);
    }, true);
    // 欢迎页出现或离开时马上换（每次回到欢迎页都先看封面）
    const chatEl = doc.getElementById('chat');
    if (chatEl) {
        new MutationObserver(() => {
            if (!body.classList.contains('ar-tab')) return;
            body.classList.toggle('ar-home', home());
            refresh();
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
            body.classList.toggle('ar-drawer', any);
            if (hadDrawerOpen && !any) setTimeout(() => open(false), 250);
            hadDrawerOpen = any;
        }).observe(holder, { subtree: true, attributes: true, attributeFilter: ['class'] });
    }

    // 壁纸交给 --ar-wall：酒馆换壁纸时 #bg1 的内联样式会变，没变就不去读（读计算样式要整页算一遍）
    let wallKey = null;
    function wall() {
        const bg = doc.getElementById('bg1');
        const key = bg?.getAttribute('style') ?? '';
        if (key === wallKey) return;
        wallKey = key;
        const root = doc.documentElement.style;
        const img = getComputedStyle(bg ?? body).backgroundImage;
        if (img && img !== 'none') setRoot('--ar-wall', img);
        else root.removeProperty('--ar-wall');
    }

    // 手机状态栏那一条（时间、电量后面）：网页在浏览器里没法把图片画到那里，那一条只跟着页面的底色走。
    // 所以取壁纸最上面一条的平均色当底色（--ar-top），看起来就是壁纸一直铺上去；同时写进 theme-color。
    // 另外加一个 meta：以后「添加到主屏幕」打开时，页面真的能铺到状态栏底下，那时候就是壁纸本身了
    let topKey = '', themeColor0 = null;
    function topColor() {
        const root = doc.documentElement;
        // 壁纸地址从 --ar-wall 里取（wall() 写的，就是 #bg1 的图），不读计算样式
        const m = (root.style.getPropertyValue('--ar-wall') || '').match(/url\(["']?(.*?)["']?\)/);
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
        if (navigator.standalone === true && (sat > 0 || root.style.getPropertyValue('--ar-sat'))) {
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
                // 顶栏图标的颜色跟着壁纸走：取顶上一成高那一条（图标所在的地方）的亮度，暗就用浅色图标，亮就用深色
                g.drawImage(img, sx, sy, cw, Math.max(1, chh * .1), 0, 0, 16, 4);
                const p2 = g.getImageData(0, 0, 16, 4).data;
                let L = 0;
                for (let i = 0; i < p2.length; i += 4) L += .2126 * p2[i] + .7152 * p2[i + 1] + .0722 * p2[i + 2];
                L /= p2.length / 4;
                if (topKey !== key) return;
                root.style.setProperty('--ar-top', col);
                root.style.setProperty('--ar-topink', L < 140 ? '#f3f3f1' : '#1d1d1c');
                meta?.setAttribute('content', col);
            } catch { root.style.removeProperty('--ar-top'); root.style.removeProperty('--ar-topink'); }
        };
        img.onerror = () => { root.style.removeProperty('--ar-top'); root.style.removeProperty('--ar-topink'); };
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
    // v47 起每项只写一个词（她说括号里的解释、口语化的说法都不要）；台面去掉了——桌面一律是酒馆的壁纸
    const VARS = [
        ['--ar-paper', '纸'], ['--ar-ink', '字'], ['--ar-mute', '灰字'], ['--ar-hi', '强调'],
        ['--ar-accent', '文件夹'], ['--ar-accent-ink', '标签字'],
        // 这两个自带的配色方案里没有：不调就跟着纸色和字色走
        ['--ar-underc', '垫纸'], ['--ar-dotc', '波点'],
    ];
    // 自带方案里每个颜色对应哪一项（第七个是以前的台面，不用了）
    const PRESET_KEYS = ['--ar-paper', '--ar-ink', '--ar-mute', '--ar-accent', '--ar-accent-ink', '--ar-hi'];
    const SWATCH_KEYS = ['--ar-paper', '--ar-ink', '--ar-mute', '--ar-accent'];
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
        // v49（第 48 轮她挑的纸）：书纸换成米白书纸、布纹信纸换成象牙白信笺；新加哑粉纸（拍卖图录用的）、试卷纸（干净、带一丢丢暖黄）。
        // v50：书纸、试卷纸的图里画了淡淡的反字（透出来的背面），她说不必真是背面那一页
        // 新的三张图是 840 的无缝小图，铺成 580px 宽，颗粒和样张里一样大
        ['书纸', '', '--ar-book', '580px 580px'],
        ['信笺', '', '--ar-linen', '580px 580px'],
        ['哑粉纸', '', '--ar-matte', '580px 580px'],
        ['试卷纸', '', '--ar-exam', '580px 580px'],
    ];
    const PAPER_ORDER = [8, 6, 7, 9, 0, 1, 2, 3, 4];
    const UPLOAD = 5;
    // 每种版式默认配的纸：图录页 棉纸、刊物 书纸、信 布纹信纸、答卷 素白；在哪种版式下选的纸只记给那种版式
    const PAPER_DEF = [8, 6, 7, 9];
    const paperOf = (s) => s?.papers?.[s.lay ?? 0] ?? PAPER_DEF[s?.lay ?? 0] ?? 0;
    // 每张纸的版式：名字、body 上的 class
    const LAYOUTS = [
        ['图录页', ''],
        ['刊物', 'ar-lay-b'],
        ['信', 'ar-lay-c'],
        ['答卷', 'ar-lay-d'],
    ];
    const IMAGES = [
        ['--ar-photo', 'photo', '拍立得', 700],
        ['--ar-cv1', 'cv1', '相片一', 700],
        ['--ar-cv2', 'cv2', '相片二', 700],
        ['--ar-mood1', 'mood1', '氛围图一', 600],
        ['--ar-mood2', 'mood2', '氛围图二', 600],
        ['--ar-wash', 'wash', '输入栏衬图', 500],
    ];
    // 自己上传的纸纹单独存（不在「图片」那一栏里，在「纸纹」那一栏）
    // 可以改的几行字：键、说明、默认值、是不是多行
    const TEXTS = [
        ['title', '标题', '无题', false, 1],
        ['epi', '题记', '草在结它的种子，风在摇它的叶子，我们站着，不说话，就十分美好。', true, 1],
        ['addr', '来信地址', '19 Rue des Archives, 75004 Paris', false, 2],
        ['addr2', '回信地址', '7 Rue Barbette, 75003 Paris', false, 2],
        ['dear', '称呼', 'Dear {name},', false, 2],
        ['open1', '来信开头', '在我所感与我所写之间，永远横亘着一道无法跨越的距离。所以如果这封信显得有些笨拙，请原谅。', true, 2],
        ['close1', '来信落款', 'Nothing new...\nEver yours,', true, 2],
        ['open2', '回信开头', '我想作诗，写雨，写夜的相思，写你，写不出。', true, 2],
        ['close2', '回信落款', 'Yours ever, fair Star,', true, 2],
        ['exam', '考试名称', '高三第三次模拟考试', false, 3],
        ['idle', '输入栏', '从前的日色变得慢，车，马，邮件都慢', false, -1],
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
        // 0.19.1：「纸纹固定在屏幕上」去掉了
        delete s.texFix;
        // 0.20：底图一律是酒馆的壁纸、封面一律有；台面颜色和桌面图去掉
        delete s.bgST; delete s.cover;
        if (s.images) delete s.images.desk;
        if (s.colors) delete s.colors['--ar-desk'];
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
    const PROPS = ['--ar-no', '--ar-date', '--ar-time', '--ar-stamp', '--ar-datel', '--ar-sheet', '--ar-title', '--ar-dear', '--ar-name', '--ar-pic'];
    // 纸上能双击改的几行字（v42 起是真元素，不再是伪元素：伪元素点不到，双击只能按坐标猜，她说定不准）。
    // data-k 是哪一行（主题按它排版），data-e 是改的是哪一项设置（角色和你各一份的，分 1 / 2）
    function keyLine(el, k, e, txt, where) {
        let x = el.querySelector(`.ar-k[data-k="${k}"]`);
        if (!x) {
            x = doc.createElement('div');
            x.className = 'ar-k';
            x.dataset.k = k;
            where(x);
        }
        if (x.dataset.e !== e) x.dataset.e = e;
        if (x.textContent !== txt) x.textContent = txt;
    }
    function keyLines(el, user, t, to, id) {
        const blk = el.querySelector(':scope > .mes_block');
        const mt = blk?.querySelector(':scope > .mes_text');
        const ch = blk?.querySelector(':scope > .ch_name');
        const nm = ch?.querySelector('.name_text');
        if (!blk || !mt || !ch || !nm) return;
        keyLine(el, 'title', 'title', t.title.replaceAll('{n}', words(id)).replaceAll('{no}', String(id)), (x) => blk.prepend(x));
        keyLine(el, 'open', user ? 'open2' : 'open1', user ? t.open2 : t.open1, (x) => blk.prepend(x));
        keyLine(el, 'epi', 'epi', t.epi.trim() ? t.epi : '', (x) => mt.before(x));
        keyLine(el, 'close', user ? 'close2' : 'close1', user ? t.close2 : t.close1, (x) => mt.after(x));
        keyLine(el, 'addr', user ? 'addr2' : 'addr', user ? t.addr2 : t.addr, (x) => nm.after(x));
        keyLine(el, 'dear', 'dear', t.dear.replaceAll('{name}', to), (x) => ch.append(x));
    }
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
            keyLines(el, user, t, to, id);
            const img = el.querySelector('.mesAvatarWrapper .avatar img');
            const v = [
                q(id), q(date), q(time),
                q(d ? `${date.toUpperCase()} · ${time}` : ''),
                q(d ? `${MON[d.getMonth()]}. ${d.getDate()}, ${d.getFullYear()} · ${time}` : ''),
                q(`${si + 1} / ${sw}`),
                q(t.title.replaceAll('{n}', words(id)).replaceAll('{no}', String(id))),
                q(t.dear.replaceAll('{name}', to)),
                q(el.getAttribute('ch_name') || ''),
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
    // 背面透过来的字：刊物和答卷的纸不是完全不透的，背面那一页印的字会淡淡地反着透过来（她说真的书纸、模考卷都这样）。
    // 刊物透的是下一页（下一条消息，没有就是上一条）的正文；答卷透的是背面的题。左右反、糊一点、很淡，不能选中
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
    // 封面：加载的这几秒里桌上一只合着的文件夹（底下就是酒馆的壁纸）。等的时候可以翻看：
    // 点拍立得拿起来，再点翻到背面，再点放回去；点后面露出的相片抽出来看，再点塞回去。
    // 酒馆一准备好（APP_READY）文件夹自己打开；手里正拿着照片时，等放回去再开
    let appReady = false;
    function cover() {
        if (coverDone) return;
        coverDone = true;
        if (doc.getElementById('ar-cover')) return;
        const d = new Date();
        const p2 = (n) => String(n).padStart(2, '0');
        const date = `${p2(d.getDate())} . ${p2(d.getMonth() + 1)} . ${d.getFullYear()}`;
        const el = doc.createElement('div');
        el.id = 'ar-cover';
        el.innerHTML = `<div class="cv">
            <div class="bk bk1"><i></i></div><div class="bk bk2"><i></i></div>
            <div class="sh"><div class="tb"><b>archive</b></div><div class="fd"></div></div>
            <div class="lb lb1">PHOTOGRAPHS \u00b7 DO NOT BEND</div>
            <div class="ph"><div class="pin"><div class="pf"><i></i><span class="lb">${date}</span></div><div class="pb"><span>${date}</span></div></div></div>
        </div>`;
        const t0 = Date.now();
        const inHand = () => el.querySelector('.ph.zoom, .bk.pull') || doc.getElementById('ar-edit');
        const open = () => {
            if (el.classList.contains('open')) return;
            el.classList.add('open');
            setTimeout(() => el.remove(), 900);
        };
        const tryOpen = () => {
            if (!el.isConnected || !appReady || inHand()) return;
            // 封面至少停一下，不然刚出来就打开，像闪了一下
            const wait = 1400 - (Date.now() - t0);
            if (wait > 0) { setTimeout(tryOpen, wait); return; }
            open();
        };
        el.addEventListener('click', (e) => {
            const ph = e.target.closest('.ph');
            const bk = e.target.closest('.bk');
            if (ph) {
                // 拿起来 → 翻到背面 → 放回去
                if (!ph.classList.contains('zoom')) ph.classList.add('zoom');
                else if (!ph.classList.contains('flip')) ph.classList.add('flip');
                else ph.classList.remove('zoom', 'flip');
            } else if (bk) {
                const was = bk.classList.contains('pull');
                for (const x of el.querySelectorAll('.bk.pull')) x.classList.remove('pull');
                if (!was) bk.classList.add('pull');
            } else if (inHand()) {
                // 点桌面：手里的放回去
                for (const x of el.querySelectorAll('.ph.zoom')) x.classList.remove('zoom', 'flip');
                for (const x of el.querySelectorAll('.bk.pull')) x.classList.remove('pull');
            } else if (appReady) open();
            setTimeout(tryOpen, 650);
        });
        // 挂在 <html> 下面而不是 body 里：酒馆的 body 自己没有高度还会裁掉超出的部分，放在里面的满屏元素整个看不见
        doc.documentElement.append(el);
        cover.tryOpen = tryOpen;
        tryOpen();
    }
    function markReady() {
        if (appReady) return;
        appReady = true;
        cover.tryOpen?.();
    }

    // ── 双击原地修改：卷头、标题、题记、称呼、开场白、落款、地址、输入框那一句，在纸上双击就地改；
    //    图片（氛围图、封面上的照片、输入标签下面晕开的图）双击就换一张 ──
    const TEXT_NAME = Object.fromEntries(TEXTS.map(([k, n]) => [k, n]));
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
        if (!mes) return null;
        if (t.closest('.ar-scratch .hd b')) return { text: 'exam' };
        // 标题、题记、地址、称呼、开场白、落款：纸上的真文字，点到哪一行就是哪一行
        const k = t.closest('.ar-k[data-e]');
        if (k) return { text: k.dataset.e };
        // 有思维链时标题（刊物）、称呼（信）写在思维链的开关上
        if (t.closest('.mes_reasoning_header')) {
            if (lay === 'ar-lay-b') return { text: 'title' };
            if (lay === 'ar-lay-c') return { text: 'dear' };
        }
        // 氛围图：刊物在头像右边，信在头像两边
        const av = r(mes.querySelector('.mesAvatarWrapper .avatar'));
        if (av && t.closest('.mesAvatarWrapper')) {
            if (lay === 'ar-lay-b' && x > av.right) return { img: user ? 'mood2' : 'mood1' };
            if (lay === 'ar-lay-c' && x < av.left) return { img: user ? 'mood2' : 'mood1' };
            if (lay === 'ar-lay-c' && x > av.right) return { img: user ? 'mood1' : 'mood2' };
        }
        return null;
    }
    // 一张小白卡：上面一行灰字是改的哪一项，一个输入框，下面「还原（改过才有）/ 撤销 / 存档」
    function editBox({ label, value, multi, changed, x, y, onSave, onReset }) {
        doc.getElementById('ar-edit')?.remove();
        const box = doc.createElement('div');
        box.id = 'ar-edit';
        box.innerHTML = `<small>${esc(label ?? '')}</small>${multi ? '<textarea rows="3"></textarea>' : '<input type="text">'}<span>${changed ? '<button data-a="r">还原</button>' : ''}<button data-a="0">撤销</button><button data-a="1">存档</button></span>`;
        const inp = box.querySelector('textarea, input');
        inp.value = value ?? '';
        doc.documentElement.append(box);
        const W = innerWidth, H = innerHeight;
        const bw = Math.min(360, W - 24);
        box.style.width = `${bw}px`;
        box.style.left = `${Math.max(12, Math.min(W - bw - 12, x - bw / 2))}px`;
        box.style.top = `${Math.max(12, Math.min(H - 170, y + 14))}px`;
        inp.focus();
        inp.select?.();
        const done = (a) => {
            box.remove();
            if (a === 'r') onReset?.();
            else if (a === '1') onSave?.(inp.value);
        };
        box.addEventListener('click', (e) => { const a = e.target.closest('button')?.dataset.a; if (a !== undefined) done(a); });
        inp.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') done('0');
            if (e.key === 'Enter' && (!multi || e.ctrlKey || e.metaKey)) { e.preventDefault(); done('1'); }
        });
    }
    function editText(key, x, y) {
        const def = TEXTS.find((t) => t[0] === key);
        const after = () => { applyStyle(); refresh(0); save(); stylePanel.sync?.(); };
        editBox({
            label: TEXT_NAME[key], value: text(key), multi: def?.[3], x, y,
            changed: store()?.texts?.[key] !== undefined && store().texts[key] !== def?.[2],
            onSave: (v) => { const st = store(); st.texts ??= {}; st.texts[key] = v; after(); },
            onReset: () => { delete store().texts?.[key]; after(); },
        });
    }
    function editImage(key, x, y) {
        doc.getElementById('ar-edit')?.remove();
        if (store()?.images?.[key] && x !== undefined) {
            const box = doc.createElement('div');
            box.id = 'ar-edit';
            box.innerHTML = `<small>${esc(IMAGES.find((m) => m[1] === key)?.[2] ?? '')}</small><span><button data-a="r">还原</button><button data-a="0">撤销</button><button data-a="1">换一张</button></span>`;
            doc.documentElement.append(box);
            const W = innerWidth, H = innerHeight;
            const bw = Math.min(260, W - 24);
            box.style.width = `${bw}px`;
            box.style.left = `${Math.max(12, Math.min(W - bw - 12, x - bw / 2))}px`;
            box.style.top = `${Math.max(12, Math.min(H - 90, y + 14))}px`;
            box.addEventListener('click', (e) => {
                const a = e.target.closest('button')?.dataset.a;
                if (a === undefined) return;
                box.remove();
                if (a === 'r') { delete store().images[key]; applyStyle(); save(); }
                if (a === '1') editImage(key);
            });
            return;
        }
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
    doc.addEventListener('pointerdown', (e) => {
        const box = doc.getElementById('ar-edit');
        if (box && !box.contains(e.target)) box.remove();
    }, true);
    doc.addEventListener('dblclick', (e) => {
        if (!body.classList.contains('ar-tab')) return;
        if (e.target.closest?.('#ar-edit, #ar-style, textarea, input, .mes_text p, .mes_text li')) return;
        const hit = editTarget(e.target, e.clientX, e.clientY);
        if (!hit) return;
        e.preventDefault();
        e.stopPropagation();
        doc.getSelection?.()?.removeAllRanges();
        if (hit.text) editText(hit.text, e.clientX, e.clientY);
        else if (hit.img) editImage(hit.img, e.clientX, e.clientY);
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
        for (const x of doc.querySelectorAll('#chat .ar-k')) x.remove();
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
        // 上传字体（下拉框最后一项）：上传的文件或贴的链接
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
        root.setProperty('--ar-idle', q(text('idle')));
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
            // 图跟着每张纸走：宽度对齐，纸比图长的部分接同一张（做成了上下无缝的竖条，见 paperTile）。
            // （v40–v42 有过「固定在屏幕上、纸从上面滑过」，v43 她说图不动字在动很怪，去掉了）
            if (texSrc !== `${k}|${src}` || !texURL) {
                // 新的一块还没做好时：先用原图（浓淡还没算进去），但别从别的图闪一下
                if (!texSrc?.endsWith(`|${src}`)) root.setProperty('--ar-cotton', `url("${src}")`);
            } else root.setProperty('--ar-cotton', `url("${texURL}")`);
            root.setProperty('--ar-cs', '100% auto');
            root.setProperty('--ar-pp', '50% 0');
            root.setProperty('--ar-cr', 'repeat-y');
            paperTile(src, k).then((u) => {
                const now = store() ?? {};
                if (now.paperTex === src && (now.texK ?? 100) / 100 === (s.texK ?? 100) / 100 && (PAPERS[paperOf(now)] ?? PAPERS[0])[2] === 'upload') {
                    root.setProperty('--ar-cotton', `url("${u}")`);
                }
            });
        }
        else root.removeProperty('--ar-cotton');
        if (pp[2] !== 'upload' || !s.paperTex) {
            for (const v of ['--ar-cs', '--ar-pp', '--ar-cr']) root.removeProperty(v);
        }
        // 有的纸纹要铺得比棉纸细（布纹的织纹）
        if (pp[3]) root.setProperty('--ar-cs', pp[3]);
        wall();
        refresh(0);
    }

    function clearStyle() {
        const root = doc.documentElement.style;
        for (const [v] of VARS) root.removeProperty(v);
        for (const [v] of IMAGES) root.removeProperty(v);
        for (const v of ['--ar-cn', '--ar-tw', '--ar-idle', '--ar-epi', '--ar-vh', '--ar-nextno', '--ar-pat', '--ar-cotton', '--ar-cs', '--ar-pp', '--ar-cr', '--ar-wall']) root.removeProperty(v);
        for (const [, cls] of LAYOUTS) if (cls) body.classList.remove(cls);
        undress();
    }

    // 上传的纸纹做成一块能上下无缝接的竖条：横图先转成竖的（纸纹不分方向）；四周裁掉一点（扫描、拍照的纸边常有一道亮边或暗角）；
    // 再把图最下面的一段渐变叠到最上面——这样一块的下沿和下一块的上沿是同一行，接起来没有缝。
    // （v46 以前是下面接一份上下翻转的，纸边那道亮边被对成了一条白缝，她在聊天记录里看到的）
    let texURL = null, texSrc = null, texJob = null;
    function paperTile(src, k = 1) {
        const key = `${k}|${src}`;
        if (texSrc === key && texURL) return Promise.resolve(texURL);
        if (texJob?.src === key) return texJob.p;
        const job = { src: key };
        job.p = new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const land = img.width > img.height;
                const W0 = land ? img.height : img.width;
                const H0 = land ? img.width : img.height;
                const full = doc.createElement('canvas');
                full.width = W0;
                full.height = H0;
                const f = full.getContext('2d');
                if (land) { f.translate(W0, 0); f.rotate(Math.PI / 2); }
                f.drawImage(img, 0, 0);
                const m = Math.round(Math.min(W0, H0) * 0.035);
                const w = W0 - 2 * m, h = H0 - 2 * m;
                const bl = Math.round(h * 0.22);
                // 接缝那一段：最下面一段（A）和最上面一段（B）逐行过渡。直接按透明度叠，两层纹理会互相抵消、那一段发白发平；
                // 这里按「保持起伏」的方式混：先减去整张图的平均色，A、B 的权重是 cos/sin（平方和为 1），再加回平均色
                const avg = doc.createElement('canvas');
                avg.width = avg.height = 8;
                const ac = avg.getContext('2d');
                ac.drawImage(full, m, m, w, h, 0, 0, 8, 8);
                const ad = ac.getImageData(0, 0, 8, 8).data;
                const mu = [0, 1, 2].map((ch) => { let t = 0; for (let i = ch; i < ad.length; i += 4) t += ad[i]; return t / 64; });
                const A = f.getImageData(m, m + h - bl, w, bl);
                const B = f.getImageData(m, m, w, bl).data;
                const ad2 = A.data;
                for (let y = 0; y < bl; y++) {
                    const t = (y + .5) / bl * Math.PI / 2;
                    const wa = Math.cos(t), wb = Math.sin(t);
                    for (let x = 0, i = y * w * 4; x < w; x++, i += 4) {
                        for (let ch = 0; ch < 3; ch++) ad2[i + ch] = mu[ch] + (ad2[i + ch] - mu[ch]) * wa + (B[i + ch] - mu[ch]) * wb;
                        ad2[i + 3] = 255;
                    }
                }
                const strip = doc.createElement('canvas');
                strip.width = w;
                strip.height = bl;
                strip.getContext('2d').putImageData(A, 0, 0);
                const cv = doc.createElement('canvas');
                cv.width = w;
                cv.height = h - bl;
                const c = cv.getContext('2d');
                // 调淡：先降饱和度（彩色的图先变素），再蒙白；蒙白的量按 1 - k^1.5，往淡的那头走得快一些
                if (k < 1) c.filter = `saturate(${k.toFixed(2)})`;
                c.drawImage(full, m, m, w, h - bl, 0, 0, w, h - bl);
                c.drawImage(strip, 0, 0);
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
    // 字体网站给的 css 链接：读出里面 @font-face 的字体名；读不到（不让跨域）就看链接里的 family=
    async function fontFamilyOf(url, depth = 0) {
        try {
            const css = await (await fetch(url)).text();
            const m = /font-family\s*:\s*['"]?([^;'"]+)['"]?/i.exec(css);
            if (m) return m[1].trim();
            // 有的 css 自己不写字体，只 @import 别的 css（比如霞鹜文楷，正体、等宽各一份）：都读一遍，取名字最短的那个（正体）
            if (depth < 1) {
                const ims = [...css.matchAll(/@import\s+(?:url\()?\s*['"]?([^'")\s;]+)/gi)].slice(0, 8).map((x) => new URL(x[1], url).href);
                const names = (await Promise.all(ims.map((u) => fontFamilyOf(u, depth + 1)))).filter(Boolean);
                if (names.length) return names.sort((x, y) => x.length - y.length)[0];
            }
        } catch { /* 跨域读不到 */ }
        const f = /[?&]family=([^&:]+)/.exec(url);
        return f ? decodeURIComponent(f[1].replace(/\+/g, ' ')) : '';
    }
    const swatch = (colors) => `<span>${colors.slice(0, 4).map((x) => `<i style="background:${esc(x)}"></i>`).join('')}</span>`;

    function buildPanel() {
        let p = doc.getElementById('ar-style');
        if (p) return p;
        p = doc.createElement('div');
        p.id = 'ar-style';
        p.innerHTML = `
            <header><b>style</b><small>插件 0.23</small><i class="ar-x" role="button" title="收起">×</i></header>
            <section><h4>配色</h4>
                <div class="ar-presets"></div>
                <div class="ar-colors">${VARS.map(([v, n]) => `<label><input type="color" data-v="${v}"><span>${n}</span></label>`).join('')}</div>
            </section>
            <section><h4>纸纹</h4>
                <div class="ar-papers"></div>
                <label class="ar-row ar-texk"><span>浓淡</span><input type="range" min="5" max="100" step="5" data-texk></label>
            </section>
            <section><h4>版式</h4>
                <div class="ar-lays">${LAYOUTS.map(([n], i) => `<button data-lay="${i}">${n}</button>`).join('')}</div>
            </section>
            <section><h4>字体</h4>
                ${[['cn', '中文', CN_FONTS], ['tw', '英文', TW_FONTS]].map(([slot, n, list]) => `
                <label class="ar-row"><span>${n}</span><select data-f="${slot}">${list.map(([fn], i) => `<option value="${i}">${fn}</option>`).join('')}<option value="${list.length}">上传字体</option></select></label>
                <div class="ar-uf" data-uf="${slot}"><input type="text" data-ufurl="${slot}" placeholder="字体链接"><label class="ar-btn">上传<input type="file" accept=".ttf,.otf,.woff,.woff2,font/*" data-uffile="${slot}" hidden></label></div>`).join('')}
            </section>
            <footer><button class="ar-btn" data-all>全部还原</button></footer>`;
        doc.body.append(p);

        // 配色方案：四套自带的，后面跟着自己存的（右上角 × 删掉，双击名字改名），最后一格「+」把现在的颜色存成一套
        const presets = () => {
            const mine = store()?.schemes ?? [];
            p.querySelector('.ar-presets').innerHTML =
                PRESETS.map(([n, c], i) => `<button data-p="${i}" title="${esc(n)}">${swatch(c)}<em>${esc(n)}</em></button>`).join('') +
                mine.map((sc, i) => `<button data-sp="${i}" title="${esc(sc.name)}">${swatch(SWATCH_KEYS.map((v) => sc.colors[v] ?? '#000'))}<em>${esc(sc.name)}</em><i class="ar-del" role="button" data-del="${i}" title="删除">×</i></button>`).join('') +
                '<button class="ar-add" data-savescheme title="存下现在的配色">+</button>';
        };
        // 纸纹：自带的几种，后面是上传过的（右上角 × 删掉），最后一格「上传」
        const lib = () => {
            const st = store();
            const cur = paperOf(st);
            p.querySelector('.ar-papers').innerHTML =
                PAPER_ORDER.map((i) => `<button data-paper="${i}" class="${cur === i ? 'on' : ''}"><i class="p${i}"></i><em>${PAPERS[i][0]}</em></button>`).join('') +
                (st?.texLib ?? []).map((u, i) => `<button data-lib="${i}" class="${cur === UPLOAD && st?.paperTex === u ? 'on' : ''}"><i style="background-image:url('${esc(u)}')"></i><i class="ar-del" role="button" data-libdel="${i}" title="删除">×</i><em></em></button>`).join('') +
                '<label class="ar-add"><i></i><em>上传</em><input type="file" accept="image/*" data-paperup hidden></label>';
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
                const up = uf.src?.startsWith('/user/files/');
                const u = box.querySelector('[data-ufurl]'); if (u && doc.activeElement !== u) u.value = up ? '' : (uf.src ?? '');
                u.placeholder = up ? (uf.file ?? '已上传') : '字体链接';
            }
            for (const b of p.querySelectorAll('[data-lay]')) b.classList.toggle('on', Number(b.dataset.lay) === (store()?.lay ?? 0));
            const tk = p.querySelector('[data-texk]');
            if (tk) tk.value = String(store()?.texK ?? 100);
            // 浓淡只对上传的纸纹有用：选着上传的那张时才出现
            for (const row of p.querySelectorAll('.ar-texk')) row.hidden = !(store()?.paperTex && paperOf(store()) === UPLOAD);
        };
        let texTimer = 0;
        p.addEventListener('input', (e) => {
            const st = store();
            if (!st) return;
            const v = e.target.dataset?.v;
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
            } else return;
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
                p.syncInputs?.();
            }
            // 上传字体：贴链接。字体文件直接用；css 链接（字体网站给的）要知道字体名——从 css 里读出来，读不到就看链接里的 family=
            if (e.target.dataset?.ufurl !== undefined) {
                const slot = e.target.dataset.ufurl;
                const src = e.target.value.trim();
                st.uf ??= {};
                st.uf[slot] = { src };
                if (src && !/\.(ttf|otf|woff2?)(\?|#|$)/i.test(src)) st.uf[slot].name = await fontFamilyOf(src);
                applyStyle();
                save();
            }
            // 上传字体：文件存到酒馆服务器上
            if (e.target.dataset?.uffile !== undefined && e.target.files?.[0]) {
                const slot = e.target.dataset.uffile;
                const f = e.target.files[0];
                const ext = (f.name.match(/\.(ttf|otf|woff2?)$/i)?.[1] ?? 'ttf').toLowerCase();
                toastr?.info?.('上传中');
                const url = await putFile(`archive-font-${slot}-${stamp()}.${ext}`, await fileB64(f));
                if (!url) { toastr?.error?.('上传失败'); return; }
                st.uf ??= {};
                st.uf[slot] = { src: url, file: f.name };
                e.target.value = '';
                applyStyle();
                save();
                p.syncInputs?.();
            }
            if (e.target.dataset?.paperup !== undefined && e.target.files?.[0]) {
                // 上传的纸纹：缩到最长边 2400，存到酒馆服务器上（存不了就存在设置里），放进纸纹格子里，并直接换成它
                const data = await shrink(e.target.files[0], 2400, 0.9);
                const url = (await putFile(`archive-paper-${stamp()}.jpg`, data.split(',')[1])) ?? data;
                st.texLib = [...(st.texLib ?? []).filter((x) => x !== url), url].slice(-12);
                st.paperTex = url;
                delete st.texK;
                st.papers ??= {};
                st.papers[st.lay ?? 0] = UPLOAD;
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
                st.papers[st.lay ?? 0] = UPLOAD;
                applyStyle(); save(); sync(); return;
            }
            if (b.dataset.del !== undefined) {
                st.schemes?.splice(Number(b.dataset.del), 1);
            } else if (b.dataset.p !== undefined) {
                st.colors = Object.fromEntries(PRESET_KEYS.map((v, i) => [v, PRESETS[b.dataset.p][1][i]]).filter(([, c]) => c));
            } else if (b.dataset.sp !== undefined) {
                const sc = st.schemes?.[Number(b.dataset.sp)];
                if (sc) st.colors = { ...sc.colors };
            } else if (b.dataset.savescheme !== undefined) {
                // 把现在看到的颜色存成一套，先叫「方案 N」，双击名字改
                st.schemes ??= [];
                st.schemes.push({ name: `方案 ${st.schemes.length + 1}`, colors: Object.fromEntries(VARS.map(([v]) => [v, hex(current(v))])) });
            } else if (b.dataset.lay !== undefined) {
                st.lay = Number(b.dataset.lay);
            } else if (b.dataset.paper !== undefined) {
                st.papers ??= {};
                st.papers[st.lay ?? 0] = Number(b.dataset.paper);
            } else if (b.dataset.all !== undefined) {
                // 自己存的配色方案留着，别的都回到默认
                delete st.colors; delete st.images; delete st.cn; delete st.tw; delete st.lay; delete st.texts; delete st.papers; delete st.texK;
            } else return;
            applyStyle();
            save();
            sync();
        });
        // 自己存的配色方案：双击名字改名
        p.addEventListener('dblclick', (e) => {
            const b = e.target.closest('[data-sp]');
            const st = store();
            const sc = st?.schemes?.[Number(b?.dataset.sp)];
            if (!sc) return;
            e.preventDefault();
            editBox({ label: '方案名', value: sc.name, x: e.clientX, y: e.clientY, onSave: (v) => { sc.name = v.trim() || sc.name; save(); sync(); } });
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
        if (e.target.closest('#ar-style, #ar-sides, #ar-edit')) return;
        stylePanel(false);
    }, true);

    const c = ctx();
    const es = c?.eventSource;
    const et = c?.eventTypes ?? c?.event_types ?? {};
    if (es?.on) {
        for (const k of ['CHAT_CHANGED', 'MESSAGE_SENT', 'MESSAGE_RECEIVED', 'MESSAGE_DELETED', 'CHARACTER_EDITED', 'MESSAGE_SWIPED', 'MESSAGE_EDITED', 'MESSAGE_UPDATED', 'CHARACTER_MESSAGE_RENDERED', 'USER_MESSAGE_RENDERED', 'MORE_MESSAGES_LOADED']) {
            if (et[k]) es.on(et[k], () => { sync(); fill(); refresh(); });
        }
        if (et.APP_READY) es.on(et.APP_READY, markReady);
        // 生成结束、换版式之类之后补一次
        for (const k of ['GENERATION_ENDED', 'GENERATION_STOPPED', 'SETTINGS_UPDATED']) if (et[k]) es.on(et[k], () => refresh(120));
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
    {
        const readyCheck = setInterval(() => {
            if (appReady) { clearInterval(readyCheck); return; }
            if (!doc.querySelector('#loader.splash-screen, #preloader') && doc.querySelector('#chat')) { clearInterval(readyCheck); setTimeout(markReady, 400); }
        }, 300);
    }
})();
