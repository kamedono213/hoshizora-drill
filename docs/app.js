'use strict';
// ほしぞらドリル: 天文宇宙検定4級の範囲を、間隔をあけたくり返し(覚えた問題ほど間をあけて出す)で学ぶ。
// データ: data/questions.json(問題)、data/sky.json(星座の線。d3-celestial由来)。

const CHAPTERS = [
  { name: '宇宙にのりだそう', short: '宇宙へ', star: 'Ori' },
  { name: '月と地球', short: '月', star: 'Cas' },
  { name: '太陽と地球', short: '太陽', star: 'Leo' },
  { name: '太陽系の世界', short: '太陽系', star: 'Sco' },
  { name: '星座の世界', short: '星座', star: 'Cyg' },
  { name: '星と銀河の世界', short: '星と銀河', star: 'Peg' },
  { name: '天体観察入門', short: '観察', star: 'UMa' },
];
// 模擬試験40問の章ごとの配分(テキストの分量に合わせた目安)
const EXAM_PLAN = [3, 6, 6, 7, 9, 5, 4];
const EXAM_MIN = 50;
// 覚えぐあいの箱(0〜5)。正解すると1つ上がり、次に出すまでの日数がのびる。まちがえると1に戻る
const INTERVAL = [0, 1, 2, 4, 7, 15];
const LEARNED = 3; // この箱以上を「覚えた」とする(星が光る)
const RANKS = [
  [0, '星空みならい'], [10, '星さがし名人'], [25, '月の観察者'], [40, '惑星たんけん家'],
  [55, '星座マスター'], [70, '銀河の旅人'], [85, '宇宙はかせ見習い'], [100, '宇宙はかせ'],
];

let Q = [], BY = {}, SKY = null;
const app = document.getElementById('app');
let S = { screen: 'home' };

// ---------- 保存(この端末のブラウザの中だけ)
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem('hoshi:' + k)); return v == null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('hoshi:' + k, JSON.stringify(v)); } catch (e) { /* 保存できなくても遊べる */ } },
  del(k) { try { localStorage.removeItem('hoshi:' + k); } catch (e) { /* 何もしない */ } },
};
let P = store.get('progress', {}); // id → { b: 箱, d: 次に出す日, n: 回答数, w: まちがい数 }
const saveP = () => store.set('progress', P);
const today = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);

// ---------- 共通
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const box = id => (P[id] ? P[id].b : 0);
const learned = id => box(id) >= LEARNED;
const chQ = ch => Q.filter(q => q.ch === ch);
const ratio = list => (list.length ? list.filter(q => learned(q.id)).length / list.length : 0);
const due = () => Q.filter(q => P[q.id] && P[q.id].d <= today());
const rankOf = pct => RANKS.filter(([p]) => pct >= p).pop()[1];

function record(id, ok) {
  const p = P[id] || { b: 0, d: 0, n: 0, w: 0 };
  p.n++;
  if (ok) { p.b = Math.min(5, p.b + 1); p.d = today() + INTERVAL[p.b]; }
  else { p.w++; p.b = 1; p.d = today(); }
  P[id] = p;
  saveP();
}

