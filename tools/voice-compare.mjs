// こえの ききくらべページを つくる（voice-compare/index.html）。リポジトリには いれない。
// 使い方: VOICEVOX を起動したまま  node tools/voice-compare.mjs
import { writeFile, mkdir } from 'node:fs/promises';

const ENGINE = 'http://127.0.0.1:50021';
const out = new URL('../voice-compare/', import.meta.url);

const CALM = { speedScale: 0.85, intonationScale: 1.0 };
const VOICES = [
  ['いまの ずんだもん（ノーマル・抑揚つよめ）', 3, { speedScale: 0.9, intonationScale: 1.15 }],
  ['ずんだもん ノーマル（おちついた設定）', 3, CALM],
  ['ずんだもん あまあま', 1, CALM],
  ['No.7 読み聞かせ', 31, CALM],
  ['春日部つむぎ', 8, CALM],
  ['冥鳴ひまり', 14, CALM],
  ['東北ずん子', 107, CALM],
  ['四国めたん ノーマル', 2, CALM],
  ['もち子さん のんびり', 80, CALM],
  ['WhiteCUL たのしい', 24, CALM],
];
// [ひょうじ, VOICEVOX に わたす もじ]
const SAMPLES = [
  ['あ', 'ア'], ['は', 'ハ'], ['ねこ', 'ねこ'], ['ひこうき', 'ひこうき'], ['でんしゃ', 'でんしゃ'],
  ['ライオン', 'ライオン'], ['に たす さん は？', 'ニたすサンは？'], ['じょうずに かけたね！', 'じょうずに かけたね！'],
];

await mkdir(out, { recursive: true });
const rows = [];
for (const [vi, [label, id, params]] of VOICES.entries()) {
  const cells = [];
  for (const [si, [shown, src]] of SAMPLES.entries()) {
    const q = await (await fetch(`${ENGINE}/audio_query?speaker=${id}&text=${encodeURIComponent(src)}`, { method: 'POST' })).json();
    Object.assign(q, params, { prePhonemeLength: 0.05, postPhonemeLength: 0.12 });
    const wav = Buffer.from(await (await fetch(`${ENGINE}/synthesis?speaker=${id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q),
    })).arrayBuffer());
    const file = `v${vi}-s${si}.wav`;
    await writeFile(new URL(file, out), wav);
    cells.push(`<td><button data-src="${file}">${shown}</button></td>`);
  }
  rows.push(`<tr><th>${vi + 1}. ${label}<br><button class="all" data-row="${vi}">▶ ぜんぶ</button></th>${cells.join('')}</tr>`);
  console.log('done', label);
}

await writeFile(new URL('index.html', out), `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>こえの ききくらべ</title>
<style>
body { font-family: sans-serif; background: #fff8ec; color: #3b2f2f; margin: 16px; }
table { border-collapse: collapse; } th, td { padding: 6px; border-bottom: 1px solid #f0dcc0; text-align: left; }
th { font-size: 14px; white-space: nowrap; } button { font-size: 16px; padding: 8px 10px; border-radius: 8px; border: 1px solid #e0c8a8; background: #fff; cursor: pointer; }
button.playing { background: #ffe066; } .all { margin-top: 4px; font-size: 13px; padding: 4px 8px; }
</style></head><body>
<h1>こえの ききくらべ</h1>
<p>ボタンを押すと再生します。「▶ ぜんぶ」でその声の全サンプルを続けて再生します。2〜10は、ゆっくり（0.85）・抑揚ふつう（1.0）です。</p>
<table>${rows.join('\n')}</table>
<script>
const a = new Audio(); let q = [];
const play = btns => { q = btns; next(); };
function next() { document.querySelectorAll('.playing').forEach(b => b.classList.remove('playing'));
  const b = q.shift(); if (!b) return; b.classList.add('playing'); a.src = b.dataset.src; a.play(); }
a.onended = () => setTimeout(next, 300);
document.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
  play(b.classList.contains('all') ? [...b.closest('tr').querySelectorAll('td button')] : [b]); });
</script></body></html>`);
console.log('open http://localhost:8765/voice-compare/');
