/* 우리집 배움터 — 공통 로직 (아이 화면·엄마 화면 함께 사용) */
(function () {
  'use strict';
  const SUPABASE_URL = 'https://pqjbsagecbhbcbignbcq.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_PjQxftU-iz0Zvx8PYejRZQ_IcXPIAca'; // 공개용 키(권한은 DB 보안 규칙으로 제한)

  const SUBJECTS = {
    read: { name: '국어 문해력', short: '문해력', emoji: '📖', bg: '#ecdffb', col: 'var(--c-read)', min: 10 },
    calc: { name: '수학 연산', short: '연산', emoji: '🧮', bg: '#dcecfb', col: 'var(--c-calc)', min: 7 },
    math: { name: '수학 단원', short: '수학', emoji: '📐', bg: '#d6f1ef', col: 'var(--c-math)', min: 25 },
    soc:  { name: '사회·한국사', short: '사회', emoji: '🏯', bg: '#ffe5d1', col: 'var(--c-soc)', min: 12 },
    word: { name: '영어 단어', short: '영단어', emoji: '🔤', bg: '#ffe0f2', col: 'var(--c-word)', min: 7 },
    eng:  { name: '영어 수업', short: '영어', emoji: '💬', bg: '#dcf5e2', col: 'var(--c-eng)', min: 12 },
    etc:  { name: '할 일', short: '할 일', emoji: '✅', bg: '#f1e9de', col: 'var(--c-etc)', min: 0 },
    link: { name: '엄마가 고른 강의', short: '강의', emoji: '🎬', bg: '#e3e8ff', col: 'var(--c-link)', min: 15 }
  };
  const SUBJECT_ORDER = ['read', 'calc', 'math', 'soc', 'word', 'eng'];
  const WD = ['일', '월', '화', '수', '목', '금', '토'];

  /* ── 날짜·학년 ── */
  function ymd(d) { d = d || new Date(); const z = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); }
  function parseYmd(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
  function schoolYear(d) { d = d || new Date(); return d.getMonth() >= 2 ? d.getFullYear() : d.getFullYear() - 1; } // 3월 새 학년
  function semester(d) { d = d || new Date(); const m = d.getMonth() + 1; return (m >= 3 && m <= 8) ? 1 : 2; }
  function gradeOf(kid, d) { return Math.min(6, Math.max(1, schoolYear(d) - kid.entry_year + 1)); }
  function levelOf(kid, subject, d) {
    const off = (kid.levels && Number(kid.levels[subject])) || 0;
    return Math.min(6, Math.max(1, gradeOf(kid, d) + off));
  }
  function fmtDate(s) { const d = parseYmd(s); return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + WD[d.getDay()] + '요일'; }

  /* ── 시드 난수 (같은 날 같은 문제) ── */
  function rng(seedStr) {
    let h = 1779033703 ^ seedStr.length;
    for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
    let a = h >>> 0;
    const f = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    f.int = (lo, hi) => lo + Math.floor(f() * (hi - lo + 1));
    f.pick = arr => arr[Math.floor(f() * arr.length)];
    return f;
  }
  function shuffle(arr, r) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor((r ? r() : Math.random()) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /* ── 분수 계산 ── */
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
  const lcm = (a, b) => a / gcd(a, b) * b;
  function F(n, d) { d = d || 1; if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return { n: n / g, d: d / g }; }
  const fadd = (a, b) => F(a.n * b.d + b.n * a.d, a.d * b.d);
  const fsub = (a, b) => F(a.n * b.d - b.n * a.d, a.d * b.d);
  const fmul = (a, b) => F(a.n * b.n, a.d * b.d);
  const fdiv = (a, b) => F(a.n * b.d, a.d * b.n);
  function fstr(f, mixed) { // 기약분수 문자열
    if (f.d === 1) return String(f.n);
    if (mixed && Math.abs(f.n) > f.d) { const w = Math.trunc(f.n / f.d), r = Math.abs(f.n % f.d); return w + ' ' + r + '/' + f.d; }
    return f.n + '/' + f.d;
  }
  // "3", "0.25", "3/4", "1 2/3" → 분수 값
  function parseNum(s) {
    s = String(s == null ? '' : s).trim().replace(/,/g, '').replace(/\s+/g, ' ');
    if (!s) return null;
    let m;
    if ((m = s.match(/^(-?\d+) (\d+)\/(\d+)$/))) { const w = +m[1], n = +m[2], d = +m[3]; if (!d) return null; return F(w * d + (w < 0 ? -n : n), d); }
    if ((m = s.match(/^(-?\d+)\/(\d+)$/))) { if (!+m[2]) return null; return F(+m[1], +m[2]); }
    if ((m = s.match(/^(-?)(\d*)\.(\d+)$/))) { const d = Math.pow(10, m[3].length); return F((m[1] ? -1 : 1) * (+(m[2] || 0) * d + +m[3]), d); }
    if ((m = s.match(/^-?\d+$/))) return F(+s, 1);
    return null;
  }
  function sameNum(a, b) { const x = parseNum(a), y = parseNum(b); return !!x && !!y && x.n === y.n && x.d === y.d; }
  function normText(s) { return String(s || '').trim().toLowerCase().replace(/[\s.!?~·,'"]/g, ''); }

  // 채점: 정답이면 true
  function check(q, given) {
    if (q.type === 'choice') return Number(given) === Number(q.answer);
    if (q.type === 'number') {
      if (q.strict) return String(given).trim().replace(/\s+/g, ' ') === String(q.answer).trim(); // 요구한 모양(기약분수·대분수·소수) 그대로
      return sameNum(given, q.answer);
    }
    if (q.type === 'qr') return given && sameNum(given[0], q.answer[0]) && sameNum(given[1], q.answer[1]);
    if (q.type === 'text') { const g = normText(given); return (Array.isArray(q.answer) ? q.answer : [q.answer]).some(a => normText(a) === g); }
    return false;
  }
  function answerText(q) {
    if (q.type === 'choice') return q.choices[q.answer];
    if (q.type === 'qr') return '몫 ' + q.answer[0] + ', 나머지 ' + q.answer[1];
    if (q.type === 'text') return Array.isArray(q.answer) ? q.answer[0] : q.answer;
    return String(q.answer);
  }

  /* ── 연산 자동 출제 (학년·학기별 주제) ── */
  // 숫자 뒤 조사(와/과, 을/를, 는/은)
  const jo = (n, a, b) => { n = Math.abs(n); const d = n % 10; return n + ((d === 0 || [1, 3, 6, 7, 8].includes(d)) ? b : a); };
  const CALC = [
    // [id, 학년, 학기, 이름, 설명, 만들기]
    ['c1a', 1, 1, '9까지 모으기·가르기', '두 수를 모으면 더하기, 가르면 빼기예요.', r => { const a = r.int(1, 8), b = r.int(1, 9 - a); return r() < .5 ? { q: jo(a, '와', '과') + ' ' + jo(b, '를', '을') + ' 모으면?', answer: a + b } : { q: jo(a + b, '는', '은') + ' ' + jo(a, '와', '과') + ' □로 가를 수 있어요. □는?', answer: b }; }],
    ['c1b', 1, 1, '한 자리 덧셈·뺄셈', '손가락이나 그림을 떠올리며 세어 봐요.', r => { const a = r.int(1, 9), b = r.int(0, 9 - a); return r() < .5 ? { q: a + ' + ' + b + ' =', answer: a + b, big: 1 } : { q: (a + b) + ' − ' + b + ' =', answer: a, big: 1 }; }],
    ['c1c', 1, 2, '받아올림 있는 덧셈', '10을 먼저 만들고 남은 수를 더해요. 8+5 → 8+2=10, 10+3=13', r => { const a = r.int(2, 9), b = r.int(11 - a, 9); return { q: a + ' + ' + b + ' =', answer: a + b, big: 1 }; }],
    ['c1d', 1, 2, '받아내림 있는 뺄셈', '10에서 먼저 빼 봐요. 13−5 → 10−5=5, 5+3=8', r => { const b = r.int(2, 9), s = r.int(11, 9 + b); return { q: s + ' − ' + b + ' =', answer: s - b, big: 1 }; }],
    ['c1e', 1, 2, '세 수의 계산', '앞에서부터 차례로 계산해요.', r => { const a = r.int(1, 9), b = r.int(1, 9), c = r.int(1, Math.min(9, a + b)); return r() < .5 ? { q: a + ' + ' + b + ' − ' + c + ' =', answer: a + b - c, big: 1 } : { q: (a + b) + ' − ' + c + ' + ' + b + ' =', answer: a + b - c + b, big: 1 }; }],
    ['c1f', 1, 2, '두 자리 수 ± 한 자리 수', '일의 자리끼리 먼저 계산해요.', r => { const t = r.int(1, 8) * 10, o = r.int(0, 5), b = r.int(1, 9 - o); return r() < .5 ? { q: (t + o) + ' + ' + b + ' =', answer: t + o + b, big: 1 } : { q: (t + o + b) + ' − ' + b + ' =', answer: t + o, big: 1 }; }],
    ['c2a', 2, 1, '두 자리 덧셈(받아올림)', '일의 자리 합이 10이 넘으면 십의 자리로 1을 올려요.', r => { const a = r.int(15, 69), b = r.int(12, 99 - a); return { q: a + ' + ' + b + ' =', answer: a + b, big: 1 }; }],
    ['c2b', 2, 1, '두 자리 뺄셈(받아내림)', '일의 자리를 뺄 수 없으면 십의 자리에서 10을 빌려 와요.', r => { const a = r.int(31, 99), b = r.int(12, a - 5); return { q: a + ' − ' + b + ' =', answer: a - b, big: 1 }; }],
    ['c2c', 2, 2, '곱셈구구 2·5·3·6단', '같은 수를 여러 번 더한 것이 곱셈이에요.', r => { const a = r.pick([2, 5, 3, 6]), b = r.int(1, 9); return { q: a + ' × ' + b + ' =', answer: a * b, big: 1 }; }],
    ['c2d', 2, 2, '곱셈구구 4·8·7·9단', '4단은 2단의 두 배, 8단은 4단의 두 배예요.', r => { const a = r.pick([4, 8, 7, 9]), b = r.int(1, 9); return { q: a + ' × ' + b + ' =', answer: a * b, big: 1 }; }],
    ['c2e', 2, 2, '곱셈구구 섞어서', '모르는 건 순서를 바꿔 생각해 봐요. 7×3 = 3×7', r => { const a = r.int(2, 9), b = r.int(1, 9); return { q: a + ' × ' + b + ' =', answer: a * b, big: 1 }; }],
    ['c3a', 3, 1, '세 자리 덧셈', '같은 자리끼리 맞춰 더하고, 10이 되면 올려요.', r => { const a = r.int(105, 799), b = r.int(105, 999 - a); return { q: a + ' + ' + b + ' =', answer: a + b, big: 1 }; }],
    ['c3b', 3, 1, '세 자리 뺄셈', '받아내림을 잊지 말아요.', r => { const a = r.int(300, 999), b = r.int(101, a - 50); return { q: a + ' − ' + b + ' =', answer: a - b, big: 1 }; }],
    ['c3c', 3, 1, '곱셈구구로 나눗셈', '÷ 는 똑같이 나누기! 곱셈구구를 거꾸로 생각해요.', r => { const a = r.int(2, 9), b = r.int(2, 9); return { q: (a * b) + ' ÷ ' + a + ' =', answer: b, big: 1 }; }],
    ['c3d', 3, 1, '(두 자리) × (한 자리)', '일의 자리, 십의 자리를 따로 곱해서 더해요.', r => { const a = r.int(12, 49), b = r.int(2, 9); return { q: a + ' × ' + b + ' =', answer: a * b, big: 1 }; }],
    ['c3e', 3, 2, '세 자리×한 자리 · 두 자리×두 자리', '자리를 맞춰 곱하고 더해요.', r => { if (r() < .5) { const a = r.int(102, 399), b = r.int(2, 6); return { q: a + ' × ' + b + ' =', answer: a * b, big: 1 }; } const a = r.int(12, 39), b = r.int(11, 29); return { q: a + ' × ' + b + ' =', answer: a * b, big: 1 }; }],
    ['c3f', 3, 2, '나머지가 있는 나눗셈', '몫과 나머지를 함께 구해요. 나머지는 나누는 수보다 작아요.', r => { const b = r.int(3, 9), q = r.int(3, 12), m = r.int(1, b - 1); return { type: 'qr', q: (b * q + m) + ' ÷ ' + b + ' =', answer: [q, m], big: 1 }; }],
    ['c4a', 4, 1, '(세 자리) × (두 자리)', '일의 자리 곱 + 십의 자리 곱(한 칸 앞으로)', r => { const a = r.int(105, 499), b = r.int(12, 49); return { q: a + ' × ' + b + ' =', answer: a * b, big: 1 }; }],
    ['c4b', 4, 1, '(세 자리) ÷ (두 자리)', '몫을 어림하고, 곱해서 확인해요.', r => { const b = r.int(12, 39), q = r.int(Math.ceil(100 / b), Math.min(25, Math.floor(950 / b))), m = r.int(0, b - 1); return { type: 'qr', q: (b * q + m) + ' ÷ ' + b + ' =', answer: [q, m], big: 1 }; }],
    ['c4c', 4, 2, '분모가 같은 분수의 덧셈', '분모는 그대로, 분자끼리 더해요. 대분수로 답해도 돼요.', r => { const d = r.int(4, 12), a = r.int(1, d - 1), b = r.int(1, d - 1); const s = F(a + b, d); return { q: a + '/' + d + ' + ' + b + '/' + d + ' =', answer: (a + b) + '/' + d, big: 1, hint: '분수는 3/4처럼, 대분수는 1 2/3처럼 입력해요' }; }],
    ['c4d', 4, 2, '분모가 같은 분수의 뺄셈', '분모는 그대로, 분자끼리 빼요. 대분수는 자연수끼리, 분수끼리!', r => { const d = r.int(4, 12), w = r.int(1, 3), a = r.int(1, d - 1), b = r.int(1, d - 1); return { q: w + ' ' + a + '/' + d + ' − ' + b + '/' + d + ' =', answer: (w * d + a - b) + '/' + d, big: 1 }; }],
    ['c4e', 4, 2, '소수의 덧셈·뺄셈', '소수점끼리 줄을 맞춰 계산해요.', r => { const a = r.int(105, 899), b = r.int(105, 899); const A = a / 100, B = b / 100; if (r() < .5) return { q: A.toFixed(2) + ' + ' + B.toFixed(2) + ' =', answer: ((a + b) / 100).toString(), big: 1 }; const [x, y] = a > b ? [a, b] : [b, a]; return { q: (x / 100).toFixed(2) + ' − ' + (y / 100).toFixed(2) + ' =', answer: ((x - y) / 100).toString(), big: 1 }; }],
    ['c5a', 5, 1, '자연수의 혼합 계산', '( ) 먼저 → × ÷ → + − 순서!', r => { const a = r.int(2, 9), b = r.int(2, 9), c = r.int(2, 9), d = r.int(10, 40); const t = r.int(0, 2); if (t === 0) return { q: d + ' + ' + a + ' × ' + b + ' =', answer: d + a * b }; if (t === 1) return { q: '(' + d + ' − ' + a + ') × ' + c + ' =', answer: (d - a) * c }; return { q: (a * b * c) + ' ÷ ' + a + ' − ' + b + ' =', answer: b * c - b }; }],
    ['c5b', 5, 1, '최대공약수·최소공배수', '두 수를 함께 나눌 수 있는 수, 함께 만나는 배수를 찾아요.', r => { const g = r.int(2, 6), x = r.int(2, 7), y = r.pick([2, 3, 5, 7].filter(v => gcd(v, x) === 1)); const A = g * x, B = g * y; return r() < .5 ? { q: jo(A, '와', '과') + ' ' + B + '의 최대공약수는?', answer: g } : { q: jo(A, '와', '과') + ' ' + B + '의 최소공배수는?', answer: lcm(A, B) }; }],
    ['c5c', 5, 1, '약분해서 기약분수로', '분자와 분모를 최대공약수로 나눠요.', r => { const d = r.int(3, 9), n = r.int(1, d - 1); const f = F(n, d); const k = r.int(2, 6); return { q: (f.n * k) + '/' + (f.d * k) + ' 을(를) 기약분수로 나타내면?', answer: fstr(f), strict: true }; }],
    ['c5d', 5, 1, '분모가 다른 분수의 덧셈·뺄셈', '통분해서 분모를 같게 만든 뒤 계산해요. 답은 기약분수로!', r => { const da = r.int(2, 8); let db = r.int(2, 9); if (db === da) db = da + 1; const A = F(r.int(1, da - 1), da), B = F(r.int(1, db - 1), db); if (r() < .5) return { q: fstr(A) + ' + ' + fstr(B) + ' =', answer: fstr(fadd(A, B)) }; const [x, y] = (A.n / A.d >= B.n / B.d) ? [A, B] : [B, A]; return { q: fstr(x) + ' − ' + fstr(y) + ' =', answer: fstr(fsub(x, y)) }; }],
    ['c5e', 5, 2, '분수의 곱셈', '분자끼리, 분모끼리 곱하고 약분해요.', r => { const A = F(r.int(1, 7), r.int(2, 9)); if (r() < .5) { const k = r.int(2, 9); return { q: fstr(A) + ' × ' + k + ' =', answer: fstr(fmul(A, F(k, 1))) }; } const B = F(r.int(1, 7), r.int(2, 9)); return { q: fstr(A) + ' × ' + fstr(B) + ' =', answer: fstr(fmul(A, B)) }; }],
    ['c5f', 5, 2, '소수의 곱셈', '자연수처럼 곱한 뒤, 소수점 아래 자릿수를 세어 찍어요.', r => { const nz = (lo, hi) => { let v; do v = r.int(lo, hi); while (v % 10 === 0); return v; }; if (r() < .5) { const a = nz(11, 99), k = r.int(2, 9); return { q: (a / 10).toFixed(1) + ' × ' + k + ' =', answer: String(Math.round(a * k) / 10) }; } const a = nz(2, 39), b = nz(2, 19); return { q: (a / 10).toFixed(1) + ' × ' + (b / 10).toFixed(1) + ' =', answer: String(a * b / 100) }; }],
    ['c6a', 6, 1, '분수 ÷ 자연수', '÷ 자연수는 × 1/자연수 와 같아요.', r => { const A = F(r.int(1, 8), r.int(2, 9)), k = r.int(2, 6); return { q: fstr(A) + ' ÷ ' + k + ' =', answer: fstr(fdiv(A, F(k, 1))) }; }],
    ['c6b', 6, 1, '소수 ÷ 자연수', '자연수 나눗셈처럼 하고 소수점을 그대로 올려 찍어요.', r => { const k = r.int(2, 9), q = r.int(11, 99); return { q: (q * k / 10).toFixed(1) + ' ÷ ' + k + ' =', answer: String(q / 10) }; }],
    ['c6c', 6, 2, '분수 ÷ 분수', '나누는 분수를 뒤집어서 곱해요.', r => { const da = r.int(2, 9), dbb = r.int(2, 9); const A = F(r.int(1, da - 1), da), B = F(r.int(1, dbb - 1), dbb); return { q: fstr(A) + ' ÷ ' + fstr(B) + ' =', answer: fstr(fdiv(A, B)), hint: '가분수로 답해도 돼요' }; }],
    ['c6d', 6, 2, '소수 ÷ 소수', '두 수에 똑같이 10이나 100을 곱해 자연수 나눗셈으로 바꿔요.', r => { const b = r.int(2, 9), q = r.int(2, 30); return { q: (b * q / 10).toFixed(1) + ' ÷ ' + (b / 10).toFixed(1) + ' =', answer: String(q) }; }],
    ['c6e', 6, 1, '비율을 백분율로', '비율 × 100 = 백분율(%)', r => { const b = r.pick([2, 4, 5, 10, 20, 25, 50]), a = r.int(1, b - 1); return { q: a + '/' + b + ' 을(를) 백분율로 나타내면 몇 %?', answer: String(a * 100 / b) }; }]
  ];
  const CALC_MAP = Object.fromEntries(CALC.map(c => [c[0], { id: c[0], grade: c[1], sem: c[2], name: c[3], tip: c[4], make: c[5] }]));

  function calcTopicsFor(level, sem) { // 현재 학기까지 범위
    return CALC.filter(c => c[1] === level && (sem === 2 || c[2] === 1)).map(c => CALC_MAP[c[0]]);
  }
  function autoCalcTopic(level, dayStr, sem) {
    const list = calcTopicsFor(level, sem); if (!list.length) return CALC_MAP.c1a;
    const d = parseYmd(dayStr); const idx = Math.floor(d.getTime() / 864e5);
    // 이번 학기 주제를 더 자주(2:1)
    const cur = list.filter(t => t.sem === sem), all = cur.length ? cur.concat(cur, list) : list;
    return all[idx % all.length];
  }
  function makeCalc(topicId, count, seed) {
    const t = CALC_MAP[topicId] || CALC_MAP.c1a; const r = rng(seed + '|' + t.id); const qs = []; const seen = new Set(); let guard = 0;
    while (qs.length < count && guard++ < count * 20) {
      const g = t.make(r); if (seen.has(g.q)) continue; seen.add(g.q);
      qs.push({ type: g.type || 'number', q: g.q, answer: Array.isArray(g.answer) ? g.answer.map(String) : String(g.answer), big: !!g.big, strict: !!g.strict, hint: g.hint || '', explain: t.tip });
    }
    return { topic: t, questions: qs };
  }

  /* ── 콘텐츠 라이브러리 ── */
  const LIB = (window.EDU_LIB || []);
  const LIB_MAP = Object.fromEntries(LIB.map(x => [x.id, x]));
  function libList(subject, level, track) {
    return LIB.filter(x => x.subject === subject && (x.grades || []).includes(level) && (!track || x.track === track))
      .sort((a, b) => (a.sem || 0) - (b.sem || 0) || (a.order || 0) - (b.order || 0));
  }
  // 다음 진도: 이번 학기부터 안 한 것 → 이전 학기 → 다음 학년 → 처음부터 복습
  function nextItem(subject, level, sem, doneSet, track, skip) {
    skip = skip || new Set();
    const ok = x => !doneSet.has(x.id) && !skip.has(x.id);
    const cur = libList(subject, level, track);
    const bySem = cur.filter(x => !x.sem || x.sem >= sem).concat(cur.filter(x => x.sem && x.sem < sem));
    let it = bySem.find(ok);
    for (let l = level + 1; !it && l <= 6; l++) it = libList(subject, l, track).find(ok);
    if (!it) it = bySem.find(x => !skip.has(x.id)) || cur[0];
    return it || null;
  }

  /* ── EBS 연결 (공식 강좌 페이지로 이동만 함, 2026-10-23 검색 확인) ── */
  const E = 'https://primary.ebs.co.kr/course/';
  const EBS = {
    main: 'https://primary.ebs.co.kr/',
    grade: { 1: E + 'grade/list?tab=1s', 2: E + 'grade/list?tab=2s', 3: E + 'grade/list?tab=3s', 4: E + 'grade/list?tab=4s', 5: E + 'grade/list?tab=5s', 6: E + 'grade/list?tab=6s' },
    math: { '1-1': 100004633, '1-2': 100005135, '2-1': 100006191, '2-2': 100005136, '3-1': 100006149, '3-2': 100006220, '4-1': 100006150, '4-2': 100006221, '6-1': 100007147, '6-2': 100007230 },
    soc: { '3-1': 100006151, '4-2': 100006223, '5-1': 100007148, '6-1': 100007149 },
    vocab: { '1-1': 100004668, '3-1': 100006197, '3-2': 100006262, '4-1': 100006202, '4-2': 100006263, '5-1': 100004133, '5-2': 100004134 },
    series: {
      manjeom: E + 'series/list?seriesId=S00053', calc: E + 'series/list?seriesId=S00097', vocab: E + 'series/list?seriesId=S00135',
      reading: E + 'series/list?seriesId=S00137', literacy: E + 'literacy', story: E + 'series/list?seriesId=S00069', easyStory: E + 'series/list?seriesId=S00112',
      word1: E + 'view?courseId=100004649', word2: E + 'view?courseId=100004650', engText: E + 'series/list?seriesId=S00161', engStory: E + 'series/list?seriesId=S00145'
    },
    login: 'https://primary.ebs.co.kr/login/form'
  };
  const cv = id => E + 'view?courseId=' + id;
  function ebsFor(item, level, overrides) {
    if (!item) return null;
    if (overrides && overrides[item.id]) return { url: overrides[item.id].url, label: overrides[item.id].title || '엄마가 고른 EBS 강의', exact: true };
    const g = level || (item.grades || [1])[0], s = item.sem || 1, k = g + '-' + s;
    const label = (item.ebs && item.ebs.label) || 'EBS 초등';
    switch (item.subject) {
      case 'math': return { url: EBS.math[k] ? cv(EBS.math[k]) : EBS.series.manjeom, label: '만점왕 수학 ' + k + (EBS.math[k] ? '' : ' (시리즈에서 찾기)') };
      case 'calc': return { url: EBS.series.calc, label: '만점왕 연산' };
      case 'read': return /독해/.test(label) ? { url: EBS.series.reading, label: '독해가 문해력이다' } : { url: EBS.vocab[g + '-' + semester()] ? cv(EBS.vocab[g + '-' + semester()]) : EBS.series.vocab, label: '어휘가 문해력이다' };
      case 'soc': if (item.track === 'history') return g <= 3 ? { url: EBS.series.easyStory, label: '매일 쉬운 스토리 한국사' } : { url: EBS.series.story, label: '스토리 한국사' };
        return { url: EBS.soc[k] ? cv(EBS.soc[k]) : (g >= 3 ? EBS.series.manjeom : EBS.grade[g]), label: g >= 3 ? '만점왕 사회 ' + k : 'EBS ' + g + '학년 강좌' };
      case 'word': return g <= 2 ? { url: EBS.series.engStory, label: '영어 스토리 타임' } : { url: g <= 4 ? EBS.series.word1 : EBS.series.word2, label: '초등 필수 영단어 LEVEL ' + (g <= 4 ? 1 : 2) };
      case 'eng': return g <= 2 ? { url: EBS.series.engStory, label: '영어 스토리 타임' } : { url: EBS.series.engText, label: 'EBSe 교과서 영어' };
    }
    return { url: EBS.main, label: 'EBS 초등' };
  }

  /* ── 읽어 주기 (기기 내장 음성, 무료) ── */
  let voices = [];
  function loadVoices() { try { voices = speechSynthesis.getVoices(); } catch (e) { } }
  if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
  function speak(text, lang, rate) {
    if (!('speechSynthesis' in window)) { toast('이 기기는 읽어 주기를 지원하지 않아요'); return; }
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text); u.lang = lang || 'en-US'; u.rate = rate || (lang === 'ko-KR' ? 1 : .85);
      const v = voices.find(v => v.lang === u.lang) || voices.find(v => v.lang && v.lang.startsWith(u.lang.slice(0, 2))); if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) { }
  }

  /* ── 화면 도우미 ── */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function fracHtml(s) { return esc(s).replace(/(\d+)\/(\d+)/g, '<span class="frac"><span>$1</span><span>$2</span></span>'); }
  let toastT;
  function toast(msg) {
    let t = document.querySelector('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), 2600);
  }
  const store = {
    get(k) { try { return localStorage.getItem('edu.' + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('edu.' + k, v); } catch (e) { } },
    del(k) { try { localStorage.removeItem('edu.' + k); } catch (e) { } }
  };
  function sb() {
    if (!window.supabase) throw new Error('supabase 라이브러리를 불러오지 못했어요');
    if (!window.__sb) window.__sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, storageKey: 'edu-auth' } });
    return window.__sb;
  }

  // 유튜브 주소 → 사이트 안 재생용 주소 (EBS 초등 강의 페이지는 다른 사이트 안 재생을 막아 둠 → 새 창)
  function ytId(url) {
    const m = String(url || '').match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }
  function ytEmbed(url) { const id = ytId(url); return id ? 'https://www.youtube.com/embed/' + id + '?rel=0&modestbranding=1&playsinline=1' : null; }

  window.EDU = { SUBJECTS, SUBJECT_ORDER, WD, ymd, parseYmd, schoolYear, semester, gradeOf, levelOf, fmtDate, rng, shuffle,
    F, fstr, parseNum, sameNum, check, answerText, CALC, CALC_MAP, calcTopicsFor, autoCalcTopic, makeCalc,
    LIB, LIB_MAP, libList, nextItem, EBS, ebsFor, ytId, ytEmbed, speak, esc, fracHtml, toast, store, sb };
})();