// ---------- 効果音(Web Audio で合成)
const SE = {
  ctx: null,
  muted: store.get('muted', false),
  ac() { if (!this.ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; this.ctx = new C(); } if (this.ctx.state === 'suspended') this.ctx.resume(); return this.ctx; },
  tone(f, at, dur, type = 'sine', vol = 0.16, to = null) {
    const c = this.ac(); if (!c) return;
    const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  },
  play(n) {
    if (this.muted) return;
    try {
      if (n === 'start') { this.tone(587, 0, 0.1, 'triangle'); this.tone(880, 0.09, 0.16, 'triangle'); }
      if (n === 'ok') { this.tone(1047, 0, 0.12, 'sine', 0.18); this.tone(1568, 0.09, 0.3, 'sine', 0.14); }
      if (n === 'ng') this.tone(233, 0, 0.3, 'square', 0.06, 160);
      if (n === 'star') [1319, 1568, 2093].forEach((f, i) => this.tone(f, i * 0.07, 0.25, 'sine', 0.1));
      if (n === 'result') [523, 659, 784].forEach((f, i) => this.tone(f, i * 0.11, 0.2, 'triangle'));
      if (n === 'pass') { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.1, 0.18, 'triangle')); [1047, 1319, 1568].forEach(f => this.tone(f, 0.44, 0.7, 'sine', 0.08)); }
    } catch (e) { /* 音が出せない環境でも遊べる */ }
  },
  toggle() { this.muted = !this.muted; store.set('muted', this.muted); if (!this.muted) this.play('ok'); },
};
const soundBtn = () => `<button class="link sound" id="sound">${SE.muted ? '🔇 音なし' : '🔊 音あり'}</button>`;
function bindSound() { const b = app.querySelector('#sound'); if (b) b.onclick = () => { SE.toggle(); b.outerHTML = soundBtn(); bindSound(); }; }

// ---------- 図(星座・大三角・月)
// 天球の位置を、その星座の中心から見た平面に写す(星を見上げた向き: 東が左)
function projector(points) {
  const rad = Math.PI / 180;
  let x = 0, y = 0, z = 0;
  points.forEach(([ra, dec]) => { x += Math.cos(dec * rad) * Math.cos(ra * rad); y += Math.cos(dec * rad) * Math.sin(ra * rad); z += Math.sin(dec * rad); });
  const ra0 = Math.atan2(y, x), dec0 = Math.atan2(z, Math.hypot(x, y));
  return ([ra, dec]) => {
    const a = ra * rad - ra0, d = dec * rad;
    const cosc = Math.sin(dec0) * Math.sin(d) + Math.cos(dec0) * Math.cos(d) * Math.cos(a);
    const k = 2 / (1 + cosc);
    return [-k * Math.cos(d) * Math.sin(a), -k * (Math.cos(dec0) * Math.sin(d) - Math.sin(dec0) * Math.cos(d) * Math.cos(a))];
  };
}
function fitter(xy, W, H, pad) {
  const xs = xy.map(p => p[0]), ys = xy.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const s = Math.min((W - 2 * pad) / Math.max(1e-6, x1 - x0), (H - 2 * pad) / Math.max(1e-6, y1 - y0));
  const ox = (W - s * (x0 + x1)) / 2, oy = (H - s * (y0 + y1)) / 2;
  return ([x, y]) => [ox + s * x, oy + s * y];
}
const starR = mag => Math.max(1.3, 4.6 - 0.75 * mag);

