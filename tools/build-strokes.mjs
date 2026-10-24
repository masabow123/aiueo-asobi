// KanjiVG から ひらがな・カタカナ の書き順データを取り出して js/strokes.js を作る。
// 使い方: node tools/build-strokes.mjs
// データ: KanjiVG (https://kanjivg.tagaini.net/) CC BY-SA 3.0 — Ulrich Apel
import { writeFile } from 'node:fs/promises';

const TAG = 'r20260714';
const BASE = `https://raw.githubusercontent.com/KanjiVG/kanjivg/${TAG}/kanji/`;

const HIRA = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん' +
  'がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ';
const KATA = [...HIRA].map(c => String.fromCodePoint(c.codePointAt(0) + 0x60)).join('');

const out = {};
for (const ch of [...HIRA, ...KATA]) {
  const hex = ch.codePointAt(0).toString(16).padStart(5, '0');
  const res = await fetch(BASE + hex + '.svg');
  if (!res.ok) { console.warn('missing', ch, res.status); continue; }
  const svg = await res.text();
  const paths = [...svg.matchAll(/<path [^>]*\bd="([^"]+)"/g)].map(m => m[1]);
  if (!paths.length) { console.warn('no paths', ch); continue; }
  out[ch] = paths;
}

const body = '// 自動生成: tools/build-strokes.mjs\n' +
  '// 書き順データ: KanjiVG (https://kanjivg.tagaini.net/) CC BY-SA 3.0 — Ulrich Apel\n' +
  'window.STROKES = ' + JSON.stringify(out) + ';\n';
await writeFile(new URL('../js/strokes.js', import.meta.url), body);
console.log('wrote', Object.keys(out).length, 'chars');
