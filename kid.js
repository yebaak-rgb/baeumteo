/* 우리집 배움터 — 아이 화면 */
(function () {
  'use strict';
  const X = window.EDU, S = X.SUBJECTS, esc = X.esc;
  const $ = (s, el) => (el || document).querySelector(s);
  const app = $('#app');
  const st = { code: X.store.get('code'), kids: [], family: {}, kid: null, day: X.ymd(), data: null, tab: 'today', items: [], browse: { subject: 'math', grade: null, track: 'history' } };

  /* ── 서버 호출 ── */
  async function rpc(fn, args) {
    const { data, error } = await X.sb().rpc(fn, args);
    if (error) throw error;
    if (data && data.error === 'bad_code') { X.store.del('code'); st.code = null; gateCode('가족코드가 바뀌었어요. 다시 입력해 주세요.'); throw new Error('bad_code'); }
    return data;
  }
  const log = (o) => rpc('edu_kid_log', { p_code: st.code, p_kid: st.kid.id, p_day: st.day, p_plan: o.plan || null, p_item_key: o.key || null,
    p_subject: o.subject || null, p_kind: o.kind || null, p_status: o.status, p_score: o.score == null ? null : o.score, p_total: o.total == null ? null : o.total, p_detail: o.detail || {} }).catch(e => { if (e.message !== 'bad_code') X.toast('저장하지 못했어요. 인터넷을 확인해 주세요'); });

  /* ── 시작 ── */
  async function boot() {
    if (!st.code) return gateCode();
    app.innerHTML = '<div class="spin"></div>';
    try {
      const d = await rpc('edu_kid_boot', { p_code: st.code });
      st.kids = d.kids || []; st.family = d.family || {};
      const saved = X.store.get('kid'); const k = st.kids.find(k => k.id === saved);
      if (k) { st.kid = k; await loadDay(); render(); } else gateProfile();
    } catch (e) { if (e.message !== 'bad_code') app.innerHTML = errBox(e); }
  }
  function errBox(e) { return '<div class="gate"><div class="box"><div style="font-size:52px">📡</div><h1>연결이 안 돼요</h1><p>인터넷 연결을 확인하고 다시 눌러 주세요.<br><small>' + esc(e.message || e) + '</small></p><button class="btn btn-primary btn-lg" onclick="location.reload()">다시 시도</button></div></div>'; }
  function stars() { let h = '<div class="stars">'; const r = X.rng('stars'); for (let i = 0; i < 40; i++) h += '<i style="left:' + (r() * 100) + '%;top:' + (r() * 100) + '%;opacity:' + (.2 + r() * .6) + '"></i>'; return h + '</div>'; }

  function gateCode(msg) {
    app.innerHTML = '<div class="gate">' + stars() + '<div class="box"><div style="font-size:56px">🏡</div><h1>우리집 배움터</h1><p>' + esc(msg || '엄마에게 받은 가족코드를 넣어 주세요. 이 태블릿에서는 한 번만 넣으면 돼요.') + '</p>' +
      '<input class="codein" id="code" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="가족코드"><br><button class="btn btn-primary btn-lg" id="go">시작하기</button></div></div>';
    const go = async () => { const v = $('#code').value.trim(); if (!v) return; st.code = v; X.store.set('code', v); boot(); };
    $('#go').onclick = go; $('#code').onkeydown = e => { if (e.key === 'Enter') go(); };
  }
  function gateProfile() {
    app.innerHTML = '<div class="gate">' + stars() + '<div class="box"><h1>누가 공부할까요?</h1><p>내 얼굴을 눌러 주세요</p><div class="profiles">' +
      st.kids.map(k => '<button class="prof" data-id="' + k.id + '"><span class="av" style="background:' + esc(k.color) + '22">' + esc(k.emoji) + '</span><b>' + esc(k.name) + '</b><small>' + X.gradeOf(k) + '학년</small></button>').join('') +
      '</div><p style="margin:22px 0 0"><a href="admin.html">엄마 페이지</a></p></div></div>';
    app.querySelectorAll('.prof').forEach(b => b.onclick = async () => { st.kid = st.kids.find(k => k.id === b.dataset.id); X.store.set('kid', st.kid.id); st.tab = 'today'; app.innerHTML = '<div class="spin"></div>'; await loadDay(); render(); });
  }

  async function loadDay() {
    st.day = X.ymd();
    st.data = await rpc('edu_kid_day', { p_code: st.code, p_kid: st.kid.id, p_day: st.day });
    st.done = new Set(st.data.done || []);
    st.over = {}; st.mats = {};
    (st.data.materials || []).forEach(m => { if (m.body && m.body.lib_id) st.over[m.body.lib_id] = m; else st.mats[m.id] = m; });
    buildItems();
  }

  /* ── 오늘 할 일 목록 만들기 ── */
  function buildItems() {
    const kid = st.kid, d = X.parseYmd(st.day), sem = X.semester(d), logs = st.data.logs || [];
    const skip = new Set(); const items = [];
    (st.data.plans || []).forEach(p => {
      const myLogs = logs.filter(l => l.plan_id === p.id);
      const doneLog = myLogs.filter(l => l.status === 'done').pop();
      const it = { plan: p.id, kind: p.kind, subject: p.subject, done: !!doneLog, watched: myLogs.some(l => l.status === 'watched'), payload: p.payload || {}, doneLog };
      if (p.kind === 'task') { it.title = p.title; it.byKid = !!(p.payload && p.payload.by_kid); items.push(it); return; }
      if (p.kind === 'link') { it.subject = 'link'; it.title = p.title || '엄마가 고른 강의'; it.url = p.payload.url; it.key = 'URL:' + p.id; items.push(it); return; }
      const level = X.levelOf(kid, p.subject, d);
      it.level = level;
      if (p.kind === 'drill') {
        const tid = (p.ref && p.ref !== 'auto' && X.CALC_MAP[p.ref]) ? p.ref : X.autoCalcTopic(level, st.day, sem).id;
        it.subject = 'calc'; it.topic = X.CALC_MAP[tid]; it.count = Number(p.payload.count) || 10; it.key = 'CALC:' + tid; it.title = it.topic.name; items.push(it); return;
      }
      if (p.ref && p.ref.startsWith('MAT:')) { const m = st.mats[p.ref.slice(4)]; if (!m) return; it.mat = m; it.subject = m.subject || 'link'; it.title = m.title; it.key = 'MAT:' + m.id; items.push(it); return; }
      let lib = null;
      if (doneLog && doneLog.item_key && X.LIB_MAP[doneLog.item_key]) lib = X.LIB_MAP[doneLog.item_key];
      else if (p.ref && p.ref !== 'next' && X.LIB_MAP[p.ref]) lib = X.LIB_MAP[p.ref];
      else lib = X.nextItem(p.subject, level, sem, st.done, p.subject === 'soc' ? (p.payload.track || 'history') : null, skip);
      if (!lib) return;
      skip.add(lib.id); it.lib = lib; it.key = lib.id; it.title = lib.title; items.push(it);
    });
    st.items = items;
  }

  /* ── 공통 레이아웃 ── */
  function render() {
    const rv = (st.data.review || []).length;
    const tabs = [['today', '오늘의 학습'], ['subjects', '과목별 공부'], ['review', '다시 풀기' + (rv ? '<span class="cnt">' + rv + '</span>' : '')], ['room', '나의 공부방']];
    app.innerHTML = '<header class="topbar"><div class="wrap"><div class="logo"><span class="mark">🏡</span><span>우리집 배움터</span></div><nav class="nav">' +
      tabs.map(t => '<button data-t="' + t[0] + '" class="' + (st.tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>').join('') + '</nav>' +
      '<button class="kidchip" id="who"><span class="av" style="background:' + esc(st.kid.color) + '22">' + esc(st.kid.emoji) + '</span>' + esc(st.kid.name) + ' <small>' + X.gradeOf(st.kid) + '학년</small></button></div></header><main class="wrap" id="main"></main>' +
      '<footer class="foot"><div class="wrap">우리집 배움터 · EBS 강의는 EBS 초등 공식 사이트에서 열려요 · <a href="admin.html">엄마 페이지</a></div></footer>';
    app.querySelectorAll('.nav button').forEach(b => b.onclick = () => { st.tab = b.dataset.t; render(); window.scrollTo(0, 0); });
    $('#who').onclick = gateProfile;
    ({ today: viewToday, subjects: viewSubjects, review: viewReview, room: viewRoom })[st.tab]();
  }

  function card(it, i) {
    const s = S[it.subject] || S.link;
    const sub = s.name + (it.level ? ' · ' + it.level + '학년' + (it.lib && it.lib.sem ? ' ' + it.lib.sem + '학기' : '') : '');
    const mins = it.kind === 'drill' ? Math.max(5, Math.round(it.count * .7)) : s.min;
    return '<button class="card lcard s-' + (S[it.subject] ? it.subject : 'link') + (it.done ? ' done' : '') + '" data-i="' + i + '"><div class="band"><span class="dots"></span><span class="emo">' + s.emoji + '</span></div>' +
      (it.done ? '<span class="stamp">참 잘<br>했어요</span>' : '') +
      '<div class="body"><span class="sub">' + esc(sub) + '</span><span class="ttl">' + esc(it.title) + '</span><div class="meta"><span>⏱ 약 ' + mins + '분' + (it.kind === 'drill' ? ' · ' + it.count + '문제' : '') + '</span><span class="go">' + (it.done ? '완료 ✓' : (it.watched ? '이어하기 →' : '시작 →')) + '</span></div></div></button>';
  }

  function viewToday() {
    const learn = st.items.filter(i => i.kind !== 'task'), tasks = st.items.filter(i => i.kind === 'task');
    const total = st.items.length, done = st.items.filter(i => i.done).length, pct = total ? done / total : 0;
    const goal = st.family.reward_goal || 30, stamps = st.data.stamps || 0;
    const hour = new Date().getHours(); const hi = hour < 12 ? '좋은 아침이에요' : hour < 18 ? '오늘도 반가워요' : '오늘 하루 수고 많았어요';
    const C = 2 * Math.PI * 34;
    const r = X.rng(st.day); const stk = ['⭐', '✏️', '📚', '🌙', '🔭', '🎈'].map((e, i) => '<span class="stk" style="left:' + (44 + r() * 9) + '%;top:' + (8 + i * 15) + '%;font-size:' + (18 + r() * 14) + 'px;opacity:.8">' + e + '</span>').join('');
    let h = '<section class="hero">' + stars() + stk + '<div><div class="date">' + X.fmtDate(st.day) + '</div><h1>' + esc(st.kid.name) + ', ' + hi + '! ' + esc(st.kid.emoji) + '</h1>' +
      '<p>' + (total ? (done === total ? '오늘 할 일을 모두 끝냈어요. 정말 멋져요! 🎉' : '오늘은 ' + total + '가지를 해요. 하나씩 차근차근 해 볼까요?') : '오늘은 엄마가 정한 공부가 없어요. 과목별 공부에서 골라 봐도 좋아요.') + '</p>' +
      '<div class="acts">' + (learn.some(i => !i.done) ? '<button class="btn btn-primary btn-lg" id="start">오늘 공부 시작하기 →</button>' : '') + (tasks.length ? '<button class="btn btn-secondary btn-lg" id="tochk">체크리스트</button>' : '') + '</div></div>' +
      '<div class="hero-side"><h3>오늘의 진행</h3><div class="ring"><svg width="84" height="84" viewBox="0 0 84 84"><circle cx="42" cy="42" r="34" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="10"/><circle cx="42" cy="42" r="34" fill="none" stroke="#62aef0" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="' + (C * (1 - pct)) + '" transform="rotate(-90 42 42)"/></svg><div><b>' + done + ' / ' + total + '</b><div style="opacity:.75;font-size:14px">끝낸 일</div></div></div>' +
      '<div class="reward">🏅 칭찬 도장 <b>' + stamps + '</b> / ' + goal + '<div class="bar"><i style="width:' + Math.min(100, stamps / goal * 100) + '%"></i></div><div style="margin-top:8px;opacity:.8">' + esc(st.family.reward_text || '') + '</div></div></div></section>';
    h += '<div class="sec-h"><h2>오늘의 학습</h2><span>' + learn.filter(i => i.done).length + ' / ' + learn.length + ' 완료</span></div>';
    h += learn.length ? '<div class="grid g3">' + learn.map(it => card(it, st.items.indexOf(it))).join('') + '</div>' : '<div class="empty"><div class="e">🌱</div>오늘 정해진 학습이 없어요.</div>';
    h += '<div class="sec-h" id="chk"><h2>오늘의 체크리스트</h2><span>학원·학교 숙제, 연산 문제집도 끝나면 체크!</span></div><div class="card checks">' +
      tasks.map(it => '<div class="chk' + (it.done ? ' on' : '') + '" data-i="' + st.items.indexOf(it) + '"><button class="box" aria-label="체크">' + (it.done ? '✓' : '') + '</button><span class="t">' + esc(it.title) + '</span>' + (it.payload.note ? '<span class="who">' + esc(it.payload.note) + '</span>' : '') + (it.byKid ? '<span class="who">내가 추가</span><button class="btn-ghost" data-del="' + it.plan + '">✕</button>' : '') + '</div>').join('') +
      (tasks.length ? '' : '<div class="chk"><span class="t" style="color:var(--muted);font-weight:500">오늘 체크할 일이 없어요</span></div>') +
      '<div class="addrow"><input id="newtask" maxlength="60" placeholder="선생님이 내 준 숙제를 직접 적어도 돼요"><button class="btn btn-primary" id="addtask">추가</button></div></div>';
    $('#main').innerHTML = h;
    $('#main').querySelectorAll('.lcard').forEach(b => b.onclick = () => openItem(st.items[+b.dataset.i]));
    const s = $('#start'); if (s) s.onclick = () => { const n = learn.find(i => !i.done); if (n) openItem(n); };
    const tc = $('#tochk'); if (tc) tc.onclick = () => $('#chk').scrollIntoView({ behavior: 'smooth' });
    $('#main').querySelectorAll('.chk[data-i] .box').forEach(b => b.onclick = async () => {
      const it = st.items[+b.parentNode.dataset.i]; it.done = !it.done; viewToday();
      await log({ plan: it.plan, key: 'TASK:' + it.plan, subject: 'etc', kind: 'task', status: it.done ? 'done' : 'undone', detail: { title: it.title } });
      if (it.done) X.toast('잘했어요! 도장 하나 꾹 🏅'); await refresh();
    });
    $('#main').querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { await rpc('edu_kid_task', { p_code: st.code, p_kid: st.kid.id, p_day: st.day, p_action: 'delete', p_title: null, p_plan: b.dataset.del }); await refresh(); });
    const add = async () => { const v = $('#newtask').value.trim(); if (!v) return; $('#addtask').disabled = true; await rpc('edu_kid_task', { p_code: st.code, p_kid: st.kid.id, p_day: st.day, p_action: 'add', p_title: v, p_plan: null }); await refresh(); X.toast('체크리스트에 넣었어요'); };
    $('#addtask').onclick = add; $('#newtask').onkeydown = e => { if (e.key === 'Enter') add(); };
  }
  async function refresh() { try { await loadDay(); render(); } catch (e) { } }

  /* ── 과목별 공부 ── */
  function viewSubjects() {
    const b = st.browse, kid = st.kid;
    if (!b.grade) b.grade = X.levelOf(kid, b.subject);
    let h = '<div class="sec-h"><h2>과목별 공부</h2><span>더 공부하고 싶은 과목을 골라요</span></div><div class="grid g6">' +
      X.SUBJECT_ORDER.map(k => '<button class="stile' + (b.subject === k ? ' on' : '') + '" data-s="' + k + '"><span class="ic" style="background:' + S[k].bg + '">' + S[k].emoji + '</span>' + S[k].name + '</button>').join('') + '</div>';
    h += '<div class="sec-h"><div class="tabs">' + [1, 2, 3, 4, 5, 6].map(g => '<button data-g="' + g + '" class="' + (b.grade === g ? 'on' : '') + '">' + g + '학년</button>').join('') + '</div>' +
      (b.subject === 'soc' ? '<div class="tabs"><button data-tr="history" class="' + (b.track === 'history' ? 'on' : '') + '">이야기 한국사</button><button data-tr="social" class="' + (b.track === 'social' ? 'on' : '') + '">사회</button></div>' : '') + '</div>';
    let rows = '';
    if (b.subject === 'calc') {
      rows = X.CALC.filter(c => c[1] === b.grade).map((c, i) => '<button class="urow" data-calc="' + c[0] + '"><span class="no">' + (i + 1) + '</span><span class="t"><b>' + esc(c[3]) + '</b><small>' + c[1] + '학년 ' + c[2] + '학기 · 10문제 · 풀 때마다 새 문제</small></span>' + (st.done.has('CALC:' + c[0]) ? '<span class="ok">✓</span>' : '') + '<span class="go" style="color:var(--primary);font-weight:700">풀기 →</span></button>').join('');
    } else {
      const list = X.libList(b.subject, b.grade, b.subject === 'soc' ? b.track : null);
      rows = list.map((x, i) => '<button class="urow" data-id="' + x.id + '"><span class="no">' + (i + 1) + '</span><span class="t"><b>' + esc(x.title) + '</b><small>' + (x.sem ? x.sem + '학기 · ' : '') + esc(x.goal || x.era || '') + '</small></span>' + (st.done.has(x.id) ? '<span class="ok">✓ 완료</span>' : '') + '</button>').join('');
      if (!list.length) rows = '<div class="urow"><span class="t" style="color:var(--muted)">이 학년 자료는 준비 중이에요</span></div>';
    }
    h += '<div class="card ulist">' + rows + '</div>';
    $('#main').innerHTML = h;
    $('#main').querySelectorAll('[data-s]').forEach(x => x.onclick = () => { b.subject = x.dataset.s; b.grade = X.levelOf(kid, b.subject); viewSubjects(); });
    $('#main').querySelectorAll('[data-g]').forEach(x => x.onclick = () => { b.grade = +x.dataset.g; viewSubjects(); });
    $('#main').querySelectorAll('[data-tr]').forEach(x => x.onclick = () => { b.track = x.dataset.tr; viewSubjects(); });
    $('#main').querySelectorAll('[data-id]').forEach(x => x.onclick = () => { const lib = X.LIB_MAP[x.dataset.id]; openItem({ kind: 'lesson', subject: lib.subject, lib, key: lib.id, title: lib.title, level: b.grade, free: true }); });
    $('#main').querySelectorAll('[data-calc]').forEach(x => x.onclick = () => { const t = X.CALC_MAP[x.dataset.calc]; openItem({ kind: 'drill', subject: 'calc', topic: t, count: 10, key: 'CALC:' + t.id, title: t.name, level: t.grade, free: true, seed: String(Date.now()) }); });
  }

  /* ── 다시 풀기 ── */
  function viewReview() {
    const list = st.data.review || [];
    let h = '<div class="sec-h"><h2>다시 풀기</h2><span>틀렸던 문제를 한 번에 맞히면 목록에서 사라져요</span></div>';
    if (!list.length) { $('#main').innerHTML = h + '<div class="empty"><div class="e">🌈</div>다시 풀 문제가 없어요. 아주 잘하고 있어요!</div>'; return; }
    h += '<div class="card pad" style="display:flex;align-items:center;gap:18px;margin-bottom:16px"><div style="font-size:44px">🔁</div><div style="flex:1"><b style="font-size:20px">' + list.length + '문제가 기다려요</b><div style="color:var(--muted)">천천히 다시 생각해 봐요</div></div><button class="btn btn-primary btn-lg" id="rvgo">다시 풀기 시작</button></div>';
    h += '<div class="card ulist">' + list.map((r, i) => '<div class="urow"><span class="no">' + (S[r.subject] || S.link).emoji + '</span><span class="t"><b>' + X.fracHtml(String(r.q.q).slice(0, 70)) + '</b><small>' + esc((S[r.subject] || S.link).name) + (r.wrong_count > 1 ? ' · ' + r.wrong_count + '번 틀림' : '') + '</small></span></div>').join('') + '</div>';
    $('#main').innerHTML = h;
    $('#rvgo').onclick = () => openReview(list.slice(0, 10));
  }

  /* ── 나의 공부방 ── */
  async function viewRoom() {
    const now = X.parseYmd(st.day), y = now.getFullYear(), m = now.getMonth();
    const first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
    $('#main').innerHTML = '<div class="spin"></div>';
    let rows = [];
    try { rows = await rpc('edu_kid_history', { p_code: st.code, p_kid: st.kid.id, p_from: X.ymd(first), p_to: X.ymd(last) }) || []; } catch (e) { }
    const byDay = {}; rows.forEach(r => { byDay[r.day] = (byDay[r.day] || 0) + 1; });
    const bySub = {}; rows.forEach(r => { const k = r.kind === 'task' ? 'etc' : (r.subject || 'etc'); bySub[k] = (bySub[k] || 0) + 1; });
    const goal = st.family.reward_goal || 30, stamps = st.data.stamps || 0;
    let h = '<div class="sec-h"><h2>' + esc(st.kid.name) + '의 공부방</h2><span>' + (m + 1) + '월에 모은 기록</span></div>';
    h += '<div class="grid g2"><div class="card pad"><h3 style="margin:0 0 6px">🏅 칭찬 도장</h3><div style="font-size:40px;font-weight:800;letter-spacing:-1px">' + stamps + ' <span style="font-size:20px;color:var(--muted)">/ ' + goal + '</span></div><div class="bar" style="background:var(--paper)"><i style="width:' + Math.min(100, stamps / goal * 100) + '%"></i></div><p style="color:var(--muted);margin:10px 0 0">' + esc(st.family.reward_text || '') + '</p></div>' +
      '<div class="card pad"><h3 style="margin:0 0 6px">📅 이번 달 공부한 날</h3><div style="font-size:40px;font-weight:800;letter-spacing:-1px">' + Object.keys(byDay).length + '일</div><p style="color:var(--muted);margin:6px 0 0">끝낸 일 모두 ' + rows.length + '개 · 다른 사람이 아니라 어제의 나와 비교해요</p></div></div>';
    h += '<div class="sec-h"><h2>과목별로 끝낸 것</h2></div><div class="statrow">' + X.SUBJECT_ORDER.map(k => '<div class="stat"><div class="e">' + S[k].emoji + '</div><b>' + (bySub[k] || 0) + '</b><small>' + S[k].short + '</small></div>').join('') + '</div>';
    h += '<div class="sec-h"><h2>' + (m + 1) + '월 도장 달력</h2></div><div class="card pad"><div class="cal">' + X.WD.map(w => '<div class="wd">' + w + '</div>').join('');
    for (let i = 0; i < first.getDay(); i++) h += '<div></div>';
    for (let d = 1; d <= last.getDate(); d++) { const k = X.ymd(new Date(y, m, d)); const c = byDay[k] || 0; h += '<div class="d' + (k === st.day ? ' today' : '') + '"><span class="n">' + d + '</span>' + (c ? '<span class="s">' + (c >= 4 ? '🌟' : '⭐') + '</span><span class="c">' + c + '</span>' : '') + '</div>'; }
    $('#main').innerHTML = h + '</div></div>';
  }

  /* ════════ 학습 진행 화면 ════════ */
  let P = null; // 현재 진행 상태
  function shell(title, stepIdx, stepN) {
    let el = $('.player'); if (!el) { el = document.createElement('div'); el.className = 'player'; document.body.appendChild(el); }
    el.innerHTML = '<div class="ph"><button class="btn btn-ghost" id="px">← 나가기</button><span class="ttl">' + esc(title) + '</span><span class="steps">' + Array.from({ length: stepN }, (_, i) => '<i class="' + (i < stepIdx ? 'done' : i === stepIdx ? 'on' : '') + '"></i>').join('') + '</span></div><div class="pb"><div class="pin" id="pin"></div></div><div class="pf" id="pf"></div>';
    $('#px').onclick = closePlayer;
    return el;
  }
  function closePlayer() { try { speechSynthesis.cancel(); } catch (e) { } document.removeEventListener('keydown', keyHandler); const el = $('.player'); if (el) el.remove(); P = null; refresh(); }

  function openItem(it) {
    P = { it, step: 0 };
    if (it.kind === 'drill') return startQuiz(X.makeCalc(it.topic.id, it.count, it.seed || (st.day + st.kid.id)).questions, { tip: it.topic.tip, steps: 2, idx: 0 });
    if (it.kind === 'link' || it.mat) return viewLink(it);
    const lib = it.lib; if (!lib) return;
    if (lib.subject === 'word') return viewWords(lib);
    viewLearn(lib);
  }

  function ebsBox(lib, it) {
    const ov = it.payload && it.payload.url ? { [lib.id]: { url: it.payload.url, title: it.payload.url_title } } : st.over;
    const e = X.ebsFor(lib, it.level, ov); if (!e) return '';
    return '<div class="ebsbox"><span class="lg">EBS</span><span class="t"><b>' + esc(e.label) + '</b><small>' + (e.exact ? '엄마가 골라 둔 강의예요' : '강좌 목록에서 「' + esc(lib.title) + '」 강의를 찾아 들어요') + ' · EBS 로그인 필요</small></span>' +
      '<a class="btn btn-secondary" id="ebsgo" href="' + esc(e.url) + '" target="_blank" rel="noopener">강의 보기 ↗</a>' + (it.watched ? '<span class="watched">✓ 봤어요</span>' : '<button class="btn btn-util" id="ebsdone">강의 보고 왔어요</button>') + '</div>';
  }
  function bindEbs(it) {
    const g = $('#ebsgo'); if (g) g.onclick = () => log({ plan: it.plan, key: it.key, subject: it.subject, kind: it.kind, status: 'opened', detail: { title: it.title } });
    const d = $('#ebsdone'); if (d) d.onclick = () => { it.watched = true; d.outerHTML = '<span class="watched">✓ 봤어요</span>'; log({ plan: it.plan, key: it.key, subject: it.subject, kind: it.kind, status: 'watched', detail: { title: it.title } }); X.toast('좋아요! 이제 문제를 풀어 봐요'); };
  }
  function head(lib, it) {
    const s = S[lib.subject];
    return '<div class="lesson-h"><span class="ic" style="background:' + s.bg + '">' + s.emoji + '</span><div><span class="pill">' + s.name + ' · ' + (it.level || lib.grades[0]) + '학년' + (lib.sem ? ' ' + lib.sem + '학기' : '') + (lib.era ? ' · ' + esc(lib.era) : '') + '</span><h2>' + esc(lib.title) + '</h2>' + (lib.goal ? '<div class="goal">🎯 ' + esc(lib.goal) + '</div>' : '') + '</div></div>';
  }

  function viewLearn(lib) {
    const it = P.it; shell(lib.title, 0, 3);
    let h = head(lib, it);
    if (lib.subject === 'read') {
      h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b>' + esc(lib.genre || '') + '</b><button class="btn btn-util" id="readko">🔊 읽어 주기</button></div><div class="passage">' + esc(lib.passage) + '</div>';
      if (lib.words && lib.words.length) h += '<div class="wordbox">' + lib.words.map(w => '<span><b>' + esc(w.w) + '</b> : ' + esc(w.mean) + '</span>').join('') + '</div>';
      h += '<p style="color:var(--muted)">💡 소리 내어 한 번 읽고, 문제를 풀어 봐요.</p>';
    } else if (lib.subject === 'eng') {
      h += '<h3>오늘의 표현</h3><div class="expr">' + (lib.expressions || []).map((e, i) => '<div class="e"><button class="say" data-say="' + esc(e.en) + '">🔊</button><div><b>' + esc(e.en) + '</b><small style="color:var(--muted)">' + esc(e.ko) + '</small></div></div>').join('') + '</div>';
      h += '<div style="display:flex;justify-content:space-between;align-items:center"><h3>대화 듣기</h3><button class="btn btn-util" id="dlgall">🔊 전체 듣기</button></div><div class="dlg">' + (lib.dialog || []).map(l => '<div class="ln"><span class="w" style="background:' + (l.who === 'A' ? '#cfe6fb' : '#ffd3ef') + '">' + esc(l.who) + '</span><span class="tx"><b>' + esc(l.en) + '</b><small>' + esc(l.ko) + '</small></span><button class="say" data-say="' + esc(l.en) + '">🔊</button></div>').join('') + '</div>';
      if (lib.tip) h += '<div class="example">💡 ' + esc(lib.tip) + '</div>';
    } else {
      const paras = lib.explain || lib.story || [];
      h += '<div class="explain">' + paras.map(p => '<p>' + X.fracHtml(p) + '</p>').join('') + '</div>';
      if (lib.people && lib.people.length) h += '<div class="wordbox">' + lib.people.map(p => '<span>👤 <b>' + esc(p.name) + '</b> — ' + esc(p.desc) + '</span>').join('') + '</div>';
      if (lib.example) h += '<div class="example"><b>✏️ 예제</b><div style="font-size:20px;margin-top:6px">' + X.fracHtml(lib.example.q) + '</div><ol id="steps" class="hidden">' + (lib.example.steps || []).map(s => '<li>' + X.fracHtml(s) + '</li>').join('') + '</ol><div id="exa" class="hidden" style="margin-top:8px;font-weight:800">답: ' + X.fracHtml(lib.example.a) + '</div><button class="btn btn-util" id="showsteps" style="margin-top:10px">풀이 보기</button></div>';
      h += '<button class="btn btn-util" id="readko" style="margin-bottom:6px">🔊 설명 읽어 주기</button>';
    }
    h += ebsBox(lib, it);
    $('#pin').innerHTML = h;
    $('#pf').innerHTML = '<button class="btn btn-primary btn-lg" id="toq">문제 풀러 가기 →</button>';
    bindEbs(it);
    document.querySelectorAll('[data-say]').forEach(b => b.onclick = () => X.speak(b.dataset.say, 'en-US'));
    const da = $('#dlgall'); if (da) da.onclick = () => X.speak((lib.dialog || []).map(l => l.en).join(' '), 'en-US');
    const rk = $('#readko'); if (rk) rk.onclick = () => X.speak(lib.passage || (lib.explain || lib.story || []).join(' '), 'ko-KR');
    const ss = $('#showsteps'); if (ss) ss.onclick = () => { $('#steps').classList.remove('hidden'); $('#exa').classList.remove('hidden'); ss.remove(); };
    $('#toq').onclick = () => startQuiz(lib.questions || [], { steps: 3, idx: 1 });
  }

  function viewLink(it) {
    const m = it.mat || {}; const url = it.url || m.url; shell(it.title, 0, (m.body && m.body.questions && m.body.questions.length) ? 3 : 2);
    let h = '<div class="lesson-h"><span class="ic" style="background:' + (S[it.subject] || S.link).bg + '">🎬</span><div><span class="pill">엄마가 고른 강의</span><h2>' + esc(it.title) + '</h2>' + (m.goal ? '<div class="goal">🎯 ' + esc(m.goal) + '</div>' : '') + '</div></div>';
    if (m.memo || (it.payload && it.payload.note)) h += '<div class="example">📝 ' + esc(m.memo || it.payload.note) + '</div>';
    if (m.body && m.body.explain) h += '<div class="explain">' + m.body.explain.map(p => '<p>' + X.fracHtml(p) + '</p>').join('') + '</div>';
    if (url) h += '<div class="ebsbox"><span class="lg">▶</span><span class="t"><b>강의 보러 가기</b><small>새 창에서 열려요. 다 보고 이 화면으로 돌아와요.</small></span><a class="btn btn-secondary" id="ebsgo" href="' + esc(url) + '" target="_blank" rel="noopener">강의 보기 ↗</a></div>';
    $('#pin').innerHTML = h;
    const hasQ = m.body && m.body.questions && m.body.questions.length;
    $('#pf').innerHTML = hasQ ? '<button class="btn btn-primary btn-lg" id="toq">문제 풀러 가기 →</button>' : '<button class="btn btn-primary btn-lg" id="fin">강의 다 봤어요 ✓</button>';
    const g = $('#ebsgo'); if (g) g.onclick = () => log({ plan: it.plan, key: it.key, subject: it.subject, kind: it.kind, status: 'opened', detail: { title: it.title } });
    if (hasQ) $('#toq').onclick = () => startQuiz(m.body.questions, { steps: 3, idx: 1 });
    else $('#fin').onclick = () => finish([]);
  }

  /* 영어 단어: 카드 → 퀴즈 */
  function viewWords(lib) {
    const it = P.it, W = lib.words || []; let i = 0;
    const draw = () => {
      shell(lib.title, 0, 3); const w = W[i];
      $('#pin').innerHTML = head(lib, it) + '<div class="qhead" style="margin-bottom:10px"><span>단어 카드 ' + (i + 1) + ' / ' + W.length + '</span><span>🔊를 누르고 따라 말해 봐요</span></div>' +
        '<div class="wcard">' + (w.emoji ? '<div class="em">' + esc(w.emoji) + '</div>' : '') + '<div class="en">' + esc(w.en) + '</div><div class="ko">' + esc(w.ko) + '</div><div style="margin-top:14px"><button class="say" id="sw">🔊</button></div>' +
        (w.ex ? '<div class="ex">' + esc(w.ex) + ' <button class="say" id="se" style="width:40px;height:40px;font-size:18px">🔊</button><small>' + esc(w.ex_ko || '') + '</small></div>' : '') + '</div>' + (i === 0 ? ebsBox(lib, it) : '');
      $('#pf').innerHTML = (i > 0 ? '<button class="btn btn-secondary btn-lg" id="prev">← 이전</button>' : '') + (i < W.length - 1 ? '<button class="btn btn-primary btn-lg" id="next">다음 단어 →</button>' : '<button class="btn btn-primary btn-lg" id="toq">단어 퀴즈 시작 →</button>');
      $('#sw').onclick = () => X.speak(w.en, 'en-US'); const se = $('#se'); if (se) se.onclick = () => X.speak(w.ex, 'en-US');
      const p = $('#prev'); if (p) p.onclick = () => { i--; draw(); };
      const n = $('#next'); if (n) n.onclick = () => { i++; draw(); };
      const q = $('#toq'); if (q) q.onclick = () => startQuiz(wordQuiz(lib), { steps: 3, idx: 1 });
      bindEbs(it); setTimeout(() => X.speak(w.en, 'en-US'), 250);
    };
    draw();
  }
  function wordQuiz(lib) {
    const r = X.rng(st.day + lib.id), W = lib.words || [], qs = [];
    const order = X.shuffle(W, r);
    order.forEach((w, k) => {
      const others = X.shuffle(W.filter(x => x !== w), r).slice(0, 3);
      if (k >= order.length - 3) { qs.push({ type: 'text', q: (w.emoji ? w.emoji + '  ' : '') + '「' + w.ko + '」을(를) 영어로 써 보세요', answer: [w.en, w.en.toLowerCase()], explain: w.ko + ' = ' + w.en, say: w.en, sayAfter: true }); return; }
      if (k % 2 === 0) { const ch = X.shuffle([w].concat(others), r); qs.push({ type: 'choice', q: '「' + w.en + '」의 뜻은?', choices: ch.map(x => x.ko), answer: ch.indexOf(w), explain: w.en + ' = ' + w.ko, say: w.en }); }
      else { const ch = X.shuffle([w].concat(others), r); qs.push({ type: 'choice', q: '🔊 소리를 듣고 알맞은 단어를 골라요', choices: ch.map(x => x.en), answer: ch.indexOf(w), explain: '들린 단어는 ' + w.en + ' (' + w.ko + ')', say: w.en, autoSay: true }); }
    });
    return qs;
  }

  /* 다시 풀기 */
  function openReview(list) {
    P = { it: { kind: 'review', title: '다시 풀기', subject: 'etc' }, review: list };
    startQuiz(list.map(r => Object.assign({}, r.q, { _rid: r.id, _key: r.item_key, _sub: r.subject })), { steps: 2, idx: 0 });
  }

  /* ════════ 문제 풀기 엔진 ════════ */
  let keyHandler = () => { };
  function startQuiz(questions, opt) {
    const it = P.it; P.q = { list: questions, i: 0, res: [], opt };
    if (!questions.length) return finish([]);
    const t0 = Date.now(); P.q.t0 = t0;
    drawQ();
  }
  function drawQ() {
    const it = P.it, Q = P.q, q = Q.list[Q.i]; Q.try = 0; Q.input = q.type === 'qr' ? ['', ''] : ''; Q.focus = 0; Q.locked = false; Q.wrongPicks = [];
    shell(it.title, Q.opt.idx, Q.opt.steps);
    const txt = q.q + ' ' + String(q.answer), kSlash = /\d\/\d|분수/.test(txt), kDot = /\d\.\d|소수/.test(txt), kSp = / \d+\/\d/.test(txt) || /대분수/.test(txt);
    const isNum = q.type === 'number' || q.type === 'qr';
    let h = '<div class="qwrap">' + (Q.opt.tip && Q.i === 0 ? '<div class="fb retry" style="background:#eef6fe;color:#0b4a8a"><span class="x">💡</span><span>' + X.fracHtml(Q.opt.tip) + '</span></div>' : '') +
      '<div class="qhead"><span>문제 ' + (Q.i + 1) + ' / ' + Q.list.length + '</span><span class="timer" id="tm"></span></div><div class="qcard' + (isNum ? ' numq' : '') + '">' + (isNum ? '<div class="nl">' : '') + '<div class="qtext' + (q.big ? ' big' : '') + '">' + X.fracHtml(q.q) + '</div>' +
      (q.say ? '<div style="margin-top:12px' + (q.big ? ';text-align:center' : '') + '"><button class="say" id="qsay">🔊</button></div>' : '');
    if (q.type === 'choice') h += '<div class="choices">' + q.choices.map((c, k) => '<button class="choice" data-k="' + k + '"><span class="n">' + (k + 1) + '</span><span>' + X.fracHtml(c) + '</span></button>').join('') + '</div>';
    else if (q.type === 'text') h += '<div class="ansline"><input class="txtans" id="ta" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="여기에 써요"><button class="btn btn-primary btn-lg" id="tok">확인</button></div>';
    else {
      h += '<div class="ansline">' + (q.type === 'qr' ? '<span style="font-weight:700">몫</span><div class="ansbox sm focus" data-f="0"></div><span style="font-weight:700">나머지</span><div class="ansbox sm dim" data-f="1"></div>' : '<div class="ansbox focus" data-f="0"></div>') + '</div>';
      if (q.hint) h += '<p style="text-align:center;color:var(--muted);margin:10px 0 0">' + esc(q.hint) + '</p>';
      h += '<div id="fb"></div></div><div class="keypad">' + ['7', '8', '9', '⌫', '4', '5', '6', kSlash ? '/' : '', '1', '2', '3', kDot ? '.' : '', kSp ? '␣' : '', '0', '', 'OK'].map(k => k === '' ? '<span></span>' : '<button data-key="' + k + '" class="' + (k === 'OK' ? 'ok' : (k === '⌫' || k === '/' || k === '.' || k === '␣') ? 'fn' : '') + '">' + (k === 'OK' ? '확인' : k === '␣' ? '띄우기' : k === '/' ? '분수 /' : k) + '</button>').join('') + '</div>';
    }
    h += '</div>' + (isNum ? '' : '<div id="fb"></div>') + '</div>';
    $('#pin').innerHTML = h; $('#pf').innerHTML = '';
    paintAns();
    const tm = $('#tm'); if (it.kind === 'drill') { const tick = () => { if (!document.body.contains(tm)) return; const s = Math.floor((Date.now() - Q.t0) / 1000); tm.textContent = '⏱ ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); setTimeout(tick, 1000); }; tick(); }
    const qs = $('#qsay'); if (qs) { qs.onclick = () => X.speak(q.say, 'en-US'); if (q.autoSay) setTimeout(() => X.speak(q.say, 'en-US'), 300); }
    document.querySelectorAll('.choice').forEach(b => b.onclick = () => { if (Q.locked || b.disabled) return; submit(+b.dataset.k, b); });
    const ta = $('#ta'); if (ta) { setTimeout(() => ta.focus(), 50); $('#tok').onclick = () => submit(ta.value); ta.onkeydown = e => { if (e.key === 'Enter') submit(ta.value); }; }
    document.querySelectorAll('.ansbox').forEach(b => b.onclick = () => { Q.focus = +b.dataset.f; paintAns(); });
    document.querySelectorAll('[data-key]').forEach(b => b.onclick = () => press(b.dataset.key));
    document.removeEventListener('keydown', keyHandler);
    keyHandler = e => { if (q.type === 'text' || q.type === 'choice') { if (q.type === 'choice' && /^[1-4]$/.test(e.key)) { const b = document.querySelector('.choice[data-k="' + (+e.key - 1) + '"]'); if (b) b.click(); } return; } if (/^[0-9]$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('⌫'); else if (e.key === 'Enter') press('OK'); else if (e.key === '/' || e.key === '.') press(e.key); else if (e.key === ' ') { e.preventDefault(); press('␣'); } else if (e.key === 'Tab' && q.type === 'qr') { e.preventDefault(); Q.focus = 1 - Q.focus; paintAns(); } };
    document.addEventListener('keydown', keyHandler);
  }
  function paintAns() {
    const Q = P.q; document.querySelectorAll('.ansbox').forEach(b => { const f = +b.dataset.f; const v = Array.isArray(Q.input) ? Q.input[f] : Q.input; b.innerHTML = v ? X.fracHtml(v.replace(/ /g, '  ')) : '<span class="ph">?</span>'; b.classList.toggle('focus', f === Q.focus); b.classList.toggle('dim', f !== Q.focus); });
  }
  function press(k) {
    const Q = P.q; if (!Q || Q.locked) return; const q = Q.list[Q.i];
    if (k === 'OK') return submit(Q.input);
    let v = Array.isArray(Q.input) ? Q.input[Q.focus] : Q.input;
    if (k === '⌫') v = v.slice(0, -1); else if (k === '␣') { if (v && !/ $/.test(v)) v += ' '; } else if (v.length < 12) v += k;
    if (Array.isArray(Q.input)) { Q.input[Q.focus] = v; if (q.type === 'qr' && Q.focus === 0 && k === '␣') Q.focus = 1; } else Q.input = v;
    paintAns();
  }
  function submit(given, btn) {
    const Q = P.q, q = Q.list[Q.i];
    if (q.type === 'qr' ? (!given[0] || !given[1]) : (given === '' || given == null)) { X.toast(q.type === 'qr' ? '몫과 나머지를 모두 써 주세요' : '답을 먼저 써 주세요'); return; }
    if (q.type === 'number' && !X.parseNum(given)) { X.toast('숫자 모양을 확인해 주세요 (분수는 3/4처럼)'); return; }
    const ok = X.check(q, given);
    if (!ok && q.strict && X.sameNum(given, q.answer)) { X.toast('값은 맞아요! 문제에서 말한 모양으로 다시 써 봐요 (예: 대분수 1 2/3, 기약분수, 소수)'); return; }
    Q.try++;
    const fb = $('#fb');
    if (q.type === 'choice' && btn) btn.classList.add(ok ? 'right' : 'wrong');
    if (ok) {
      Q.locked = true; Q.res.push({ q, first: Q.try === 1, ok: true, given });
      fb.innerHTML = '<div class="fb good"><span class="x">🎉</span><span>' + (Q.try === 1 ? '정답이에요!' : '다시 생각해서 맞혔어요! 멋져요') + (q.explain ? '<br><small style="font-weight:500">' + X.fracHtml(q.explain) + '</small>' : '') + '</span></div>';
      if (q.sayAfter && q.say) X.speak(q.say, 'en-US');
      nextBtn();
    } else if (Q.try === 1) {
      if (btn) { btn.disabled = true; Q.wrongPicks.push(+given); }
      fb.innerHTML = '<div class="fb retry"><span class="x">🤔</span><span>아까워요! 한 번 더 생각해 봐요.' + (q.hint && q.type === 'choice' ? '<br><small>' + esc(q.hint) + '</small>' : '') + '</span></div>';
      if (q.type !== 'choice') { if (Array.isArray(Q.input)) Q.input = ['', '']; else Q.input = ''; Q.focus = 0; paintAns(); const ta = $('#ta'); if (ta) { ta.value = ''; ta.focus(); } }
    } else {
      Q.locked = true; Q.res.push({ q, first: false, ok: false, given });
      if (q.type === 'choice') { const r = document.querySelector('.choice[data-k="' + q.answer + '"]'); if (r) r.classList.add('right'); }
      fb.innerHTML = '<div class="fb bad"><span class="x">📌</span><span>정답은 <b>' + X.fracHtml(X.answerText(q)) + '</b> 이에요.' + (q.explain ? '<br><small style="font-weight:500">' + X.fracHtml(q.explain) + '</small>' : '') + '<br><small>다시 풀기에 담아 둘게요.</small></span></div>';
      if (q.say) X.speak(q.say, 'en-US');
      nextBtn();
    }
  }
  function nextBtn() {
    const Q = P.q; const last = Q.i >= Q.list.length - 1;
    $('#pf').innerHTML = '<button class="btn btn-primary btn-lg" id="nx">' + (last ? '결과 보기 →' : '다음 문제 →') + '</button>';
    $('#nx').onclick = () => { if (last) finish(Q.res); else { Q.i++; drawQ(); } };
    $('#nx').focus();
  }

  async function finish(res) {
    document.removeEventListener('keydown', keyHandler);
    const it = P.it, total = res.length, first = res.filter(r => r.first).length, retry = res.filter(r => r.ok && !r.first).length, wrong = res.filter(r => !r.first);
    const secs = P.q ? Math.round((Date.now() - P.q.t0) / 1000) : 0;
    shell(it.title, 9, 3);
    $('#pin').innerHTML = '<div class="result"><div class="big-stamp">참 잘<br>했어요</div><h2>' + (total ? (first === total ? '모두 한 번에 맞혔어요! 🎉' : '끝까지 해냈어요! 👏') : '오늘 공부 완료! 👏') + '</h2>' +
      (total ? '<div class="score">한 번에 맞힌 문제 <b>' + first + '</b> / ' + total + (retry ? ' · 다시 생각해서 맞힌 문제 ' + retry : '') + (it.kind === 'drill' ? ' · ' + Math.floor(secs / 60) + '분 ' + (secs % 60) + '초' : '') + '</div>' : '') +
      '<div class="chips">' + (wrong.length && it.kind !== 'review' ? '<span class="pill" style="color:var(--orange-d)">🔁 다시 풀기에 ' + wrong.length + '문제 담았어요</span>' : '') + '<span class="pill">🏅 칭찬 도장 +1</span></div></div>';
    $('#pf').innerHTML = '<button class="btn btn-secondary btn-lg" id="home">처음으로</button><button class="btn btn-primary btn-lg hidden" id="nextit">다음 공부 →</button>';
    $('#home').onclick = closePlayer;
    // 저장
    if (it.kind === 'review') {
      for (const r of res) if (r.first && r.q._rid) await rpc('edu_kid_review', { p_code: st.code, p_kid: st.kid.id, p_action: 'clear', p_id: r.q._rid, p_item_key: null, p_subject: null, p_q: null }).catch(() => { });
      return;
    }
    const slim = q => { const o = { type: q.type, q: q.q, answer: q.answer }; if (q.choices) o.choices = q.choices; if (q.explain) o.explain = q.explain; if (q.say) o.say = q.say; if (q.big) o.big = 1; if (q.strict) o.strict = 1; return o; };
    await log({ plan: it.free ? null : it.plan, key: it.key, subject: it.subject, kind: it.kind, status: 'done', score: total ? first : null, total: total || null,
      detail: { title: it.title, level: it.level, secs, wrong: wrong.map(r => ({ q: r.q.q, given: r.given, ok2: r.ok })) } });
    for (const r of wrong) await rpc('edu_kid_review', { p_code: st.code, p_kid: st.kid.id, p_action: 'add', p_id: null, p_item_key: it.key, p_subject: it.subject, p_q: slim(r.q) }).catch(() => { });
    if (!it.free) {
      it.done = true; st.done.add(it.key);
      const n = st.items.find(x => x.kind !== 'task' && !x.done && x !== it);
      if (n) { const b = $('#nextit'); b.classList.remove('hidden'); b.textContent = '다음: ' + n.title + ' →'; b.onclick = async () => { await loadDay(); const nn = st.items.find(x => x.kind !== 'task' && !x.done); if (nn) openItem(nn); else closePlayer(); }; }
    }
  }

  window.addEventListener('focus', () => { if (!P && st.kid && st.data && X.ymd() !== st.day) refresh(); });
  boot();
})();