// 星座: opts.lit = 光らせる星の数(明るい順)、opts.mark = 赤丸をつける星の名前
function constSVG(ids, opts = {}) {
  const W = opts.w || 360, H = opts.h || 260;
  const cs = ids.map(id => SKY.const[id]);
  const extra = opts.extraPoints || [];
  const all = cs.flatMap(c => c.stars.map(s => [s.ra, s.dec])).concat(extra.map(s => [s.ra, s.dec]));
  const pr = projector(all);
  const fit = fitter(all.map(pr), W, H, opts.pad || 22);
  const P2 = p => fit(pr(p));
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || '星図')}">`;
  cs.forEach((c, ci) => {
    const faint = opts.faint && opts.faint.includes(c.id);
    c.lines.forEach(seg => { svg += `<polyline points="${seg.map(p => P2(p).map(v => v.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="${faint ? '#3b4a85' : '#7fa8e8'}" stroke-width="${faint ? 1 : 1.6}" stroke-linejoin="round"/>`; });
  });
  if (opts.poly) {
    const pts = opts.poly.map(s => P2([s.ra, s.dec]).map(v => v.toFixed(1)).join(',')).join(' ');
    svg += `<polygon points="${pts}" fill="rgba(255,217,106,.07)" stroke="#ffd96a" stroke-width="2.6" stroke-linejoin="round"/>`;
  }
  cs.forEach(c => {
    const order = c.stars.slice().sort((a, b) => a.mag - b.mag);
    const litSet = new Set(opts.lit == null ? order : order.slice(0, opts.lit));
    c.stars.forEach(s => {
      const [x, y] = P2([s.ra, s.dec]);
      const on = litSet.has(s);
      const fill = opts.lit == null ? '#ffffff' : on ? '#ffd96a' : '#3a4670';
      svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(starR(s.mag) * (opts.scaleStar || 1)).toFixed(1)}" fill="${fill}"${on && opts.lit != null ? ' class="twinkle"' : ''}/>`;
      if (opts.mark && s.name === opts.mark) svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11" fill="none" stroke="#ff5a6e" stroke-width="2.5"/>`;
    });
  });
  (opts.poly || []).forEach(s => { const [x, y] = P2([s.ra, s.dec]); svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${starR(s.mag).toFixed(1)}" fill="#fff"/>`; });
  return svg + '</svg>';
}
// 月: 月齢から北半球で見た形を描く(右から満ちて、右から欠ける)
function moonSVG(age) {
  const r = 70, c = 90, k = Math.cos(2 * Math.PI * age / 29.53), rx = Math.abs(k) * r;
  const waxing = age < 14.765;
  let d;
  if (waxing) d = `M0 ${-r} A${r} ${r} 0 0 1 0 ${r} A${rx} ${r} 0 0 ${k > 0 ? 0 : 1} 0 ${-r}Z`;
  else d = `M0 ${-r} A${r} ${r} 0 0 0 0 ${r} A${rx} ${r} 0 0 ${k > 0 ? 1 : 0} 0 ${-r}Z`;
  return `<svg viewBox="0 0 180 180" role="img" aria-label="月の形"><circle cx="${c}" cy="${c}" r="${r}" fill="#1f2a4f"/><path transform="translate(${c} ${c})" d="${d}" fill="#fff4c9"/></svg>`;
}
function figureHTML(fig) {
  if (!fig) return '';
  const [type, a, b] = fig.split(':');
  if (type === 'const') return `<div class="fig">${constSVG([a], { label: '星座の形' })}</div>`;
  if (type === 'mark') return `<div class="fig">${constSVG([a], { mark: b, label: '星座の図' })}</div>`;
  if (type === 'moon') return `<div class="fig">${moonSVG(Number(a))}</div>`;
  if (type === 'ast') { const ast = SKY.asterisms[a]; return `<div class="fig">${constSVG(ast.context, { faint: ast.context, poly: ast.stars, extraPoints: ast.stars, scaleStar: .8, label: '星を結んだ形' })}</div>`; }
  return '';
}

// ---------- 画面
function render() {
  window.scrollTo(0, 0);
  ({ home: renderHome, chapters: renderChapters, quiz: renderQuiz, done: renderDone, examIntro: renderExamIntro, exam: renderExam, examResult: renderExamResult, settings: renderSettings })[S.screen]();
}
function go(screen, extra = {}) { S = { ...extra, screen }; render(); }

function renderHome() {
  const pct = Math.round(ratio(Q) * 100);
  const nDue = due().length;
  const st = store.get('streak', { n: 0, last: -1 });
  const streak = st.last >= today() - 1 ? st.n : 0;
  const best = store.get('examBest', null);
  const doneToday = st.last === today();
  app.innerHTML = `
    <header class="mast">
      <div class="bar"><span class="eyebrow">天文宇宙検定4級の対策ドリル(非公式)</span>${soundBtn()}</div>
      <h1>ほしぞら<span>ドリル</span></h1>
    </header>
    <section class="rank" aria-label="いまの称号">
      <div class="meter"><span class="small muted">いまの称号</span><div class="title">${rankOf(pct)}</div>
        <div class="track" aria-hidden="true"><i style="width:${pct}%"></i></div>
        <span class="small muted num">覚えた問題 ${Q.filter(q => learned(q.id)).length} / ${Q.length}(${pct}%)</span></div>
    </section>
    <button class="mission" id="mission"><b>${doneToday ? '今日のミッション達成! もう1回' : '今日のミッション 10問'}</b><span>${nDue ? `復習の時期が来た問題が ${nDue}問 あります。新しい問題とまぜて出します。` : 'まだ解いていない問題から、苦手な章を中心に出します。'}</span></button>
    <div class="menu">
      <button data-go="chapters"><b>章ごとに練習</b><span>7つの章から選ぶ</span></button>
      <button data-go="examIntro"><b>模擬試験</b><span>本番と同じ40問・50分</span></button>
      <button data-go="weak"><b>苦手の復習</b><span>まちがえた問題だけ</span></button>
      <button data-go="settings"><b>記録と設定</b><span>ベスト・リセット</span></button>
    </div>
    <div class="streak"><span>連続 <b class="num">${streak}</b> 日</span><span>模擬試験のベスト <b class="num">${best ? best.score + '点' : '—'}</b></span></div>
    <section class="stack" aria-label="章ごとの星座">
      <div class="sky-h"><h2 style="font-size:18px">章の星座を光らせよう</h2><span class="small muted">覚えた問題の数だけ星が光る</span></div>
      <div class="skymap">${CHAPTERS.map((c, i) => {
        const list = chQ(i), r = ratio(list), n = SKY.const[c.star].stars.length;
        return `<button class="cst" data-ch="${i}">${constSVG([c.star], { lit: Math.round(r * n), w: 200, h: 140, pad: 14, label: c.name + 'の星座' })}<b>${i}章 ${c.short}</b><span class="num">${Math.round(r * 100)}%(${list.filter(q => learned(q.id)).length}/${list.length}問)</span></button>`;
      }).join('')}</div>
    </section>
    <p class="note">問題はすべてオリジナルです(公式の過去問ではありません)。範囲は公式テキスト《4級 星博士ジュニア》2025〜2026年版の章立てに合わせています。本番は4択・40問・50分、100点満点の60点以上で合格です(2026年10月時点の公式案内)。星座の線はd3-celestial(BSD-3ライセンス)のデータを使っています。</p>`;
  bindSound();
  app.querySelector('#mission').onclick = () => startQuiz('mission', buildMission());
  app.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
    const g = b.dataset.go;
    if (g === 'weak') { const w = buildWeak(); if (!w.length) { b.querySelector('span').textContent = 'まちがえた問題はまだありません'; return; } startQuiz('weak', w); }
    else go(g);
  });
  app.querySelectorAll('[data-ch]').forEach(b => b.onclick = () => startQuiz('chapter', buildChapter(Number(b.dataset.ch), 10), { ch: Number(b.dataset.ch) }));
}

