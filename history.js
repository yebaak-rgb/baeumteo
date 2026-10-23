/* 휘스토리 — 우리집 배움터 안의 한국사 탭 (기능이 켜진 가족에게만 보임)
   - 내용: history-data.js (명세서에서 자동 생성) / 그림: history/img/*.webp
   - 기록: edu_logs 에 item_key 'WH:…' 로 저장 (공부 끝 = 도장, 퀴즈 점수, 학습노트, 유적 도장)
   - 그림이 없는 곳은 빈 칸으로 두고 그리지 않음 (엄마에게 요청 목록 전달) */
(function () {
  'use strict';
  const D = window.WH_DATA, X = window.EDU, esc = X.esc;
  const IMG = 'history/img/';
  const W = { r: { p: 'home' }, rec: null, ctx: null, quiz: null };

  /* ── 기본 데이터 ── */
  const ERAS = [
    { id: 'prehistoric', name: '선사·고조선', sub: '인류의 시작과 우리 역사의 첫 나라', img: 'era-prehistoric', parts: ['I'], col: '#8a6a3d' },
    { id: 'three', name: '삼국·남북국', sub: '고구려·백제·신라 그리고 남북국', img: 'era-three-kingdoms', parts: ['II'], col: '#2f7a5b' },
    { id: 'goryeo', name: '고려', sub: '통일과 외침 속에서 성장한 나라', img: 'era-goryeo', parts: ['III'], col: '#1f7c84' },
    { id: 'joseon', name: '조선', sub: '여러분의 시작은 여기서!', img: 'era-joseon', parts: ['IV'], col: '#b23a3a' },
    { id: 'modern', name: '근현대', sub: '개항에서 오늘의 대한민국까지', img: 'era-modern', parts: ['V', 'VI', 'VII'], col: '#36579a' },
    { id: 'world', name: '세계사', sub: '한국사 옆 세계사', img: 'era-world', parts: [], col: '#6a59b3' }
  ];
  const ERA = Object.fromEntries(ERAS.map(e => [e.id, e]));
  const TOP = Object.fromEntries(D.topics.map(t => [t.no, t]));
  // 조선 왕 재위 연도와 영문 파일 이름
  const REIGN = ['1392–1398', '1398–1400', '1400–1418', '1418–1450', '1450–1452', '1452–1455', '1455–1468', '1468–1469', '1469–1494', '1494–1506', '1506–1544', '1544–1545', '1545–1567', '1567–1608', '1608–1623', '1623–1649', '1649–1659', '1659–1674', '1674–1720', '1720–1724', '1724–1776', '1776–1800', '1800–1834', '1834–1849', '1849–1863', '1863–1907', '1907–1910'];
  const KFILE = ['taejo', 'jeongjong', 'taejong', 'sejong', 'munjong', 'danjong', 'sejo', 'yejong', 'seongjong', 'yeonsangun', 'jungjong', 'injong', 'myeongjong', 'seonjo', 'gwanghaegun', 'injo', 'hyojong', 'hyeonjong', 'sukjong', 'gyeongjong', 'yeongjo', 'jeongjo', 'sunjo', 'heonjong', 'cheoljong', 'gojong', 'sunjong'];
  D.kings.forEach((k, i) => { k.reign = REIGN[i]; k.img = IMG + 'king-' + String(i + 1).padStart(2, '0') + '-' + KFILE[i] + '.webp'; });
  const KING = Object.fromEntries(D.kings.map(k => [k.no, k]));
  // 유적 16곳 — 내용은 '유적지 도장깨기 16곳' PDF. 그림은 고화질 원본이 있는 곳만 (없으면 글자 카드)
  const SITE_MAP = {
    '01': ['gochang-dolmen', [], ['03', '04'], []], '02': ['muryeong', [], ['07'], []], '03': ['gongsanseong', [], ['07'], []],
    '04': ['buso-jeongnimsa', [], ['07', '12'], []], '05': ['daereungwon', [], ['09', '13'], []], '06': ['bulguksa', ['bulguksa', 'seokguram'], ['13'], []],
    '07': ['ganghwa-goryeo', [], ['20', '21'], []], '08': ['gyeonggijeon', [], ['25'], [1]], '09': ['gyeongbokgung', ['gyeongbokgung'], ['25', '26'], [1, 4]],
    '10': ['jongmyo', ['jongmyo'], ['26'], []], '11': ['changdeokgung', [], ['26'], [3]], '12': ['yeongneung', [], ['27'], [4]],
    '13': ['dongnaeeupseong', ['dongnaeeupseong'], ['29'], [14]], '14': ['namhansanseong', [], ['30'], [16]], '15': ['suwon-hwaseong', ['suwon-hwaseong'], ['32'], [22]],
    '16': ['gwangseongbo', [], ['35'], [26]]
  };
  const SITES = D.sites.map(x => { const m = SITE_MAP[x.no]; return Object.assign({}, x, { id: m[0], imgs: m[1], topics: m[2], kings: m[3] }); });
  const SITE = Object.fromEntries(SITES.map(s => [s.id, s]));
  const siteEraCol = s => /청동기/.test(s.era) ? ERA.prehistoric.col : /백제|신라/.test(s.era) ? ERA.three.col : /고려/.test(s.era) ? ERA.goryeo.col : /말기|신미/.test(s.era) ? ERA.modern.col : ERA.joseon.col;
  const KDOC = D.kingDoc || {};
  const periodOf = no => (D.periods || []).find(p => no >= p.from && no <= p.to);
  const THEME_IMG = ['01-foundation', '02-society-people', '03-war-diplomacy', '04-culture-life', '05-modern-change'];

  // 주제 ↔ 왕 연결 (명세서의 '왕 연결·연결 왕·인물' 칸)
  const PEOPLE_H = /왕 연결|연결 왕|인물/;
  D.kings.forEach(k => k.topics = []);
  D.topics.forEach(t => {
    t.kings = [];
    t.s.forEach(s => {
      if (!PEOPLE_H.test(s.h)) return;
      s.b.forEach(b => (b.t === 'ul' ? b.v : b.t === 'p' ? [b.v] : []).forEach(v => {
        if (/왕건/.test(v)) return; // 고려 태조
        const k = D.kings.find(k => v.replace(/\*/g, '').trim().split(/[\s(]/)[0] === k.name);
        if (k && t.era === 'joseon' || k && t.era === 'modern') { if (!t.kings.includes(k.no)) { t.kings.push(k.no); k.topics.push(t.no); } }
      }));
    });
  });
  const lineOf = name => D.kingLines.filter(l => JSON.stringify(l.b).includes(name));

  /* ── 기록 ── */
  const done = key => W.ctx.st.done && W.ctx.st.done.has(key);
  const recs = key => (W.rec || []).filter(r => r.key === key);
  const lastRec = key => { const a = recs(key); return a[a.length - 1]; };
  async function loadRec() {
    if (W.rec) return;
    try { W.rec = await W.ctx.rpc('edu_kid_wh', W.ctx.P()); if (!Array.isArray(W.rec)) W.rec = []; } catch (e) { W.rec = []; }
  }
  async function save(key, kind, status, o) {
    o = o || {};
    const row = { key, kind, status, score: o.score == null ? null : o.score, total: o.total == null ? null : o.total, detail: o.detail || {}, day: X.ymd() };
    (W.rec = W.rec || []).push(row);
    if (status === 'done') W.ctx.st.done.add(key);
    try {
      const r = await W.ctx.rpc('edu_kid_log', Object.assign(W.ctx.P(), { p_day: X.ymd(), p_plan: null, p_item_key: key, p_subject: 'hist', p_kind: kind, p_status: status, p_score: row.score, p_total: row.total, p_detail: row.detail }));
      if (r && r.error) throw new Error(r.error);
      return true;
    } catch (e) { X.toast('저장하지 못했어요. 인터넷을 확인해 주세요'); return false; }
  }
  const tDone = no => done('WH:T' + no), kDone = n => done('WH:K' + n), sDone = id => done('WH:H:' + id);

  /* ── 글 도우미 ── */
  const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const img = (name, alt, cls) => '<img class="' + (cls || '') + '" src="' + IMG + name + '.webp" alt="' + esc(alt || '') + '" loading="lazy" decoding="async">';
  const eraOf = t => ERA[t.era];
  const ytId = u => X.ytId(u);
  const lead = t => { const s = t.s.find(s => s.h === '한마디로'); const b = s && s.b.find(b => b.t === 'p'); return b ? b.v : ''; };
  const leadRow = t => { if (lead(t)) return lead(t); const s = t.s.find(s => /핵심 메시지/.test(s.h)); const b = s && s.b.find(b => b.t === 'p'); return b ? b.v : ''; };
  const H_NAME = { '핵심 시각화': '한눈에 보기', '다룰 내용': '이런 걸 배워요', '미션': '미션', '언제?': '언제였을까?', '그러나 바로 끝이 아니다': '그러나 바로 끝이 아니었어요', '같이 이야기해보기': '엄마·아빠와 이야기하기' };
  const crumbs = list => '<nav class="wh-crumb">' + list.map((c, i) => i < list.length - 1 ? '<button data-wh="' + c[1] + '">' + esc(c[0]) + '</button><span>›</span>' : '<b>' + esc(c[0]) + '</b>').join('') + '</nav>';

  function blocks(bl, opt) {
    opt = opt || {};
    return bl.map(b => {
      if (b.t === 'p') return '<p>' + md(b.v) + '</p>';
      if (b.t === 'label') return '<p class="wh-label">' + md(b.v) + '</p>';
      if (b.t === 'sub') return '<h4>' + md(b.v) + '</h4>';
      if (b.t === 'ul' || b.t === 'ol') {
        if (opt.chips) return '<div class="wh-chips">' + b.v.map(v => chip(v)).join('') + '</div>';
        return '<' + b.t + '>' + b.v.map(v => '<li>' + md(v) + '</li>').join('') + '</' + b.t + '>';
      }
      if (b.t === 'flow') return flow(b.v);
      if (b.t === 'tree') return '<pre class="wh-tree">' + esc(b.v.join('\n')) + '</pre>';
      if (b.t === 'qa') return qa(b.v, opt);
      return '';
    }).join('');
  }
  function chip(v) {
    const name = v.replace(/\*/g, '').trim().split(/[\s(]/)[0];
    const k = D.kings.find(k => k.name === name);
    if (k && opt_chipKings) return '<button class="wh-chip king" data-wh="king:' + k.no + '"><img src="' + k.img + '" alt="" loading="lazy">' + md(v) + '</button>';
    const s = SITES.find(s => s.name.split(/\s*·\s*/).some(n => v.includes(n.replace(/^(공주|부여|경주|강화|전주|여주) /, ''))));
    if (s) return '<button class="wh-chip" data-wh="site:' + s.id + '">📍 ' + md(v) + '</button>';
    return '<span class="wh-chip">' + md(v) + '</span>';
  }
  let opt_chipKings = true;
  function flow(items) {
    return '<ol class="wh-flow">' + items.map((v, i) => '<li><span class="n num">' + (i + 1) + '</span><span class="t">' + md(v) + '</span></li>').join('') + '</ol>';
  }
  let qaSeq = 0;
  function qa(v, opt) {
    const id = 'qa' + (++qaSeq);
    if (v.answer || v.kid) { // 사실인가요?
      return '<div class="wh-fact"><p class="q">🤔 ' + md(v.q || '') + '</p>' +
        '<button class="btn small ghost" data-reveal-wh="' + id + '">어떻게 된 걸까요?</button><div id="' + id + '" hidden>' + (v.answer ? '<p>' + md(v.answer) + '</p>' : '') + (v.kid ? '<p class="kid">💡 ' + md(v.kid) + '</p>' : '') + '</div></div>';
    }
    if (v.choices) {
      const ans = Number(v.a) - 1;
      return '<div class="wh-quiz" data-ans="' + ans + '" data-key="' + esc(opt.qkey || '') + '"><p class="q">' + md(v.q || '') + '</p><div class="opts">' +
        v.choices.map((c, i) => '<button class="wh-opt" data-pick="' + i + '"><span class="num">' + (i + 1) + '</span>' + md(c) + '</button>').join('') + '</div><p class="fb" aria-live="polite"></p></div>';
    }
    const hint = Array.isArray(v.hint) ? '<ul>' + v.hint.map(h => '<li>' + md(h) + '</li>').join('') + '</ul>' : v.hint ? '<p>' + md(v.hint) + '</p>' : '';
    const ansT = v.a ? '<p><b>정답</b> ' + md(v.a) + '</p>' : '';
    return '<div class="wh-think">' + (v.q ? '<p class="q">' + md(v.q) + '</p>' : '') + '<p class="hint-l">먼저 내 생각을 말해 보고 눌러 봐요</p><button class="btn small ghost" data-reveal-wh="' + id + '">' + (v.a ? '정답 보기' : '생각 도우미 보기') + '</button><div id="' + id + '" hidden class="ans">' + ansT + hint + '</div></div>';
  }

  /* ── 공통 조각 ── */
  function progress() {
    const t = D.topics.filter(x => tDone(x.no)).length, k = D.kings.filter(x => kDone(x.no)).length, s = SITES.filter(x => sDone(x.id)).length;
    const qz = (W.rec || []).filter(r => r.key && r.key.startsWith('WH:Q') && r.total);
    const sc = qz.reduce((a, r) => a + (r.score || 0), 0), tt = qz.reduce((a, r) => a + r.total, 0);
    const bar = (n, all) => '<i style="width:' + Math.round(n / all * 100) + '%"></i>';
    return '<div class="wh-prog">' +
      '<div><span>한국사 주제</span><b class="num">' + t + '<small>/' + D.topics.length + '</small></b><div class="tr">' + bar(t, D.topics.length) + '</div></div>' +
      '<div><span>조선 왕</span><b class="num">' + k + '<small>/27</small></b><div class="tr">' + bar(k, 27) + '</div></div>' +
      '<div><span>유적 도장</span><b class="num">' + s + '<small>/' + SITES.length + '</small></b><div class="tr">' + bar(s, SITES.length) + '</div></div>' +
      '<div><span>퀴즈 정답률</span><b class="num">' + (tt ? Math.round(sc / tt * 100) + '<small>%</small>' : '–') + '</b><div class="tr">' + (tt ? bar(sc, tt) : '') + '</div></div></div>';
  }
  function head(icon, title, sub, more) {
    return '<div class="wh-h"><div><h2>' + (icon ? '<span class="ic">' + icon + '</span>' : '') + esc(title) + '</h2>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div>' + (more ? '<button class="wh-more" data-wh="' + more[1] + '">' + esc(more[0]) + ' →</button>' : '') + '</div>';
  }
  const kingCard = k => '<button class="wh-king' + (kDone(k.no) ? ' done' : '') + '" data-wh="king:' + k.no + '"><span class="pic"><img src="' + k.img + '" alt="' + esc(k.name) + ' 초상(학습용 재구성 그림)" loading="lazy"></span><b>' + k.no + '대 ' + esc(k.name) + '</b><small class="num">' + k.reign + '</small>' + (k.why ? '<i class="tag">' + esc(k.why.split(/[;·]/)[0].trim()) + '</i>' : '') + (kDone(k.no) ? '<span class="ok">✓</span>' : '') + '</button>';
  const sitePic = (s, cls) => s.imgs.length ? img(s.imgs[0], s.name + ' (학습용 재구성 그림)', cls) : '<span class="wh-noimg ' + (cls || '') + '" style="--ec:' + siteEraCol(s) + '"><em class="num">' + s.no + '</em><span>' + esc(s.tag) + '</span></span>';
  const siteCard = s => '<button class="wh-site' + (sDone(s.id) ? ' done' : '') + '" data-wh="site:' + s.id + '">' + sitePic(s) + '<b>' + esc(s.name) + '</b><small>' + esc(s.region) + '</small><span class="wh-stp">' + (sDone(s.id) ? '🏅 도장 완료' : '도장 칸 ○') + '</span></button>';
  function badgeNow() { const n = SITES.filter(x => sDone(x.id)).length; const got = (D.badges || []).filter(b => n >= b.n); return { n, cur: got[got.length - 1], next: (D.badges || []).find(b => n < b.n) }; }
  const topicRow = t => '<button class="wh-trow' + (tDone(t.no) ? ' done' : '') + '" data-wh="topic:' + t.no + '" style="--ec:' + eraOf(t).col + '"><span class="no num">' + t.no + '</span><span class="tt"><b>' + esc(t.title) + '</b><small>' + md(leadRow(t)) + '</small></span>' + (tDone(t.no) ? '<span class="ok">✓ 완료</span>' : '<span class="go">›</span>') + '</button>';

  /* ── 화면: 홈 ── */
  function vHome() {
    return '<section class="wh-hero"><div class="bg">' + img('hero-palace-desktop', '', 'hb') + '</div><div class="wrap in"><div class="txt">' +
      '<p class="eyebrow">엄마와 함께 배우는</p><h1>역사 여행</h1><p class="sub">휘스토리와 함께 떠나는 역사 공부</p><p class="desc">왕으로 배우는 한국사, 시대별 흐름과 사건, 이야기, 영상, 퀴즈로 재미있고 깊이 있게 배워요.</p>' +
      '<div class="cta"><button class="btn wh-btn" data-wh="kings">👑 조선 왕조 시작하기</button><button class="btn ghost wh-ghost" data-wh="all">전체 시대 보기</button></div></div>' +
      img('hero-children-book', '책을 펼쳐 보는 아이들', 'kids') + '</div></section>' +
      '<div class="wrap">' + progress() +
      head('🗺️', '시대별로 알아보는 한국사', '시대를 따라 떠나는 역사 여행, 지금 시작해 보세요', ['전체 시대 보기', 'all']) +
      '<div class="wh-eras">' + ERAS.map(e => eraCard(e)).join('') + '</div>' +
      head('👑', '조선 왕조로 배우기', '27명의 왕, 500년의 이야기. 왕을 알면 조선이 보여요', ['27명 모두 보기', 'kings']) +
      '<div class="wh-hscroll">' + D.kings.map(kingCard).join('') + '</div>' +
      head('🧭', '역사의 흐름으로 이해하기', '점이 아니라 선으로! 흐름을 따라가면 역사가 더 재미있어요') +
      '<div class="wh-themes">' + D.themes.map((t, i) => '<button class="wh-theme" data-wh="theme:' + t.id + '">' + img(THEME_IMG[i], '') + '<span class="num">0' + t.id + '</span><b>' + esc(t.name) + '</b></button>').join('<span class="arr" aria-hidden="true">→</span>') + '</div>' +
      '<div class="wh-two"><div>' + head('✨', '더 재미있게 배우는 휘스토리') + '<div class="wh-feats">' +
      feat('video', '영상과 함께 보기', '짧은 영상으로 역사 지식을 쏙쏙', 'videos') + feat('quiz-mission', '퀴즈와 미션', '퀴즈로 실력을 키우고 미션에 도전', 'quiz') + feat('study-note', '학습노트', '정리하고 복습하며 나만의 역사노트', 'notes') + '</div></div>' +
      '<div>' + head('📍', '유적지 도장깨기', '다녀온 곳은 도장을 꾹!', ['전체 보기', 'sites']) + '<div class="wh-hscroll sites">' + SITES.map(siteCard).join('') + '</div></div></div>' +
      '</div>';
  }
  const feat = (ic, t, s, to) => '<button class="wh-feat" data-wh="' + to + '">' + img(ic, '') + '<span><b>' + esc(t) + '</b><small>' + esc(s) + '</small></span></button>';
  function eraCard(e) {
    const ts = D.topics.filter(t => t.era === e.id), n = ts.filter(t => tDone(t.no)).length;
    return '<button class="wh-era" data-wh="era:' + e.id + '" style="--ec:' + e.col + '">' + img(e.img, '') + '<span class="tx"><b>' + esc(e.name) + '</b><small>' + esc(e.sub) + '</small>' + (ts.length ? '<em class="num">' + n + ' / ' + ts.length + '</em>' : '') + '</span></button>';
  }

  /* ── 화면: 전체 시대 ── */
  function vAll() {
    return '<div class="wrap wh-page">' + crumbs([['휘스토리', 'home'], ['전체 시대', '']]) +
      head('🗺️', '한국사 전체 흐름', '55개 주제를 시대 순서대로 모았어요') +
      '<div class="wh-spine"><p class="wh-label">한국사의 큰 뼈대 25개 — 이 순서만 알아도 흐름이 잡혀요</p>' + flow(D.spine) + '</div>' +
      ERAS.filter(e => e.parts.length).map(e => '<div class="wh-allera" style="--ec:' + e.col + '"><button class="wh-allhead" data-wh="era:' + e.id + '">' + img(e.img, '') + '<span><b>' + esc(e.name) + '</b><small>' + esc(e.sub) + '</small></span><span class="go">›</span></button><div class="wh-tlist">' + D.topics.filter(t => t.era === e.id).map(topicRow).join('') + '</div></div>').join('') + '</div>';
  }

  /* ── 화면: 시대 ── */
  function vEra(id) {
    const e = ERA[id];
    if (id === 'world') return vWorld();
    const ts = D.topics.filter(t => t.era === id), n = ts.filter(t => tDone(t.no)).length;
    let h = '<section class="wh-ehero" style="--ec:' + e.col + '">' + img(e.img, '', 'eb') + '<div class="wrap in">' + crumbs([['휘스토리', 'home'], [e.name, '']]) + '<h1>' + esc(e.name) + '</h1><p class="sub">' + esc(e.sub) + '</p><p class="cnt num">주제 ' + ts.length + '개 · ' + n + '개 끝냈어요</p>' +
      (ts.find(t => !tDone(t.no)) ? '<button class="btn wh-btn" data-wh="topic:' + ts.find(t => !tDone(t.no)).no + '">이어서 공부하기 →</button>' : '<span class="wh-allok">🎉 이 시대를 모두 끝냈어요!</span>') + '</div></section><div class="wrap wh-page">';
    e.parts.forEach(pid => {
      const p = D.parts[pid];
      h += '<div class="wh-part" style="--ec:' + e.col + '"><div class="ph"><span class="pn">PART ' + pid + '</span><h2>' + esc(p.name) + '</h2><p>' + md(p.title) + '</p></div>' + (p.b && p.b.length ? '<div class="pb">' + blocks(p.b) + '</div>' : '') +
        '<div class="wh-tlist">' + ts.filter(t => t.part === pid).map(topicRow).join('') + '</div></div>';
    });
    if (id === 'joseon') h += head('👑', '왕으로 배우는 조선', '27명의 왕이 만들어 간 조선의 역사', ['27명 모두 보기', 'kings']) + '<div class="wh-hscroll">' + D.kings.map(kingCard).join('') + '</div>';
    const ss = SITES.filter(s => s.topics.some(no => TOP[no].era === id));
    if (ss.length) h += head('📍', e.name + ' 유적 탐방') + '<div class="wh-hscroll sites">' + ss.map(siteCard).join('') + '</div>';
    h += eraNav(id) + '</div>';
    return h;
  }
  function eraNav(id) {
    const list = ERAS.filter(e => e.parts.length), i = list.findIndex(e => e.id === id), a = list[i - 1], b = list[i + 1];
    return '<div class="wh-pn">' + (a ? '<button data-wh="era:' + a.id + '"><small>← 이전 시대</small><b>' + esc(a.name) + '</b></button>' : '<span></span>') + (b ? '<button class="r" data-wh="era:' + b.id + '"><small>다음 시대 →</small><b>' + esc(b.name) + '</b></button>' : '<span></span>') + '</div>';
  }

  /* ── 화면: 주제 상세 ── */
  function vTopic(no) {
    const t = TOP[no], e = eraOf(t), i = D.topics.indexOf(t), prev = D.topics[i - 1], next = D.topics[i + 1];
    const one = lead(t);
    qaSeq = 0;
    const secs = t.s.filter(s => s.h !== '한마디로');
    const card = s => {
      const h = H_NAME[s.h] || s.h;
      let cls = 'wh-card', ic = '📘';
      if (/흐름|연표|시각화|그러나/.test(s.h)) { cls += ' flowc'; ic = '🧭'; }
      else if (/기억/.test(s.h)) { cls += ' memo'; ic = '⭐'; }
      else if (/퀴즈/.test(s.h)) { cls += ' quizc'; ic = '❓'; }
      else if (/이야기/.test(s.h)) { cls += ' talk'; ic = '💬'; }
      else if (/사실/.test(s.h)) { cls += ' factc'; ic = '🔎'; }
      else if (PEOPLE_H.test(s.h)) { cls += ' people'; ic = '🧑'; }
      else if (/유물|유적|현장/.test(s.h)) { cls += ' relic'; ic = '🏺'; }
      else if (/미션/.test(s.h)) { cls += ' memo'; ic = '🔍'; }
      else if (/핵심 메시지/.test(s.h)) { cls += ' msg'; ic = '💡'; }
      const chips = PEOPLE_H.test(s.h) || /유물|유적|현장|기억|문화 키워드|함께|다룰/.test(s.h);
      return '<section class="' + cls + '"><h3><span class="ic">' + ic + '</span>' + esc(h) + '</h3>' + blocks(s.b, { chips, qkey: 'WH:TQ' + no }) + '</section>';
    };
    const flowS = secs.filter(s => /흐름|연표|그러나|시각화/.test(s.h)), quizS = secs.filter(s => /퀴즈|이야기|사실/.test(s.h)), main = secs.filter(s => !flowS.includes(s) && !quizS.includes(s));
    const vids = t.videos || [];
    const note = (lastRec('WH:N' + no) || {}).detail || {};
    return '<section class="wh-thero" style="--ec:' + e.col + '">' + img(e.img, '', 'tb') + '<div class="wrap in">' + crumbs([['휘스토리', 'home'], [e.name, 'era:' + e.id], [t.no + '. ' + t.title, '']]) +
      '<div class="badges"><span class="eb">' + esc(e.name) + '</span><span class="nb num">' + t.no + ' / 55</span>' + (tDone(no) ? '<span class="okb">✓ 공부 완료</span>' : '') + '</div><h1>' + esc(t.title) + '</h1>' + (one ? '<p class="one"><span>한마디로</span>' + md(one) + '</p>' : '') + '</div></section>' +
      '<div class="wrap wh-page">' +
      (t.family ? '<p class="wh-family">👨‍👩‍👦 마음이 무거울 수 있는 내용이에요. 엄마·아빠와 함께 보세요.</p>' : '') +
      flowS.map(card).join('') +
      '<div class="wh-grid">' + main.map(card).join('') + '</div>' +
      (vids.length ? '<section class="wh-card vids"><h3><span class="ic">🎬</span>영상으로 보기</h3><p class="vnote">영상은 이해를 돕는 보조 자료예요. 다 보면 다시 이 화면으로 돌아와요.</p><div class="wh-vlist">' + vids.map(v => vcard(v)).join('') + '</div></section>' : '') +
      quizS.map(card).join('') +
      noteBox('WH:N' + no, note) +
      '<div class="wh-donebar">' + (tDone(no) ? '<span class="okb big">🏅 도장을 받은 주제예요</span>' : '<button class="btn wh-btn big" data-whdone="T' + no + '">다 공부했어요 · 도장 받기 🏅</button>') + '</div>' +
      '<div class="wh-pn">' + (prev ? '<button data-wh="topic:' + prev.no + '"><small>← 앞의 역사</small><b>' + esc(prev.title) + '</b></button>' : '<span></span>') + (next ? '<button class="r" data-wh="topic:' + next.no + '"><small>뒤의 역사 →</small><b>' + esc(next.title) + '</b></button>' : '<span></span>') + '</div>' +
      (t.kings.length ? head('👑', '함께 알아볼 왕') + '<div class="wh-hscroll">' + t.kings.map(n => kingCard(KING[n])).join('') + '</div>' : '') +
      '</div>';
  }
  function vcard(v) {
    const id = ytId(v.url);
    return '<button class="wh-vid" data-play="' + esc(v.url) + '" data-vt="' + esc(v.t) + '"><span class="th">' + (id ? '<img src="https://i.ytimg.com/vi/' + id + '/mqdefault.jpg" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">' : '') + '<span class="pl">▶</span></span><span class="vt"><b>' + esc(v.t) + '</b><small>' + esc(v.ch || '') + (v.role === 'sub' ? ' · 보조 영상' : '') + '</small></span></button>';
  }
  function noteBox(key, n) {
    return '<section class="wh-card note"><h3><span class="ic">📝</span>나의 학습노트</h3><div class="wh-nf" data-note="' + key + '">' +
      '<label>오늘 배운 내용 한 줄<input data-nk="sum" maxlength="120" value="' + esc(n.sum || '') + '"></label>' +
      '<div class="f2"><label>가장 기억에 남는 인물<input data-nk="person" maxlength="40" value="' + esc(n.person || '') + '"></label><label>가장 기억에 남는 사건<input data-nk="event" maxlength="40" value="' + esc(n.event || '') + '"></label></div>' +
      '<label>아직 궁금한 점<input data-nk="ask" maxlength="120" value="' + esc(n.ask || '') + '"></label>' +
      '<div class="row"><button class="btn small" data-savenote="' + key + '">노트 저장</button>' + (n.sum || n.person || n.event || n.ask ? '<small class="saved">저장돼 있어요</small>' : '') + '</div></div></section>';
  }

  /* ── 화면: 왕 ── */
  function vKings() {
    const n = D.kings.filter(k => kDone(k.no)).length;
    const group = (title, years, desc, list) => '<section class="wh-period"><div class="pph"><h3>' + esc(title) + '</h3><span class="num">' + esc(years) + '</span></div>' + (desc ? '<p>' + esc(desc) + '</p>' : '') + '<div class="wh-kgrid">' + list.map(kingCard).join('') + '</div></section>';
    return '<div class="wrap wh-page">' + crumbs([['휘스토리', 'home'], ['조선 왕조 27대 군주', '']]) +
      head('👑', '조선 왕조 27대 군주', '왕 이름만 외우지 말고, 왜 다음 왕에게 그런 일이 생겼는지 연결해서 봐요 · ' + n + '/27') +
      (D.periods || []).map(p => group(p.id + '. ' + p.name, p.years, p.desc, D.kings.filter(k => k.no >= p.from && k.no <= p.to))).join('') +
      group('개항과 대한제국', '1863–1910', '고종은 조선 제26대 국왕이자 대한제국 초대 황제, 순종은 대한제국의 마지막 황제예요.', D.kings.filter(k => k.no >= 26)) +
      '<p class="wh-srcnote">※ 5개 구간은 학습 편의를 위한 구분이며 학계의 유일한 표준 시대구분은 아니에요. 나이는 전통식 표기를 따르는 곳이 있어요.</p>' +
      head('🧵', '조선 왕 흐름 한눈에', '왕위가 어떻게 이어졌는지 따라가 봐요') +
      '<div class="wh-lines">' + D.kingLines.map(l => '<section class="wh-card flowc"><h3>' + esc(l.title) + '</h3>' + blocks(l.b) + '</section>').join('') + '</div></div>';
  }
  function vKing(no) {
    const k = KING[no], prev = KING[no - 1], next = KING[no + 1], lines = lineOf(k.name), doc = KDOC[no], per = periodOf(no);
    const card = (cls, ic, h, body) => '<section class="wh-card ' + cls + '"><h3><span class="ic">' + ic + '</span>' + esc(h) + '</h3>' + body + '</section>';
    return '<section class="wh-khero"><div class="wrap in">' + crumbs([['휘스토리', 'home'], ['조선 왕', 'kings'], [k.name, '']]) +
      '<div class="kh"><div class="pic"><img src="' + k.img + '" alt="' + esc(k.name) + ' 초상(학습용 재구성 그림)"></div><div class="tx"><span class="eb">조선 ' + k.no + '대' + (k.no >= 26 ? ' · 대한제국' : '') + '</span>' + (per ? '<span class="pb">' + esc(per.id + '. ' + per.name) + '</span>' : '') + '<h1>' + esc(doc ? doc.name : k.name) + '</h1>' +
      (k.note ? '<p class="sub">' + esc(k.note) + '</p>' : '') + (doc && doc.one ? '<p class="one"><span>한마디로</span>' + esc(doc.one) + '</p>' : '') +
      '<div class="facts"><span>📅 재위 <b class="num">' + k.reign + '</b></span>' + (k.why ? '<span>🔑 ' + esc(k.why.split(';')[0]) + '</span>' : '') + '</div>' +
      (doc ? '' : '<p class="wh-pdf">고종·순종의 자세한 이야기는 검증 자료를 받으면 채울게요.</p>') + '</div></div></div></section>' +
      '<div class="wrap wh-page">' +
      (doc ? '<div class="wh-grid">' + card('', '📘', '꼭 알아야 할 것', '<ul>' + doc.must.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>') +
        '<div>' + (doc.rel.length ? card('flowc', '🧵', '인물 관계 / 흐름', flow(doc.rel)) : '') + (doc.story ? card('memo', '⭐', '기억할 이야기', '<p>' + esc(doc.story) + '</p>') : '') + '</div></div>' +
        (doc.memo ? card('factc', '🔎', '사실 확인 메모', '<p>' + esc(doc.memo) + '</p>') : '') : '') +
      (!doc && lines.length ? lines.map(l => card('flowc', '🧵', l.title, blocks(l.b))).join('') : '') +
      (k.videos && k.videos.length ? '<section class="wh-card vids"><h3><span class="ic">🎬</span>영상으로 보기</h3><p class="vnote">' + esc(k.why ? '연결 이유: ' + k.why + '. ' : '') + '왕 한 사람만 다룬 영상이 아닐 수도 있어요.</p><div class="wh-vlist">' + k.videos.map(vcard).join('') + '</div></section>' : '') +
      (doc && doc.talk ? card('talk', '💬', '엄마·아빠와 이야기하기', '<p>' + esc(doc.talk) + '</p>') : '') +
      (k.topics.length ? head('📘', '이 왕과 연결된 역사') + '<div class="wh-tlist">' + k.topics.map(n => topicRow(TOP[n])).join('') + '</div>' : '') +
      (SITES.some(s => s.kings.includes(no)) ? head('📍', '이 왕과 연결된 유적') + '<div class="wh-hscroll sites">' + SITES.filter(s => s.kings.includes(no)).map(siteCard).join('') + '</div>' : '') +
      '<div class="wh-donebar">' + (kDone(no) ? '<span class="okb big">🏅 도장을 받은 왕이에요</span>' : '<button class="btn wh-btn big" data-whdone="K' + no + '">이 왕을 알아봤어요 · 도장 받기 🏅</button>') + '</div>' +
      '<div class="wh-pn">' + (prev ? '<button data-wh="king:' + prev.no + '"><small>← 이전 왕</small><b>' + prev.no + '대 ' + esc(prev.name) + '</b></button>' : '<span></span>') + '<button class="mid" data-wh="kings">👑 27명 모두</button>' + (next ? '<button class="r" data-wh="king:' + next.no + '"><small>다음 왕 →</small><b>' + next.no + '대 ' + esc(next.name) + '</b></button>' : '<span></span>') + '</div>' +
      (doc ? '<p class="wh-srcnote">내용: ' + esc(D.kingSrc || '') + '</p>' : '') + '</div>';
  }

  /* ── 화면: 유적 ── */
  function vSites() {
    const B = badgeNow();
    return '<div class="wrap wh-page">' + crumbs([['휘스토리', 'home'], ['유적지 도장깨기', '']]) +
      head('📍', '유적지 도장깨기 16곳', '공부한 역사를 직접 만나러 가는 가족 역사여행 · 보고 → 찾아보고 → 이야기하고 → 도장 찍기') +
      '<div class="wh-badges">' + (D.badges || []).map(b => '<div class="' + (B.n >= b.n ? 'on' : '') + '"><span>' + b.icon + '</span><b>' + esc(b.name) + '</b><small class="num">' + b.n + '곳</small></div>').join('') +
      '<p class="num">' + B.n + ' / 16곳 다녀왔어요' + (B.next ? ' · ' + (B.next.n - B.n) + '곳 더 가면 「' + esc(B.next.name) + '」' : ' · 휘스토리 마스터! 👑') + '</p></div>' +
      '<div class="wh-sgrid">' + SITES.map(siteCard).join('') + '</div>' +
      '<p class="wh-srcnote">※ 관람 시간·예약·공사 구간은 바뀔 수 있어요. 가기 전에 공식 누리집에서 확인하세요. (영상·공식자료 확인 ' + esc(D.siteChecked || '') + ')</p></div>';
  }
  function vSite(id) {
    const s = SITE[id], v = lastRec('WH:H:' + id), vd = (v && v.detail) || {};
    const i = SITES.indexOf(s), prev = SITES[i - 1], next = SITES[i + 1];
    const vids = s.videos.filter(x => !x.search), finds = s.videos.filter(x => x.search);
    const card = (cls, ic, h, body) => '<section class="wh-card ' + cls + '"><h3><span class="ic">' + ic + '</span>' + esc(h) + '</h3>' + body + '</section>';
    return '<div class="wrap wh-page">' + crumbs([['휘스토리', 'home'], ['유적지 도장깨기', 'sites'], [s.no + '. ' + s.name, '']]) +
      '<div class="wh-sdet" style="--ec:' + siteEraCol(s) + '"><div class="pic">' + sitePic(s, 'big') + (s.imgs[1] ? img(s.imgs[1], '석굴암 (학습용 재구성 그림)', 'second') : '') + '</div><div class="tx"><span class="eb num">' + s.no + ' · ' + esc(s.era) + '</span><h1>' + esc(s.name) + '</h1><p class="tagl">' + esc(s.tag) + '</p><p class="sub">📍 ' + esc(s.region) + '</p>' +
      (sDone(id) ? '<div class="wh-stamp">🏅 도장 완료' + (vd.date ? ' · <span class="num">' + esc(vd.date) + '</span>' : '') + '</div>' + (vd.memo ? '<p class="vmemo">✏️ ' + esc(vd.memo) + '</p>' : '') : '') + '</div></div>' +
      card('msg', '💡', '왜 가볼까?', '<p>' + esc(s.why) + '</p>') +
      '<div class="wh-grid">' + card('', '🔎', '현장에서 꼭 봐야 할 것', '<ol class="wh-check">' + s.see.map((x, j) => '<li><label><input type="checkbox" data-see="' + j + '"' + ((vd.found || []).includes(j) ? ' checked' : '') + '><span>' + esc(x) + '</span></label></li>').join('') + '</ol>') +
      '<div>' + card('talk', '💬', '아이와 나눌 질문', '<p>“' + esc(s.ask) + '”</p>') + card('memo', '🎯', '현장 미션', '<p>' + esc(s.mission) + '</p>') + '</div></div>' +
      (vids.length || finds.length ? '<section class="wh-card vids"><h3><span class="ic">▶</span>가기 전에 미리보기</h3><p class="vnote"><b>' + esc(s.vtitle) + '</b><br>' + esc(s.vnote) + '</p><div class="wh-vlist">' + vids.map((x, j) => vcard({ url: x.url, t: j === 0 ? s.vtitle.replace(/^.*? - /, '') : (s.more || '추가 영상'), ch: j === 0 ? s.vtitle.split(' - ')[0] : '추가 영상' })).join('') + '</div>' +
        finds.map(x => '<a class="wh-find" href="' + esc(x.url) + '" target="_blank" rel="noopener">🔍 유튜브에서 찾아보기' + (s.more ? ' — ' + esc(s.more.replace(/\s*유튜브 검색 바로가기/, '')) : '') + ' ↗</a>').join('') + '</section>' : '') +
      '<section class="wh-card note"><h3><span class="ic">🏅</span>' + (sDone(id) ? '방문 기록' : '다녀왔으면 도장 찍기') + '</h3><div class="wh-nf"><label>오늘 본 것·느낀 것 한 줄<input id="vmemo" maxlength="120" value="' + esc(vd.memo || '') + '" placeholder="예: 덮개돌이 생각보다 훨씬 컸다"></label>' +
      '<div class="row"><button class="btn wh-btn" data-visit="' + id + '">' + (sDone(id) ? '기록 고치기' : '다녀왔어요 · 도장 찍기 🏅') + '</button><small>위에서 찾은 것에 체크하면 함께 저장돼요</small></div></div></section>' +
      head('📘', '함께 공부할 역사') + '<div class="wh-tlist">' + s.topics.map(n => topicRow(TOP[n])).join('') + '</div>' +
      (s.kings.length ? '<div class="wh-hscroll" style="margin-top:12px">' + s.kings.map(n => kingCard(KING[n])).join('') + '</div>' : '') +
      '<div class="wh-pn">' + (prev ? '<button data-wh="site:' + prev.id + '"><small>← 이전 유적</small><b>' + esc(prev.name) + '</b></button>' : '<span></span>') + (next ? '<button class="r" data-wh="site:' + next.id + '"><small>다음 유적 →</small><b>' + esc(next.name) + '</b></button>' : '<span></span>') + '</div>' +
      '<p class="wh-srcnote">자료 검증: ' + esc(s.src) + ' · 관람 정보는 방문 전 공식 누리집에서 확인하세요.</p></div>';
  }

  /* ── 화면: 흐름 테마 ── */
  function vTheme(id) {
    const t = D.themes.find(x => x.id === +id);
    const link = v => { const key = v.replace(/^\d{4}\s*/, '').replace(/\s/g, ''); const tp = D.topics.find(x => { const tt = x.title.replace(/\s/g, ''); return key.length >= 2 && (tt.includes(key)); }); return tp; };
    return '<div class="wrap wh-page">' + crumbs([['휘스토리', 'home'], [t.name, '']]) +
      '<div class="wh-thead">' + img(THEME_IMG[t.id - 1], '') + '<div><span class="eb num">흐름 0' + t.id + '</span><h1>' + esc(t.name) + '</h1>' + (t.q ? '<p class="sub">🤔 ' + esc(t.q) + '</p>' : '') + '</div></div>' +
      '<ol class="wh-vline">' + t.flow.map((v, i) => { const tp = link(v); return '<li>' + (tp ? '<button data-wh="topic:' + tp.no + '"><span class="n num">' + (i + 1) + '</span><b>' + esc(v) + '</b><small>' + esc(tp.no + '. ' + tp.title) + ' ›</small></button>' : '<div><span class="n num">' + (i + 1) + '</span><b>' + esc(v) + '</b></div>') + '</li>'; }).join('') + '</ol>' +
      '<div class="wh-themes small">' + D.themes.map((x, i) => '<button class="wh-theme' + (x.id === t.id ? ' on' : '') + '" data-wh="theme:' + x.id + '">' + img(THEME_IMG[i], '') + '<b>' + esc(x.name) + '</b></button>').join('') + '</div></div>';
  }

  /* ── 화면: 세계사 ── */
  function vWorld() {
    const e = ERA.world;
    return '<section class="wh-ehero" style="--ec:' + e.col + '">' + img(e.img, '', 'eb') + '<div class="wrap in">' + crumbs([['휘스토리', 'home'], ['세계사', '']]) + '<h1>세계사</h1><p class="sub">한국사의 각 시대와 같은 시기의 세계를 함께 봐요</p></div></section>' +
      '<div class="wrap wh-page"><div class="wh-world">' + D.world.map(w => '<section class="wh-card"><h3>' + esc(w.era) + '</h3><div class="wh-chips">' + w.items.map(x => '<span class="wh-chip">' + md(x) + '</span>').join('') + '</div></section>').join('') + '</div></div>';
  }

  /* ── 화면: 영상 ── */
  function vVideos() {
    return '<div class="wrap wh-page">' + crumbs([['휘스토리', 'home'], ['영상으로 보기', '']]) +
      head('🎬', '영상으로 보기', '영상은 보조 자료예요. 보고 나면 그 주제 페이지에서 정리해 봐요') +
      ERAS.filter(e => e.parts.length).map(e => '<div class="wh-allera" style="--ec:' + e.col + '"><h2 class="wh-eh">' + esc(e.name) + '</h2><div class="wh-vlist">' +
        D.topics.filter(t => t.era === e.id && t.videos.length).map(t => { const v = t.videos.find(v => v.role === 'main') || t.videos[0]; return vcard(Object.assign({}, v, { ch: t.no + '. ' + t.title + (v.ch ? ' · ' + v.ch : '') })); }).join('') + '</div></div>').join('') + '</div>';
  }

  /* ── 화면: 학습노트 ── */
  function vNotes() {
    const map = {};
    (W.rec || []).filter(r => r.key && r.key.startsWith('WH:N')).forEach(r => map[r.key] = r);
    const list = Object.values(map).reverse();
    return '<div class="wrap wh-page">' + crumbs([['휘스토리', 'home'], ['학습노트', '']]) +
      head('📝', W.ctx.st.kid.name + '의 역사 노트', list.length ? list.length + '개 주제를 정리했어요' : '주제 페이지 아래에서 노트를 써 보세요') +
      (list.length ? '<div class="wh-notes">' + list.map(r => { const no = r.key.slice(4), t = TOP[no], d = r.detail || {}; return t ? '<button class="wh-ncard" data-wh="topic:' + no + '" style="--ec:' + eraOf(t).col + '"><span class="eb">' + esc(eraOf(t).name) + ' · ' + no + '</span><b>' + esc(t.title) + '</b>' + (d.sum ? '<p>✏️ ' + esc(d.sum) + '</p>' : '') + (d.person ? '<p>🧑 ' + esc(d.person) + '</p>' : '') + (d.event ? '<p>📌 ' + esc(d.event) + '</p>' : '') + (d.ask ? '<p>❓ ' + esc(d.ask) + '</p>' : '') + '<small class="num">' + esc(r.day || '') + '</small></button>' : ''; }).join('') + '</div>' : '<div class="wh-empty">' + img('study-note', '') + '<p>아직 쓴 노트가 없어요.</p><button class="btn wh-btn" data-wh="all">공부할 주제 고르기</button></div>') + '</div>';
  }

  /* ── 화면: 퀴즈 ── */
  const shuffle = a => X.shuffle(a);
  function vQuiz() {
    const best = k => { const a = recs('WH:Q:' + k).filter(r => r.total); if (!a.length) return ''; const r = a[a.length - 1]; return '<em class="num">최근 ' + r.score + '/' + r.total + '</em>'; };
    return '<div class="wrap wh-page">' + crumbs([['휘스토리', 'home'], ['퀴즈와 미션', '']]) +
      head('🏆', '퀴즈와 미션', '외우기보다 흐름으로! 문제를 풀면 정답률이 기록돼요') +
      '<div class="wh-qhub">' +
      qcard('order', '🔢', '순서 맞히기', '사건 카드를 일어난 순서대로 눌러요 (5문제)', best('order')) +
      qcard('era', '🗺️', '어느 시대일까?', '주제를 보고 시대를 골라요 (10문제)', best('era')) +
      qcard('spine', '🦴', '한국사 큰 뼈대', '25개 흐름 중 빈칸을 채워요 (8문제)', best('spine')) +
      qcard('topic', '📘', '주제 퀴즈 모음', '주제 페이지에 있는 문제를 한꺼번에', '') + '</div></div>';
  }
  const qcard = (k, ic, t, s, b) => '<button class="wh-qcard" data-wh="play:' + k + '"><span class="ic">' + ic + '</span><b>' + esc(t) + '</b><small>' + esc(s) + '</small>' + b + '</button>';

  function makeQuiz(kind) {
    const qs = [];
    if (kind === 'order') {
      const pool = shuffle(D.topics.flatMap(t => t.s.filter(s => /흐름|연표/.test(s.h)).flatMap(s => s.b.filter(b => b.t === 'flow' && b.v.length >= 4 && b.v.length <= 7).map(b => ({ t, v: b.v })))));
      pool.slice(0, 5).forEach(p => { const v = p.v.slice(0, 5); qs.push({ type: 'order', title: p.t.no + '. ' + p.t.title, items: v, shown: shuffle(v.map((x, i) => i)), picked: [] }); });
    } else if (kind === 'era') {
      const eras = ERAS.filter(e => e.parts.length);
      shuffle(D.topics).slice(0, 10).forEach(t => qs.push({ type: 'pick', q: '「' + t.title + '」는 어느 시대의 이야기일까요?', choices: eras.map(e => e.name), answer: eras.findIndex(e => e.id === t.era), link: t.no }));
    } else if (kind === 'spine') {
      const idx = shuffle(D.spine.map((x, i) => i).filter(i => i > 0 && i < D.spine.length - 1)).slice(0, 8);
      idx.forEach(i => { const wrong = shuffle(D.spine.filter((x, j) => Math.abs(j - i) > 2)).slice(0, 3); const ch = shuffle([D.spine[i]].concat(wrong)); qs.push({ type: 'pick', q: D.spine[i - 1] + '  →  ❓  →  ' + D.spine[i + 1], sub: '빈칸에 들어갈 흐름은?', choices: ch, answer: ch.indexOf(D.spine[i]) }); });
    } else if (kind === 'topic') {
      D.topics.forEach(t => t.s.filter(s => /퀴즈/.test(s.h)).forEach(s => s.b.filter(b => b.t === 'qa' && b.v.choices).forEach(b => qs.push({ type: 'pick', q: b.v.q, choices: b.v.choices, answer: Number(b.v.a) - 1, link: t.no }))));
    }
    return { kind, qs, i: 0, score: 0, answered: false };
  }
  function vPlay(kind) {
    if (!W.quiz || W.quiz.kind !== kind) W.quiz = makeQuiz(kind);
    const Q = W.quiz, q = Q.qs[Q.i];
    const top = '<div class="wrap wh-page">' + crumbs([['휘스토리', 'home'], ['퀴즈와 미션', 'quiz'], [{ order: '순서 맞히기', era: '어느 시대일까?', spine: '한국사 큰 뼈대', topic: '주제 퀴즈 모음' }[kind], '']]);
    if (!q) {
      return top + '<div class="wh-qend">' + img('quiz-mission', '') + '<h2>' + Q.score + ' / ' + Q.qs.length + '</h2><p>' + (Q.score === Q.qs.length ? '완벽해요! 🎉' : Q.score >= Q.qs.length * .7 ? '잘했어요! 👏' : '틀린 건 주제 페이지에서 다시 봐요 💪') + '</p><div class="cta"><button class="btn wh-btn" data-wh="play:' + kind + '" data-new="1">한 번 더</button><button class="btn ghost wh-ghost" data-wh="quiz">퀴즈 목록</button></div></div></div>';
    }
    let body = '<div class="wh-qbox"><div class="qtop"><span class="num">' + (Q.i + 1) + ' / ' + Q.qs.length + '</span><span class="num">맞힌 문제 ' + Q.score + '</span></div>';
    if (q.type === 'order') {
      body += '<p class="q">' + esc(q.title) + '</p><p class="qs">일어난 순서대로 눌러 보세요</p><ol class="wh-picked">' + q.items.map((x, i) => '<li class="num">' + (q.picked[i] != null ? esc(q.items[q.picked[i]]) : '') + '</li>').join('') + '</ol>' +
        '<div class="opts">' + q.shown.map(i => '<button class="wh-opt" data-ord="' + i + '"' + (q.picked.includes(i) || Q.answered ? ' disabled' : '') + '>' + md(q.items[i]) + '</button>').join('') + '</div>' +
        (Q.answered ? '' : '<button class="btn small ghost" data-ordreset="1">다시 놓기</button>');
      if (Q.answered) body += '<div class="fb ' + (Q.lastOk ? 'ok' : 'no') + '">' + (Q.lastOk ? '⭕ 정답이에요!' : '❌ 정답 순서는:') + '</div>' + (Q.lastOk ? '' : flow(q.items));
    } else {
      body += '<p class="q">' + md(q.q) + '</p>' + (q.sub ? '<p class="qs">' + esc(q.sub) + '</p>' : '') + '<div class="opts">' + q.choices.map((c, i) => '<button class="wh-opt' + (Q.answered && i === q.answer ? ' right' : '') + (Q.answered && i === Q.lastPick && i !== q.answer ? ' wrong' : '') + '" data-qp="' + i + '"' + (Q.answered ? ' disabled' : '') + '><span class="num">' + (i + 1) + '</span>' + md(c) + (Q.answered && i === q.answer ? ' <b>⭕ 정답</b>' : '') + (Q.answered && i === Q.lastPick && i !== q.answer ? ' <b>❌</b>' : '') + '</button>').join('') + '</div>';
      if (Q.answered && q.link) body += '<button class="wh-more" data-wh="topic:' + q.link + '">이 주제 다시 보기 →</button>';
    }
    if (Q.answered) body += '<div class="next"><button class="btn wh-btn" data-qnext="1">' + (Q.i < Q.qs.length - 1 ? '다음 문제 →' : '결과 보기') + '</button></div>';
    return top + body + '</div></div>';
  }
  async function finishQuiz() {
    const Q = W.quiz;
    await save('WH:Q:' + Q.kind, 'quiz', 'done', { score: Q.score, total: Q.qs.length, detail: { title: '휘스토리 퀴즈' } });
  }

  /* ── 동영상 창 ── */
  function play(url, title) {
    const id = ytId(url);
    if (!id) { window.open(url, '_blank', 'noopener'); return; }
    const m = document.createElement('div');
    m.className = 'wh-modal';
    m.innerHTML = '<div class="box" role="dialog" aria-label="' + esc(title) + '"><div class="bar"><b>' + esc(title) + '</b><button class="x" data-close="1" aria-label="닫기">✕</button></div><div class="fr"><iframe src="https://www.youtube-nocookie.com/embed/' + id + '?rel=0&modestbranding=1&playsinline=1" title="' + esc(title) + '" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div><div class="foot"><span>영상은 보조 학습 자료예요</span><a href="' + esc(url) + '" target="_blank" rel="noopener">유튜브에서 열기 ↗</a></div></div>';
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) m.remove(); });
    document.body.appendChild(m);
  }

  /* ── 연결 (kid.js에서 부름) ── */
  const VIEWS = { home: vHome, all: vAll, era: vEra, topic: vTopic, kings: vKings, king: n => vKing(+n), sites: vSites, site: vSite, theme: vTheme, world: vWorld, videos: vVideos, notes: vNotes, quiz: vQuiz, play: vPlay };
  function parse(s) { const [p, id] = String(s || 'home').split(':'); return VIEWS[p] ? { p, id } : { p: 'home' }; }
  function render() { return '<div class="wh">' + VIEWS[W.r.p](W.r.id) + '</div>'; }
  function nav(s, extra) {
    const r = parse(s);
    if (r.p === 'play' && (extra && extra.fresh || !W.quiz || W.quiz.kind !== r.id || W.quiz.i >= W.quiz.qs.length)) W.quiz = null;
    W.r = r; W.ctx.go('history');
  }
  function rerender() { const el = document.querySelector('.wh'); if (el) el.outerHTML = render(); }

  async function onClick(e) {
    const t = e.target.closest('button,a'); if (!t || !t.closest('.wh, .wh-modal')) return false;
    const d = t.dataset;
    if (d.wh) { e.preventDefault(); nav(d.wh, { fresh: !!d.new }); return true; }
    if (d.play) { play(d.play, d.vt || '영상'); return true; }
    if (d.revealWh) { const el = document.getElementById(d.revealWh); if (el) { el.hidden = false; t.remove(); } return true; }
    if (d.pick != null) { // 주제 안 퀴즈
      const box = t.closest('.wh-quiz'), ans = +box.dataset.ans, ok = +d.pick === ans;
      box.querySelectorAll('.wh-opt').forEach((b, i) => { b.disabled = true; if (i === ans) b.classList.add('right'); });
      if (!ok) t.classList.add('wrong');
      box.querySelector('.fb').textContent = ok ? '⭕ 정답이에요! 잘했어요.' : '❌ 아쉬워요. 초록색이 정답이에요.';
      if (box.dataset.key) save(box.dataset.key, 'quiz', 'done', { score: ok ? 1 : 0, total: 1, detail: { title: '휘스토리 주제 퀴즈' } });
      return true;
    }
    if (d.whdone) {
      const key = 'WH:' + d.whdone, isT = d.whdone[0] === 'T', nm = isT ? TOP[d.whdone.slice(1)].title : KING[+d.whdone.slice(1)].name;
      t.disabled = true;
      if (await save(key, isT ? 'topic' : 'king', 'done', { detail: { title: '휘스토리 · ' + nm } })) { X.toast('도장 꾹! 🏅 잘했어요'); rerender(); } else t.disabled = false;
      return true;
    }
    if (d.visit) {
      const was = sDone(d.visit), old = (lastRec('WH:H:' + d.visit) || {}).detail || {};
      const det = { title: '휘스토리 유적 · ' + SITE[d.visit].name, date: old.date || X.ymd(), memo: (document.getElementById('vmemo') || {}).value || '', found: Array.from(document.querySelectorAll('[data-see]:checked')).map(x => +x.dataset.see) };
      t.disabled = true;
      const B0 = badgeNow().cur;
      if (await save('WH:H:' + d.visit, 'visit', was ? 'opened' : 'done', { detail: det })) {
        if (was) { X.toast('기록을 고쳤어요'); } else { const B1 = badgeNow().cur; X.toast(B1 && B1 !== B0 ? B1.icon + ' 「' + B1.name + '」 배지를 받았어요!' : '유적 도장 꾹! 🏅'); }
        rerender();
      } else t.disabled = false;
      return true;
    }
    if (d.savenote) {
      const box = t.closest('[data-note]'), det = { title: '휘스토리 노트' };
      box.querySelectorAll('[data-nk]').forEach(i => det[i.dataset.nk] = i.value.trim());
      if (!det.sum && !det.person && !det.event && !det.ask) { X.toast('한 칸이라도 써 주세요'); return true; }
      t.disabled = true;
      if (await save(d.savenote, 'note', 'opened', { detail: det })) X.toast('노트를 저장했어요 📝');
      t.disabled = false; return true;
    }
    const Q = W.quiz;
    if (d.qp != null && Q) { const q = Q.qs[Q.i]; Q.answered = true; Q.lastPick = +d.qp; if (+d.qp === q.answer) Q.score++; rerender(); return true; }
    if (d.ord != null && Q) {
      const q = Q.qs[Q.i]; q.picked.push(+d.ord);
      if (q.picked.length === q.items.length) { Q.answered = true; Q.lastOk = q.picked.every((v, i) => v === i); if (Q.lastOk) Q.score++; }
      rerender(); return true;
    }
    if (d.ordreset && Q) { Q.qs[Q.i].picked = []; rerender(); return true; }
    if (d.qnext && Q) { Q.i++; Q.answered = false; if (Q.i >= Q.qs.length) await finishQuiz(); rerender(); window.scrollTo(0, 0); return true; }
    return false;
  }

  window.WH = {
    mount(ctx) { W.ctx = ctx; },
    async open() { await loadRec(); },
    render, nav, onClick,
    state() { return W.r.p + (W.r.id ? ':' + W.r.id : ''); },
    restore(s) { W.r = parse(s); },
    resetKid() { W.rec = null; W.quiz = null; W.r = { p: 'home' }; }
  };
})();
