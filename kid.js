/* 우리집 배움터 v2 — 아이 화면 (포털형 헤더 + 단계형 학습: 강의 듣기 → 핵심 정리 → 교재 풀기 → 문제 풀기 → 도장) */
(function () {
  'use strict';
  const X = window.EDU, S = X.SUBJECTS, esc = X.esc, fh = X.fracHtml;
  const ORDER = X.SUBJECT_ORDER; // read calc math soc word eng
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const app = $('#app');
  const st = { code: X.store.get('code'), kids: [], family: {}, kid: null, day: X.ymd(), data: null, items: [], view: 'today', browse: { subject: 'math', grade: null, track: 'history' } };
  let L = null, timerI = null;

  /* ── 서버 ── */
  async function rpc(fn, args) {
    const { data, error } = await X.sb().rpc(fn, args);
    if (error) throw error;
    if (data && data.error === 'bad_code') { X.store.del('code'); st.code = null; gateCode('가족코드가 바뀌었어요. 다시 넣어 주세요.'); throw new Error('bad_code'); }
    return data;
  }
  const P = () => ({ p_code: st.code, p_kid: st.kid.id });
  function log(o) {
    return rpc('edu_kid_log', Object.assign(P(), { p_day: st.day, p_plan: o.plan || null, p_item_key: o.key || null, p_subject: o.subject || null, p_kind: o.kind || null,
      p_status: o.status, p_score: o.score == null ? null : o.score, p_total: o.total == null ? null : o.total, p_detail: o.detail || {} }))
      .catch(e => { if (e.message !== 'bad_code') X.toast('저장하지 못했어요. 인터넷을 확인해 주세요'); });
  }

  /* ── 시작·게이트 ── */
  function stars(n) { const r = X.rng('stars'); let h = '<div class="stars">'; for (let i = 0; i < (n || 40); i++) h += '<i style="left:' + (r() * 100) + '%;top:' + (r() * 100) + '%;opacity:' + (.2 + r() * .6) + '"></i>'; return h + '</div>'; }
  async function boot() {
    if (!st.code) return gateCode();
    app.innerHTML = '<div class="spin"></div>';
    try {
      const d = await rpc('edu_kid_boot', { p_code: st.code });
      st.kids = d.kids || []; st.family = d.family || {};
      const k = st.kids.find(k => k.id === X.store.get('kid'));
      if (k) { st.kid = k; await loadDay(); go('today'); } else gateProfile();
    } catch (e) { if (e.message !== 'bad_code') app.innerHTML = '<div class="gate">' + stars() + '<div class="box"><div style="font-size:52px">📡</div><h1>연결이 안 돼요</h1><p>인터넷 연결을 확인하고 다시 눌러 주세요.</p><button class="btn" onclick="location.reload()">다시 시도</button></div></div>'; }
  }
  function gateCode(msg) {
    app.innerHTML = '<div class="gate">' + stars() + '<div class="box"><div style="font-size:56px">🏡</div><h1>우리집 배움터</h1><p>' + esc(msg || '엄마에게 받은 가족코드를 넣어 주세요. 이 태블릿에서는 한 번만 넣으면 돼요.') + '</p>' +
      '<input class="codein" id="code" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="가족코드"><br><button class="btn" id="go">시작하기</button></div></div>';
    const go_ = () => { const v = $('#code').value.trim(); if (!v) return; st.code = v; X.store.set('code', v); boot(); };
    $('#go').onclick = go_; $('#code').onkeydown = e => { if (e.key === 'Enter') go_(); };
  }
  function gateProfile() {
    app.innerHTML = '<div class="gate">' + stars() + '<div class="box"><h1>누가 공부할까요?</h1><p>내 얼굴을 눌러 주세요</p><div class="profs">' +
      st.kids.map(k => '<button class="pbtn" data-k="' + k.id + '"><span class="av" style="background:' + esc(k.color) + '22">' + esc(k.emoji) + '</span><b>' + esc(k.name) + '</b><small>' + X.gradeOf(k) + '학년</small></button>').join('') + '</div></div></div>';
    $$('.pbtn').forEach(b => b.onclick = () => pickKid(b.dataset.k));
  }
  async function pickKid(id) {
    st.kid = st.kids.find(k => k.id === id); X.store.set('kid', id); st.browse.grade = null;
    app.innerHTML = '<div class="spin"></div>'; await loadDay(); go('today');
  }

  async function loadDay() {
    st.day = X.ymd();
    st.data = await rpc('edu_kid_day', Object.assign(P(), { p_day: st.day }));
    st.done = new Set(st.data.done || []);
    st.over = {}; st.mats = {};
    (st.data.materials || []).forEach(m => { if (m.body && m.body.lib_id) st.over[m.body.lib_id] = m; else st.mats[m.id] = m; });
    st.books = st.data.books || [];
    buildItems();
  }

  /* ── 오늘 할 일 만들기 ── */
  function buildItems() {
    const kid = st.kid, d = X.parseYmd(st.day), sem = X.semester(d), logs = st.data.logs || [];
    const skip = new Set(), items = [];
    (st.data.plans || []).forEach(p => {
      const mine = logs.filter(l => l.plan_id === p.id), doneLog = mine.filter(l => l.status === 'done').pop();
      const it = { plan: p.id, kind: p.kind, subject: p.subject, payload: p.payload || {}, done: !!doneLog, doneLog, watched: mine.some(l => l.status === 'watched') };
      if (p.kind === 'task') { it.title = p.title; it.byKid = !!it.payload.by_kid; items.push(it); return; }
      if (p.kind === 'link') { it.kind = 'link'; it.subject = 'link'; it.title = p.title || '엄마가 고른 강의'; it.url = it.payload.url; it.key = 'URL:' + p.id; items.push(it); return; }
      if (p.ref && p.ref.startsWith('MAT:')) { const m = st.mats[p.ref.slice(4)]; if (!m) return; Object.assign(it, { kind: 'mat', mat: m, title: m.title, url: m.url, key: 'MAT:' + m.id, subject: m.subject || 'link' }); items.push(it); return; }
      const level = X.levelOf(kid, p.subject, d); it.level = level;
      // 교재가 등록된 과목이면 교재 강 진도가 우선
      const bk = (!p.ref || p.ref === 'next' || p.ref === 'auto') ? st.books.find(b => b.book.subject === p.subject) : null;
      if (bk) {
        const b = bk.book; let no = b.current_no;
        if (doneLog && /^BOOK:/.test(doneLog.item_key || '')) no = +doneLog.item_key.split(':')[2];
        if (no <= b.total) {
          const ls = (bk.lessons || []).find(x => x.no === no) || null;
          Object.assign(it, { kind: 'book', book: b, no, lesson: ls, key: 'BOOK:' + b.id + ':' + no, title: (ls && ls.title) || (no + '강'), level });
          items.push(it); return;
        }
      }
      if (p.kind === 'drill') {
        const tid = (p.ref && p.ref !== 'auto' && X.CALC_MAP[p.ref]) ? p.ref : X.autoCalcTopic(level, st.day, sem).id;
        Object.assign(it, { subject: 'calc', topic: X.CALC_MAP[tid], count: Number(it.payload.count) || 10, key: 'CALC:' + tid });
        it.title = it.topic.name; items.push(it); return;
      }
      let lib = null;
      if (doneLog && X.LIB_MAP[doneLog.item_key]) lib = X.LIB_MAP[doneLog.item_key];
      else if (p.ref && p.ref !== 'next' && X.LIB_MAP[p.ref]) lib = X.LIB_MAP[p.ref];
      else lib = X.nextItem(p.subject, level, sem, st.done, p.subject === 'soc' ? (it.payload.track || 'history') : null, skip);
      if (!lib) return;
      skip.add(lib.id); Object.assign(it, { lib, key: lib.id, title: lib.title }); items.push(it);
    });
    st.items = items;
  }
  const learnItems = () => st.items.filter(i => i.kind !== 'task');
  const subjItem = s => st.items.find(i => i.subject === s && ['lesson', 'drill', 'book'].includes(i.kind));

  /* ── 공통 틀 ── */
  function chrome() {
    const k = st.kid, list = learnItems(), rv = (st.data.review || []).length, d = X.parseYmd(st.day);
    const tabs = [['today', '오늘의 학습'], ['notes', '오답노트' + (rv ? ' <span class="badge num">' + rv + '</span>' : '')], ['subjects', '과목별 공부'], ['room', '나의 공부방']];
    const curG = st.view === 'subjects' ? st.browse.grade : X.gradeOf(k);
    return '<div class="util"><div class="wrap"><a href="' + X.EBS.main + '" target="_blank" rel="noopener">EBS 초등 바로가기 ↗</a><a href="admin.html">엄마 관리</a></div></div>' +
      '<header class="hdr"><div class="wrap"><button class="logo" data-go="today"><span class="logo-mark">🏡</span><span class="logo-name">우리집 배움터<span class="logo-sub">엄마가 차려 둔 매일 공부</span></span></button>' +
      '<div class="datecap"><b class="num">' + X.fmtDate(st.day) + '</b><span class="cnt num">오늘 ' + list.length + '과목</span></div>' +
      '<div class="profiles">' + st.kids.map(x => '<button class="prof" data-prof="' + x.id + '" aria-pressed="' + (x.id === k.id) + '"><span class="avatar" style="background:' + esc(x.color) + '22">' + esc(x.emoji) + '</span>' + esc(x.name) + ' <small class="num">' + X.gradeOf(x) + '학년</small></button>').join('') + '</div></div></header>' +
      '<nav class="mainnav"><div class="wrap">' + tabs.map(t => '<button class="tab" data-go="' + t[0] + '"' + ((st.view === t[0] || (st.view === 'lesson' && t[0] === 'today')) ? ' aria-current="page"' : '') + '>' + t[1] + '</button>').join('') +
      '<a class="navtext" href="admin.html">🔒 엄마 관리</a></div></nav>' +
      '<div class="gradeband"' + (st.view === 'lesson' ? ' hidden' : '') + '><div class="wrap"><span class="gb-label">학년 바로가기</span>' + [1, 2, 3, 4, 5, 6].map(g => '<button class="gpill" data-grade="' + g + '" aria-pressed="' + (g === curG) + '"><span class="face">' + ['🐣', '🐥', '🐰', '🦊', '🐼', '🦁'][g - 1] + '</span>' + g + '학년</button>').join('') +
      '<span class="gb-note">' + esc(k.name) + '는 지금 ' + X.gradeOf(k) + '학년 · 다른 학년 공부도 열어 볼 수 있어요</span></div></div>';
  }
  function go(view) {
    stopTimer(); try { speechSynthesis.cancel(); } catch (e) { }
    st.view = view;
    const body = { today: viewToday, notes: viewNotes, subjects: viewSubjects, room: viewRoom, lesson: () => '<section id="view-lesson"></section>' }[view]();
    app.innerHTML = chrome() + '<main id="main">' + body + '</main><footer><div class="wrap"><span>우리집 배움터 · 가족 전용</span><span>강의 영상의 저작권은 EBS에 있고, 이 사이트는 EBS 강의를 링크(공식 유튜브는 퍼가기)로만 연결해요. 설명·문제는 새로 쓴 자료예요.</span></div></footer>';
    if (view === 'lesson') renderLesson();
    if (view === 'room') fillRoom();
    window.scrollTo(0, 0);
  }

  /* ── 오늘의 학습 ── */
  function heroArt() {
    return '<svg class="hero-art" viewBox="0 0 160 140" aria-hidden="true"><circle cx="122" cy="32" r="20" fill="#ffd166"/><circle cx="130" cy="26" r="16" fill="#213183"/>' +
      '<path d="M20 70h50a12 12 0 0 1 12 12v46a8 8 0 0 0-8-8H20z" fill="#fff" stroke="#7fb6ec" stroke-width="4" stroke-linejoin="round"/>' +
      '<path d="M144 70H94a12 12 0 0 0-12 12v46a8 8 0 0 1 8-8h54z" fill="#fff" stroke="#7fb6ec" stroke-width="4" stroke-linejoin="round"/>' +
      '<path d="M32 86h36M32 98h30M96 86h36M96 98h28" stroke="#cfe2f8" stroke-width="4" stroke-linecap="round"/>' +
      '<rect x="40" y="18" width="12" height="52" rx="3" transform="rotate(-28 46 44)" fill="#ff9fd6"/><circle cx="26" cy="34" r="5" fill="#86d99a"/><circle cx="150" cy="112" r="6" fill="#cfb0f3"/></svg>';
  }
  function stampSvg(cls, label) {
    const [a, b] = label.split('|');
    return '<svg class="' + cls + '" viewBox="0 0 100 100" aria-hidden="true"><g transform="rotate(-8 50 50)"><circle cx="50" cy="50" r="44" fill="none" stroke="#e0475b" stroke-width="5"/><circle cx="50" cy="50" r="36" fill="none" stroke="#e0475b" stroke-width="1.6" stroke-dasharray="3 3"/>' +
      '<text x="50" y="47" text-anchor="middle" fill="#e0475b" style="font-family:var(--f-display);font-size:17px">' + a + '</text><text x="50" y="67" text-anchor="middle" fill="#e0475b" style="font-family:var(--f-display);font-size:17px">' + (b || '') + '</text></g></svg>';
  }
  function itemMeta(it) {
    if (!it) return '';
    if (it.kind === 'drill') return it.count + '문제 · 자동 출제';
    if (it.kind === 'book') { const ls = it.lesson; const nq = ls && ls.body && ls.body.questions ? ls.body.questions.length : 0; return '강의' + (ls && ls.mins ? ' ' + ls.mins + '분' : '') + (ls && ls.pages ? ' · 교재 ' + ls.pages : ' · 교재') + (nq ? ' · 문제 ' + nq + '개' : ''); }
    if (it.lib && it.lib.subject === 'word') return '단어 ' + (it.lib.words || []).length + '개 · 카드 + 퀴즈';
    return '강의 + 문제 ' + ((it.lib && it.lib.questions) || []).length + '개';
  }
  function viewToday() {
    const k = st.kid, list = learnItems(), doneN = list.filter(i => i.done).length, allDone = list.length && doneN === list.length;
    const next = list.find(i => !i.done), mins = list.reduce((a, i) => a + (S[i.subject] || S.link).min, 0);
    const segs = list.map(i => '<span class="seg" style="' + (i.done ? 'background:' + (S[i.subject] || S.link).col : '') + '"></span>').join('');
    // 이번 주 도장판 (월~일)
    const d0 = X.parseYmd(st.day), dow = d0.getDay(), mon = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - (dow === 0 ? 6 : dow - 1));
    const wk = {}; (st.data.week || []).forEach(w => wk[w.day] = w.n);
    let streak = 0; for (let i = 0; i < 30; i++) { const dd = X.ymd(new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - i)); if (wk[dd]) streak++; else if (i > 0 || !allDone) { if (i === 0) continue; break; } }
    const days = ['월', '화', '수', '목', '금', '토', '일'].map((n, i) => {
      const dd = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i), key = X.ymd(dd), c = wk[key] || 0, isT = key === st.day;
      return '<div class="day' + (c ? ' done' : '') + (isT ? ' today' : '') + '"><span class="dot">' + (c ? stampSvg('', c >= 4 ? '참|잘했어요' : '잘|했어요') : (isT ? '오늘' : '')) + '</span><span class="num">' + n + ' ' + (dd.getMonth() + 1) + '/' + dd.getDate() + '</span></div>';
    }).join('');
    const goal = st.family.reward_goal || 30, stamps = st.data.stamps || 0;
    let h = '<div class="section"><div class="wrap"><div class="hero-grid"><div class="today-banner">' + stars(30) + '<div style="min-width:0"><span class="eyebrow">오늘의 학습</span>' +
      '<h1>' + esc(k.name) + ', ' + (allDone ? '오늘 학습 끝! 정말 멋져요' : list.length ? '오늘은 ' + list.length + '과목이에요' : '오늘은 쉬는 날이에요') + '</h1>' +
      '<p>' + (allDone ? '내일도 이렇게 차근차근 해 봐요.' : list.length ? '다 끝내면 도장판에 도장이 쾅! 찍혀요.' : '과목별 공부에서 하고 싶은 걸 골라도 좋아요.') + (mins ? ' <span class="num" style="opacity:.75">· 약 ' + mins + '분</span>' : '') + '</p>' +
      '<div class="segs">' + segs + '</div>' +
      (next ? '<button class="btn" data-open="' + st.items.indexOf(next) + '">' + (doneN ? '이어서 하기' : '시작하기') + ' · ' + esc((S[next.subject] || S.link).name) + ' →</button>' : '<button class="btn ghost" data-go="notes">오답노트 다시 풀기</button>') +
      '</div>' + heroArt() + '</div>' +
      '<div class="stampboard"><h3>이번 주 도장판</h3><div class="streak num">' + (streak ? '연속 ' + streak + '일째 공부 중 🔥' : '오늘 첫 도장을 찍어 봐요') + '</div><div class="days">' + days + '</div>' +
      '<div class="reward">🏅 칭찬 도장 <b class="num">' + stamps + '</b> / ' + goal + '<div class="tr"><i style="width:' + Math.min(100, stamps / goal * 100) + '%"></i></div><div style="margin-top:6px">' + esc(st.family.reward_text || '') + '</div></div></div></div></div></div>';
    // 과목 표
    const cols = ORDER.map(s => {
      const it = subjItem(s), on = !!it, sj = S[s];
      let ttl, meta, btn, state;
      if (on) {
        ttl = it.title; meta = itemMeta(it);
        btn = it.done ? '<button class="tbtn done" data-open="' + st.items.indexOf(it) + '">✓ 완료' + (it.doneLog && it.doneLog.total ? ' ' + it.doneLog.score + '/' + it.doneLog.total : '') + '</button>' : '<button class="tbtn go" data-open="' + st.items.indexOf(it) + '">' + (it.watched ? '이어하기' : '시작하기') + '</button>';
        state = it.done ? '도장 받았어요' : '오늘 할 일';
      } else {
        const lv = X.levelOf(k, s), nx = s === 'calc' ? null : X.nextItem(s, lv, X.semester(), st.done, s === 'soc' ? 'history' : null);
        ttl = s === 'calc' ? X.autoCalcTopic(lv, st.day, X.semester()).name : (nx ? nx.title : '-'); meta = s === 'calc' ? '10문제 · 자동 출제' : '다음 진도';
        btn = '<button class="tbtn" data-free="' + s + '">해보기</button>'; state = '오늘은 쉬는 과목';
      }
      return '<div class="tcol' + (on ? '' : ' off') + '"><div class="thead" style="background:' + sj.col + '">' + sj.emoji + ' ' + esc(sj.name) + '</div>' +
        '<div class="tbody">' + (on && it.kind === 'book' ? '<span class="book">📗 ' + esc(it.book.title) + ' · ' + it.no + '강</span>' : '') + '<span class="ttl">' + esc(ttl) + '</span><span class="meta">' + esc(meta) + '</span></div>' +
        '<div class="tfoot">' + btn + '<span class="state">' + state + '</span></div></div>';
    }).join('');
    h += '<div class="section"><div class="wrap"><div class="sec-head"><h2>오늘 할 일</h2><button class="more" data-go="subjects">과목별 공부 ›</button></div><div class="ttable">' + cols + '</div></div></div>';
    // 엄마가 고른 강의
    const extra = st.items.filter(i => i.kind === 'link' || i.kind === 'mat');
    if (extra.length) h += '<div class="section"><div class="wrap"><div class="sec-head"><h2>엄마가 고른 강의</h2></div><div class="ulist">' + extra.map(it => '<button class="urow" data-open="' + st.items.indexOf(it) + '"><span class="no">🎬</span><span class="t"><b>' + esc(it.title) + '</b><small>' + (it.done ? '다 봤어요' : '눌러서 시작') + '</small></span>' + (it.done ? '<span class="ok">✓ 완료</span>' : '<span class="ok" style="color:var(--brand)">시작 →</span>') + '</button>').join('') + '</div></div></div>';
    // 체크리스트
    const tasks = st.items.filter(i => i.kind === 'task');
    h += '<div class="section"><div class="wrap"><div class="sec-head"><h2>오늘의 체크리스트</h2><span style="color:var(--muted);font-size:14px">학원·학교 숙제, 문제집도 끝나면 체크!</span></div><div class="checks">' +
      tasks.map(it => '<div class="chk' + (it.done ? ' on' : '') + '"><button class="box" data-chk="' + st.items.indexOf(it) + '" aria-label="체크">' + (it.done ? '✓' : '') + '</button><span class="t">' + esc(it.title) + '</span>' + (it.payload.note ? '<span class="who">' + esc(it.payload.note) + '</span>' : '') + (it.byKid ? '<span class="who">내가 추가</span><button class="x" data-deltask="' + it.plan + '" aria-label="지우기">✕</button>' : '') + '</div>').join('') +
      (tasks.length ? '' : '<div class="chk"><span class="t" style="color:var(--muted);font-weight:500">오늘 체크할 일이 없어요</span></div>') +
      '<div class="addrow"><input id="newtask" maxlength="60" placeholder="선생님이 내 준 숙제를 직접 적어도 돼요"><button class="btn small" data-addtask>추가</button></div></div></div></div>';
    h += '<div class="section soft"><div class="wrap"><div class="sec-head"><h2>더 해보고 싶을 때</h2></div><div class="circles">' +
      circ('📚', 'var(--c-math)', '과목별 공부', '1~6학년 전체 단원', 'data-go="subjects"') + circ('🔁', 'var(--c-word)', '오답노트', '틀린 문제 다시 풀기', 'data-go="notes"') +
      circ('🏅', 'var(--c-read)', '나의 공부방', '도장 달력', 'data-go="room"') + circ('📺', 'var(--c-eng)', 'EBS 초등', '공식 사이트 새 창', 'data-href="' + X.EBS.main + '"') + '</div></div></div>';
    return h;
  }
  function circ(e, c, t, sub, attr) { return '<button class="circ" ' + attr + '><span class="disc" style="background:' + c + '">' + e + '</span><b>' + esc(t) + '</b><span>' + esc(sub) + '</span></button>'; }

  /* ════ 학습 ════ */
  function stopTimer() { if (timerI) { clearInterval(timerI); timerI = null; } }
  function openItem(it) {
    const d = X.parseYmd(st.day), lv = it.level || X.levelOf(st.kid, it.subject, d);
    L = { it, subject: it.subject, grade: lv, step: 0, qi: 0, res: [], answered: false };
    const subj = S[it.subject] || S.link;
    if (it.kind === 'drill') {
      L.kind = 'calc'; L.title = it.topic.name; L.topic = it.topic;
      L.probs = X.makeCalc(it.topic.id, it.count, it.seed || (st.day + st.kid.id)).questions;
      L.steps = ['오늘의 규칙', '문제 풀기', '도장 받기'];
    } else if (it.kind === 'book') {
      const b = it.book, ls = it.lesson || {}, body = ls.body || {};
      L.kind = 'lesson'; L.title = (ls.title || it.no + '강'); L.bookTitle = b.title + ' · ' + it.no + '강';
      const url = ls.url || b.course_url || X.ebsFor({ subject: it.subject, grades: [lv] }, lv).url;
      L.video = { url, embed: X.ytEmbed(url), label: b.title + ' ' + it.no + '강' + (ls.mins ? ' · ' + ls.mins + '분' : ''), exact: !!ls.url, hint: ls.url ? '' : 'EBS 강좌에서 ' + it.no + '강을 눌러 들어요' };
      L.points = body.points || []; L.passage = body.passage || ''; L.pages = ls.pages || ''; L.book = b; L.no = it.no;
      L.questions = (body.questions || []).slice();
      if (!L.questions.length && it.subject === 'calc') L.questions = X.makeCalc(X.autoCalcTopic(lv, st.day, X.semester(d)).id, 8, st.day + st.kid.id).questions;
      L.steps = ['강의 듣기'].concat(L.points.length || L.passage ? ['핵심 정리'] : [], ['교재 풀기'], L.questions.length ? ['문제 풀기'] : [], ['도장 받기']);
    } else if (it.kind === 'link' || it.kind === 'mat') {
      const m = it.mat || {}; const url = it.url || m.url;
      L.kind = 'lesson'; L.title = it.title;
      L.video = { url, embed: X.ytEmbed(url), label: it.title, exact: true };
      L.points = (m.body && (m.body.points || m.body.explain)) || []; if (m.memo || it.payload.note) L.memo = m.memo || it.payload.note;
      L.questions = ((m.body && m.body.questions) || []).slice();
      L.steps = ['강의 듣기'].concat(L.points.length ? ['핵심 정리'] : [], L.questions.length ? ['문제 풀기'] : [], ['도장 받기']);
    } else {
      const lib = it.lib; L.lib = lib; L.title = lib.title; L.goal = lib.goal;
      if (lib.subject === 'word') { L.kind = 'word'; L.words = lib.words || []; L.questions = wordQuiz(lib); L.steps = ['단어 카드', '단어 퀴즈', '도장 받기']; }
      else {
        L.kind = 'lesson';
        const ov = it.payload && it.payload.url ? { [lib.id]: { url: it.payload.url } } : st.over;
        const e = X.ebsFor(lib, lv, ov);
        L.video = { url: e.url, embed: X.ytEmbed(e.url), label: e.label, exact: !!e.exact, hint: e.exact ? '' : '강좌 목록에서 「' + lib.title + '」 강의를 찾아 들어요' };
        L.points = lib.explain || lib.story || []; L.passage = lib.passage || ''; L.glossary = lib.words || []; L.people = lib.people || [];
        L.example = lib.example; L.expressions = lib.expressions; L.dialog = lib.dialog; L.tip = lib.tip; L.era = lib.era;
        L.questions = (lib.questions || []).slice();
        L.steps = ['강의 듣기', '핵심 정리', '문제 풀기', '도장 받기'];
      }
    }
    L.chipName = subj.name; L.col = subj.col;
    go('lesson');
  }

  function renderLesson() {
    const cur = L.steps[L.step];
    if (cur === '도장 받기' && !L.finished) return finish();
    const head = '<div class="lesson-top"><button class="back" data-go="today">‹ 오늘의 학습</button><span class="subj-chip" style="background:' + L.col + '">' + (S[L.subject] || S.link).emoji + ' ' + esc(L.chipName) + '</span><span class="num" style="color:var(--muted);font-size:14px">' + L.grade + '학년' + (L.lib && L.lib.sem ? ' ' + L.lib.sem + '학기' : '') + (L.era ? ' · ' + esc(L.era) : '') + '</span>' + (L.bookTitle ? '<span class="pill" style="font-size:13px;font-weight:700;color:var(--brand-ink);background:var(--pill);border-radius:20px;padding:3px 10px">📗 ' + esc(L.bookTitle) + '</span>' : '') + '</div>' +
      '<h1 class="lesson-title">' + esc(L.title) + '</h1>' + (L.goal ? '<div class="lesson-goal">🎯 ' + esc(L.goal) + '</div>' : '') +
      '<ol class="steps">' + L.steps.map((n, i) => '<li class="' + (i === L.step ? 'cur' : i < L.step ? 'past' : '') + '"><i class="num">' + (i < L.step ? '✓' : i + 1) + '</i>' + n + '</li>').join('') + '</ol>';
    const body = ({ '강의 듣기': stepVideo, '핵심 정리': stepPoints, '교재 풀기': stepBook, '오늘의 규칙': stepRule, '단어 카드': stepCards, '단어 퀴즈': stepQuiz, '도장 받기': stepResult })[cur] || (L.kind === 'calc' ? stepCalc : stepQuiz);
    $('#view-lesson').innerHTML = '<div class="section"><div class="wrap">' + head + body() + '</div></div>';
    if (cur === '문제 풀기' && L.kind === 'calc') startTimer();
    if ((cur === '단어 퀴즈' || cur === '문제 풀기') && L.kind !== 'calc') { const q = L.questions[L.qi]; if (q && q.autoSay) setTimeout(() => X.speak(q.say, 'en-US'), 300); }
    const ta = $('#ansin'); if (ta) setTimeout(() => ta.focus(), 60);
  }
  const nextStep = () => { L.step++; L.qi = 0; renderLesson(); window.scrollTo(0, 0); };

  function stepVideo() {
    const v = L.video, it = L.it;
    const tile = v.embed ? '<div class="video"><iframe src="' + esc(v.embed) + '" title="' + esc(v.label) + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>'
      : '<a class="video" id="vlink" href="' + esc(v.url) + '" target="_blank" rel="noopener" style="background:' + L.col + '"><span class="tagr">EBS 새 창 ↗</span><span class="play">▶</span><span class="cap">' + esc(v.label) + '</span></a>';
    return '<div class="panel"><div class="video-grid">' + tile + '<div><h3>먼저 강의를 들어요</h3><p style="margin:0 0 12px">' +
      (v.embed ? '여기에서 바로 재생돼요. 끝까지 보고 아래에 체크해요.' : '화면을 누르면 EBS 강의가 새 창으로 열려요. 끝까지 보고 이 화면으로 돌아와서 체크해요.') + '</p>' +
      (v.hint ? '<div class="note" style="margin-bottom:6px">💡 ' + esc(v.hint) + '</div>' : '') + (L.memo ? '<div class="note">📝 ' + esc(L.memo) + '</div>' : '') +
      '<label class="check"><input type="checkbox" id="watched"' + (it.watched ? ' checked' : '') + '> 끝까지 다 봤어요</label>' +
      (!v.embed ? '<div class="note">EBS 초등 강의는 로그인한 EBS 창에서 열려요.</div>' : '') +
      '<div class="row end"><button class="btn" id="nextBtn"' + (it.watched ? '' : ' disabled') + '>' + esc(L.steps[1]) + ' →</button></div>' +
      (!v.exact ? '<div class="row end" style="margin-top:8px"><button class="btn small ghost" data-skipvideo>강의 없이 ' + esc(L.steps[1]) + '</button></div>' : '') + '</div></div></div>';
  }
  function stepPoints() {
    let h = '';
    if (L.passage) h += '<div class="panel"><div class="row between" style="margin-bottom:12px"><h3 style="margin:0">오늘의 글</h3><button class="speak" data-say="' + esc(L.passage) + '" data-lang="ko-KR">🔊 읽어주기</button></div><p class="passage">' + esc(L.passage) + '</p>' +
      (L.glossary && L.glossary.length ? '<div class="wordbox">' + L.glossary.map(w => '<span><b>' + esc(w.w) + '</b> : ' + esc(w.mean) + '</span>').join('') + '</div>' : '') + '</div>';
    if (L.expressions) h += '<div class="panel"><div class="row between" style="margin-bottom:12px"><h3 style="margin:0">오늘의 표현</h3><button class="speak" data-say="' + esc((L.dialog || []).map(l => l.en).join(' ')) + '" data-lang="en-US">🔊 대화 전체 듣기</button></div>' +
      '<ol class="points">' + L.expressions.map((e, i) => '<li><i class="num">' + (i + 1) + '</i><span><b>' + esc(e.en) + '</b> <button class="speak" data-say="' + esc(e.en) + '" data-lang="en-US" style="min-height:32px">🔊</button><br><small style="color:var(--muted)">' + esc(e.ko) + '</small></span></li>').join('') + '</ol>' +
      (L.dialog ? '<h3 style="margin:20px 0 10px">대화</h3><div class="dlg">' + L.dialog.map(l => '<div class="ln"><span class="w">' + esc(l.who) + '</span><span class="tx"><b>' + esc(l.en) + '</b><small>' + esc(l.ko) + '</small></span><button class="speak" data-say="' + esc(l.en) + '" data-lang="en-US">🔊</button></div>').join('') + '</div>' : '') +
      (L.tip ? '<div class="note" style="margin-top:14px">💡 ' + esc(L.tip) + '</div>' : '') + '</div>';
    if (L.points && L.points.length) h += '<div class="panel"><div class="row between" style="margin-bottom:12px"><h3 style="margin:0">' + (L.book ? '엄마의 핵심 정리' : '핵심 정리') + '</h3><button class="speak" data-say="' + esc(L.points.join(' ')) + '" data-lang="ko-KR">🔊 읽어주기</button></div>' +
      '<ol class="points">' + L.points.map((t, i) => '<li><i class="num">' + (i + 1) + '</i><span>' + fh(t) + '</span></li>').join('') + '</ol>' +
      (L.people && L.people.length ? '<div class="wordbox">' + L.people.map(p => '<span>👤 <b>' + esc(p.name) + '</b> — ' + esc(p.desc) + '</span>').join('') + '</div>' : '') +
      (L.example ? '<div class="example"><b>✏️ 예제</b><div style="font-size:20px;margin-top:6px">' + fh(L.example.q) + '</div><div id="exs" hidden><ol>' + (L.example.steps || []).map(s => '<li>' + fh(s) + '</li>').join('') + '</ol><b>답: ' + fh(L.example.a) + '</b></div><button class="btn small ghost" data-showex style="margin-top:10px">풀이 보기</button></div>' : '') + '</div>';
    return h + '<div class="row end"><button class="btn ghost" data-step="-1">강의 다시 보기</button><button class="btn" data-step="1">' + esc(L.steps[L.step + 1]) + ' →</button></div>';
  }
  function stepBook() {
    const sj = S[L.subject] || S.link;
    return '<div class="panel"><div class="book-task"><div class="cover" style="background:' + L.col + '">' + sj.emoji + '</div><div><div style="color:var(--muted);font-weight:700">📗 ' + esc(L.book.title) + ' · ' + L.no + '강</div>' +
      '<div class="pages">' + (L.pages ? esc(L.pages) + ' 풀기' : L.no + '강 문제 풀기') + '</div><p style="margin:6px 0 0">강의에서 배운 내용으로 교재 문제를 풀어요. 다 풀면 엄마와 답을 맞춰 봐요.</p>' +
      '<label class="check"><input type="checkbox" id="bookdone"> 교재 다 풀었어요</label></div></div>' +
      '<div class="row end"><button class="btn ghost" data-step="-1">이전</button><button class="btn" id="bookNext" disabled>' + esc(L.steps[L.step + 1]) + ' →</button></div></div>';
  }
  function stepRule() {
    const t = L.topic; const ex = X.makeCalc(t.id, 2, 'rule-ex').questions;
    return '<div class="panel"><h3>오늘의 연산 규칙</h3><ol class="points"><li><i class="num">1</i><span>' + fh(t.tip) + '</span></li>' + ex.map((q, i) => '<li><i class="num">' + (i + 2) + '</i><span class="num">예) ' + fh(q.q) + ' ' + fh(X.answerText(q)) + '</span></li>').join('') + '</ol>' +
      '<div class="note" style="margin-top:16px">연산은 매일 새로 자동 출제돼요. ' + (L.probs.some(q => /\//.test(q.answer)) ? '분수는 3/4처럼, 대분수는 1 2/3처럼 써요.' : '') + '</div>' +
      '<div class="row end"><button class="btn" data-step="1">' + L.probs.length + '문제 시작 · 시간 재기</button></div></div>';
  }
  function inmode(q) { const a = String(q.answer) + q.q; return /\//.test(a) ? 'text' : /\./.test(String(q.answer)) ? 'decimal' : 'numeric'; }
  function stepCalc() {
    return '<div class="panel"><div class="calc-head"><h3 style="margin:0">답을 적어요</h3><span class="timer num" id="timer">0:00</span></div><form id="calcForm" autocomplete="off"><div class="calc-grid">' +
      L.probs.map((p, i) => '<div class="cp" id="cp' + i + '"><span class="n num">' + (i + 1) + '</span><span class="ex num">' + fh(p.q.replace(/ =$/, '')) + ' =</span>' +
        (p.type === 'qr' ? '<span class="ins">몫<input class="sm" id="ci' + i + 'a" inputmode="numeric">나머지<input class="sm" id="ci' + i + 'b" inputmode="numeric"></span>' : '<span class="ins"><input id="ci' + i + '" inputmode="' + inmode(p) + '" aria-label="' + (i + 1) + '번 답"></span>') +
        '<span class="mk"></span></div>').join('') + '</div><div class="row end"><button class="btn" type="submit" id="gradeBtn">채점하기</button></div></form></div>';
  }
  function startTimer() { L.t0 = Date.now(); timerI = setInterval(() => { const el = $('#timer'); if (!el) return stopTimer(); const s = Math.floor((Date.now() - L.t0) / 1000); el.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }, 500); }
  function gradeCalc() {
    stopTimer(); L.secs = Math.floor((Date.now() - L.t0) / 1000); L.res = [];
    L.probs.forEach((p, i) => {
      const given = p.type === 'qr' ? [$('#ci' + i + 'a').value.trim(), $('#ci' + i + 'b').value.trim()] : $('#ci' + i).value.trim();
      const ok = p.type === 'qr' ? (given[0] && given[1] && X.check(p, given)) : (given !== '' && X.check(p, given));
      const row = $('#cp' + i); row.classList.add(ok ? 'right' : 'wrong'); row.querySelector('.mk').textContent = ok ? 'O' : 'X';
      $$('input', row).forEach(x => x.readOnly = true);
      if (!ok) row.insertAdjacentHTML('beforeend', '<span class="fix num">정답 ' + fh(X.answerText(p)) + '</span>');
      L.res.push({ q: p, ok, given: Array.isArray(given) ? given.join(', ') : (given || '(빈칸)') });
    });
    const b = $('#gradeBtn'); b.textContent = '도장 받으러 가기 →'; b.type = 'button'; b.id = 'toResult';
    X.toast(L.probs.length + '문제 중 ' + L.res.filter(r => r.ok).length + '개 맞았어요');
  }
  function stepCards() {
    return '<div class="panel"><div class="row between" style="margin-bottom:14px"><h3 style="margin:0">소리 듣고 따라 말해요</h3><span style="font-size:14px;color:var(--muted)">뜻은 눌러서 확인해요</span></div><div class="cards">' +
      L.words.map((w, i) => '<div class="wcard">' + (w.emoji ? '<span class="em">' + esc(w.emoji) + '</span>' : '') + '<span class="en">' + esc(w.en) + '</span><span class="ko hide" id="ko' + i + '">' + esc(w.ko) + '</span><span class="ex">' + esc(w.ex || '') + '</span>' +
        '<div class="row"><button class="speak" data-say="' + esc(w.en) + '" data-lang="en-US" aria-label="듣기">🔊</button><button class="speak" data-reveal="' + i + '">뜻 보기</button></div></div>').join('') +
      '</div>' + (L.lib && L.lib.ebs ? '<div class="note" style="margin-top:14px">📺 EBS 「' + esc(X.ebsFor(L.lib, L.grade, st.over).label) + '」 강의로 더 연습할 수 있어요. <a href="' + esc(X.ebsFor(L.lib, L.grade, st.over).url) + '" target="_blank" rel="noopener">열기 ↗</a></div>' : '') +
      '<div class="row end"><button class="btn" data-step="1">단어 퀴즈 풀기 →</button></div></div>';
  }
  function wordQuiz(lib) {
    const r = X.rng(st.day + lib.id), W = lib.words || [], qs = [];
    X.shuffle(W, r).forEach((w, k, arr) => {
      const others = X.shuffle(W.filter(x => x !== w), r).slice(0, 3);
      if (k >= arr.length - 3) { qs.push({ type: 'text', q: (w.emoji ? w.emoji + ' ' : '') + '「' + w.ko + '」을(를) 영어로 써 보세요', answer: [w.en, w.en.toLowerCase()], explain: w.ko + ' = ' + w.en, say: w.en, sayAfter: true }); return; }
      const ch = X.shuffle([w].concat(others), r);
      if (k % 2 === 0) qs.push({ type: 'choice', q: '「' + w.en + '」의 뜻은?', choices: ch.map(x => x.ko), answer: ch.indexOf(w), explain: w.en + ' = ' + w.ko, say: w.en });
      else qs.push({ type: 'choice', q: '🔊 소리를 듣고 알맞은 단어를 골라요', choices: ch.map(x => x.en), answer: ch.indexOf(w), explain: '들린 단어는 ' + w.en + ' (' + w.ko + ')', say: w.en, autoSay: true });
    });
    return qs;
  }
  function stepQuiz() {
    const q = L.questions[L.qi];
    const psg = L.passage ? '<details class="psg"><summary>글 다시 보기</summary><p class="passage">' + esc(L.passage) + '</p></details>' : '';
    let ans;
    if (q.type === 'choice') ans = '<div class="opts" id="opts">' + q.choices.map((o, i) => '<button class="opt" data-ans="' + i + '"><i class="num">' + (i + 1) + '</i>' + fh(o) + '</button>').join('') + '</div>';
    else if (q.type === 'qr') ans = '<div class="ansrow">몫 <input class="ansin" id="ansin" inputmode="numeric" style="width:120px"> 나머지 <input class="ansin" id="ansin2" inputmode="numeric" style="width:120px"><button class="btn" data-submit>확인</button></div>';
    else ans = '<div class="ansrow"><input class="ansin' + (q.type === 'text' ? ' wide' : '') + '" id="ansin" autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="' + (q.type === 'text' ? 'text' : inmode(q)) + '" placeholder="' + (q.type === 'text' ? '여기에 써요' : '답') + '"><button class="btn" data-submit>확인</button></div>' + (q.type === 'number' && /\//.test(q.answer) ? '<div class="note" style="margin-top:10px">분수는 3/4처럼, 대분수는 1 2/3처럼 써요.</div>' : '');
    return '<div class="panel">' + psg + '<div class="row between"><span class="qcount num">' + (L.qi + 1) + ' / ' + L.questions.length + '</span>' +
      '<button class="speak" data-say="' + esc(q.say || q.q.replace(/[🔊「」]/g, '')) + '" data-lang="' + (q.say ? 'en-US' : 'ko-KR') + '">🔊 ' + (q.say ? '소리 듣기' : '문제 읽어주기') + '</button></div>' +
      '<p class="qtext">' + fh(q.q) + '</p>' + ans + '<div id="fb"></div></div>';
  }
  function answer(given, btn) {
    const q = L.questions[L.qi]; if (L.answered) return;
    if (q.type !== 'choice') {
      if (q.type === 'qr' ? (!given[0] || !given[1]) : given === '') return X.toast('답을 먼저 써 주세요');
      if (q.type === 'number' && !X.parseNum(given)) return X.toast('숫자 모양을 확인해 주세요 (분수는 3/4처럼)');
    }
    const ok = X.check(q, given);
    if (!ok && q.strict && X.sameNum(given, q.answer)) return X.toast('값은 맞아요! 문제에서 말한 모양(대분수·기약분수·소수)으로 다시 써 봐요');
    L.answered = true;
    if (q.type === 'choice') { $$('#opts .opt').forEach((b, k) => { b.disabled = true; if (k === q.answer) b.classList.add('right'); }); if (!ok && btn) btn.classList.add('wrong'); }
    else $$('.ansin').forEach(x => { x.readOnly = true; x.style.borderColor = ok ? 'var(--ok)' : 'var(--bad)'; });
    L.res.push({ q, ok, given: q.type === 'choice' ? q.choices[given] : (Array.isArray(given) ? given.join(', ') : given) });
    if (q.say && (q.sayAfter || !ok)) X.speak(q.say, 'en-US');
    const last = L.qi === L.questions.length - 1;
    $('#fb').innerHTML = '<div class="fb ' + (ok ? 'ok' : 'no') + '">' + (ok ? '정답이에요! 🎉' : '아쉬워요. 정답은 ‘' + fh(X.answerText(q)) + '’예요.') + (q.explain ? '<small>' + fh(q.explain) + '</small>' : '') + '</div>' +
      '<div class="row end"><button class="btn" id="qNext">' + (last ? '도장 받으러 가기 →' : '다음 문제 →') + '</button></div>';
    const nb = $('#qNext'); if (nb) nb.focus();
  }
  function nextQ() { L.answered = false; if (L.qi < L.questions.length - 1) { L.qi++; renderLesson(); } else finish(); }

  async function finish() {
    if (L.finished) return; L.finished = true; stopTimer();
    const it = L.it, res = L.res, total = res.length, right = res.filter(r => r.ok).length, wrong = res.filter(r => !r.ok);
    L.total = total; L.right = right; L.wrongs = wrong; L.step = L.steps.length - 1; renderLesson(); window.scrollTo(0, 0);
    const slim = q => { const o = { type: q.type, q: q.q, answer: q.answer }; ['choices', 'explain', 'say', 'strict'].forEach(k => { if (q[k]) o[k] = q[k]; }); return o; };
    const free = !!it.free || !it.plan;
    await log({ plan: free ? null : it.plan, key: it.key, subject: it.subject, kind: it.kind, status: 'done', score: total ? right : null, total: total || null,
      detail: { title: L.bookTitle || L.title, level: L.grade, secs: L.secs || null, wrong: wrong.map(r => ({ q: r.q.q, given: r.given })) } });
    for (const r of wrong) await rpc('edu_kid_review', Object.assign(P(), { p_action: 'add', p_id: null, p_item_key: it.key, p_subject: it.subject, p_q: slim(r.q) })).catch(() => { });
    if (it.kind === 'book') await rpc('edu_kid_book', Object.assign(P(), { p_book: it.book.id, p_no: it.no })).catch(() => { });
    try { await loadDay(); } catch (e) { }
    const nb = $('#nextLesson'); const n = learnItems().find(x => !x.done);
    if (nb && n && !free) { nb.hidden = false; nb.textContent = '다음 학습 · ' + (S[n.subject] || S.link).name + ' →'; nb.dataset.open = st.items.indexOf(n); }
  }
  function stepResult() {
    const pct = L.total ? Math.round(L.right / L.total * 100) : 100;
    const label = pct >= 80 ? '참|잘했어요' : pct >= 50 ? '잘|했어요' : '다시|도전!';
    const wl = L.wrongs && L.wrongs.length ? '<ul>' + L.wrongs.map(w => '<li>' + fh(w.q.q) + ' → 정답 ' + fh(X.answerText(w.q)) + '</li>').join('') + '</ul><p style="font-size:14px;color:var(--muted);margin:4px 0 0">틀린 문제는 오답노트에 담겼어요.</p>' : (L.total ? '<p style="margin:0;color:var(--muted)">하나도 안 틀렸어요!</p>' : '');
    return '<div class="panel"><div class="result">' + stampSvg('stamp pop', label) + (L.total ? '<div class="score num">' + L.right + ' / ' + L.total + '</div>' : '<div class="score">완료!</div>') +
      (L.secs != null ? '<div class="num" style="color:var(--muted)">걸린 시간 ' + Math.floor(L.secs / 60) + '분 ' + (L.secs % 60) + '초</div>' : '') + wl +
      '<div class="row" style="justify-content:center;margin-top:14px"><button class="btn" id="nextLesson" hidden></button><button class="btn ghost" data-go="today">오늘의 학습으로</button></div></div></div>';
  }

  /* ── 오답노트 ── */
  function viewNotes() {
    const list = st.data.review || [];
    const items = list.length ? '<div class="notes">' + list.map((r, i) => {
      const q = r.q, sj = S[r.subject] || S.link;
      const ans = q.type === 'choice' ? '<div class="opts">' + q.choices.map((o, k) => '<button class="opt" data-nans="' + i + '-' + k + '"><i class="num">' + (k + 1) + '</i>' + fh(o) + '</button>').join('') + '</div>'
        : q.type === 'qr' ? '<div class="ansrow">몫 <input class="ansin" id="ni' + i + 'a" inputmode="numeric" style="width:100px"> 나머지 <input class="ansin" id="ni' + i + 'b" inputmode="numeric" style="width:100px"><button class="btn small" data-ncheck="' + i + '">확인</button></div>'
        : '<div class="ansrow"><input class="ansin' + (q.type === 'text' ? ' wide' : '') + '" id="ni' + i + '" autocomplete="off" inputmode="' + (q.type === 'text' ? 'text' : inmode(q)) + '"><button class="btn small" data-ncheck="' + i + '">확인</button></div>';
      return '<div class="ncard"><div class="row between"><span class="subj-chip" style="background:' + sj.col + '">' + sj.emoji + ' ' + esc(sj.name) + '</span>' + (r.wrong_count > 1 ? '<span style="font-size:12px;color:var(--muted)">' + r.wrong_count + '번 틀림</span>' : '') + '</div>' +
        (q.say ? '<button class="speak" data-say="' + esc(q.say) + '" data-lang="en-US" style="justify-self:start">🔊 소리 듣기</button>' : '') + '<div class="q">' + fh(q.q) + '</div>' + ans + '</div>';
    }).join('') + '</div>' : '<div class="empty"><div class="e">🌈</div>틀린 문제가 하나도 없어요. 멋져요!</div>';
    return '<div class="section"><div class="wrap"><div class="sec-head"><h2>' + esc(st.kid.name) + '의 오답노트</h2><span style="font-size:14px;color:var(--muted)">다시 풀어서 맞히면 노트에서 지워져요</span></div>' + items + '</div></div>';
  }
  async function clearReview(i) {
    const r = st.data.review[i]; await rpc('edu_kid_review', Object.assign(P(), { p_action: 'clear', p_id: r.id, p_item_key: null, p_subject: null, p_q: null })).catch(() => { });
    st.data.review.splice(i, 1); X.toast('정답! 오답노트에서 지웠어요 🎉'); go('notes');
  }

  /* ── 과목별 공부 ── */
  function viewSubjects() {
    const b = st.browse, k = st.kid; if (!b.grade) b.grade = X.levelOf(k, b.subject);
    let h = '<div class="section"><div class="wrap"><div class="sec-head"><h2>과목별 공부</h2><span style="color:var(--muted);font-size:14px">' + b.grade + '학년 · 더 공부하고 싶은 걸 골라요</span></div><div class="stiles">' +
      ORDER.map(s => '<button class="stile" data-subj="' + s + '" aria-pressed="' + (b.subject === s) + '"><span class="ic" style="background:' + S[s].col + '">' + S[s].emoji + '</span>' + S[s].name + '</button>').join('') + '</div>';
    if (b.subject === 'soc') h += '<div class="tabs" style="margin-top:14px"><button data-track="history" aria-pressed="' + (b.track === 'history') + '">이야기 한국사</button><button data-track="social" aria-pressed="' + (b.track === 'social') + '">학년 사회</button></div>';
    let rows;
    if (b.subject === 'calc') rows = X.CALC.filter(c => c[1] === b.grade).map((c, i) => '<button class="urow" data-fcalc="' + c[0] + '"><span class="no">' + (i + 1) + '</span><span class="t"><b>' + esc(c[3]) + '</b><small>' + c[1] + '학년 ' + c[2] + '학기 · 10문제 · 풀 때마다 새 문제</small></span>' + (st.done.has('CALC:' + c[0]) ? '<span class="ok">✓</span>' : '') + '</button>').join('');
    else { const list = X.libList(b.subject, b.grade, b.subject === 'soc' ? b.track : null); rows = list.map((x, i) => '<button class="urow" data-flib="' + x.id + '"><span class="no">' + (x.sem ? x.sem + '-' : '') + (x.order || i + 1) + '</span><span class="t"><b>' + esc(x.title) + '</b><small>' + esc(x.goal || x.era || '') + '</small></span>' + (st.done.has(x.id) ? '<span class="ok">✓ 완료</span>' : '') + '</button>').join('') || '<div class="urow"><span class="t" style="color:var(--muted)">이 학년 자료는 준비 중이에요</span></div>'; }
    return h + '<div class="ulist" style="margin-top:16px">' + rows + '</div></div></div>';
  }

  /* ── 나의 공부방 ── */
  function viewRoom() { return '<div class="section"><div class="wrap" id="room"><div class="spin"></div></div></div>'; }
  async function fillRoom() {
    const now = X.parseYmd(st.day), y = now.getFullYear(), m = now.getMonth(), first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
    let rows = []; try { rows = await rpc('edu_kid_history', Object.assign(P(), { p_from: X.ymd(first), p_to: X.ymd(last) })) || []; } catch (e) { }
    const el = $('#room'); if (!el) return;
    const byDay = {}, bySub = {}; rows.forEach(r => { byDay[r.day] = (byDay[r.day] || 0) + 1; const k = r.kind === 'task' ? 'etc' : (r.subject || 'etc'); bySub[k] = (bySub[k] || 0) + 1; });
    const goal = st.family.reward_goal || 30, stamps = st.data.stamps || 0;
    let h = '<div class="sec-head"><h2>' + esc(st.kid.name) + '의 공부방</h2><span style="color:var(--muted)">' + (m + 1) + '월 기록</span></div><div class="g2">' +
      '<div class="card"><h3>🏅 칭찬 도장</h3><div style="font-size:42px;font-weight:900">' + stamps + ' <span style="font-size:20px;color:var(--muted)">/ ' + goal + '</span></div><div class="reward" style="border:0;margin:0;padding:0"><div class="tr"><i style="width:' + Math.min(100, stamps / goal * 100) + '%"></i></div><div style="margin-top:8px">' + esc(st.family.reward_text || '') + '</div></div></div>' +
      '<div class="card"><h3>📅 이번 달 공부한 날</h3><div style="font-size:42px;font-weight:900">' + Object.keys(byDay).length + '일</div><p class="desc" style="margin:0">끝낸 일 모두 ' + rows.length + '개 · 어제의 나와 비교해요</p></div></div>' +
      '<div class="sec-head" style="margin-top:24px"><h2>과목별로 끝낸 것</h2></div><div class="statrow">' + ORDER.map(k => '<div class="stat"><div class="e">' + S[k].emoji + '</div><b>' + (bySub[k] || 0) + '</b><small>' + S[k].short + '</small></div>').join('') + '</div>' +
      '<div class="sec-head" style="margin-top:24px"><h2>' + (m + 1) + '월 도장 달력</h2></div><div class="card"><div class="cal">' + X.WD.map(w => '<div class="wd">' + w + '</div>').join('');
    for (let i = 0; i < first.getDay(); i++) h += '<div></div>';
    for (let d = 1; d <= last.getDate(); d++) { const key = X.ymd(new Date(y, m, d)), c = byDay[key] || 0; h += '<div class="d' + (key === st.day ? ' today' : '') + '"><span>' + d + '</span>' + (c ? '<span class="s">' + (c >= 4 ? '🌟' : '⭐') + '</span><span class="c">' + c + '</span>' : '') + '</div>'; }
    el.innerHTML = h + '</div></div>';
  }

  /* ── 이벤트 ── */
  document.addEventListener('click', async e => {
    const t = e.target.closest('button,a'); if (!t || !st.kid) return; const d = t.dataset;
    if (d.go) { e.preventDefault(); if (d.go !== 'lesson') go(d.go); return; }
    if (d.href) { window.open(d.href, '_blank', 'noopener'); return; }
    if (d.prof) { if (d.prof !== st.kid.id) pickKid(d.prof); return; }
    if (d.grade) { st.browse.grade = +d.grade; go('subjects'); return; }
    if (d.open != null && d.open !== '') { const it = st.items[+d.open]; if (it) openItem(it); return; }
    if (d.free) { const s = d.free, lv = X.levelOf(st.kid, s); if (s === 'calc') { const tp = X.autoCalcTopic(lv, st.day, X.semester()); openItem({ kind: 'drill', subject: 'calc', topic: tp, count: 10, key: 'CALC:' + tp.id, title: tp.name, level: lv, free: true, seed: String(Date.now()) }); } else { const lib = X.nextItem(s, lv, X.semester(), st.done, s === 'soc' ? 'history' : null); if (lib) openItem({ kind: 'lesson', subject: s, lib, key: lib.id, title: lib.title, level: lv, free: true, payload: {} }); } return; }
    if (d.subj) { st.browse.subject = d.subj; go('subjects'); return; }
    if (d.track) { st.browse.track = d.track; go('subjects'); return; }
    if (d.flib) { const lib = X.LIB_MAP[d.flib]; openItem({ kind: 'lesson', subject: lib.subject, lib, key: lib.id, title: lib.title, level: st.browse.grade, free: true, payload: {} }); return; }
    if (d.fcalc) { const tp = X.CALC_MAP[d.fcalc]; openItem({ kind: 'drill', subject: 'calc', topic: tp, count: 10, key: 'CALC:' + tp.id, title: tp.name, level: tp.grade, free: true, seed: String(Date.now()) }); return; }
    if (d.say) { X.speak(d.say, d.lang || 'ko-KR'); return; }
    if (d.reveal) { const k = $('#ko' + d.reveal); if (k) k.classList.toggle('hide'); return; }
    if (d.showex != null) { $('#exs').hidden = false; t.remove(); return; }
    if (d.step) { L.step += +d.step; L.qi = 0; renderLesson(); window.scrollTo(0, 0); return; }
    if (d.skipvideo != null || t.id === 'nextBtn' || t.id === 'bookNext') { nextStep(); return; }
    if (t.id === 'vlink') { log({ plan: L.it.plan, key: L.it.key, subject: L.it.subject, kind: L.it.kind, status: 'opened', detail: { title: L.title } }); return; }
    if (d.ans != null && t.closest('#opts')) { answer(+d.ans, t); return; }
    if (d.submit != null) { const q = L.questions[L.qi]; answer(q.type === 'qr' ? [$('#ansin').value.trim(), $('#ansin2').value.trim()] : $('#ansin').value.trim()); return; }
    if (t.id === 'qNext') { nextQ(); return; }
    if (t.id === 'toResult') { finish(); return; }
    if (d.chk) { const it = st.items[+d.chk]; it.done = !it.done; t.closest('.chk').classList.toggle('on', it.done); t.textContent = it.done ? '✓' : ''; await log({ plan: it.plan, key: 'TASK:' + it.plan, subject: 'etc', kind: 'task', status: it.done ? 'done' : 'undone', detail: { title: it.title } }); if (it.done) X.toast('잘했어요! 도장 하나 꾹 🏅'); await loadDay(); return; }
    if (d.deltask) { await rpc('edu_kid_task', Object.assign(P(), { p_day: st.day, p_action: 'delete', p_title: null, p_plan: d.deltask })); await loadDay(); go('today'); return; }
    if (d.addtask != null) { const v = $('#newtask').value.trim(); if (!v) return; t.disabled = true; await rpc('edu_kid_task', Object.assign(P(), { p_day: st.day, p_action: 'add', p_title: v, p_plan: null })); await loadDay(); go('today'); X.toast('체크리스트에 넣었어요'); return; }
    if (d.nans) { const [i, k] = d.nans.split('-').map(Number), r = st.data.review[i]; if (k === r.q.answer) clearReview(i); else { t.classList.add('wrong'); t.disabled = true; X.toast('한 번 더 생각해 봐요'); } return; }
    if (d.ncheck != null) { const i = +d.ncheck, q = st.data.review[i].q; const g = q.type === 'qr' ? [$('#ni' + i + 'a').value.trim(), $('#ni' + i + 'b').value.trim()] : $('#ni' + i).value.trim(); if (X.check(q, g)) clearReview(i); else X.toast('아직 아니에요. 다시 생각해 봐요'); return; }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'watched') { const b = $('#nextBtn'); if (b) b.disabled = !t.checked; if (t.checked && !L.it.watched) { L.it.watched = true; log({ plan: L.it.plan, key: L.it.key, subject: L.it.subject, kind: L.it.kind, status: 'watched', detail: { title: L.title } }); } }
    if (t.id === 'bookdone') { $('#bookNext').disabled = !t.checked; }
  });
  document.addEventListener('submit', e => { if (e.target.id === 'calcForm') { e.preventDefault(); if (L.secs == null) gradeCalc(); else finish(); } });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !L || st.view !== 'lesson') return;
    if (e.target.id === 'ansin' || e.target.id === 'ansin2') { e.preventDefault(); const nb = $('#qNext'); if (nb) return nextQ(); const s = $('[data-submit]'); if (s) s.click(); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'newtask') { const a = $('[data-addtask]'); if (a) a.click(); } });
  window.addEventListener('focus', () => { if (st.kid && st.data && st.view === 'today' && X.ymd() !== st.day) loadDay().then(() => go('today')).catch(() => { }); });
  boot();
})();