function renderChapters() {
  app.innerHTML = `
    <div class="bar"><button class="link" id="back">← もどる</button></div>
    <h2>章ごとに練習</h2>
    <p class="muted small" style="margin:0">まだ覚えていない問題を優先して10問出します。</p>
    <div class="list">${CHAPTERS.map((c, i) => { const list = chQ(i); return `<button class="row" data-ch="${i}"><span class="no">${i}</span><span class="meta"><b>${c.name}</b><span class="num">覚えた ${list.filter(q => learned(q.id)).length} / ${list.length}問</span><span class="track" aria-hidden="true"><i style="width:${ratio(list) * 100}%"></i></span></span><span class="go">10問 →</span></button>`; }).join('')}</div>`;
  app.querySelector('#back').onclick = () => go('home');
  app.querySelectorAll('[data-ch]').forEach(b => b.onclick = () => startQuiz('chapter', buildChapter(Number(b.dataset.ch), 10), { ch: Number(b.dataset.ch) }));
}

// ---------- 出題リストの作り方
function buildMission() {
  const t = today();
  const dueList = shuffle(Q.filter(q => P[q.id] && P[q.id].d <= t)).sort((a, b) => box(a.id) - box(b.id)).slice(0, 7);
  const out = dueList.slice();
  // のこりは、まだ解いていない問題を「覚えた割合が低い章」から
  const chOrder = CHAPTERS.map((_, i) => i).sort((a, b) => ratio(chQ(a)) - ratio(chQ(b)));
  for (const ch of chOrder) {
    for (const q of shuffle(chQ(ch).filter(q => !P[q.id]))) { if (out.length >= 10) break; out.push(q); }
    if (out.length >= 10) break;
  }
  // それでも足りなければ、箱の低い問題から
  if (out.length < 10) out.push(...shuffle(Q.filter(q => !out.includes(q))).sort((a, b) => box(a.id) - box(b.id)).slice(0, 10 - out.length));
  return shuffle(out);
}
function buildChapter(ch, n) {
  const list = chQ(ch);
  const notLearned = shuffle(list.filter(q => !learned(q.id))).sort((a, b) => (P[a.id] ? 1 : 0) - (P[b.id] ? 1 : 0));
  const rest = shuffle(list.filter(q => learned(q.id)));
  return notLearned.concat(rest).slice(0, n);
}
function buildWeak() { return shuffle(Q.filter(q => P[q.id] && P[q.id].w > 0 && !learned(q.id))).slice(0, 10); }

