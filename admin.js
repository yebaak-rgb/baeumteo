/* 우리집 배움터 v2 — 엄마 관리 (한 페이지: 편성표 · 체크리스트 · 교재 진도 · 학습 만들기 · 리포트 · 루틴 · 설정) */
(function () {
  'use strict';
  const X = window.EDU, S = X.SUBJECTS, esc = X.esc, fh = X.fracHtml, ORDER = X.SUBJECT_ORDER;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const app = $('#app'), db = X.sb();
  const WDS = [1, 2, 3, 4, 5, 6, 0];
  const st = { kids: [], plans: [], mats: [], family: {}, books: [], lessons: [], logs: [], review: [], done: [], kidSel: null, lib: { subject: 'math', grade: 4 }, mk: { book: null, no: null } };

  async function q(p) { const { data, error } = await p; if (error) { X.toast('오류: ' + error.message); throw error; } return data; }
  async function all(make) { let out = [], from = 0; for (;;) { const d = await q(make().range(from, from + 999)); out = out.concat(d || []); if (!d || d.length < 1000) return out; from += 1000; } }

  /* ── 로그인 ── */
  async function boot() {
    const { data: { session } } = await db.auth.getSession();
    // 구글 로그인에서 돌아온 주소(#access_token…, ?code=…)를 깨끗하게 → 뒤로가기 때 로그인 화면·오류로 가지 않게
    const back = /access_token|error_description|[?&]code=/.test(location.hash + location.search), err = (location.hash.match(/error_description=([^&]+)/) || [])[1];
    if (back) try { history.replaceState(null, '', location.pathname); } catch (e) { }
    if (!session) return login(err ? '로그인 실패: ' + decodeURIComponent(err.replace(/\+/g, ' ')) : '');
    const { data: ok } = await db.rpc('edu_is_parent');
    if (!ok) { app.innerHTML = '<div class="gate"><div class="box"><h1>권한이 없어요</h1><p>' + esc(session.user.email) + ' 계정은 엄마 계정이 아니에요.</p><button class="btn ghost" id="lo">로그아웃</button></div></div>'; $('#lo').onclick = async () => { await db.auth.signOut(); login(); }; return; }
    app.innerHTML = '<div class="spin"></div>'; await loadAll(); render();
  }
  function login(msg) {
    // 엄마 계정(yeba.ak@gmail.com)은 구글 로그인 계정 → 비밀번호 없이 구글로 로그인
    app.innerHTML = '<div class="gate"><div class="box" style="max-width:460px"><div style="font-size:52px">🔐</div><h1>엄마 관리</h1><p>' + esc(msg || '등록된 엄마 구글 계정으로 로그인해 주세요') + '</p>' +
      '<button class="btn" id="gg" style="background:#fff;color:#1f1f1f;border:1px solid #dadce0;box-shadow:var(--sh1)"><svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg> 구글로 로그인</button>' +
      '<p style="margin:18px 0 0"><a href="index.html">← 아이 화면</a></p></div></div>';
    $('#gg').onclick = async () => {
      // 새 기록을 남기지 않고(location.replace) 구글로 이동 → 로그인 뒤 뒤로가기를 눌러도 구글 화면이 다시 나오지 않아요
      const { data, error } = await db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } } });
      if (error) return login('로그인 실패: ' + error.message);
      location.replace(data.url);
    };
  }
  async function loadAll() {
    const from = X.ymd(new Date(Date.now() - 30 * 864e5));
    [st.kids, st.plans, st.mats, st.family, st.books, st.logs, st.review, st.done] = await Promise.all([
      q(db.from('edu_kids').select('*').order('sort')), all(() => db.from('edu_plan').select('*').order('sort').order('created_at')),
      q(db.from('edu_materials').select('*').order('created_at', { ascending: false })), q(db.from('edu_families').select('id,family_name,reward_goal,reward_text,updated_at').maybeSingle()),
      q(db.from('edu_books').select('*').order('created_at')), all(() => db.from('edu_logs').select('*').gte('day', from).order('id', { ascending: false })),
      all(() => db.from('edu_review').select('*').is('cleared_at', null).order('id', { ascending: false })), q(db.rpc('edu_parent_done'))]);
    st.family = st.family || {};
    if (!st.kidSel || !st.kids.find(k => k.id === st.kidSel)) st.kidSel = (st.kids[0] || {}).id;
  }
  async function reload(part) {
    if (part === 'plans') st.plans = await all(() => db.from('edu_plan').select('*').order('sort').order('created_at'));
    else if (part === 'books') st.books = await q(db.from('edu_books').select('*').order('created_at'));
    else if (part === 'mats') st.mats = await q(db.from('edu_materials').select('*').order('created_at', { ascending: false }));
    else await loadAll();
    render();
  }
  const kid = () => st.kids.find(k => k.id === st.kidSel);
  const today = X.ymd(), todayDow = new Date().getDay();
  const appliesOn = (p, day) => p.active && (p.on_date === day || (!p.on_date && (p.weekdays || []).includes(X.parseYmd(day).getDay())));
  const mainPlan = (kidId, s) => st.plans.find(p => p.kid_id === kidId && !p.on_date && (s === 'calc' ? (p.kind === 'drill' || (p.kind === 'lesson' && p.subject === 'calc')) : (p.kind === 'lesson' && p.subject === s)) && (!p.ref || p.ref === 'next' || p.ref === 'auto'));
  const bookOf = (kidId, s) => st.books.find(b => b.kid_id === kidId && b.subject === s && b.active);
  const subjOfLog = l => l.kind === 'task' ? 'etc' : (l.subject || 'link');

  /* ── 틀 ── */
  function render() {
    const k = kid(); if (!k) { app.innerHTML = '<div class="wrap"><div class="empty">아이를 먼저 등록해 주세요.</div></div>'; return; }
    const nToday = ORDER.filter(s => { const p = mainPlan(k.id, s); return p && appliesOn(p, today); }).length;
    let h = '<div class="util"><div class="wrap"><a href="index.html">아이 화면 ↗</a><button id="lo">로그아웃</button></div></div>' +
      '<header class="hdr"><div class="wrap"><a class="logo" href="admin.html"><span class="logo-mark">🔒</span><span class="logo-name">엄마 관리<span class="logo-sub">' + esc(st.family.family_name || '우리집 배움터') + ' 운영실</span></span></a>' +
      '<div class="datecap"><b class="num">' + X.fmtDate(today) + '</b><span class="cnt num">' + esc(k.name) + ' 오늘 ' + nToday + '과목</span></div>' +
      '<div class="profiles">' + st.kids.map(x => '<button class="prof" data-kid="' + x.id + '" aria-pressed="' + (x.id === k.id) + '"><span class="avatar" style="background:' + esc(x.color) + '22">' + esc(x.emoji) + '</span>' + esc(x.name) + ' <small class="num">' + X.gradeOf(x) + '학년</small></button>').join('') + '</div></div></header>' +
      '<nav class="mainnav"><div class="wrap"><a class="tab" href="#plan" aria-current="page">편성·진도</a><a class="tab" href="#report">리포트</a><a class="tab" href="#make">학습 만들기</a><a class="tab" href="#lib">기본 자료함</a><a class="tab" href="#set">설정</a><a class="navtext" href="index.html">아이 화면으로 →</a></div></nav>';
    h += '<main class="section"><div class="wrap">' +
      '<div class="sec-head" id="plan"><h2>엄마 관리 · ' + esc(k.name) + '</h2><span style="font-size:13px;color:var(--muted)">엄마 계정으로만 바꿀 수 있어요 · 위에서 아이를 바꿔요</span></div>' +
      '<div class="flow"><div><em>1 · EBS</em><b>강의는 링크·유튜브로</b><span>교재 강 주소만 붙이면 끝</span></div><div><em>2 · 교재</em><b>하루 1강 자동 진도</b><span>다 하면 다음 날 다음 강</span></div>' +
      '<div><em>3 · 자동</em><b>연산·단어 자동 출제</b><span>엄마 손이 안 가요</span></div><div><em>4 · 아이</em><b>듣기 → 정리 → 교재 → 풀기</b><span>채점·오답노트 자동</span></div><div><em>5 · 엄마</em><b>리포트 3분 확인</b><span>도장·칭찬으로 마무리</span></div></div>' +
      '<div class="pgrid" style="margin-top:20px"><div>' + cardSched(k) + cardTasks(k) + cardBooks(k) + '<div id="make">' + cardMake(k) + '</div></div><div>' + cardReport() + cardRecent(k) + cardRoutine() + cardBulk(k) + '</div></div>' +
      '<div class="card" style="margin-top:20px" id="lib">' + libSection() + '</div>' +
      '<div class="g2" style="margin-top:20px" id="set">' + cardKids() + cardFamily() + '</div>' +
      '</div></main><footer><div class="wrap"><span>우리집 배움터 · 엄마 관리</span><span>EBS 강의는 링크(공식 유튜브는 퍼가기)로만 연결해요.</span></div></footer>';
    app.innerHTML = h;
    bindMake(); updatePrompt();
  }

  /* ── 주간 편성표 ── */
  function cardSched(k) {
    const mon = new Date(); mon.setDate(mon.getDate() - (todayDow === 0 ? 6 : todayDow - 1));
    const head = '<tr><th style="text-align:left">과목</th>' + WDS.map((w, i) => { const d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i); return '<th class="num' + (w === todayDow ? ' today' : '') + '">' + X.WD[w] + '<br>' + (d.getMonth() + 1) + '/' + d.getDate() + '</th>'; }).join('') + '</tr>';
    const rows = ORDER.map(s => {
      const p = mainPlan(k.id, s), b = bookOf(k.id, s), lv = X.levelOf(k, s);
      const sub = b ? '📗 ' + b.title + ' · ' + Math.min(b.current_no, b.total) + '강' + (b.current_no > b.total ? ' (완료)' : '') : (s === 'calc' ? lv + '학년 자동 출제' : s === 'word' ? lv + '학년 단어 자동' : lv + '학년 기본 진도');
      return '<tr><th><span class="sdot" style="background:' + S[s].col + '"></span>' + S[s].name + '<small>' + esc(sub) + '</small></th>' +
        WDS.map(w => { const on = !!(p && p.active && (p.weekdays || []).includes(w)); return '<td class="' + (w === todayDow ? 'today' : '') + '"><button class="cell" data-cell="' + s + ':' + w + '" aria-pressed="' + on + '">' + (on ? (s === 'calc' || s === 'word' ? '자동' : '편성') : '쉼') + '</button></td>'; }).join('') + '</tr>';
    }).join('');
    const foot = '<tr><th style="text-align:left">예상 시간</th>' + WDS.map(w => { const m = ORDER.reduce((a, s) => { const p = mainPlan(k.id, s); return a + (p && p.active && (p.weekdays || []).includes(w) ? S[s].min : 0); }, 0); return '<td class="num">' + (m ? m + '분' : '-') + '</td>'; }).join('') + '</tr>';
    const extra = st.plans.filter(p => p.kid_id === k.id && p.kind !== 'task' && !ORDER.some(s => mainPlan(k.id, s) === p) && (!p.on_date || p.on_date >= today));
    return '<div class="card"><h3>' + esc(k.emoji + ' ' + k.name) + ' 주간 편성표</h3><p class="desc">칸을 누르면 그 요일에 넣고 빼요. 매일 짧은 3과목(문해력·연산·영단어) + 요일마다 긴 과목 1개가 기본이에요. 교재를 등록한 과목은 그 교재 진도로 나가요.</p>' +
      '<div class="scroll-x"><table class="sched"><thead>' + head + '</thead><tbody>' + rows + '</tbody><tfoot>' + foot + '</tfoot></table></div>' +
      (extra.length ? '<div style="margin-top:12px"><b style="font-size:14px">추가 일정</b><div class="tasks" style="margin-top:6px">' + extra.map(p => '<div class="tk"><span class="t">' + (S[p.subject] || S.link).emoji + ' ' + esc(p.title || (X.LIB_MAP[p.ref] ? X.LIB_MAP[p.ref].title : p.ref)) + '</span><small style="color:var(--muted)">' + (p.on_date ? X.fmtDate(p.on_date) : (p.weekdays || []).map(w => X.WD[w]).join('·')) + '</small><button class="mini" data-delplan="' + p.id + '">삭제</button></div>').join('') + '</div></div>' : '') +
      '<div class="row" style="margin-top:12px"><button class="btn small ghost" data-addlink>+ 강의 링크 하나 넣기</button><button class="btn small ghost" data-copysched>다른 아이 편성 복사해 오기</button></div></div>';
  }
  async function toggleCell(s, w) {
    const k = kid(); let p = mainPlan(k.id, s);
    if (!p) {
      const rec = { kid_id: k.id, kind: s === 'calc' ? 'drill' : 'lesson', subject: s, weekdays: [w], ref: s === 'calc' ? 'auto' : 'next', payload: s === 'calc' ? { count: X.gradeOf(k) <= 2 ? 8 : 10 } : s === 'soc' ? { track: 'history' } : {}, sort: { read: 10, calc: 20, word: 30, math: 40, eng: 41, soc: 42 }[s], active: true };
      await q(db.from('edu_plan').insert(rec));
    } else {
      const set = new Set(p.weekdays || []); set.has(w) ? set.delete(w) : set.add(w);
      await q(db.from('edu_plan').update({ weekdays: [...set].sort(), active: true }).eq('id', p.id));
    }
    await reload('plans');
  }

  /* ── 체크리스트 ── */
  function cardTasks(k) {
    const tasks = st.plans.filter(p => p.kid_id === k.id && p.kind === 'task' && (!p.on_date || p.on_date >= today) && !(p.payload && p.payload.by_kid && p.on_date < today));
    return '<div class="card"><h3>' + esc(k.emoji + ' ' + k.name) + ' 체크리스트 <small style="font-weight:500;color:var(--muted);font-size:13px">학원·숙제·문제집</small></h3><p class="desc">' + esc(k.name) + '에게만 보이는 할 일이에요. 다른 아이는 맨 위 이름 버튼을 눌러 바꿔요. 요일을 누르면 바로 켜고 꺼져요. 아이가 직접 추가한 숙제도 여기 보여요.</p><div class="tasks">' +
      (tasks.map(p => st.editTask === p.id ?
        // 수정 중인 줄: 할 일·메모(·날짜)를 바로 고쳐요
        '<form class="tk tk-edit" data-tedit="' + p.id + '"><input class="inp" name="t" maxlength="60" value="' + esc(p.title || '') + '" aria-label="할 일"><input class="inp n" name="n" maxlength="20" value="' + esc((p.payload && p.payload.note) || '') + '" placeholder="메모 (선택)" aria-label="메모">' +
        (p.on_date ? '<input class="inp d" type="date" name="d" value="' + esc(p.on_date) + '" aria-label="날짜">' : '') + '<button class="btn small" type="submit">저장</button><button class="mini" type="button" data-tcancel>취소</button></form>' :
        '<div class="tk"><span class="t">' + esc(p.title) + (p.payload && p.payload.note ? ' <small style="color:var(--muted)">· ' + esc(p.payload.note) + '</small>' : '') + (p.payload && p.payload.by_kid ? ' <small style="color:var(--brand)">· 아이가 추가</small>' : '') + '</span>' +
        (p.on_date ? '<small style="color:var(--muted)">' + X.fmtDate(p.on_date) + '</small>' : '<span class="wd">' + WDS.map(w => '<button data-twd="' + p.id + ':' + w + '" aria-pressed="' + (p.weekdays || []).includes(w) + '">' + X.WD[w] + '</button>').join('') + '</span>') +
        '<button class="mini" data-tedit="' + p.id + '">수정</button><button class="mini" data-delplan="' + p.id + '">삭제</button></div>').join('') || '<div class="empty" style="padding:20px">아직 없어요</div>') + '</div>' +
      '<form class="form" id="taskForm" style="margin-top:14px"><div class="f2"><label>할 일<input id="tt" maxlength="60" placeholder="예: 수학학원 숙제 / 연산 문제집 2쪽"></label><label>작은 메모 <small>선택</small><input id="tn" maxlength="20" placeholder="예: 수학학원"></label></div>' +
      '<div class="row"><span class="wd" id="tw">' + WDS.map(w => '<button type="button" data-pick="' + w + '" aria-pressed="' + (w >= 1 && w <= 5) + '">' + X.WD[w] + '</button>').join('') + '</span><span style="color:var(--muted);font-size:13px">또는 날짜</span><input type="date" id="td" class="inp" style="width:auto"><button class="btn small" type="submit">추가</button></div></form></div>';
  }

  /* ── 교재 진도 ── */
  function cardBooks(k) {
    const books = st.books.filter(b => b.kid_id === k.id);
    return '<div class="card"><h3>' + esc(k.emoji + ' ' + k.name) + ' 교재 진도 <small style="font-weight:500;color:var(--muted);font-size:13px">하루 1강 자동</small></h3><p class="desc">교재를 사면 여기 등록해요. 그 과목은 「강의 듣기 → 핵심 정리 → 교재 쪽 풀기 → 확인 문제」로 하루 1강씩 나가요. 아이가 끝내면 다음 날 다음 강이 열려요.</p><div class="books">' +
      (books.map(b => { const pct = Math.round(Math.min(b.current_no - 1, b.total) / b.total * 100);
        const th = X.thumbFor(b.course_url || '', b.cover_url || null);
        return '<div class="bk' + (th ? ' th' : '') + '">' + (th ? '<img class="bk-th" src="' + esc(th) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">' : '') + '<span class="subj-chip" style="background:' + S[b.subject].col + '">' + S[b.subject].emoji + ' ' + S[b.subject].short + '</span><span class="t"><b>' + esc(b.title) + (b.active ? '' : ' (쉬는 중)') + '</b><small class="num">지금 ' + Math.min(b.current_no, b.total) + '강 / 전체 ' + b.total + '강' + (b.current_no > b.total ? ' · 다 끝났어요 🎉' : '') + (b.course_url ? ' · <a href="' + esc(b.course_url) + '" target="_blank">EBS 강좌</a>' : '') + '</small></span>' +
          '<span class="ctl"><button data-bno="' + b.id + ':-1" aria-label="한 강 뒤로">−</button><button data-bno="' + b.id + ':1" aria-label="한 강 앞으로">+</button><button data-bmk="' + b.id + '">강 내용</button><button data-bcov="' + b.id + '">표지</button><button data-btog="' + b.id + '">' + (b.active ? '쉬기' : '켜기') + '</button><button data-bdel="' + b.id + '">삭제</button></span>' +
          '<span class="prog"><i style="width:' + pct + '%"></i></span></div>'; }).join('') || '<div class="empty" style="padding:20px">아직 등록한 교재가 없어요. 교재가 없는 과목은 기본 콘텐츠로 진도가 나가요.</div>') + '</div>' +
      '<form class="form" id="bookForm" style="margin-top:14px"><div class="f3"><label>과목<select id="bs">' + ORDER.map(s => '<option value="' + s + '">' + S[s].name + '</option>').join('') + '</select></label><label>교재 이름<input id="bt" placeholder="예: 만점왕 수학 4-2"></label><label>전체 강 수<input id="bn" type="number" min="1" max="300" value="40"></label></div>' +
      '<div class="f3"><label>EBS 강좌 주소 <small>강 목록이 있는 페이지</small><input id="bu" placeholder="https://primary.ebs.co.kr/course/view?courseId=..."></label><label>표지 이미지 주소 <small>비워도 돼요</small><input id="bcv" placeholder="https://… .jpg"></label><label>시작할 강<input id="bc" type="number" min="1" value="1"></label></div>' +
      '<p class="desc" style="margin:2px 0 8px;font-size:13px">💡 표지: 교재·강좌 이미지를 길게 눌러 「이미지 주소 복사」 → 붙여넣기. 비워 두면 EBS 강좌 대표 이미지를 자동으로 써요.</p><div class="err" id="bErr"></div><div class="row end" style="margin-top:0"><button class="btn small" type="submit">교재 등록</button></div></form></div>';
  }

  /* ── 학습 만들기 (강 하나) ── */
  function cardMake(k) {
    const books = st.books.filter(b => b.kid_id === k.id);
    if (!books.length) return '<div class="card"><h3>학습 만들기</h3><p class="desc">교재를 먼저 등록하면, 강마다 강의 주소·교재 쪽수·핵심 정리·확인 문제를 넣을 수 있어요. 기본 콘텐츠 단원에 EBS 강의 주소만 연결하려면 아래 「기본 자료함」을 써요.</p></div>';
    if (!st.mk.book || !books.find(b => b.id === st.mk.book)) { st.mk.book = books[0].id; st.mk.no = null; }
    const b = books.find(x => x.id === st.mk.book); if (!st.mk.no) st.mk.no = Math.min(b.current_no, b.total);
    return '<div class="card"><h3>학습 만들기</h3><p class="desc">교재 강 하나의 내용을 넣어요. 유튜브 주소면 아이 화면에서 바로 재생, EBS 초등 주소면 큰 재생 버튼으로 새 창이 열려요.</p>' +
      '<form class="form" id="mkForm" autocomplete="off"><div class="f2"><label>교재<select id="mkBook">' + books.map(x => '<option value="' + x.id + '"' + (x.id === b.id ? ' selected' : '') + '>' + esc(S[x.subject].short + ' · ' + x.title) + '</option>').join('') + '</select></label>' +
      '<label>강 번호 <small>바꾸면 저장된 내용을 불러와요</small><input id="mkNo" type="number" min="1" max="' + b.total + '" value="' + st.mk.no + '"></label></div>' +
      '<label>제목<input id="mkTitle" placeholder="예: 소수 두 자리 수, 세 자리 수"></label>' +
      '<div class="f3"><label>강의 주소 <small>EBS 또는 유튜브</small><input id="mkUrl" inputmode="url" placeholder="https://"></label><label>교재 쪽수<input id="mkPages" placeholder="예: p.58~61"></label><label>강의 길이(분)<input id="mkMins" type="number" min="1" max="120"></label></div>' +
      '<label>핵심 정리 <small>한 줄에 하나씩, 아이 말투로 3줄 정도</small><textarea id="mkPts"></textarea></label>' +
      '<label>지문 <small>문해력일 때만</small><textarea id="mkPsg" placeholder="문해력 지문을 붙여 넣어요"></textarea></label>' +
      '<label>확인 문제 <small>한 줄에 하나 · 문제 | 보기1 / 보기2 / 보기3 | 정답번호 · 숫자·단답은 문제 | =정답</small><textarea id="mkQs" placeholder="0.01이 25개인 수는? | 0.025 / 0.25 / 2.5 | 2&#10;3.684에서 8이 나타내는 수는? | =0.08"></textarea></label>' +
      '<div class="err" id="mkErr"></div><div class="row end" style="margin-top:0"><span id="mkState" style="color:var(--muted);font-size:13px;margin-right:auto"></span><button class="btn" type="submit">이 강 저장</button></div></form></div>';
  }
  function parseQs(text) {
    const out = []; let bad = '';
    text.split('\n').map(s => s.trim()).filter(Boolean).forEach((line, i) => {
      const parts = line.split('|').map(s => s.trim());
      if (parts.length === 2 && parts[1].startsWith('=')) { const a = parts[1].slice(1).split(',').map(s => s.trim()).filter(Boolean); if (!a.length) { bad = bad || (i + 1) + '번째 줄'; return; } out.push(a.length === 1 && X.parseNum(a[0]) ? { type: 'number', q: parts[0], answer: a[0] } : { type: 'text', q: parts[0], answer: a }); }
      else if (parts.length >= 3) { const ch = parts[1].split('/').map(s => s.trim()).filter(Boolean), n = parseInt(parts[2], 10) - 1; if (ch.length < 2 || !(n >= 0 && n < ch.length)) bad = bad || (i + 1) + '번째 줄'; else out.push({ type: 'choice', q: parts[0], choices: ch, answer: n }); }
      else bad = bad || (i + 1) + '번째 줄';
    });
    return { qs: out, bad };
  }
  const qsToText = qs => (qs || []).map(x => x.type === 'choice' ? x.q + ' | ' + x.choices.join(' / ') + ' | ' + (x.answer + 1) : x.q + ' | =' + (Array.isArray(x.answer) ? x.answer.join(',') : x.answer)).join('\n');
  async function fillMake() {
    const f = $('#mkForm'); if (!f) return;
    const book = $('#mkBook').value, no = +$('#mkNo').value; st.mk = { book, no };
    const r = await q(db.from('edu_book_lessons').select('*').eq('book_id', book).eq('no', no).maybeSingle());
    const b = r || { body: {} };
    $('#mkTitle').value = b.title || ''; $('#mkUrl').value = b.url || ''; $('#mkPages').value = b.pages || ''; $('#mkMins').value = b.mins || '';
    $('#mkPts').value = (b.body.points || []).join('\n'); $('#mkPsg').value = b.body.passage || ''; $('#mkQs').value = qsToText(b.body.questions);
    $('#mkState').textContent = r ? '저장된 내용을 불러왔어요' : '아직 비어 있는 강이에요';
  }
  function bindMake() {
    const f = $('#mkForm'); if (!f) return;
    $('#mkBook').onchange = () => { st.mk.no = null; const b = st.books.find(x => x.id === $('#mkBook').value); $('#mkNo').value = Math.min(b.current_no, b.total); $('#mkNo').max = b.total; fillMake(); updatePrompt(); };
    $('#mkNo').onchange = fillMake;
    fillMake();
  }
  async function saveMake(e) {
    e.preventDefault(); const err = $('#mkErr'); err.textContent = '';
    const book = $('#mkBook').value, no = +$('#mkNo').value, b = st.books.find(x => x.id === book);
    if (!(no >= 1 && no <= b.total)) { err.textContent = '강 번호는 1~' + b.total + ' 사이로 넣어 주세요.'; return; }
    const url = $('#mkUrl').value.trim(); if (url && !/^https?:\/\//.test(url)) { err.textContent = '강의 주소는 https:// 로 시작해야 해요.'; return; }
    const { qs, bad } = parseQs($('#mkQs').value); if (bad) { err.textContent = bad + ' 문제 형식을 확인해 주세요.'; return; }
    const rec = { book_id: book, no, title: $('#mkTitle').value.trim() || null, url: url || null, pages: $('#mkPages').value.trim() || null, mins: +$('#mkMins').value || null,
      body: { points: $('#mkPts').value.split('\n').map(s => s.trim()).filter(Boolean), passage: $('#mkPsg').value.trim() || undefined, questions: qs }, updated_at: new Date().toISOString() };
    await q(db.from('edu_book_lessons').upsert(rec, { onConflict: 'book_id,no' }));
    X.toast(b.title + ' ' + no + '강을 저장했어요'); $('#mkState').textContent = '저장했어요';
  }

  /* ── 여러 강 한꺼번에 (Claude 결과 붙여넣기) ── */
  function cardBulk(k) {
    const books = st.books.filter(b => b.kid_id === k.id);
    return '<div class="card"><h3>한 달치 한 번에 만들기</h3><p class="desc">① 요청문을 복사해 Claude에게 보내고 ② 받은 결과를 아래 칸에 그대로 붙여 넣으면 여러 강이 한 번에 들어가요. 강의 주소만 붙여도 돼요.</p>' +
      (books.length ? '<div class="f2 form" style="margin-bottom:10px"><label>강 범위 시작<input id="pA" type="number" min="1" value="' + (books.find(b => b.id === st.mk.book) || books[0]).current_no + '"></label><label>끝<input id="pB" type="number" min="1" value="' + Math.min((books.find(b => b.id === st.mk.book) || books[0]).current_no + 19, (books.find(b => b.id === st.mk.book) || books[0]).total) + '"></label></div><div class="prompt" id="promptBox"></div><div class="row end" style="margin-top:10px"><button class="btn small ghost" id="copyPrompt">요청문 복사</button></div>' +
        '<form class="form" id="bulkForm" style="margin-top:14px"><label>결과 붙여넣기 <small>' + esc('@강번호 | 제목 | 쪽수 | 주소 | 분 → 다음 줄부터 - 핵심, ? 문제, > 지문') + '</small><textarea id="bulk" style="min-height:160px" placeholder="@21 | 소수의 덧셈 | p.62~65 | https://... | 25&#10;- 소수점끼리 줄을 맞춰요.&#10;? 0.3 + 0.45는? | =0.75&#10;@22 | 소수의 뺄셈 | p.66~69"></textarea></label><div class="err" id="bulkErr"></div><div class="row end" style="margin-top:0"><button class="btn small" type="submit">위에서 고른 교재에 넣기</button></div></form>'
        : '<div class="empty" style="padding:20px">교재를 등록하면 쓸 수 있어요.</div>') + '</div>';
  }
  function updatePrompt() {
    const box = $('#promptBox'); if (!box) return;
    const b = st.books.find(x => x.id === ($('#mkBook') ? $('#mkBook').value : st.mk.book)); if (!b) return;
    const k = kid(), a = +$('#pA').value || 1, z = +$('#pB').value || a;
    box.textContent = '초등 ' + X.gradeOf(k) + '학년 EBS 「' + b.title + '」 교재 ' + a + '강~' + z + '강 학습 자료를 만들어 줘.\n' +
      '- 강마다 첫 줄: @강번호 | 강 제목 | 교재 쪽수(모르면 비워 두기) | | \n- 다음 줄들: - 로 시작하는 핵심 정리 3줄 (아이 말투, 짧게)\n' +
      '- ? 로 시작하는 확인 문제 3개: 객관식은 「? 문제 | 보기1 / 보기2 / 보기3 | 정답번호」, 숫자 답은 「? 문제 | =정답」\n' +
      (b.subject === 'read' ? '- > 로 시작하는 지문 1개 (' + X.gradeOf(k) + '학년이 혼자 읽을 300자 안팎)\n' : '') +
      '- 교재 문장을 그대로 옮기지 말고 새로 써 줘. 강 제목·순서가 확실하지 않으면 그 강 끝에 (확인 필요)라고 적어 줘.\n- 결과는 코드 블록 하나로만.';
  }
  function parseBulk(text) {
    const out = []; let cur = null, bad = '';
    text.replace(/```\w*/g, '').split('\n').forEach((raw, i) => {
      const line = raw.trim(); if (!line) return;
      if (line[0] === '@') { const p = line.slice(1).split('|').map(s => s.trim()); const no = parseInt(p[0], 10); if (!no) { bad = bad || (i + 1) + '번째 줄'; return; } cur = { no, title: p[1] || null, pages: p[2] || null, url: p[3] || null, mins: parseInt(p[4], 10) || null, points: [], qs: [], passage: '' }; out.push(cur); return; }
      if (!cur) return;
      if (line[0] === '-') cur.points.push(line.slice(1).trim());
      else if (line[0] === '?') { const r = parseQs(line.slice(1).trim()); if (r.bad) bad = bad || (i + 1) + '번째 줄'; else cur.qs.push(...r.qs); }
      else if (line[0] === '>') cur.passage += (cur.passage ? '\n' : '') + line.slice(1).trim();
    });
    return { lessons: out, bad };
  }
  async function saveBulk(e) {
    e.preventDefault(); const err = $('#bulkErr'); err.textContent = '';
    const book = $('#mkBook').value, b = st.books.find(x => x.id === book);
    const { lessons, bad } = parseBulk($('#bulk').value);
    if (bad) { err.textContent = bad + ' 형식을 확인해 주세요.'; return; }
    if (!lessons.length) { err.textContent = '@강번호 로 시작하는 줄이 없어요.'; return; }
    const ex = await q(db.from('edu_book_lessons').select('*').eq('book_id', book));
    const rows = lessons.filter(l => l.no >= 1 && l.no <= b.total).map(l => { const old = ex.find(x => x.no === l.no) || { body: {} };
      return { book_id: book, no: l.no, title: l.title || old.title || null, url: (l.url && /^https?:\/\//.test(l.url)) ? l.url : (old.url || null), pages: l.pages || old.pages || null, mins: l.mins || old.mins || null,
        body: { points: l.points.length ? l.points : (old.body.points || []), passage: l.passage || old.body.passage || undefined, questions: l.qs.length ? l.qs : (old.body.questions || []) }, updated_at: new Date().toISOString() }; });
    await q(db.from('edu_book_lessons').upsert(rows, { onConflict: 'book_id,no' }));
    X.toast(b.title + '에 ' + rows.length + '개 강을 넣었어요'); $('#bulk').value = ''; fillMake();
  }

  /* ── 리포트 ── */
  function weekStat(k) {
    const mon = new Date(); mon.setDate(mon.getDate() - (todayDow === 0 ? 6 : todayDow - 1)); let sch = 0, dn = 0;
    for (let d = new Date(mon); X.ymd(d) <= today; d.setDate(d.getDate() + 1)) {
      const key = X.ymd(d); st.plans.filter(p => p.kid_id === k.id && appliesOn(p, key) && p.kind !== 'task').forEach(p => { sch++; if (st.logs.some(l => l.plan_id === p.id && l.day === key && l.status === 'done')) dn++; });
    }
    return { sch, dn };
  }
  function cardReport() {
    const kids = st.kids.map(k => {
      const w = weekStat(k), agg = {};
      st.logs.filter(l => l.kid_id === k.id && l.status === 'done' && l.total).forEach(l => { const s = l.subject; agg[s] = agg[s] || { a: 0, b: 0 }; agg[s].a += l.score || 0; agg[s].b += l.total; });
      const bars = ORDER.map(s => { const g = agg[s], v = g && g.b ? Math.round(g.a / g.b * 100) : null; return '<div class="bar"><span>' + S[s].name + '</span><span class="tr"><span class="fl" style="width:' + (v || 0) + '%;background:' + S[s].col + '"></span></span><span class="v num">' + (v == null ? '–' : v + '%') + '</span></div>'; }).join('');
      const tl = st.plans.filter(p => p.kid_id === k.id && appliesOn(p, today)).map(p => {
        const lg = st.logs.filter(l => l.plan_id === p.id && l.day === today), d = lg.find(l => l.status === 'done'), sj = S[p.kind === 'task' ? 'etc' : p.kind === 'drill' ? 'calc' : p.subject] || S.link;
        return '<div>' + sj.emoji + ' <span>' + esc(d && d.detail && d.detail.title ? d.detail.title : (p.title || sj.name)) + '</span><span class="st" style="color:' + (d ? 'var(--ok)' : lg.some(l => l.status === 'watched') ? 'var(--brand)' : 'var(--faint)') + '">' + (d ? '✓ ' + (d.total ? d.score + '/' + d.total : '완료') : lg.some(l => l.status === 'watched') ? '강의 봄' : '아직') + '</span></div>';
      }).join('');
      return '<div class="kid"><div class="kid-h"><span class="avatar" style="background:' + esc(k.color) + '22">' + esc(k.emoji) + '</span><b>' + esc(k.name) + '</b><span class="num" style="color:var(--muted);font-size:13px">' + X.gradeOf(k) + '학년</span>' +
        '<span class="kid-week num">이번 주 <b>' + w.dn + '</b> / ' + w.sch + ' 완료 · 오답 ' + st.review.filter(r => r.kid_id === k.id).length + '개</span></div>' +
        '<div class="todayl"><b style="font-size:13px;color:var(--muted)">오늘</b>' + (tl || '<div style="color:var(--faint)">배정 없음</div>') + '</div><div class="bars">' + bars + '</div></div>';
    }).join('');
    return '<div class="card" id="report"><h3>아이별 리포트</h3><p class="desc">막대는 최근 30일 「문제를 맞힌 비율」이에요. 아이가 풀면 바로 반영돼요(새로고침).</p>' + kids + '</div>';
  }
  function cardRecent(k) {
    const logs = st.logs.filter(l => l.kid_id === k.id && l.status === 'done').slice(0, 14), rev = st.review.filter(r => r.kid_id === k.id).slice(0, 12);
    return '<div class="card"><h3>' + esc(k.name) + ' 최근 기록 · 오답</h3><div class="scroll-x"><table class="logtbl"><thead><tr><th>날짜</th><th>내용</th><th>점수</th><th>틀린 문제 → 아이 답</th></tr></thead><tbody>' +
      (logs.map(l => '<tr><td class="num" style="white-space:nowrap">' + l.day.slice(5).replace('-', '/') + '</td><td>' + (S[subjOfLog(l)] || S.link).emoji + ' ' + esc((l.detail && l.detail.title) || l.item_key || '') + (l.plan_id ? '' : ' <small style="color:var(--brand)">스스로</small>') + '</td><td class="num">' + (l.total ? l.score + '/' + l.total : '✓') + '</td><td style="font-size:13px;color:var(--muted)">' + ((l.detail && l.detail.wrong) || []).map(w => fh(String(w.q).slice(0, 34)) + ' → <b>' + esc(w.given) + '</b>').join('<br>') + '</td></tr>').join('') || '<tr><td colspan="4" style="color:var(--faint)">아직 기록이 없어요</td></tr>') + '</tbody></table></div>' +
      (rev.length ? '<h3 style="margin-top:16px;font-size:16px">오답노트 (' + st.review.filter(r => r.kid_id === k.id).length + ')</h3><div class="tasks">' + rev.map(r => '<div class="tk"><span class="t" style="font-weight:500">' + fh(r.q.q) + ' <small style="color:var(--ok)">정답 ' + fh(X.answerText(r.q)) + '</small></span><button class="mini" data-clr="' + r.id + '">빼기</button></div>').join('') + '</div>' : '') + '</div>';
  }
  function cardRoutine() {
    return '<div class="card"><h3>엄마 루틴</h3><p class="desc">조각 시간에 맞춘 운영 주기예요.</p><ul class="routine">' +
      '<li><b>매일 3분</b><span>리포트·오답 확인, 도장에 한마디<small>저녁 먹고 아이와 같이 보기</small></span></li>' +
      '<li><b>주 1회 15분</b><span>다음 주 교재 강 주소 붙이기<small>EBS 강좌 페이지에서 5강씩 복사 → 학습 만들기</small></span></li>' +
      '<li><b>월 1회 20분</b><span>Claude로 다음 달 핵심 정리·문제 묶음 만들기<small>요청문 복사 → 결과 붙여넣기 → 검수</small></span></li>' +
      '<li><b>학기 초</b><span>새 교재 등록 · 강좌 주소 다시 확인<small>EBS 강좌 주소는 3월·8월에 바뀔 수 있어요</small></span></li></ul></div>';
  }

  /* ── 기본 자료함 (내장 콘텐츠 검수 + EBS 주소 연결) ── */
  function libSection() {
    const L = st.lib, over = {}; st.mats.forEach(m => { if (m.body && m.body.lib_id) over[m.body.lib_id] = m; });
    let h = '<details class="lib"><summary>기본 자료함 · 1~6학년 내장 콘텐츠 ' + X.LIB.length + '개 + 연산 ' + X.CALC.length + '주제</summary><p class="desc" style="margin-top:8px">교재가 없는 과목은 이 순서로 진도가 나가요. 단원마다 정확한 EBS·유튜브 강의 주소를 붙이면 아이 화면 「강의 듣기」가 그 강의로 열려요. 「미리보기」로 설명·정답을 검수해요.</p>' +
      '<div class="tabs" style="margin-bottom:10px">' + ORDER.map(s => '<button data-ls="' + s + '" aria-pressed="' + (L.subject === s) + '">' + S[s].emoji + ' ' + S[s].short + '</button>').join('') + '</div>' +
      '<div class="tabs" style="margin-bottom:12px">' + [1, 2, 3, 4, 5, 6].map(g => '<button data-lg="' + g + '" aria-pressed="' + (L.grade === g) + '">' + g + '학년</button>').join('') + '</div>';
    if (L.subject === 'calc') h += '<div class="ulist">' + X.CALC.filter(c => c[1] === L.grade).map(c => { const ex = X.makeCalc(c[0], 3, 'preview'); return '<div class="urow"><span class="no">' + c[2] + '학기</span><span class="t"><b>' + esc(c[3]) + '</b><small>' + esc(c[4]) + '<br>예: ' + ex.questions.map(x => fh(x.q) + ' <b>' + fh(X.answerText(x)) + '</b>').join(' · ') + '</small></span></div>'; }).join('') + '</div>';
    else h += '<div class="ulist">' + X.LIB.filter(x => x.subject === L.subject && x.grades.includes(L.grade)).sort((a, b) => (a.track || '').localeCompare(b.track || '') || (a.sem || 0) - (b.sem || 0) || a.order - b.order).map(x => {
      const e = X.ebsFor(x, L.grade, {}), o = over[x.id];
      return '<div class="urow" style="flex-wrap:wrap"><span class="no">' + (x.track === 'history' ? '史' : x.sem ? x.sem + '-' + x.order : x.order) + '</span><span class="t"><b>' + esc(x.title) + '</b><small>' + esc(x.goal || x.era || '') + ' · 기본 연결: <a href="' + esc(e.url) + '" target="_blank">' + esc(e.label) + '</a></small></span>' +
        '<input class="ovin" data-ov="' + x.id + '" placeholder="EBS·유튜브 강의 주소 붙여넣기" value="' + esc(o ? o.url : '') + '"><button class="mini" data-pv="' + x.id + '">미리보기</button><div class="pv" id="pv-' + x.id + '" hidden></div></div>'; }).join('') + '</div>';
    return h + '</details>';
  }
  function preview(x) {
    let h = '';
    if (x.passage) h += '<p class="passage" style="font-size:15px">' + esc(x.passage) + '</p>';
    (x.explain || x.story || []).forEach(p => h += '<p>' + fh(p) + '</p>');
    if (x.subject === 'word') h += '<p>' + (x.words || []).map(w => esc((w.emoji || '') + ' ' + w.en + ' = ' + w.ko)).join(' · ') + '</p>';
    if (x.dialog) h += '<p>' + x.dialog.map(l => esc(l.who + ': ' + l.en)).join('<br>') + '</p>';
    return h + '<ol>' + (x.questions || []).map(qq => '<li>' + fh(qq.q) + '<br><small>정답: <b style="color:var(--ok)">' + fh(X.answerText(qq)) + '</b>' + (qq.choices ? ' (보기: ' + qq.choices.map(esc).join(' / ') + ')' : '') + '</small></li>').join('') + '</ol>';
  }

  /* ── 설정 ── */
  function cardKids() {
    const sy = X.schoolYear();
    return '<div class="card"><div class="row between"><h3>아이 설정</h3><button class="btn small ghost" data-addkid>+ 아이 추가</button></div><p class="desc">학년은 입학 연도로 매년 3월에 자동으로 올라가요. 과목별로 학년보다 쉽게/어렵게 조정할 수 있어요.</p>' + st.kids.map(k =>
      '<div class="kid" data-k="' + k.id + '"><div class="kid-h"><input class="inp" data-f="emoji" value="' + esc(k.emoji) + '" style="width:58px;text-align:center;font-size:22px"><input class="inp" data-f="name" value="' + esc(k.name) + '" style="width:120px;font-weight:700"><input type="color" data-f="color" value="' + esc(k.color) + '" style="width:44px;height:40px;border:1px solid var(--line-strong);border-radius:8px">' +
      '<select class="inp" data-f="entry_year" style="width:auto">' + Array.from({ length: 12 }, (_, i) => sy - 6 + i).map(y => '<option value="' + y + '"' + (y === k.entry_year ? ' selected' : '') + '>' + y + '년 입학 → ' + ((sy - y + 1) >= 1 && (sy - y + 1) <= 6 ? (sy - y + 1) + '학년' : '범위 밖') + '</option>').join('') + '</select></div>' +
      '<div class="f3 form" style="margin-top:10px">' + ORDER.map(s => { const off = (k.levels && k.levels[s]) || 0; return '<label>' + S[s].emoji + ' ' + S[s].short + ' <small>지금 ' + X.levelOf(k, s) + '학년</small><select data-lv="' + s + '">' + [-2, -1, 0, 1, 2].map(o => '<option value="' + o + '"' + (o === off ? ' selected' : '') + '>' + (o === 0 ? '학년 그대로' : o < 0 ? o + '학년 (쉽게)' : '+' + o + '학년') + '</option>').join('') + '</select></label>'; }).join('') + '</div>' +
      '<div class="row" style="margin-top:10px"><button class="btn small" data-savekid="' + k.id + '">저장</button><button class="btn small ghost" data-reward="' + k.id + '">🎁 보상 줬어요 (도장 0부터)</button></div></div>').join('') + '</div>';
  }
  function cardFamily() {
    const url = location.href.replace(/admin\.html.*$/, '');
    return '<div class="card"><h3>가족코드 · 보상</h3><div class="form"><label>새 가족코드 <small>6자 이상 · 바꾸면 태블릿에서 다시 넣어야 해요</small><input id="nc" autocomplete="off" placeholder="새 가족코드"></label><div class="row end" style="margin-top:0"><button class="btn small" id="setc">가족코드 바꾸기</button></div>' +
      '<label>가족 이름 <small>아이 화면 맨 위에 보여요</small><input id="fn" maxlength="20" value="' + esc(st.family.family_name || '') + '"></label><div class="f2"><label>도장 목표<input id="rg" type="number" min="5" max="500" value="' + (st.family.reward_goal || 30) + '"></label><label>보상 약속<input id="rt" maxlength="60" value="' + esc(st.family.reward_text || '') + '"></label></div><div class="row end" style="margin-top:0"><button class="btn small" id="setr">가족 이름·보상 저장</button></div></div>' +
      '<h3 style="margin-top:18px;font-size:16px">📱 태블릿 준비 (한 번만)</h3><ol style="line-height:1.9;margin:6px 0 0;padding-left:20px;font-size:14px"><li>크롬에서 <b>' + esc(url) + '</b> 열기 → 가족코드 → 얼굴 선택</li><li>크롬 메뉴(⋮) → <b>홈 화면에 추가</b></li><li>같은 크롬에서 <a href="' + X.EBS.login + '" target="_blank">EBS 초등 로그인</a> (안 하면 5분 미리보기)</li></ol></div>';
  }

  /* ── 이벤트 ── */
  document.addEventListener('click', async e => {
    const t = e.target.closest('button,a'); if (!t) return; const d = t.dataset;
    try {
      if (t.id === 'lo') { await db.auth.signOut(); return login(); }
      if (d.kid) { st.kidSel = d.kid; st.mk = { book: null, no: null }; render(); return; }
      if (d.cell) { const [s, w] = d.cell.split(':'); t.disabled = true; await toggleCell(s, +w); return; }
      if (d.twd) { const [id, w] = d.twd.split(':'); const p = st.plans.find(x => x.id === id); const set = new Set(p.weekdays || []); set.has(+w) ? set.delete(+w) : set.add(+w); p.weekdays = [...set].sort(); t.setAttribute('aria-pressed', set.has(+w)); await q(db.from('edu_plan').update({ weekdays: p.weekdays }).eq('id', id)); return; }
      if (d.tedit) { st.editTask = d.tedit; render(); const i = $('[data-tedit="' + d.tedit + '"] input[name=t]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } return; }
      if (d.tcancel != null) { st.editTask = null; render(); return; }
      if (d.pick) { t.setAttribute('aria-pressed', t.getAttribute('aria-pressed') !== 'true'); return; }
      if (d.delplan) { if (!confirm('이 일정을 지울까요? (이미 한 기록은 남아요)')) return; await q(db.from('edu_plan').delete().eq('id', d.delplan)); await reload('plans'); return; }
      if (d.addlink != null) { const title = prompt('강의 제목 (예: 만점왕 수학 4-2 7강)'); if (!title) return; const url = prompt('강의 주소 (EBS 또는 유튜브)'); if (!url || !/^https?:\/\//.test(url)) return X.toast('주소를 확인해 주세요'); const day = prompt('언제 볼까요? 날짜 (예: ' + today + ')', today); if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return; await q(db.from('edu_plan').insert({ kid_id: st.kidSel, kind: 'link', subject: 'link', on_date: day, title, payload: { url }, sort: 60 })); await reload('plans'); X.toast('넣었어요'); return; }
      if (d.copysched != null) { const k = kid(), o = st.kids.find(x => x.id !== k.id); if (!o) return; if (!confirm(o.name + '의 요일 편성을 ' + k.name + '에게 똑같이 적용할까요? (과목·요일만, 진도는 각자)')) return;
        for (const s of ORDER) { const src = mainPlan(o.id, s), dst = mainPlan(k.id, s); const wd = src && src.active ? src.weekdays : [];
          if (dst) await q(db.from('edu_plan').update({ weekdays: wd }).eq('id', dst.id)); else if (wd.length) await q(db.from('edu_plan').insert({ kid_id: k.id, kind: src.kind, subject: src.subject, weekdays: wd, ref: src.ref, payload: src.payload, sort: src.sort })); }
        await reload('plans'); X.toast('편성을 복사했어요'); return; }
      if (d.bno) { const [id, dlt] = d.bno.split(':'); const b = st.books.find(x => x.id === id); const n = Math.max(1, Math.min(b.total + 1, b.current_no + +dlt)); await q(db.from('edu_books').update({ current_no: n }).eq('id', id)); await reload('books'); return; }
      if (d.btog) { const b = st.books.find(x => x.id === d.btog); await q(db.from('edu_books').update({ active: !b.active }).eq('id', b.id)); await reload('books'); return; }
      if (d.bcov) { const b = st.books.find(x => x.id === d.bcov); const v = prompt('「' + b.title + '」 표지 이미지 주소 (https://…)\n비우고 확인하면 EBS 강좌 대표 이미지를 써요', b.cover_url || ''); if (v === null) return; const u = v.trim();
        if (u && !/^https:\/\//.test(u)) { X.toast('주소는 https:// 로 시작해야 해요'); return; } await q(db.from('edu_books').update({ cover_url: u || null }).eq('id', b.id)); await reload('books'); X.toast('표지를 바꿨어요'); return; }
      if (d.bdel) { const b = st.books.find(x => x.id === d.bdel); if (!confirm('「' + b.title + '」 교재와 강별 내용을 지울까요? (아이 기록은 남아요)')) return; await q(db.from('edu_books').delete().eq('id', b.id)); await reload('books'); return; }
      if (d.bmk) { st.mk = { book: d.bmk, no: null }; render(); $('#make').scrollIntoView({ behavior: 'smooth' }); return; }
      if (d.clr) { await q(db.from('edu_review').update({ cleared_at: new Date().toISOString() }).eq('id', d.clr)); st.review = st.review.filter(r => String(r.id) !== d.clr); render(); return; }
      if (d.ls) { st.lib.subject = d.ls; rerenderLib(); return; }
      if (d.lg) { st.lib.grade = +d.lg; rerenderLib(); return; }
      if (d.pv) { const el = $('#pv-' + d.pv); el.hidden = !el.hidden; if (!el.hidden) el.innerHTML = preview(X.LIB_MAP[d.pv]); return; }
      if (t.id === 'copyPrompt') { updatePrompt(); const txt = $('#promptBox').textContent; try { await navigator.clipboard.writeText(txt); X.toast('요청문을 복사했어요'); } catch (er) { const r = document.createRange(); r.selectNodeContents($('#promptBox')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); X.toast('선택됐어요. 길게 눌러 복사하세요'); } return; }
      if (d.savekid) { const c = t.closest('[data-k]'), f = n => c.querySelector('[data-f="' + n + '"]'), levels = {}; $$('[data-lv]', c).forEach(s => { if (+s.value) levels[s.dataset.lv] = +s.value; });
        await q(db.from('edu_kids').update({ name: f('name').value.trim(), emoji: f('emoji').value.trim() || '🙂', color: f('color').value, entry_year: +f('entry_year').value, levels }).eq('id', d.savekid)); await reload(); X.toast('저장했어요'); return; }
      if (d.addkid != null) { const name = prompt('아이 이름'); if (!name || !name.trim()) return; const g = parseInt(prompt('지금 몇 학년? (1~6)', '1'), 10); if (!(g >= 1 && g <= 6)) return X.toast('학년은 1~6으로 적어 주세요');
        const { data: nk, error: ke } = await db.from('edu_kids').insert({ name: name.trim(), entry_year: X.schoolYear() - g + 1, emoji: '🐰', color: '#1aae39', sort: st.kids.length + 1 }).select().single(); if (ke) return X.toast('오류: ' + ke.message);
        const base = [['lesson', 'read', [1, 2, 3, 4, 5], 'next', null, {}, 10], ['drill', 'calc', [1, 2, 3, 4, 5], 'auto', null, { count: g <= 2 ? 8 : 10 }, 20], ['lesson', 'word', [1, 2, 3, 4, 5], 'next', null, {}, 30], ['lesson', 'math', [1, 4], 'next', null, {}, 40], ['lesson', 'eng', [2, 5], 'next', null, {}, 41], ['lesson', 'soc', [3], 'next', null, { track: 'history' }, 42], ['task', 'etc', [1, 2, 3, 4, 5], null, '알림장 보고 학교 숙제 확인하기', {}, 100]];
        await q(db.from('edu_plan').insert(base.map(b => ({ kid_id: nk.id, kind: b[0], subject: b[1], weekdays: b[2], ref: b[3], title: b[4], payload: b[5], sort: b[6] }))));
        st.kidSel = nk.id; await reload(); X.toast(name + ' 등록! 기본 시간표를 넣어 뒀어요'); return; }
      if (d.reward) { if (!confirm('보상을 줬나요? 칭찬 도장을 0부터 다시 모아요.')) return; await q(db.from('edu_kids').update({ reward_since: new Date().toISOString() }).eq('id', d.reward)); X.toast('도장을 새로 모아요 🎁'); return; }
      if (t.id === 'setc') { const c = $('#nc').value.trim(); if (c.length < 6) return X.toast('6자 이상으로 정해 주세요'); const { error: ce } = await db.rpc('edu_set_code', { p_code: c }); if (ce) return X.toast(/code_taken/.test(ce.message) ? '다른 가족이 쓰는 코드예요. 다른 코드로 정해 주세요' : '오류: ' + ce.message); $('#nc').value = ''; X.toast('가족코드를 바꿨어요. 태블릿에서 새 코드를 넣어 주세요'); return; }
      if (t.id === 'setr') { await q(db.from('edu_families').update({ family_name: $('#fn').value.trim() || '우리집 배움터', reward_goal: Math.max(5, +$('#rg').value || 30), reward_text: $('#rt').value.trim(), updated_at: new Date().toISOString() }).eq('id', st.family.id)); await reload(); X.toast('저장했어요'); return; }
    } catch (er) { t.disabled = false; }
  });
  function rerenderLib() { const el = $('#lib'); el.innerHTML = libSection(); el.querySelector('details').open = true; }
  document.addEventListener('change', async e => {
    const t = e.target;
    if (t.dataset && t.dataset.ov) {
      const id = t.dataset.ov, url = t.value.trim(), o = st.mats.find(m => m.body && m.body.lib_id === id);
      if (url && !/^https?:\/\//.test(url)) return X.toast('주소는 https:// 로 시작해야 해요');
      if (!url && o) await q(db.from('edu_materials').delete().eq('id', o.id));
      else if (url && o) await q(db.from('edu_materials').update({ url, checked_on: today }).eq('id', o.id));
      else if (url) { const x = X.LIB_MAP[id]; await q(db.from('edu_materials').insert({ subject: x.subject, grades: x.grades, title: 'EBS · ' + x.title, url, body: { lib_id: id }, status: 'ready', checked_on: today })); }
      st.mats = await q(db.from('edu_materials').select('*').order('created_at', { ascending: false })); X.toast(url ? '강의를 연결했어요' + (X.ytId(url) ? ' (유튜브: 화면 안에서 재생)' : '') : '연결을 지웠어요');
    }
    if (t.id === 'pA' || t.id === 'pB') updatePrompt();
  });
  document.addEventListener('submit', async e => {
    const f = e.target; e.preventDefault();
    try {
      if (f.id === 'mkForm') return await saveMake(e);
      if (f.id === 'bulkForm') return await saveBulk(e);
      if (f.dataset.tedit) {
        const p = st.plans.find(x => x.id === f.dataset.tedit), title = f.t.value.trim(), note = f.n.value.trim();
        if (!title) return X.toast('할 일을 적어 주세요');
        const payload = Object.assign({}, p.payload || {}); if (note) payload.note = note; else delete payload.note;
        const upd = { title, payload }; if (f.d) { if (!f.d.value) return X.toast('날짜를 골라 주세요'); upd.on_date = f.d.value; }
        await q(db.from('edu_plan').update(upd).eq('id', p.id)); st.editTask = null; await reload('plans'); X.toast('고쳤어요'); return;
      }
      if (f.id === 'taskForm') {
        const title = $('#tt').value.trim(); if (!title) return X.toast('할 일을 적어 주세요');
        const date = $('#td').value, wd = $$('#tw [data-pick]').filter(b => b.getAttribute('aria-pressed') === 'true').map(b => +b.dataset.pick);
        if (!date && !wd.length) return X.toast('요일이나 날짜를 골라 주세요');
        await q(db.from('edu_plan').insert({ kid_id: st.kidSel, kind: 'task', subject: 'etc', title, weekdays: date ? [] : wd, on_date: date || null, payload: $('#tn').value.trim() ? { note: $('#tn').value.trim() } : {}, sort: 100 }));
        await reload('plans'); X.toast('체크리스트에 넣었어요'); return;
      }
      if (f.id === 'bookForm') {
        const err = $('#bErr'); err.textContent = '';
        const rec = { kid_id: st.kidSel, subject: $('#bs').value, title: $('#bt').value.trim(), total: +$('#bn').value || 20, current_no: Math.max(1, +$('#bc').value || 1), course_url: $('#bu').value.trim() || null, cover_url: $('#bcv').value.trim() || null };
        if (!rec.title) { err.textContent = '교재 이름을 적어 주세요.'; return; }
        if (rec.course_url && !/^https?:\/\//.test(rec.course_url)) { err.textContent = '주소는 https:// 로 시작해야 해요.'; return; }
        if (rec.cover_url && !/^https:\/\//.test(rec.cover_url)) { err.textContent = '표지 주소는 https:// 로 시작해야 해요.'; return; }
        if (bookOf(st.kidSel, rec.subject)) { if (!confirm('이 과목에 쓰는 교재가 이미 있어요. 기존 교재는 쉬게 하고 새 교재로 진도를 나갈까요?')) return; await q(db.from('edu_books').update({ active: false }).eq('kid_id', st.kidSel).eq('subject', rec.subject)); }
        await q(db.from('edu_books').insert(rec));
        if (!mainPlan(st.kidSel, rec.subject)) await q(db.from('edu_plan').insert({ kid_id: st.kidSel, kind: rec.subject === 'calc' ? 'drill' : 'lesson', subject: rec.subject, weekdays: [1, 2, 3, 4, 5], ref: rec.subject === 'calc' ? 'auto' : 'next', payload: {}, sort: 40 }));
        st.books = await q(db.from('edu_books').select('*').order('created_at')); st.plans = await all(() => db.from('edu_plan').select('*').order('sort').order('created_at'));
        st.mk = { book: st.books[st.books.length - 1].id, no: null }; render(); X.toast('교재를 등록했어요. 학습 만들기에서 강 내용을 넣어요'); return;
      }
    } catch (er) { }
  });
  boot();
})();
