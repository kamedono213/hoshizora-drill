// 問題データ(data/questions.js)と星図データ(d3-celestial, BSD-3)から、アプリ用の app/data/*.json を作る。
// 図を使う問題(星座の形・大三角・1等星の位置・月の形)はここで自動生成する。正解は星図データから決まるので取り違えがない。
// 実行: node tools/build-data.js
const fs = require('fs');
const path = require('path');
const R = p => path.join(__dirname, '..', p);
const manual = require('../data/questions.js');
const lines = require('../research/constellations.lines.json');
const consts = require('../research/constellations.json');
const stars = require('../research/stars.6.json');
const starnames = require('../research/starnames.json');

// 問題IDは問題文から作る(問題を足したり並べ替えたりしても、学習記録が引き継がれる)
const hash = s => { let h = 5381; for (const ch of s) h = ((h << 5) + h + ch.codePointAt(0)) >>> 0; return h.toString(36); };

// ---- 星図: 星座の線と、線の頂点の星の明るさ・名前
const jaName = id => consts.features.find(f => f.id === id).properties.ja;
const starList = stars.features.map(f => ({ hip: f.id, ra: f.geometry.coordinates[0], dec: f.geometry.coordinates[1], mag: f.properties.mag }));
const near = (ra, dec) => {
  let best = null, bd = 1e9;
  for (const s of starList) { const d = Math.abs(s.ra - ra) + Math.abs(s.dec - dec); if (d < bd) { bd = d; best = s; } }
  return bd < 0.05 ? best : null;
};
const JA_FIX = { 69673: 'アークトゥルス', 11767: 'ポラリス' };
const nameOf = hip => JA_FIX[hip] || (starnames[hip] && starnames[hip].ja) || '';
function constellation(id) {
  const f = lines.features.find(x => x.id === id);
  if (!f) throw new Error('no lines for ' + id);
  const segs = f.geometry.coordinates;
  const pts = new Map();
  segs.flat().forEach(([ra, dec]) => {
    const k = ra.toFixed(3) + ',' + dec.toFixed(3);
    if (!pts.has(k)) { const s = near(ra, dec); pts.set(k, { ra, dec, mag: s ? s.mag : 4, hip: s ? s.hip : null, name: s ? nameOf(s.hip) : '' }); }
  });
  return { id, name: jaName(id), lines: segs, stars: [...pts.values()] };
}
const starByName = name => {
  const hip = Object.keys(starnames).find(h => nameOf(h) === name);
  const s = starList.find(x => String(x.hip) === hip);
  if (!s) throw new Error('star not found: ' + name);
  return { name, ra: s.ra, dec: s.dec, mag: s.mag, hip: s.hip };
};

// 図に使う星座(季節つき。まちがいの選択肢は同じ季節を優先)
const SHAPES = [
  ['Ori', '冬'], ['Tau', '冬'], ['Gem', '冬'], ['CMa', '冬'], ['Aur', '冬'],
  ['Leo', '春'], ['Vir', '春'], ['Boo', '春'], ['UMa', '春'],
  ['Sco', '夏'], ['Cyg', '夏'], ['Lyr', '夏'], ['Aql', '夏'], ['Sgr', '夏'], ['Her', '夏'],
  ['Peg', '秋'], ['And', '秋'], ['Cas', '秋'], ['Per', '秋'], ['Cep', '秋'],
  ['UMi', '一年中'],
];
const sky = { const: {}, asterisms: {} };
SHAPES.forEach(([id]) => { sky.const[id] = constellation(id); });
// 大三角・四辺形: 太線で結ぶ星と、うすく添える星座
const AST = {
  summer: { name: '夏の大三角', stars: ['ベガ', 'アルタイル', 'デネブ'], context: ['Lyr', 'Aql', 'Cyg'] },
  winter: { name: '冬の大三角', stars: ['ベテルギウス', 'シリウス', 'プロキオン'], context: ['Ori', 'CMa', 'CMi'] },
  spring: { name: '春の大三角', stars: ['アークトゥルス', 'スピカ', 'デネボラ'], context: ['Boo', 'Vir', 'Leo'] },
  autumn: { name: '秋の四辺形', stars: ['マルカブ', 'シェアト', 'アルフェラッツ', 'アルゲニブ'], context: ['Peg', 'And'] },
};
for (const [k, a] of Object.entries(AST)) {
  a.context.forEach(id => { if (!sky.const[id]) sky.const[id] = constellation(id); });
  sky.asterisms[k] = { name: a.name, stars: a.stars.map(starByName), context: a.context };
}

// ---- 問題
const out = [];
const push = (ch, q, choices, exp, fig) => out.push({ id: hash(q + (fig || '')), ch, q, a: choices, exp, ...(fig ? { fig } : {}) });
manual.forEach(([ch, q, choices, exp]) => push(ch, q, choices, exp));