// ---------- 練習(1問ずつ答え合わせ)
function startQuiz(mode, list, extra = {}) {
  SE.play('start');
  go('quiz', { mode, ...extra, list: list.map(q => q.id), i: 0, score: 0, retry: [], newlyLearned: 0, opts: null });
}
function renderQuiz() {
  const id = S.list[S.i], q = BY[id];
  if (!S.opts) S.opts = shuffle(q.a);
  const total = S.list.length;
  const label = S.mode === 'mission' ? '今日のミッション' : S.mode === 'weak' ? '苦手の復習' : `${S.ch}章 ${CHAPTERS[S.ch].name}`;
  app.innerHTML = `
    <div class="bar"><button class="link" id="quit">✕ やめる</button><span class="small muted">${esc(label)}</span>${soundBtn()}</div>
    <div class="progress"><span class="small num">${S.i + 1} / ${total}${S.list.indexOf(id) !== S.i ? '(もう一度)' : ''}</span><div class="track"><i style="width:${(S.i / total) * 100}%"></i></div></div>
    <section class="qcard">
      <span class="tag">${q.ch}章 ${CHAPTERS[q.ch].short}</span>
      <p class="qtext">${esc(q.q)}</p>
      ${figureHTML(q.fig)}
      <div class="choices">${S.opts.map((a, k) => `<button class="choice" data-k="${k}"><i>${'アイウエ'[k]}</i><span>${esc(a)}</span></button>`).join('')}</div>
      <div id="after" class="stack"></div>
    </section>`;
  bindSound();
  app.querySelector('#quit').onclick = () => go('home');
  app.querySelectorAll('[data-k]').forEach(b => b.onclick = () => answer(Number(b.dataset.k)));
}
function answer(k) {
  const id = S.list[S.i], q = BY[id];
  const picked = S.opts[k], ok = picked === q.a[0];
  const wasLearned = learned(id);
  // その場のやり直し(2回目)は記録に入れない。すぐ後に正解しても「覚えた」ことにはしない
  const isRetry = S.list.indexOf(id) !== S.i;
  if (!isRetry) record(id, ok);
  if (ok) S.score++;
  else if (!isRetry) { S.retry.push(id); S.list.push(id); } // まちがえた問題は、この回の最後にもう一度
  const nowLearned = !wasLearned && learned(id);
  if (nowLearned) S.newlyLearned++;
  SE.play(ok ? (nowLearned ? 'star' : 'ok') : 'ng');
  app.querySelectorAll('[data-k]').forEach(b => {
    b.disabled = true;
    const a = S.opts[Number(b.dataset.k)];
    if (a === q.a[0]) b.classList.add('ok'); else if (a === picked) b.classList.add('ng');
  });
  const after = app.querySelector('#after');
  const last = S.i === S.list.length - 1;
  after.innerHTML = `<div class="verdict ${ok ? 'ok' : 'ng'}"><b>${ok ? (nowLearned ? '正解! 星がひとつ光った' : '正解!') : 'ざんねん'}</b>${ok ? '' : `<p>正解は「${esc(q.a[0])}」</p>`}<p>${esc(q.exp)}</p></div>
    <button class="primary" id="next">${last ? '結果を見る' : '次へ'}</button>`;
  const nx = after.querySelector('#next');
  nx.onclick = () => { if (last) finishQuiz(); else { S.i++; S.opts = null; render(); } };
  nx.focus({ preventScroll: true });
  after.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function finishQuiz() {
  if (S.mode === 'mission') {
    const st = store.get('streak', { n: 0, last: -1 });
    if (st.last !== today()) { st.n = st.last === today() - 1 ? st.n + 1 : 1; st.last = today(); store.set('streak', st); }
  }
  SE.play('result');
  go('done', { mode: S.mode, ch: S.ch, score: S.score, total: S.list.length, newlyLearned: S.newlyLearned, firstTry: new Set(S.list).size });
}
function renderDone() {
  const st = store.get('streak', { n: 0 });
  app.innerHTML = `
    <section class="score"><span class="small muted">${S.mode === 'mission' ? '今日のミッション 完了' : 'おつかれさま'}</span>
      <span class="big num">${S.score}<span class="muted" style="font-size:26px"> / ${S.total}</span></span>
      <span class="muted small">まちがえた問題は、その場でもう一度出しました</span></section>
    <div class="panel"><p>この回で新しく光った星: <b class="num">${S.newlyLearned}</b> こ</p>${S.mode === 'mission' ? `<p>連続 <b class="num">${st.n}</b> 日</p>` : ''}<p class="small muted">覚えた問題は、1日後・2日後・4日後・7日後…と間をあけて出てきます。間をあけて正解できたら、本当に覚えた印です。</p></div>
    <div class="stack">
      ${S.mode === 'chapter' ? '<button class="primary" id="again">この章をもう10問</button>' : '<button class="primary" id="again">もう10問</button>'}
      <button class="secondary" id="home">ホームへ</button>
    </div>`;
  app.querySelector('#home').onclick = () => go('home');
  app.querySelector('#again').onclick = () => S.mode === 'chapter' ? startQuiz('chapter', buildChapter(S.ch, 10), { ch: S.ch }) : S.mode === 'weak' ? (buildWeak().length ? startQuiz('weak', buildWeak()) : go('home')) : startQuiz('mission', buildMission());
}

// ---------- 模擬試験(本番と同じく、終わるまで答え合わせしない)
function renderExamIntro() {
  const best = store.get('examBest', null);
  app.innerHTML = `
    <div class="bar"><button class="link" id="back">← もどる</button></div>
    <h2>模擬試験</h2>
    <div class="panel">
      <p>本番と同じ <b>4択・40問・50分</b>。1問2.5点で、<b>60点以上で合格</b>です。</p>
      <p class="small muted">章ごとの出題数(目安): ${EXAM_PLAN.map((n, i) => `${i}章 ${n}問`).join('・')}</p>
      <p class="small muted">途中では答え合わせをしません。前の問題にもどって答えを直せます。</p>
      ${best ? `<p class="small">これまでのベスト: <b class="num">${best.score}点</b></p>` : ''}
    </div>
    <button class="primary" id="start">試験をはじめる</button>`;
  app.querySelector('#back').onclick = () => go('home');
  app.querySelector('#start').onclick = () => {
    const list = EXAM_PLAN.flatMap((n, ch) => shuffle(chQ(ch)).slice(0, n));
    SE.play('start');
    go('exam', { list: list.map(q => q.id), opts: list.map(q => shuffle(q.a)), ans: list.map(() => null), i: 0, end: Date.now() + EXAM_MIN * 60000 });
  };
}
let examTimer = null;
function renderExam() {
  clearInterval(examTimer);
  const id = S.list[S.i], q = BY[id], opts = S.opts[S.i];
  const answered = S.ans.filter(a => a != null).length;
  app.innerHTML = `
    <div class="bar"><button class="link" id="quit">✕ 中止</button><span class="timer num" id="timer"></span><span class="small muted num">回答 ${answered}/40</span></div>
    <div class="progress"><span class="small num">第${S.i + 1}問</span><div class="track"><i style="width:${(answered / 40) * 100}%"></i></div></div>
    <section class="qcard">
      <p class="qtext">${esc(q.q)}</p>
      ${figureHTML(q.fig)}
      <div class="choices">${opts.map((a, k) => `<button class="choice${S.ans[S.i] === k ? ' sel' : ''}" data-k="${k}"><i>${'アイウエ'[k]}</i><span>${esc(a)}</span></button>`).join('')}</div>
      <div class="navrow"><button class="secondary" id="prev" ${S.i === 0 ? 'disabled' : ''}>← 前へ</button><button class="secondary" id="nxt">${S.i === 39 ? '最後の問題' : '次へ →'}</button></div>
      <button class="primary" id="submit">${answered < 40 ? `採点する(未回答 ${40 - answered}問)` : '採点する'}</button>
      <div id="confirm" class="panel" hidden><p>試験を中止しますか? ここまでの答えは記録されません。</p><div class="navrow"><button class="secondary" id="no">続ける</button><button class="secondary danger" id="yes">中止する</button></div></div>
    </section>`;
  const tick = () => {
    const left = Math.max(0, S.end - Date.now()), m = Math.floor(left / 60000), s = Math.floor(left / 1000) % 60;
    const el = app.querySelector('#timer'); if (!el) return clearInterval(examTimer);
    el.textContent = `のこり ${m}:${String(s).padStart(2, '0')}`; el.classList.toggle('low', left < 5 * 60000);
    if (left <= 0) { clearInterval(examTimer); grade(true); }
  };
  tick(); examTimer = setInterval(tick, 1000);
  app.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
    S.ans[S.i] = Number(b.dataset.k);
    if (S.i < 39) { S.i++; renderExam(); } else renderExam();
  });
  app.querySelector('#prev').onclick = () => { if (S.i > 0) { S.i--; renderExam(); } };
  app.querySelector('#nxt').onclick = () => { if (S.i < 39) { S.i++; renderExam(); } };
  app.querySelector('#submit').onclick = () => grade(false);
  app.querySelector('#quit').onclick = () => { app.querySelector('#confirm').hidden = false; };
  app.querySelector('#no').onclick = () => { app.querySelector('#confirm').hidden = true; };
  app.querySelector('#yes').onclick = () => { clearInterval(examTimer); go('home'); };
}
function grade(timeUp) {
  clearInterval(examTimer);
  const res = S.list.map((id, i) => { const q = BY[id]; const ok = S.ans[i] != null && S.opts[i][S.ans[i]] === q.a[0]; return { id, ok, picked: S.ans[i] == null ? null : S.opts[i][S.ans[i]] }; });
  res.forEach(r => record(r.id, r.ok));
  const correct = res.filter(r => r.ok).length, score = correct * 2.5;
  const best = store.get('examBest', null);
  if (!best || score > best.score) store.set('examBest', { score, at: today() });
  const hist = store.get('examHist', []); hist.push({ score, at: today() }); store.set('examHist', hist.slice(-20));
  SE.play(score >= 60 ? 'pass' : 'result');
  go('examResult', { res, correct, score, timeUp });
}
function renderExamResult() {
  const byCh = CHAPTERS.map((_, ch) => { const rs = S.res.filter(r => BY[r.id].ch === ch); return { ch, n: rs.length, ok: rs.filter(r => r.ok).length }; });
  const pass = S.score >= 60;
  const weakest = byCh.filter(c => c.n).sort((a, b) => a.ok / a.n - b.ok / b.n)[0];
  app.innerHTML = `
    <section class="score"><span class="small muted">模擬試験の結果${S.timeUp ? '(時間切れ)' : ''}</span>
      <span class="big num">${S.score}<span class="muted" style="font-size:26px">点</span></span>
      <span class="pass ${pass ? 'ok' : 'ng'}">${pass ? '合格ライン到達!' : 'あと少し'}</span>
      <span class="small muted num">40問中 ${S.correct}問 正解(合格ラインは24問 = 60点)</span></section>
    <div class="panel"><h3 style="font-size:16px">章ごとの正答</h3><div class="chbars">${byCh.map(c => `<div class="chbar"><span>${c.ch}章 ${CHAPTERS[c.ch].short}</span><span class="track"><i style="width:${c.n ? c.ok / c.n * 100 : 0}%"></i></span><span class="num">${c.ok}/${c.n}</span></div>`).join('')}</div>
      ${weakest && weakest.ok < weakest.n ? `<p class="small">いちばん伸ばしやすいのは <b>${weakest.ch}章「${CHAPTERS[weakest.ch].name}」</b>。章ごとの練習で10問やってみよう。</p>` : ''}</div>
    <div class="stack"><h3 style="font-size:16px">まちがえた問題(${S.res.filter(r => !r.ok).length}問)</h3>
      ${S.res.filter(r => !r.ok).map(r => { const q = BY[r.id]; return `<details class="miss"><summary>${esc(q.q)}</summary><p>あなたの答え: ${r.picked == null ? '(未回答)' : esc(r.picked)}<br>正解: <b>${esc(q.a[0])}</b></p><p class="muted">${esc(q.exp)}</p></details>`; }).join('') || '<p class="muted">全問正解です。</p>'}
    </div>
    <div class="stack">
      ${weakest && weakest.ok < weakest.n ? `<button class="primary" id="weakch">${weakest.ch}章を練習する</button>` : ''}
      <button class="secondary" id="home">ホームへ</button>
    </div>`;
  app.querySelector('#home').onclick = () => go('home');
  const w = app.querySelector('#weakch'); if (w) w.onclick = () => startQuiz('chapter', buildChapter(weakest.ch, 10), { ch: weakest.ch });
}

