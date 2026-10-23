/* 우리집 배움터 — 엄마 관리 화면 */
(function () {
  'use strict';
  const X = window.EDU, S = X.SUBJECTS, esc = X.esc;
  const $ = (s, el) => (el || document).querySelector(s);
  const app = $('#app');
  const db = X.sb();
  const st = { tab: 'today', kids: [], plans: [], mats: [], family: {}, kidSel: null, day: X.ymd(), lib: { subject: 'math', grade: 4 } };

  // 1000행 넘는 조회는 나눠서 모두 가져오기
  async function all(make) { let out = [], from = 0; for (;;) { const d = await q(make().range(from, from + 999)); out = out.concat(d || []); if (!d || d.length < 1000) return out; from += 1000; } }
  async function q(p) { const { data, error } = await p; if (error) { X.toast('오류: ' + error.message); throw error; } return data; }

  /* ── 로그인 ── */
  async function boot() {
    const { data: { session } } = await db.auth.getSession();
    if (!session) return login();
    const { data: ok } = await db.rpc('edu_is_parent');
    if (!ok) { app.innerHTML = '<div class="gate"><div class="box"><h1>권한이 없어요</h1><p>' + esc(session.user.email) + ' 계정은 엄마 계정으로 등록되어 있지 않아요.</p><button class="btn btn-secondary" id="lo">로그아웃</button></div></div>'; $('#lo').onclick = async () => { await db.auth.signOut(); login(); }; return; }
    st.email = session.user.email; await loadAll(); render();
  }
  function login(msg) {
    app.innerHTML = '<div class="gate"><div class="box" style="max-width:460px"><div style="font-size:52px">🔐</div><h1>엄마 페이지</h1><p>' + esc(msg || '수퍼베이스 계정으로 로그인해 주세요') + '</p>' +
      '<input class="codein" style="letter-spacing:0;font-size:18px" id="em" type="email" placeholder="이메일" value="yeba.ak@gmail.com"><input class="codein" style="letter-spacing:0;font-size:18px" id="pw" type="password" placeholder="비밀번호"><br><button class="btn btn-primary btn-lg" id="go">로그인</button><p style="margin:18px 0 0"><a href="index.html">← 아이 화면</a></p></div></div>';
    const go = async () => { const { error } = await db.auth.signInWithPassword({ email: $('#em').value.trim(), password: $('#pw').value }); if (error) return login('로그인 실패: ' + error.message); boot(); };
    $('#go').onclick = go; $('#pw').onkeydown = e => { if (e.key === 'Enter') go(); };
  }
  async function loadAll() {
    [st.kids, st.plans, st.mats, st.family] = await Promise.all([
      q(db.from('edu_kids').select('*').order('sort')), q(db.from('edu_plan').select('*').order('sort').order('created_at')),
      q(db.from('edu_materials').select('*').order('created_at', { ascending: false })), q(db.from('edu_family').select('id,family_name,reward_goal,reward_text,updated_at').eq('id', 1).maybeSingle())]);
    st.family = st.family || {};
    if (!st.kidSel || !st.kids.find(k => k.id === st.kidSel)) st.kidSel = (st.kids[0] || {}).id;
  }

  function render() {
    const tabs = [['today', '오늘 현황'], ['plan', '시간표·체크리스트'], ['result', '학습 결과'], ['lib', '자료함'], ['kids', '아이 설정'], ['family', '가족코드·보상']];
    app.innerHTML = '<header class="topbar"><div class="wrap"><div class="logo"><span class="mark">🏡</span><span>엄마 페이지</span></div><nav class="nav">' + tabs.map(t => '<button data-t="' + t[0] + '" class="' + (st.tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>').join('') +
      '</nav><a class="btn btn-util" href="index.html">아이 화면</a><button class="btn btn-ghost" id="lo">로그아웃</button></div></header><main class="wrap" id="main" style="padding-bottom:60px"></main>';
    app.querySelectorAll('.nav button').forEach(b => b.onclick = () => { st.tab = b.dataset.t; render(); });
    $('#lo').onclick = async () => { await db.auth.signOut(); login(); };
    ({ today: vToday, plan: vPlan, result: vResult, lib: vLib, kids: vKids, family: vFamily })[st.tab]();
  }
  const kidTabs = () => '<div class="tabs">' + st.kids.map(k => '<button data-kid="' + k.id + '" class="' + (k.id === st.kidSel ? 'on' : '') + '">' + esc(k.emoji + ' ' + k.name) + ' · ' + X.gradeOf(k) + '학년</button>').join('') + '</div>';
  const bindKidTabs = fn => document.querySelectorAll('[data-kid]').forEach(b => b.onclick = () => { st.kidSel = b.dataset.kid; fn(); });
  const kidOf = id => st.kids.find(k => k.id === id);

  /* 시간표 항목을 사람이 읽는 말로 */
  function planLabel(p, kid, doneSet, day) {
    const d = day ? X.parseYmd(day) : new Date(), sem = X.semester(d);
    if (p.kind === 'task') return p.title + (p.payload && p.payload.note ? ' (' + p.payload.note + ')' : '') + (p.payload && p.payload.by_kid ? ' · 아이가 추가' : '');
    if (p.kind === 'link') return '🎬 ' + (p.title || '강의 링크');
    const lv = kid ? X.levelOf(kid, p.subject, d) : null;
    if (p.kind === 'drill') { if (p.ref && p.ref !== 'auto' && X.CALC_MAP[p.ref]) return X.CALC_MAP[p.ref].name + ' · ' + (p.payload.count || 10) + '문제'; return '학년 연산 자동 (' + (lv ? lv + '학년' : '') + (day && lv ? ': ' + X.autoCalcTopic(lv, day, sem).name : '') + ') · ' + (p.payload.count || 10) + '문제'; }
    if (p.ref && p.ref.startsWith('MAT:')) { const m = st.mats.find(m => m.id === p.ref.slice(4)); return '📁 ' + (m ? m.title : '삭제된 자료'); }
    if (p.ref && p.ref !== 'next' && X.LIB_MAP[p.ref]) return X.LIB_MAP[p.ref].title + ' (지정)';
    const track = p.subject === 'soc' ? (p.payload.track || 'history') : null;
    let t = '자동 다음 진도' + (track ? (track === 'history' ? ' · 이야기 한국사' : ' · 사회') : '');
    if (doneSet && lv) { const n = X.nextItem(p.subject, lv, sem, doneSet, track); if (n) t += ' → ' + n.title; }
    return t;
  }
  const subjOf = p => p.kind === 'task' ? 'etc' : p.kind === 'link' ? 'link' : p.kind === 'drill' ? 'calc' : p.subject;
  const appliesOn = (p, day) => p.active && (p.on_date === day || (!p.on_date && (p.weekdays || []).includes(X.parseYmd(day).getDay())));

  /* ── 1. 오늘 현황 ── */
  async function vToday() {
    const m = $('#main'); m.innerHTML = '<div class="sec-h"><h2>오늘 현황</h2><input type="date" id="day" value="' + st.day + '" class="btn-util"></div><div id="tbody"><div class="spin"></div></div>';
    $('#day').onchange = e => { st.day = e.target.value; vToday(); };
    const from = X.ymd(new Date(X.parseYmd(st.day).getTime() - 6 * 864e5));
    const [logs, done, rev] = await Promise.all([all(() => db.from('edu_logs').select('*').gte('day', from).lte('day', st.day).order('id')), q(db.rpc('edu_parent_done')), all(() => db.from('edu_review').select('kid_id').is('cleared_at', null).order('id'))]);
    let h = '<div class="grid g2">';
    st.kids.forEach(k => {
      const ds = new Set(done.filter(x => x.kid_id === k.id).map(x => x.item_key));
      const plans = st.plans.filter(p => p.kid_id === k.id && appliesOn(p, st.day));
      const dl = logs.filter(l => l.kid_id === k.id && l.day === st.day);
      const extra = dl.filter(l => l.status === 'done' && !l.plan_id);
      const doneN = plans.filter(p => dl.some(l => l.plan_id === p.id && l.status === 'done')).length;
      h += '<div class="card"><div style="display:flex;align-items:center;gap:12px;padding:18px 20px;border-bottom:1px solid var(--line)"><span style="font-size:34px">' + esc(k.emoji) + '</span><div style="flex:1"><b style="font-size:20px">' + esc(k.name) + '</b> <span class="pill">' + X.gradeOf(k) + '학년</span><div style="color:var(--muted);font-size:14px">' + X.fmtDate(st.day) + ' · 오답 대기 ' + rev.filter(r => r.kid_id === k.id).length + '개</div></div><b style="font-size:26px">' + doneN + '/' + plans.length + '</b></div><div class="ulist">';
        plans.forEach(p => {
          const pl = dl.filter(l => l.plan_id === p.id), d = pl.filter(l => l.status === 'done').pop();
          const s = S[subjOf(p)] || S.etc;
          const stt = d ? '<span class="ok">✓ ' + (d.total ? d.score + '/' + d.total : '완료') + '</span>' : pl.some(l => l.status === 'watched') ? '<span style="color:var(--orange)">강의 봄</span>' : pl.some(l => l.status === 'opened') ? '<span style="color:var(--muted)">강의 열어 봄</span>' : '<span style="color:var(--faint)">아직</span>';
          const title = d && d.detail && d.detail.title ? d.detail.title : planLabel(p, k, ds, st.day);
          h += '<div class="urow"><span class="no">' + s.emoji + '</span><span class="t"><b style="font-size:15px">' + esc(title) + '</b><small>' + s.name + (d && d.detail && d.detail.wrong && d.detail.wrong.length ? ' · 틀린 문제 ' + d.detail.wrong.length : '') + (d && d.detail && d.detail.secs ? ' · ' + Math.round(d.detail.secs / 60) + '분' : '') + '</small></span>' + stt + '</div>';
        });
        extra.forEach(l => h += '<div class="urow"><span class="no">⭐</span><span class="t"><b style="font-size:15px">' + esc((l.detail && l.detail.title) || l.item_key) + '</b><small>스스로 더 공부함</small></span><span class="ok">' + (l.total ? l.score + '/' + l.total : '✓') + '</span></div>');
        if (!plans.length && !extra.length) h += '<div class="urow"><span class="t" style="color:var(--muted)">이 날은 배정된 학습이 없어요</span></div>';
      // 최근 7일
      h += '</div><div style="padding:14px 20px;border-top:1px solid var(--line);display:flex;gap:6px">';
      for (let i = 6; i >= 0; i--) { const dd = X.ymd(new Date(X.parseYmd(st.day).getTime() - i * 864e5)); const pp = st.plans.filter(p => p.kid_id === k.id && appliesOn(p, dd)).length; const dn = new Set(logs.filter(l => l.kid_id === k.id && l.day === dd && l.status === 'done').map(l => l.plan_id || l.item_key)).size; const r = pp ? Math.min(1, dn / pp) : (dn ? 1 : 0); h += '<div style="flex:1;text-align:center;font-size:12px;color:var(--muted)"><div style="height:36px;border-radius:6px;background:' + (r >= 1 ? '#1aae39' : r > 0 ? '#9fdcae' : '#eee') + ';display:grid;place-items:center;color:' + (r > 0 ? '#fff' : 'var(--faint)') + ';font-weight:700">' + dn + '</div>' + X.WD[X.parseYmd(dd).getDay()] + '</div>'; }
      h += '</div></div>';
    });
    $('#tbody').innerHTML = h + '</div>';
  }

  /* ── 2. 시간표·체크리스트 ── */
  function vPlan() {
    const k = kidOf(st.kidSel); if (!k) { $('#main').innerHTML = '<div class="empty">먼저 아이를 등록해 주세요.</div>'; return; }
    const mine = st.plans.filter(p => p.kid_id === k.id);
    const rec = mine.filter(p => !p.on_date), dated = mine.filter(p => p.on_date && p.on_date >= X.ymd(new Date(Date.now() - 7 * 864e5))).sort((a, b) => a.on_date < b.on_date ? -1 : 1);
    const order = [1, 2, 3, 4, 5, 6, 0];
    const row = p => { const s = S[subjOf(p)] || S.etc; return '<tr class="' + (p.active ? '' : 'off') + '"><td><input type="number" value="' + p.sort + '" data-sort="' + p.id + '" class="mini"></td><td>' + s.emoji + ' ' + s.short + '</td><td class="lbl">' + esc(planLabel(p, k)) + '</td>' +
      (p.on_date ? '<td colspan="7" style="text-align:center">' + X.fmtDate(p.on_date) + '</td>' : order.map(w => '<td><button class="dot' + ((p.weekdays || []).includes(w) ? ' on' : '') + '" data-wd="' + p.id + ':' + w + '">' + X.WD[w] + '</button></td>').join('')) +
      '<td><button class="btn-util" data-tog="' + p.id + '">' + (p.active ? '켜짐' : '꺼짐') + '</button></td><td style="white-space:nowrap"><button class="btn-util" data-ed="' + p.id + '">수정</button> <button class="btn-util" data-del="' + p.id + '">삭제</button></td></tr>'; };
    let h = '<div class="sec-h"><h2>시간표·체크리스트</h2>' + kidTabs() + '</div>';
    h += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px"><button class="btn btn-primary" data-add="lesson">+ 학습 추가</button><button class="btn btn-secondary" data-add="drill">+ 연산</button><button class="btn btn-secondary" data-add="task">+ 체크리스트(숙제·학원)</button><button class="btn btn-secondary" data-add="link">+ 강의 링크</button><span style="flex:1"></span><button class="btn btn-util" id="copy">다른 아이에게 복사</button></div>';
    h += '<p style="color:var(--muted);margin:0 0 10px">요일 동그라미를 누르면 바로 켜고 꺼져요. 「자동 다음 진도」는 아이가 끝낸 단원 다음 것을 알아서 보여줘요(학년이 바뀌면 자동으로 다음 학년).</p>';
    h += '<div class="card" style="overflow-x:auto"><table class="tbl"><thead><tr><th>순서</th><th>과목</th><th>내용</th>' + order.map(w => '<th>' + X.WD[w] + '</th>').join('') + '<th>상태</th><th></th></tr></thead><tbody>' + (rec.map(row).join('') || '<tr><td colspan="12" style="color:var(--muted);padding:20px">반복 일정이 없어요</td></tr>') + '</tbody></table></div>';
    h += '<div class="sec-h"><h2 style="font-size:20px">날짜를 정한 할 일</h2><span>지난 7일 이후</span></div><div class="card" style="overflow-x:auto"><table class="tbl"><tbody>' + (dated.map(row).join('') || '<tr><td style="color:var(--muted);padding:20px">없어요</td></tr>') + '</tbody></table></div>';
    $('#main').innerHTML = h; bindKidTabs(vPlan);
    document.querySelectorAll('[data-add]').forEach(b => b.onclick = () => editPlan({ kind: b.dataset.add, kid_id: k.id, subject: b.dataset.add === 'lesson' ? 'math' : b.dataset.add === 'drill' ? 'calc' : 'etc', weekdays: [1, 2, 3, 4, 5], ref: b.dataset.add === 'drill' ? 'auto' : b.dataset.add === 'lesson' ? 'next' : null, payload: b.dataset.add === 'drill' ? { count: 10 } : {}, sort: b.dataset.add === 'task' ? 100 : 50, active: true }));
    document.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => editPlan(st.plans.find(p => p.id === b.dataset.ed)));
    document.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (!confirm('삭제할까요? (이미 한 기록은 남아요)')) return; await q(db.from('edu_plan').delete().eq('id', b.dataset.del)); await reloadPlans(); vPlan(); });
    document.querySelectorAll('[data-tog]').forEach(b => b.onclick = async () => { const p = st.plans.find(p => p.id === b.dataset.tog); await q(db.from('edu_plan').update({ active: !p.active }).eq('id', p.id)); await reloadPlans(); vPlan(); });
    document.querySelectorAll('[data-wd]').forEach(b => b.onclick = async () => { const [id, w] = b.dataset.wd.split(':'); const p = st.plans.find(p => p.id === id); const s = new Set(p.weekdays || []); s.has(+w) ? s.delete(+w) : s.add(+w); p.weekdays = [...s].sort(); b.classList.toggle('on'); await q(db.from('edu_plan').update({ weekdays: p.weekdays }).eq('id', id)); });
    document.querySelectorAll('[data-sort]').forEach(i => i.onchange = async () => { await q(db.from('edu_plan').update({ sort: +i.value || 0 }).eq('id', i.dataset.sort)); await reloadPlans(); vPlan(); });
    $('#copy').onclick = async () => { const others = st.kids.filter(x => x.id !== k.id); if (!others.length) return; const t = others[0]; if (!confirm(k.name + '의 반복 시간표 ' + rec.length + '개를 ' + t.name + '에게 복사할까요? (' + t.name + '의 기존 일정은 그대로 두고 추가돼요)')) return; await q(db.from('edu_plan').insert(rec.map(p => ({ kid_id: t.id, kind: p.kind, subject: p.subject, weekdays: p.weekdays, ref: p.ref && X.LIB_MAP[p.ref] ? 'next' : p.ref, title: p.title, payload: p.payload, sort: p.sort, active: p.active })))); await reloadPlans(); X.toast('복사했어요'); };
  }
  async function reloadPlans() { st.plans = await q(db.from('edu_plan').select('*').order('sort').order('created_at')); }

  function modal(title, body, onSave) {
    const d = document.createElement('div'); d.className = 'modal-bg';
    d.innerHTML = '<div class="modal"><div class="mh"><b>' + esc(title) + '</b><button class="btn-ghost" data-x>✕</button></div><div class="mb">' + body + '</div><div class="mf"><button class="btn btn-secondary" data-x>취소</button><button class="btn btn-primary" data-save>저장</button></div></div>';
    document.body.appendChild(d); d.querySelectorAll('[data-x]').forEach(b => b.onclick = () => d.remove());
    d.querySelector('[data-save]').onclick = async () => { const b = d.querySelector('[data-save]'); b.disabled = true; try { if ((await onSave(d)) !== false) d.remove(); } catch (e) { } b.disabled = false; };
    return d;
  }
  function editPlan(p) {
    const k = kidOf(p.kid_id), isNew = !p.id, kind = p.kind;
    const lvl = s => X.levelOf(k, s);
    let body = '<label>종류</label><div class="seg">' + [['lesson', '학습'], ['drill', '연산'], ['task', '체크리스트'], ['link', '강의 링크']].map(o => '<span class="' + (kind === o[0] ? 'on' : '') + '">' + o[1] + '</span>').join('') + '</div>';
    if (kind === 'lesson') {
      const g = p.ref && X.LIB_MAP[p.ref] ? X.LIB_MAP[p.ref].grades[0] : lvl(p.subject);
      body += '<label>과목</label><select id="fs">' + ['read', 'math', 'soc', 'word', 'eng'].map(s => '<option value="' + s + '"' + (p.subject === s ? ' selected' : '') + '>' + S[s].emoji + ' ' + S[s].name + '</option>').join('') + '</select>' +
        '<div id="trw"><label>사회 영역</label><select id="ftr"><option value="history"' + ((p.payload.track || 'history') === 'history' ? ' selected' : '') + '>이야기 한국사</option><option value="social"' + (p.payload.track === 'social' ? ' selected' : '') + '>학년 사회</option></select></div>' +
        '<label>내용</label><select id="fmode"><option value="next"' + (!p.ref || p.ref === 'next' ? ' selected' : '') + '>자동 다음 진도 (추천)</option><option value="pick"' + (p.ref && X.LIB_MAP[p.ref] ? ' selected' : '') + '>단원 직접 고르기</option><option value="mat"' + (p.ref && p.ref.startsWith('MAT:') ? ' selected' : '') + '>내 자료함에서 고르기</option></select>' +
        '<div id="pickw"><label>학년</label><select id="fg">' + [1, 2, 3, 4, 5, 6].map(x => '<option' + (x === g ? ' selected' : '') + '>' + x + '</option>').join('') + '</select><label>단원</label><select id="fitem"></select></div>' +
        '<div id="matw"><label>내 자료</label><select id="fmat">' + st.mats.filter(m => !(m.body && m.body.lib_id)).map(m => '<option value="' + m.id + '"' + (p.ref === 'MAT:' + m.id ? ' selected' : '') + '>' + esc(m.title) + '</option>').join('') + '</select></div>' +
        '<label>EBS 강의 주소 (선택 · 이 일정에만 적용)</label><input id="furl" placeholder="https://primary.ebs.co.kr/course/view?courseId=..." value="' + esc(p.payload.url || '') + '">';
    } else if (kind === 'drill') {
      body += '<label>연산 주제</label><select id="ftopic"><option value="auto">학년·학기에 맞춰 자동으로 돌아가며 (추천)</option>' + [1, 2, 3, 4, 5, 6].map(g => '<optgroup label="' + g + '학년">' + X.CALC.filter(c => c[1] === g).map(c => '<option value="' + c[0] + '"' + (p.ref === c[0] ? ' selected' : '') + '>' + g + '-' + c[2] + ' ' + esc(c[3]) + '</option>').join('') + '</optgroup>').join('') + '</select>' +
        '<label>문제 수</label><input id="fcount" type="number" min="3" max="30" value="' + (p.payload.count || 10) + '">';
    } else if (kind === 'task') {
      body += '<label>할 일</label><input id="ftitle" maxlength="60" placeholder="예: 수학학원 숙제 / 기적의 계산법 2쪽" value="' + esc(p.title || '') + '"><label>작은 메모 (선택)</label><input id="fnote" maxlength="20" placeholder="예: 수학학원" value="' + esc(p.payload.note || '') + '">';
    } else {
      body += '<label>강의 제목</label><input id="ftitle" value="' + esc(p.title || '') + '" placeholder="예: 만점왕 수학 4-2 3강"><label>주소</label><input id="furl" value="' + esc(p.payload.url || '') + '" placeholder="https://..."><label>아이에게 한마디 (선택)</label><input id="fnote" value="' + esc(p.payload.note || '') + '">';
    }
    body += '<label>언제</label><div class="seg" id="when"><span class="' + (p.on_date ? '' : 'on') + '" data-w="rep">매주 반복</span><span class="' + (p.on_date ? 'on' : '') + '" data-w="date">특정 날짜</span></div>' +
      '<div id="repw" class="wdpick">' + [1, 2, 3, 4, 5, 6, 0].map(w => '<label><input type="checkbox" value="' + w + '"' + ((p.weekdays || []).includes(w) ? ' checked' : '') + '> ' + X.WD[w] + '</label>').join('') + '</div><div id="datew"><input type="date" id="fdate" value="' + (p.on_date || X.ymd()) + '"></div>' +
      '<label>순서 (작을수록 먼저)</label><input id="fsort" type="number" value="' + (p.sort || 50) + '">';
    const d = modal((isNew ? '추가' : '수정') + ' · ' + k.name, body, async d => {
      const v = id => (d.querySelector('#' + id) || {}).value;
      const rec = { kid_id: k.id, kind, sort: +v('fsort') || 0, active: p.active !== false, payload: {} };
      const isDate = d.querySelector('#when .on').dataset.w === 'date';
      rec.on_date = isDate ? v('fdate') : null; rec.weekdays = isDate ? [] : [...d.querySelectorAll('#repw input:checked')].map(i => +i.value);
      if (!isDate && !rec.weekdays.length) { X.toast('요일을 하나 이상 골라 주세요'); return false; }
      if (kind === 'lesson') { rec.subject = v('fs'); const mode = v('fmode'); rec.ref = mode === 'pick' ? v('fitem') : mode === 'mat' ? 'MAT:' + v('fmat') : 'next'; if (rec.subject === 'soc') rec.payload.track = v('ftr'); if (v('furl')) rec.payload.url = v('furl').trim(); if (mode === 'mat' && !v('fmat')) { X.toast('자료함에 자료가 없어요'); return false; } }
      else if (kind === 'drill') { rec.subject = 'calc'; rec.ref = v('ftopic'); rec.payload.count = Math.min(30, Math.max(3, +v('fcount') || 10)); }
      else if (kind === 'task') { rec.subject = 'etc'; rec.title = (v('ftitle') || '').trim(); if (!rec.title) { X.toast('할 일을 적어 주세요'); return false; } if (v('fnote')) rec.payload.note = v('fnote').trim(); }
      else { rec.subject = 'link'; rec.title = (v('ftitle') || '').trim() || '엄마가 고른 강의'; rec.payload.url = (v('furl') || '').trim(); if (!/^https?:\/\//.test(rec.payload.url)) { X.toast('주소를 확인해 주세요'); return false; } if (v('fnote')) rec.payload.note = v('fnote').trim(); }
      if (isNew) await q(db.from('edu_plan').insert(rec)); else await q(db.from('edu_plan').update(rec).eq('id', p.id));
      await reloadPlans(); vPlan(); X.toast('저장했어요');
    });
    const sync = () => {
      const w = d.querySelector('#when .on').dataset.w; d.querySelector('#repw').style.display = w === 'rep' ? '' : 'none'; d.querySelector('#datew').style.display = w === 'date' ? '' : 'none';
      if (kind === 'lesson') {
        const s = d.querySelector('#fs').value, mode = d.querySelector('#fmode').value;
        d.querySelector('#trw').style.display = s === 'soc' ? '' : 'none'; d.querySelector('#pickw').style.display = mode === 'pick' ? '' : 'none'; d.querySelector('#matw').style.display = mode === 'mat' ? '' : 'none';
        const g = +d.querySelector('#fg').value, tr = s === 'soc' ? d.querySelector('#ftr').value : null; const cur = d.querySelector('#fitem').value || p.ref;
        d.querySelector('#fitem').innerHTML = X.libList(s, g, tr).map(x => '<option value="' + x.id + '"' + (x.id === cur ? ' selected' : '') + '>' + (x.sem ? x.sem + '학기 ' : '') + x.order + '. ' + esc(x.title) + '</option>').join('');
      }
    };
    d.querySelectorAll('#when span').forEach(s => s.onclick = () => { d.querySelectorAll('#when span').forEach(x => x.classList.remove('on')); s.classList.add('on'); sync(); });
    d.querySelectorAll('select').forEach(s => s.addEventListener('change', sync));
    sync();
  }

  /* ── 3. 학습 결과 ── */
  async function vResult() {
    const k = kidOf(st.kidSel); if (!k) return;
    const days = st.resDays || 14, from = X.ymd(new Date(Date.now() - (days - 1) * 864e5));
    $('#main').innerHTML = '<div class="sec-h"><h2>학습 결과</h2>' + kidTabs() + '</div><div class="tabs" style="margin-bottom:14px">' + [7, 14, 30, 90].map(n => '<button data-days="' + n + '" class="' + (n === days ? 'on' : '') + '">최근 ' + n + '일</button>').join('') + '</div><div id="rb"><div class="spin"></div></div>';
    bindKidTabs(vResult); document.querySelectorAll('[data-days]').forEach(b => b.onclick = () => { st.resDays = +b.dataset.days; vResult(); });
    const [logs, rev] = await Promise.all([all(() => db.from('edu_logs').select('*').eq('kid_id', k.id).eq('status', 'done').gte('day', from).order('id', { ascending: false })), all(() => db.from('edu_review').select('*').eq('kid_id', k.id).is('cleared_at', null).order('id', { ascending: false }))]);
    const learn = logs.filter(l => l.kind !== 'task'), tot = learn.reduce((a, l) => a + (l.total || 0), 0), first = learn.reduce((a, l) => a + (l.score || 0), 0);
    const bySub = {}; learn.forEach(l => { const s = l.subject || 'link'; bySub[s] = bySub[s] || { n: 0, sc: 0, t: 0 }; bySub[s].n++; bySub[s].sc += l.score || 0; bySub[s].t += l.total || 0; });
    let h = '<div class="statrow" style="margin-bottom:16px"><div class="stat"><b>' + learn.length + '</b><small>끝낸 학습</small></div><div class="stat"><b>' + logs.filter(l => l.kind === 'task').length + '</b><small>체크한 할 일</small></div><div class="stat"><b>' + (tot ? Math.round(first / tot * 100) : 0) + '%</b><small>한 번에 맞힌 비율</small></div><div class="stat"><b>' + new Set(logs.map(l => l.day)).size + '</b><small>공부한 날</small></div><div class="stat"><b>' + rev.length + '</b><small>오답 대기</small></div><div class="stat"><b>' + Math.round(learn.reduce((a, l) => a + ((l.detail && l.detail.secs) || 0), 0) / 60) + '분</b><small>문제 푼 시간</small></div></div>';
    h += '<div class="card" style="overflow-x:auto;margin-bottom:16px"><table class="tbl"><thead><tr><th>과목</th><th>끝낸 수</th><th>한 번에 맞힘</th></tr></thead><tbody>' + Object.keys(bySub).map(s => '<tr><td>' + (S[s] || S.link).emoji + ' ' + (S[s] || S.link).name + '</td><td>' + bySub[s].n + '</td><td>' + (bySub[s].t ? Math.round(bySub[s].sc / bySub[s].t * 100) + '% (' + bySub[s].sc + '/' + bySub[s].t + ')' : '-') + '</td></tr>').join('') + '</tbody></table></div>';
    h += '<div class="sec-h"><h2 style="font-size:20px">기록</h2></div><div class="card" style="overflow-x:auto"><table class="tbl"><thead><tr><th>날짜</th><th>과목</th><th>내용</th><th>점수</th><th>틀린 문제 (아이가 쓴 답)</th></tr></thead><tbody>' +
      logs.map(l => '<tr><td style="white-space:nowrap">' + l.day.slice(5).replace('-', '/') + '</td><td>' + ((S[l.kind === 'task' ? 'etc' : l.subject] || S.link).emoji) + '</td><td>' + esc((l.detail && l.detail.title) || l.item_key || '') + (l.plan_id ? '' : ' <span class="pill">스스로</span>') + '</td><td>' + (l.total ? l.score + '/' + l.total : '✓') + '</td><td style="font-size:14px;color:var(--muted)">' + ((l.detail && l.detail.wrong) || []).map(w => X.fracHtml(String(w.q).slice(0, 40)) + ' → <b>' + esc(Array.isArray(w.given) ? w.given.join(', ') : (typeof w.given === 'number' ? '보기 ' + (w.given + 1) : w.given)) + '</b>' + (w.ok2 ? ' (재도전 정답)' : '')).join('<br>') + '</td></tr>').join('') + '</tbody></table>' + (logs.length ? '' : '<div class="empty" style="border:0">아직 기록이 없어요</div>') + '</div>';
    h += '<div class="sec-h"><h2 style="font-size:20px">다시 풀기 목록 (오답)</h2><span>아이가 다시 풀어 한 번에 맞히면 자동으로 빠져요</span></div><div class="card ulist">' + (rev.map(r => '<div class="urow"><span class="no">' + (S[r.subject] || S.link).emoji + '</span><span class="t"><b style="font-size:15px">' + X.fracHtml(r.q.q) + '</b><small>정답: ' + X.fracHtml(X.answerText(r.q)) + ' · ' + r.wrong_count + '번 틀림 · ' + r.created_at.slice(0, 10) + '</small></span><button class="btn-util" data-clr="' + r.id + '">목록에서 빼기</button></div>').join('') || '<div class="urow"><span class="t" style="color:var(--muted)">오답이 없어요</span></div>') + '</div>';
    $('#rb').innerHTML = h;
    document.querySelectorAll('[data-clr]').forEach(b => b.onclick = async () => { await q(db.from('edu_review').update({ cleared_at: new Date().toISOString() }).eq('id', b.dataset.clr)); vResult(); });
  }

  /* ── 4. 자료함 ── */
  function vLib() {
    const L = st.lib; const over = {}; st.mats.forEach(m => { if (m.body && m.body.lib_id) over[m.body.lib_id] = m; });
    const custom = st.mats.filter(m => !(m.body && m.body.lib_id));
    let h = '<div class="sec-h"><h2>자료함</h2><span>기본 콘텐츠 ' + X.LIB.length + '개 + 연산 ' + X.CALC.length + '주제 · 내 자료 ' + custom.length + '개</span></div>';
    h += '<div class="tabs" style="margin-bottom:10px">' + X.SUBJECT_ORDER.map(s => '<button data-ls="' + s + '" class="' + (L.subject === s ? 'on' : '') + '">' + S[s].emoji + ' ' + S[s].short + '</button>').join('') + '<button data-ls="mine" class="' + (L.subject === 'mine' ? 'on' : '') + '">📁 내 자료</button></div>';
    if (L.subject === 'mine') {
      h += '<div style="margin-bottom:12px"><button class="btn btn-primary" id="addmat">+ 내 자료 등록 (EBS 강의 주소·직접 만든 문제)</button></div><div class="card ulist">' + (custom.map(m => '<div class="urow"><span class="no">' + (S[m.subject] || S.link).emoji + '</span><span class="t"><b>' + esc(m.title) + '</b><small>' + (m.grades || []).join('·') + '학년 · ' + ({ draft: '초안', ready: '사용 중', retired: '교체 필요' })[m.status] + ' · 문제 ' + ((m.body && m.body.questions) || []).length + '개' + (m.url ? ' · <a href="' + esc(m.url) + '" target="_blank">주소 열기</a>' : '') + '</small></span><button class="btn-util" data-em="' + m.id + '">수정</button></div>').join('') || '<div class="urow"><span class="t" style="color:var(--muted)">등록한 자료가 없어요. 아이에게 꼭 보여주고 싶은 EBS 강의 주소를 넣어 두면 시간표에서 고를 수 있어요.</span></div>') + '</div>';
      $('#main').innerHTML = h; bindLib();
      $('#addmat').onclick = () => editMat({ subject: 'math', grades: [4], status: 'ready', body: {} });
      document.querySelectorAll('[data-em]').forEach(b => b.onclick = () => editMat(st.mats.find(m => m.id === b.dataset.em)));
      return;
    }
    h += '<div class="tabs" style="margin-bottom:14px">' + [1, 2, 3, 4, 5, 6].map(g => '<button data-lg="' + g + '" class="' + (L.grade === g ? 'on' : '') + '">' + g + '학년</button>').join('') + '</div>';
    if (L.subject === 'calc') {
      h += '<div class="card ulist">' + X.CALC.filter(c => c[1] === L.grade).map(c => { const ex = X.makeCalc(c[0], 3, 'preview'); return '<div class="urow"><span class="no">' + c[2] + '학기</span><span class="t"><b>' + esc(c[3]) + '</b><small>' + esc(c[4]) + '<br>예: ' + ex.questions.map(q => X.fracHtml(q.q) + ' <b>' + X.fracHtml(X.answerText(q)) + '</b>').join(' · ') + '</small></span></div>'; }).join('') + '</div>';
      $('#main').innerHTML = h; bindLib(); return;
    }
    const list = X.LIB.filter(x => x.subject === L.subject && x.grades.includes(L.grade)).sort((a, b) => (a.track || '').localeCompare(b.track || '') || (a.sem || 0) - (b.sem || 0) || a.order - b.order);
    h += '<p style="color:var(--muted);margin:0 0 10px">각 단원에 <b>정확한 EBS 강의 주소</b>를 한 번 넣어 두면, 아이 화면의 「강의 보기」가 그 강의로 바로 열려요. 비워 두면 해당 EBS 강좌 목록으로 열려요. 「미리보기」로 설명과 정답을 검수할 수 있어요.</p>';
    h += '<div class="card ulist">' + list.map(x => { const e = X.ebsFor(x, L.grade, {}); const o = over[x.id]; return '<div class="urow" style="flex-wrap:wrap"><span class="no">' + (x.track === 'history' ? '史' : x.sem ? x.sem + '-' + x.order : x.order) + '</span><span class="t"><b>' + esc(x.title) + '</b><small>' + esc(x.goal || x.era || '') + ' · 문제 ' + ((x.questions || []).length || ((x.words || []).length + '단어')) + ' · 기본 연결: <a href="' + esc(e.url) + '" target="_blank">' + esc(e.label) + '</a></small></span>' +
      '<input class="ovin" data-ov="' + x.id + '" placeholder="EBS 강의 주소 붙여넣기" value="' + esc(o ? o.url : '') + '"><button class="btn-util" data-pv="' + x.id + '">미리보기</button><div class="pv hidden" id="pv-' + x.id + '"></div></div>'; }).join('') + '</div>';
    $('#main').innerHTML = h; bindLib();
    document.querySelectorAll('[data-ov]').forEach(i => i.onchange = async () => {
      const id = i.dataset.ov, url = i.value.trim(), o = over[id];
      if (url && !/^https?:\/\//.test(url)) { X.toast('주소는 https:// 로 시작해야 해요'); return; }
      if (!url && o) await q(db.from('edu_materials').delete().eq('id', o.id));
      else if (url && o) await q(db.from('edu_materials').update({ url, checked_on: X.ymd() }).eq('id', o.id));
      else if (url) { const x = X.LIB_MAP[id]; await q(db.from('edu_materials').insert({ subject: x.subject, grades: x.grades, title: 'EBS · ' + x.title, url, body: { lib_id: id }, status: 'ready', checked_on: X.ymd() })); }
      st.mats = await q(db.from('edu_materials').select('*').order('created_at', { ascending: false })); X.toast(url ? 'EBS 강의를 연결했어요' : '연결을 지웠어요');
    });
    document.querySelectorAll('[data-pv]').forEach(b => b.onclick = () => { const x = X.LIB_MAP[b.dataset.pv], el = $('#pv-' + x.id); if (!el.classList.contains('hidden')) { el.classList.add('hidden'); return; } el.classList.remove('hidden'); el.innerHTML = preview(x); });
  }
  function bindLib() {
    document.querySelectorAll('[data-ls]').forEach(b => b.onclick = () => { st.lib.subject = b.dataset.ls; vLib(); });
    document.querySelectorAll('[data-lg]').forEach(b => b.onclick = () => { st.lib.grade = +b.dataset.lg; vLib(); });
  }
  function preview(x) {
    let h = '';
    if (x.passage) h += '<div class="passage" style="font-size:16px">' + esc(x.passage) + '</div>';
    (x.explain || x.story || []).forEach(p => h += '<p>' + X.fracHtml(p) + '</p>');
    if (x.words && x.subject === 'word') h += '<p>' + x.words.map(w => esc((w.emoji || '') + ' ' + w.en + ' = ' + w.ko)).join(' · ') + '</p>';
    if (x.dialog) h += '<p>' + x.dialog.map(l => esc(l.who + ': ' + l.en)).join('<br>') + '</p>';
    h += '<ol>' + (x.questions || []).map(qq => '<li>' + X.fracHtml(qq.q) + (qq.choices ? '<br><small>' + qq.choices.map((c, i) => (i === qq.answer ? '<b style="color:var(--ok)">✓ ' : '') + esc(c) + (i === qq.answer ? '</b>' : '')).join(' / ') + '</small>' : '<br><small>정답: <b style="color:var(--ok)">' + X.fracHtml(X.answerText(qq)) + '</b></small>') + '<br><small style="color:var(--muted)">해설: ' + X.fracHtml(qq.explain || '') + '</small></li>').join('') + '</ol>';
    return h;
  }
  function editMat(m) {
    const isNew = !m.id, qs = ((m.body && m.body.questions) || []).map(qq => qq.type === 'choice' ? qq.q + ' | ' + qq.choices.join(' / ') + ' | ' + (qq.answer + 1) : qq.q + ' | =' + (Array.isArray(qq.answer) ? qq.answer.join(',') : qq.answer)).join('\n');
    const body = '<label>제목</label><input id="mt" value="' + esc(m.title || '') + '" placeholder="예: 만점왕 수학 4-2 7강 삼각형 분류"><label>과목</label><select id="ms">' + X.SUBJECT_ORDER.map(s => '<option value="' + s + '"' + (m.subject === s ? ' selected' : '') + '>' + S[s].name + '</option>').join('') + '</select>' +
      '<label>학년 (쉼표로 여러 개)</label><input id="mg" value="' + esc((m.grades || []).join(',')) + '"><label>강의 주소</label><input id="mu" value="' + esc(m.url || '') + '" placeholder="https://primary.ebs.co.kr/..."><label>학습 목표 (선택)</label><input id="mgo" value="' + esc(m.goal || '') + '"><label>아이에게 보여줄 메모 (선택)</label><input id="mm" value="' + esc(m.memo || '') + '">' +
      '<label>확인 문제 (선택 · 한 줄에 한 문제)</label><textarea id="mq" rows="5" placeholder="선택형:  문제 | 보기1 / 보기2 / 보기3 | 정답번호&#10;숫자·단답:  문제 | =정답&#10;예) 삼각형의 꼭짓점은 몇 개? | =3&#10;예) 직각이 있는 삼각형은? | 예각삼각형 / 직각삼각형 / 둔각삼각형 | 2">' + esc(qs) + '</textarea>' +
      '<label>상태</label><select id="mst">' + [['ready', '사용 중'], ['draft', '초안'], ['retired', '교체 필요']].map(o => '<option value="' + o[0] + '"' + (m.status === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' + (isNew ? '' : '<p><button class="btn-util" id="mdel" style="color:var(--bad)">이 자료 삭제</button></p>');
    const d = modal(isNew ? '내 자료 등록' : '내 자료 수정', body, async d => {
      const v = id => d.querySelector('#' + id).value.trim();
      const questions = []; let bad = '';
      v('mq').split('\n').map(s => s.trim()).filter(Boolean).forEach((line, i) => {
        const parts = line.split('|').map(s => s.trim());
        if (parts.length === 2 && parts[1].startsWith('=')) { const a = parts[1].slice(1).split(',').map(s => s.trim()).filter(Boolean); questions.push(X.parseNum(a[0]) && a.length === 1 ? { type: 'number', q: parts[0], answer: a[0] } : { type: 'text', q: parts[0], answer: a }); }
        else if (parts.length === 3) { const ch = parts[1].split('/').map(s => s.trim()).filter(Boolean), n = parseInt(parts[2], 10) - 1; if (ch.length < 2 || !(n >= 0 && n < ch.length)) bad = (i + 1) + '번째 줄'; else questions.push({ type: 'choice', q: parts[0], choices: ch, answer: n }); }
        else bad = (i + 1) + '번째 줄';
      });
      if (bad) { X.toast(bad + ' 문제 형식을 확인해 주세요'); return false; }
      const rec = { title: v('mt'), subject: v('ms'), grades: v('mg').split(',').map(s => parseInt(s, 10)).filter(n => n >= 1 && n <= 6), url: v('mu') || null, goal: v('mgo') || null, memo: v('mm') || null, status: v('mst'), body: { questions }, checked_on: X.ymd() };
      if (!rec.title) { X.toast('제목을 적어 주세요'); return false; }
      if (rec.url && !/^https?:\/\//.test(rec.url)) { X.toast('주소를 확인해 주세요'); return false; }
      if (isNew) await q(db.from('edu_materials').insert(rec)); else await q(db.from('edu_materials').update(rec).eq('id', m.id));
      st.mats = await q(db.from('edu_materials').select('*').order('created_at', { ascending: false })); vLib(); X.toast('저장했어요');
    });
    const del = d.querySelector('#mdel'); if (del) del.onclick = async () => { if (!confirm('삭제할까요? 시간표에서 이 자료를 쓰는 일정은 아이 화면에 안 보이게 돼요.')) return; await q(db.from('edu_materials').delete().eq('id', m.id)); st.mats = st.mats.filter(x => x.id !== m.id); d.remove(); vLib(); };
  }

  /* ── 5. 아이 설정 ── */
  async function vKids() {
    const done = await q(db.rpc('edu_parent_done'));
    const sy = X.schoolYear();
    let h = '<div class="sec-h"><h2>아이 설정</h2><button class="btn btn-secondary" id="addkid">+ 아이 추가</button></div><p style="color:var(--muted);margin:0 0 14px">학년은 <b>입학 연도</b>로 매년 3월에 자동으로 올라가요. 과목별로 학년보다 쉽게/어렵게 조정할 수 있어요 (예: 연산만 한 학년 아래로 복습).</p><div class="grid g2">';
    st.kids.forEach(k => {
      const ds = new Set(done.filter(x => x.kid_id === k.id).map(x => x.item_key));
      h += '<div class="card pad" data-k="' + k.id + '"><div style="display:flex;gap:10px;align-items:center;margin-bottom:12px"><input class="mini" style="width:64px;font-size:28px;text-align:center" data-f="emoji" value="' + esc(k.emoji) + '"><input data-f="name" value="' + esc(k.name) + '" style="flex:1;font-size:20px;font-weight:700"><input type="color" data-f="color" value="' + esc(k.color) + '"></div>' +
        '<label>초등 입학 연도</label><select data-f="entry_year">' + Array.from({ length: 12 }, (_, i) => sy - 6 + i).map(y => '<option value="' + y + '"' + (y === k.entry_year ? ' selected' : '') + '>' + y + '년 입학 → 지금 ' + (sy - y + 1 >= 1 && sy - y + 1 <= 6 ? (sy - y + 1) + '학년' : '범위 밖') + '</option>').join('') + '</select>' +
        '<table class="tbl" style="margin-top:12px"><thead><tr><th>과목</th><th>난이도</th><th>지금 학년</th><th>끝낸 단원</th></tr></thead><tbody>' + X.SUBJECT_ORDER.map(s => { const off = (k.levels && k.levels[s]) || 0, lv = X.levelOf(k, s), n = s === 'calc' ? [...ds].filter(x => x && x.startsWith('CALC:c' + lv)).length + '/' + X.CALC.filter(c => c[1] === lv).length : X.libList(s, lv).filter(x => ds.has(x.id)).length + '/' + X.libList(s, lv).length;
          return '<tr><td>' + S[s].emoji + ' ' + S[s].short + '</td><td><select data-lv="' + s + '">' + [-2, -1, 0, 1, 2].map(o => '<option value="' + o + '"' + (o === off ? ' selected' : '') + '>' + (o === 0 ? '학년 그대로' : o < 0 ? o + '학년 (쉽게)' : '+' + o + '학년') + '</option>').join('') + '</select></td><td>' + lv + '학년</td><td>' + n + '</td></tr>'; }).join('') + '</tbody></table>' +
        '<div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap"><button class="btn btn-primary btn-sm" data-save>저장</button><button class="btn btn-util" data-reward>🎁 보상 줬어요 (도장 0부터)</button><label style="margin:0;display:flex;align-items:center;gap:6px"><input type="checkbox" data-f="active"' + (k.active ? ' checked' : '') + '> 사용 중</label></div></div>';
    });
    $('#main').innerHTML = h + '</div>';
    document.querySelectorAll('[data-k]').forEach(c => {
      const id = c.dataset.k;
      c.querySelector('[data-save]').onclick = async () => {
        const f = n => c.querySelector('[data-f="' + n + '"]'); const levels = {}; c.querySelectorAll('[data-lv]').forEach(s => { if (+s.value) levels[s.dataset.lv] = +s.value; });
        await q(db.from('edu_kids').update({ name: f('name').value.trim(), emoji: f('emoji').value.trim() || '🙂', color: f('color').value, entry_year: +f('entry_year').value, levels, active: f('active').checked }).eq('id', id));
        await loadAll(); vKids(); X.toast('저장했어요');
      };
      c.querySelector('[data-reward]').onclick = async () => { if (!confirm('보상을 줬나요? 칭찬 도장을 0부터 다시 모아요. (기록은 그대로)')) return; await q(db.from('edu_kids').update({ reward_since: new Date().toISOString() }).eq('id', id)); X.toast('도장을 새로 모아요 🎁'); };
    });
    $('#addkid').onclick = async () => { const name = prompt('아이 이름'); if (!name) return; await q(db.from('edu_kids').insert({ name, entry_year: sy, emoji: '🐰', color: '#1aae39', sort: st.kids.length + 1 })); await loadAll(); vKids(); };
  }

  /* ── 6. 가족코드·보상 ── */
  function vFamily() {
    const url = location.href.replace(/admin\.html.*$/, '');
    $('#main').innerHTML = '<div class="sec-h"><h2>가족코드·보상</h2></div><div class="grid g2"><div class="card pad"><h3 style="margin-top:0">🔑 가족코드 바꾸기</h3><p style="color:var(--muted)">아이 태블릿에서 처음 한 번 넣는 비밀번호예요. 6자 이상, 숫자+영문 섞기를 추천해요. 바꾸면 태블릿에서 새 코드를 다시 넣어야 해요.</p><input id="nc" placeholder="새 가족코드 (6자 이상)" autocomplete="off"><div style="margin-top:12px"><button class="btn btn-primary" id="setc">가족코드 바꾸기</button></div><p style="color:var(--muted);font-size:14px">마지막 변경: ' + (st.family.updated_at ? st.family.updated_at.slice(0, 10) : '-') + ' · 틀린 코드를 10분 안에 15번 넣으면 10분간 잠겨요.</p></div>' +
      '<div class="card pad"><h3 style="margin-top:0">🎁 칭찬 도장 보상</h3><label>도장 목표 개수</label><input id="rg" type="number" min="5" max="500" value="' + (st.family.reward_goal || 30) + '"><label>보상 약속 문구</label><input id="rt" maxlength="60" value="' + esc(st.family.reward_text || '') + '"><div style="margin-top:12px"><button class="btn btn-primary" id="setr">저장</button></div><p style="color:var(--muted);font-size:14px">학습·체크리스트를 하나 끝낼 때마다 도장 1개. 보상을 준 뒤 「아이 설정」에서 도장을 0부터 다시 모을 수 있어요.</p></div></div>' +
      '<div class="sec-h"><h2 style="font-size:20px">📱 아이 태블릿 준비 (한 번만)</h2></div><div class="card pad"><ol style="line-height:2;margin:0;padding-left:22px"><li>태블릿 크롬에서 <b>' + esc(url) + '</b> 열기</li><li>가족코드 입력 → 아이 얼굴 선택</li><li>크롬 메뉴(⋮) → <b>홈 화면에 추가</b> (앱처럼 전체 화면으로 열려요)</li><li>같은 크롬에서 <a href="' + X.EBS.login + '" target="_blank">EBS 초등</a>에 엄마 계정으로 로그인해 두기 (로그인 안 하면 강의가 5분 미리보기만 나와요)</li><li>태블릿 설정 → 화면 자동 꺼짐 5분 이상 권장</li></ol></div>';
    $('#setc').onclick = async () => { const c = $('#nc').value.trim(); if (c.length < 6) return X.toast('6자 이상으로 정해 주세요'); await q(db.rpc('edu_set_code', { p_code: c })); $('#nc').value = ''; X.toast('가족코드를 바꿨어요. 태블릿에서 새 코드를 넣어 주세요'); };
    $('#setr').onclick = async () => { await q(db.from('edu_family').update({ reward_goal: Math.max(5, +$('#rg').value || 30), reward_text: $('#rt').value.trim(), updated_at: new Date().toISOString() }).eq('id', 1)); await loadAll(); X.toast('저장했어요'); };
  }

  boot();
})();