// 星座の形 → 名前
const season = Object.fromEntries(SHAPES);
SHAPES.forEach(([id, ss]) => {
  const same = SHAPES.filter(([o, s]) => o !== id && s === ss).map(([o]) => o);
  const other = SHAPES.filter(([o, s]) => o !== id && s !== ss).map(([o]) => o);
  const wrong = [...same, ...other].slice(0, 3).map(jaName);
  push(4, '図の線で結んだ形の星座はどれ?', [jaName(id), ...wrong], `${jaName(id)}(${ss === '一年中' ? '一年中見える' : ss + 'の星座'})。星をつないだ形を、星座の名前といっしょに覚えよう。`, 'const:' + id);
});
// 大三角・四辺形
const astKeys = Object.keys(AST);
astKeys.forEach(k => {
  const a = AST[k];
  push(4, '図の黄色い線で結んだ形を何という?', [a.name, ...astKeys.filter(o => o !== k).map(o => AST[o].name)], `${a.name}は、${a.stars.join('・')}を結んだ形。`, 'ast:' + k);
});
// 印のついた1等星の名前
const MARK = [['Ori', 'ベテルギウス'], ['Ori', 'リゲル'], ['Sco', 'アンタレス'], ['Lyr', 'ベガ'], ['Aql', 'アルタイル'], ['Cyg', 'デネブ'], ['Leo', 'レグルス'], ['Vir', 'スピカ'], ['Boo', 'アークトゥルス'], ['Tau', 'アルデバラン'], ['CMa', 'シリウス'], ['Aur', 'カペラ'], ['UMi', 'ポラリス']];
const DISPLAY = { 'ポラリス': '北極星(ポラリス)' };
MARK.forEach(([cid, star], i) => {
  const c = sky.const[cid];
  if (!c.stars.some(s => s.name === star)) throw new Error(star + ' is not a vertex of ' + cid);
  const others = MARK.filter(([, s]) => s !== star).map(([, s]) => s);
  const wrong = [others[i % others.length], others[(i + 4) % others.length], others[(i + 8) % others.length]];
  const disp = s => DISPLAY[s] || s;
  push(4, `図は${c.name}。赤い丸の星の名前はどれ?`, [disp(star), ...wrong.map(disp)], `${c.name}の${disp(star)}。星座の中のどの位置にあるかも覚えておこう。`, `mark:${cid}:${star}`);
});
// 月の形(月齢)。北半球(日本)で見た形
const MOON = [
  ['moon:3', 'この形の月を何という?', ['三日月', '上弦の月', '下弦の月', '満月'], '新月から3日目ごろの細い月。夕方の西の空に見え、右側がかがやく。'],
  ['moon:7.4', 'この形の月を何という?', ['上弦の月', '下弦の月', '三日月', '満月'], '右半分が光る半月が上弦の月。新月から約7日目。'],
  ['moon:14.8', 'この形の月を何という?', ['満月', '上弦の月', '新月', '十三夜の月'], '全体が光る満月。太陽と反対側にあり、夕方に東からのぼる。'],
  ['moon:22.1', 'この形の月を何という?', ['下弦の月', '上弦の月', '三日月', '満月'], '左半分が光る半月が下弦の月。満月から約7日後。'],
  ['moon:7.4', 'この形の月が南の空でいちばん高くなるのは何時ごろ?', ['夕方(午後6時ごろ)', '真夜中(午前0時ごろ)', '明け方(午前6時ごろ)', '正午ごろ'], '上弦の月は太陽より約90度東にあるので、夕方ごろ南中する。'],
  ['moon:22.1', 'この形の月が南の空でいちばん高くなるのは何時ごろ?', ['明け方(午前6時ごろ)', '夕方(午後6時ごろ)', '真夜中(午前0時ごろ)', '正午ごろ'], '下弦の月は真夜中ごろにのぼり、明け方に南中する。'],
  ['moon:3', 'この形の月が見えるのは、いつごろのどの空?', ['夕方の西の空', '明け方の東の空', '真夜中の南の空', '夕方の東の空'], '三日月は太陽を追いかけるように動き、日がしずんだあとの西の空に低く見える。'],
];
MOON.forEach(([fig, q, a, exp]) => push(1, q, a, exp, fig));

// 検証: 選択肢4つ・重複なし・IDの重複なし
const ids = new Set();
out.forEach(q => {
  if (q.a.length !== 4 || new Set(q.a).size !== 4) throw new Error('choices: ' + q.q + ' ' + q.fig);
  if (ids.has(q.id)) throw new Error('dup id: ' + q.q + ' ' + (q.fig || ''));
  ids.add(q.id);
});
fs.mkdirSync(R('app/data'), { recursive: true });
fs.writeFileSync(R('app/data/questions.json'), JSON.stringify(out));
fs.writeFileSync(R('app/data/sky.json'), JSON.stringify(sky));
const by = {}; out.forEach(q => by[q.ch] = (by[q.ch] || 0) + 1);
console.log('questions', out.length, JSON.stringify(by), 'figures', out.filter(q => q.fig).length, 'sky bytes', JSON.stringify(sky).length);