// ---------- 記録と設定
function renderSettings() {
  const hist = store.get('examHist', []);
  const answered = Object.keys(P).length;
  app.innerHTML = `
    <div class="bar"><button class="link" id="back">← もどる</button>${soundBtn()}</div>
    <h2>記録と設定</h2>
    <div class="panel"><p>解いたことのある問題: <b class="num">${answered}</b> / ${Q.length}</p><p>覚えた問題: <b class="num">${Q.filter(q => learned(q.id)).length}</b></p>
      <p>模擬試験の記録: ${hist.length ? hist.slice(-8).map(h => `<b class="num">${h.score}</b>`).join(' → ') : 'まだありません'}</p></div>
    <div class="panel"><p class="small muted">学習の記録は、このスマホ(このブラウザ)の中だけに保存されます。</p>
      <button class="secondary danger" id="reset">学習の記録をすべて消す</button>
      <div id="confirm" hidden class="stack"><p>本当に消しますか? 元にもどせません。</p><div class="navrow"><button class="secondary" id="no">やめる</button><button class="secondary danger" id="yes">消す</button></div></div></div>`;
  bindSound();
  app.querySelector('#back').onclick = () => go('home');
  app.querySelector('#reset').onclick = () => { app.querySelector('#confirm').hidden = false; };
  app.querySelector('#no').onclick = () => { app.querySelector('#confirm').hidden = true; };
  app.querySelector('#yes').onclick = () => { P = {}; saveP(); ['streak', 'examBest', 'examHist'].forEach(k => store.del(k)); go('home'); };
}

// ---------- 起動
(async function boot() {
  try {
    const [q, sky] = await Promise.all([fetch('data/questions.json').then(r => r.json()), fetch('data/sky.json').then(r => r.json())]);
    Q = q; SKY = sky; BY = Object.fromEntries(Q.map(x => [x.id, x]));
    // 問題データの更新で消えた問題の記録は捨てる
    for (const id of Object.keys(P)) if (!BY[id]) delete P[id];
    render();
  } catch (e) {
    app.innerHTML = `<p class="loading">データを読み込めませんでした。ページを再読み込みしてください。(${esc(e.message)})</p>`;
  }
})();
