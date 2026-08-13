{
  const svg = (paths) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const icons = {
    home: svg('<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>'),
    library: svg('<path d="M5 4h14v16H5z"/><path d="M9 8h6M9 12h6M9 16h4"/>'),
    calendar: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>'),
    users: svg('<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M17 5a4 4 0 0 1 0 7M22 21a6 6 0 0 0-5-5.7"/>'),
    moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>'),
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    play: svg('<path d="m8 5 11 7-11 7Z"/>'),
    link: svg('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7L12 5"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>'),
    clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>'),
    left: svg('<path d="m15 18-6-6 6-6"/>'),
    right: svg('<path d="m9 18 6-6-6-6"/>'),
    check: svg('<path d="m5 12 4 4L19 6"/>'),
    history: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>'),
    archive: svg('<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v12h14V8M10 12h4"/>'),
    settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A8 8 0 0 0 15 6l-.3-2.6h-4L10.4 6A8 8 0 0 0 9 7L6.5 6l-2 3.4L6.6 11a7 7 0 0 0 0 2l-2.1 1.6 2 3.4L9 17a8 8 0 0 0 1.4 1l.3 2.6h4L15 18a8 8 0 0 0 1.5-1l2.4 1 2-3.4-2-1.5c.1-.4.1-.7.1-1.1Z"/>'),
    mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
    sparkle: svg('<path d="m12 3 1.2 4.1L17 9l-3.8 1.9L12 15l-1.2-4.1L7 9l3.8-1.9L12 3Z"/>'),
    shield: svg('<path d="M12 3 5 6v5c0 4.8 2.9 8.4 7 10 4.1-1.6 7-5.2 7-10V6Z"/><path d="m9 12 2 2 4-4"/>'),
    arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>')
  };
  let currentPage = 'home';
  let currentTheme = 'light';
  let toastTimer;
  const screen = document.getElementById('screen');
  const studio = document.getElementById('studio');
  const status = () => `<div class="status-camera"></div><div class="statusbar"><span>9:41</span><span class="system-icons"><svg viewBox="0 0 18 12"><path d="M1 10h2M5 8h2M9 5h2M13 2h2"/></svg><svg viewBox="0 0 16 12"><path d="M2 4.5a9 9 0 0 1 12 0M4.5 7a5.5 5.5 0 0 1 7 0M7 9.5a2 2 0 0 1 2 0"/></svg><svg viewBox="0 0 22 12"><rect x="1" y="1" width="17" height="10" rx="2"/><path d="M20 4v4"/><path d="M3.5 3.5h11v5h-11Z" fill="currentColor" stroke="none"/></svg></span></div>`;
  const nav = (active) => `<nav class="bottom-nav" aria-label="主要导航">${[['home','首页',icons.home],['library','片库',icons.library],['calendar','日历',icons.calendar],['us','我们',icons.users]].map(([id,label,icon]) => `<button class="nav-btn ${active === id ? 'active' : ''}" data-nav="${id}" aria-label="${label}">${icon}<span>${label}</span></button>`).join('')}</nav>`;
  const themeButton = () => `<button class="icon-btn ghost theme-local" aria-label="切换黑白主题">${currentTheme === 'light' ? icons.moon : icons.sun}</button>`;
  const head = (index,title,note,action = themeButton()) => `<header class="page-head reveal" style="--i:0"><div><div class="page-index">${index}</div><h2 class="page-title">${title}</h2><p class="page-note">${note}</p></div>${action}</header>`;
  const toast = () => `<div class="toast" role="status">${icons.check}<span>状态已更新</span></div>`;
  const sheet = () => `<div class="sheet-backdrop js-close"></div><section class="sheet" role="dialog" aria-modal="true"><div class="sheet-handle"></div><div class="sheet-title">添加到双人空间</div><p class="sheet-copy">一个入口完成加片、创建计划或粘贴邀请链接，操作会即时同步给对方。</p><div class="sheet-form"><div class="field"><label>链接或备注</label><input aria-label="链接或备注" placeholder="粘贴 B站链接或输入内容"></div><div class="button-row"><button class="button js-close">取消</button><button class="button primary js-confirm">确认同步</button></div></div></section>`;
  const row = (icon,title,subtitle,end) => `<div class="stream-row" tabindex="0"><div class="row-icon">${icon}</div><div class="row-main"><div class="row-title">${title}</div><div class="row-sub">${subtitle}</div></div><div class="row-end">${end}</div></div>`;
  const mediaRow = (poster,title,subtitle,end) => `<div class="media-row" tabindex="0"><div class="poster ${poster}"></div><div class="row-main"><div class="row-title">${title}</div><div class="row-sub">${subtitle}</div></div><div class="row-end">${end}</div></div>`;

  function loginPage() {
    return `${status()}<main class="auth"><div class="auth-top reveal" style="--i:0"><div class="auth-mark">TK</div>${themeButton()}</div><div class="auth-kicker reveal" style="--i:1">PRIVATE SIGNAL / TWO PEOPLE</div><h2 class="auth-title reveal" style="--i:2">连接彼此，<br>不打扰观看。</h2><p class="auth-copy reveal" style="--i:3">登录后保存你们的片库、计划和共同观看记录。匿名房间仍然可以继续使用。</p><div class="auth-form reveal" style="--i:4"><div class="field"><label>邮箱</label><div class="input-shell"><span class="field-icon">${icons.mail}</span><input type="email" aria-label="邮箱" placeholder="name@example.com"></div><div class="field-help">验证码仅用于同看账号登录，不用于营销。</div></div><button class="button primary full async-action" data-success="验证码已发送">获取验证码 ${icons.arrow}</button><button class="button full anonymous-entry">暂时使用匿名房间</button></div><div class="auth-trust reveal" style="--i:5">${icons.shield}<span>每个账号仅绑定一位好友</span></div><p class="auth-foot">TONGKAN ACCOUNT · ALPHA 10<br>内容流始终由你的设备直接加载</p></main>${toast()}`;
  }

  function homePage() {
    return `${status()}<main class="page">${head('01 / NOW','一起看','连接状态、今日计划与房间操作都在这里。')}<section class="panel presence reveal" style="--i:1"><div class="presence-line"><div class="avatar">梅</div><div class="link-track"></div><div class="avatar second">然</div></div><div class="presence-copy"><span><i class="live-dot"></i> 双方在线</span><strong>连接稳定 · 38 ms</strong></div></section><section class="panel strong now-card reveal" style="--i:2"><div class="now-top"><span class="now-code">ROOM / READY</span><span class="now-status">● LIVE LINK</span></div><div class="signal-orbit"><span></span><span></span><span></span></div><h3 class="now-title">今晚，看一部好电影。</h3><p class="now-sub">房间创建后自动弹出分享，视频停在 0 秒等待双方播放。</p><div class="button-row"><button class="button primary async-action" data-success="房间已创建">${icons.play} 创建房间</button><button class="button" data-sheet="join">${icons.link} 加入房间</button></div></section><div class="label-row reveal" style="--i:3"><span class="section-label">今日轨道</span><span class="section-meta">AUG 11 / 2 ITEMS</span></div><section class="stream-list reveal" style="--i:4">${row(icons.clock,'20:00 · 星际穿越','吃完饭一起看 · 已加入片库','90 min')}${row(icons.sparkle,'当天 · 旅行纪录片','还没有设置具体时间','OPEN')}</section><div class="metrics reveal" style="--i:5"><div class="metric"><strong>8.6h</strong><span>本月同看</span></div><div class="metric"><strong>12</strong><span>共同完成</span></div><div class="metric"><strong>128d</strong><span>成为好友</span></div></div></main>${nav('home')}${sheet()}${toast()}`;
  }

  function libraryPage() {
    return `${status()}<main class="page">${head('02 / LIBRARY','片库','两个人共用一份清单，随时排序、分类和安排。',`<button class="icon-btn" data-sheet="library" aria-label="添加视频">${icons.plus}</button>`)}<div class="search reveal" style="--i:1"><span class="field-icon">${icons.search}</span><input aria-label="搜索片库" placeholder="搜索标题、分类或添加者"></div><div class="filter-line reveal" style="--i:2"><button class="filter active">全部 18</button><button class="filter">想看 8</button><button class="filter">已计划 4</button><button class="filter">已看完 6</button></div><div class="label-row reveal" style="--i:3"><span class="section-label">最近更新</span><span class="section-meta">SHARED / SORTED</span></div><section class="media-list reveal" style="--i:4">${mediaRow('','星际穿越','科幻 · 阿然添加 · 已计划今晚','20:00')}${mediaRow('alt','布达佩斯大饭店','电影 · 小梅添加 · 想看','02')}${mediaRow('soft','东京散步纪录片','旅行 · 阿然添加 · 未安排','03')}${mediaRow('mono-poster','宇宙尽头的答案','纪录 · 共同收藏 · 已看 42%','42%')}</section><button class="floating-add" data-sheet="library" aria-label="添加到片库">${icons.plus}<span>添加</span></button></main>${nav('library')}${sheet()}${toast()}`;
  }

  function calendarPage() {
    const dates = [['28','dim'],['29','dim'],['30','dim'],['31','dim'],['1',''],['2',''],['3',''],['4',''],['5',''],['6','plan'],['7',''],['8',''],['9',''],['10',''],['11','active plan'],['12',''],['13',''],['14',''],['15','plan'],['16',''],['17',''],['18',''],['19',''],['20',''],['21','plan'],['22',''],['23',''],['24',''],['25',''],['26',''],['27',''],['28',''],['29',''],['30',''],['31','']];
    return `${status()}<main class="page">${head('03 / CALENDAR','日历','把“哪天想看”变成两个人都能看到的约定。',`<button class="icon-btn" data-sheet="calendar" aria-label="新建计划">${icons.plus}</button>`)}<section class="panel calendar-panel reveal" style="--i:1"><div class="calendar-head"><div><span class="section-meta">2026</span><div class="month">八月</div></div><div class="calendar-nav"><button class="icon-btn ghost" aria-label="上个月">${icons.left}</button><button class="icon-btn ghost" aria-label="下个月">${icons.right}</button></div></div><div class="week"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div><div class="dates">${dates.map(([date,className]) => `<button class="date ${className}">${date}</button>`).join('')}</div></section><div class="label-row reveal" style="--i:2"><span class="section-label">8 月 11 日</span><span class="section-meta">TODAY / 2 PLANS</span></div><section class="timeline reveal" style="--i:3"><div class="time-item"><div class="time-code">20:00 / PLANNED</div><div class="time-title">星际穿越</div><div class="time-note">吃完饭一起看 · 169 分钟</div></div><div class="time-item"><div class="time-code">ALL DAY / OPEN</div><div class="time-title">旅行纪录片</div><div class="time-note">时间未定 · 点击补充备注</div></div></section><section class="calendar-quiet reveal" style="--i:4"><span>${icons.sparkle}</span><div><strong>留一点空白</strong><p>提醒和重复计划稍后再做，第一版只保留真正需要的约定。</p></div></section></main>${nav('calendar')}${sheet()}${toast()}`;
  }

  function usPage() {
    return `${status()}<main class="page">${head('04 / TOGETHER','我们','共同观看的时间、记忆和关系设置。')}<section class="pair-hero reveal" style="--i:1"><div class="pair-orbit"><div class="orbit"></div><div class="avatar">梅</div><div class="avatar second">然</div><div class="pair-center"><strong>一起 128 天</strong><span>SINCE 2026.04.05</span></div></div><div class="pair-signal"><i class="live-dot"></i> 两个人都在线</div></section><div class="metrics us-metrics reveal" style="--i:2"><div class="metric"><strong>26.4h</strong><span>累计同看</span></div><div class="metric"><strong>32</strong><span>看完视频</span></div><div class="metric"><strong>18</strong><span>共享片库</span></div></div><div class="label-row reveal" style="--i:3"><span class="section-label">双人空间</span><span class="section-meta">PRIVATE / SYNCED</span></div><section class="stream-list reveal" style="--i:4">${row(icons.history,'共同观看历史','按月份回顾看过的内容','AUG')}${row(icons.archive,'过去的双人空间','解绑后保留的只读归档','0')}${row(icons.settings,'账号与设置','头像、主题、设备与退出登录',icons.right)}</section><button class="button danger full reveal" style="--i:5" data-sheet="unbind">解除好友绑定</button></main>${nav('us')}${sheet()}${toast()}`;
  }

  function syncControls() {
    document.querySelectorAll('#pageSwitch button').forEach((button) => button.classList.toggle('active', button.dataset.page === currentPage));
    document.querySelectorAll('#themeSwitch button').forEach((button) => button.classList.toggle('active', button.dataset.theme === currentTheme));
  }
  function render() {
    studio.classList.toggle('dark', currentTheme === 'dark');
    const pages = { login: loginPage, home: homePage, library: libraryPage, calendar: calendarPage, us: usPage };
    screen.innerHTML = pages[currentPage]();
    screen.querySelectorAll('.async-action').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        runAsync(button);
      });
    });
    syncControls();
  }
  function showToast(message) {
    const toastElement = screen.querySelector('.toast');
    if (!toastElement) return;
    toastElement.querySelector('span').textContent = message;
    toastElement.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastElement.classList.remove('show'), 1800);
  }
  function runAsync(button) {
    if (button.disabled) return;
    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span><span>正在处理</span>';
    setTimeout(() => {
      button.innerHTML = `${icons.check}<span>已完成</span>`;
      showToast(button.dataset.success || '操作已完成');
      setTimeout(() => { button.disabled = false; button.innerHTML = original; }, 900);
    }, 850);
  }
  document.getElementById('pageSwitch').addEventListener('click', (event) => {
    const button = event.target.closest('[data-page]');
    if (!button) return;
    currentPage = button.dataset.page;
    render();
  });
  document.getElementById('themeSwitch').addEventListener('click', (event) => {
    const button = event.target.closest('[data-theme]');
    if (!button) return;
    currentTheme = button.dataset.theme;
    render();
  });
  screen.addEventListener('click', (event) => {
    const navButton = event.target.closest('[data-nav]');
    if (navButton) { currentPage = navButton.dataset.nav; render(); return; }
    if (event.target.closest('.theme-local')) { currentTheme = currentTheme === 'light' ? 'dark' : 'light'; render(); return; }
    const filter = event.target.closest('.filter');
    if (filter) { screen.querySelectorAll('.filter').forEach((item) => item.classList.remove('active')); filter.classList.add('active'); return; }
    const date = event.target.closest('.date');
    if (date) { screen.querySelectorAll('.date').forEach((item) => item.classList.remove('active')); date.classList.add('active'); return; }
    if (event.target.closest('[data-sheet]')) { screen.classList.add('sheet-open'); return; }
    if (event.target.closest('.js-close')) { screen.classList.remove('sheet-open'); return; }
    if (event.target.closest('.js-confirm')) { screen.classList.remove('sheet-open'); showToast('已同步到双人空间'); return; }
    const asyncButton = event.target.closest('.async-action');
    if (asyncButton) { runAsync(asyncButton); return; }
    if (event.target.closest('.anonymous-entry')) { currentPage = 'home'; render(); }
  });
  const params = new URLSearchParams(location.search);
  if (['login','home','library','calendar','us'].includes(params.get('page'))) currentPage = params.get('page');
  if (['light','dark'].includes(params.get('theme'))) currentTheme = params.get('theme');
  render();
}
