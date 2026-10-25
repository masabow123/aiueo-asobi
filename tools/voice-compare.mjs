// こえの ききくらべページを つくる（voice-compare/index.html）。リポジトリには いれない。
// 使い方: VOICEVOX を起動したまま  node tools/voice-compare.mjs
// いまは「1もじを どのくらい はっきり させるか」を くらべる ページ。
import { writeFile, mkdir } from 'node:fs/promises';
import { emphasize, wavPeak } from './voice-tune.mjs';

const ENGINE = 'http://127.0.0.1:50021';
const out = new URL('../voice-compare/', import.meta.url);

const BASE = { speedScale: 0.85, intonationScale: 1.0, prePhonemeLength: 0.05, postPhonemeLength: 0.12 };
// [ラベル, スピーカーID, はっきり レベル]
const VOICES = [
  ['いま（ちょうせい なし）', 3, 0],
  ['しっかり（すこし ながく・おおきく）', 3, 1],
  ['はっきり（ながく・おおきく・すこし たかく）', 3, 2],
  ['つよめ（もっと ながく・おおきく・たかく）', 3, 3],
];
// [ひょうじ, VOICEVOX に わたす もじ]
const SAMPLES = [
  ['あ', 'ア'], ['か', 'カ'], ['は', 'ハ'], ['ぬ', 'ヌ'], ['を', 'ヲ'], ['ぴ', 'ピ'],
  ['に（かず）', 'ニ'], ['ご（かず）', 'ゴ'], ['いち（かず）', 'イチ'],
];

await mkdir(out, { recursive: true });
const rows = [];
let maxPeak = 0;
for (const [vi, [label, id, level]] of VOICES.entries()) {
  const cells = [];
  for (const [si, [shown, src]] of SAMPLES.entries()) {
    const q = await (await fetch(`${ENGINE}/audio_query?speaker=${id}&text=${encodeURIComponent(src)}`, { method: 'POST' })).json();
    Object.assign(q, BASE);
    emphasize(q, level);
    const wav = Buffer.from(await (await fetch(`${ENGINE}/synthesis?speaker=${id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q),
    })).arrayBuffer());
    maxPeak = Math.max(maxPeak, wavPeak(wav));
    const file = `c${vi}-s${si}.wav`;
    await writeFile(new URL(file, out), wav);
    cells.push(`<td><button data-src="${file}">${shown}</button></td>`);
  }
  rows.push(`<tr><th>${vi + 1}. ${label}<br><button class="all">▶ ぜんぶ</button></th>${cells.join('')}</tr>`);
}
console.log('max peak', maxPeak.toFixed(2));

await writeFile(new URL('index.html', out), `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>1もじの ききくらべ</title>
<style>
body { font-family: sans-serif; background: #fff8ec; color: #3b2f2f; margin: 16px; }
table { border-collapse: collapse; } th, td { padding: 6px; border-bottom: 1px solid #f0dcc0; text-align: left; }
th { font-size: 14px; white-space: nowrap; } button { font-size: 16px; padding: 8px 10px; border-radius: 8px; border: 1px solid #e0c8a8; background: #fff; cursor: pointer; }
button.playing { background: #ffe066; } .all { margin-top: 4px; font-size: 13px; padding: 4px 8px; }
</style></head><body>
<h1>1もじの ききくらべ（ずんだもん）</h1>
<p>ボタンを押すと再生します。「▶ ぜんぶ」でその行を続けて再生します。どれも、速さ0.85・抑揚1.0（いまの設定）が土台です。</p>
<table>${rows.join('\n')}</table>
<script>
const a = new Audio(); let q = [];
function next() { document.querySelectorAll('.playing').forEach(b => b.classList.remove('playing'));
  const b = q.shift(); if (!b) return; b.classList.add('playing'); a.src = b.dataset.src; a.play(); }
a.onended = () => setTimeout(next, 400);
document.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
  q = b.classList.contains('all') ? [...b.closest('tr').querySelectorAll('td button')] : [b]; next(); });
</script></body></html>`);
console.log('open http://localhost:8765/voice-compare/');
