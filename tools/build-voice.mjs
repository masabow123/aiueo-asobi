// VOICEVOX（ずんだもん）で アプリが よみあげる ことばを ぜんぶ MP3 に する。
// 使い方: VOICEVOX を起動したまま  node tools/build-voice.mjs [スタイルID]
// 出力: voice/*.mp3 と voice/index.js（よみ → ファイル名）、tools/voice-readings.tsv（読みの確認用）
import { readFile, writeFile, mkdir, access, readdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Mp3Encoder } from '@breezystack/lamejs';

const ENGINE = 'http://127.0.0.1:50021';
const SPEAKER = Number(process.argv[2] || 3); // 3 = ずんだもん（ノーマル）
const PARAMS = { speedScale: 0.85, intonationScale: 1.0, prePhonemeLength: 0.05, postPhonemeLength: 0.12, outputSamplingRate: 24000 };
const root = new URL('../', import.meta.url);
const out = new URL('voice/', root);

// kana.js は ブラウザよう なので window を かぶせて よみこむ
const window = {};
new Function('window', await readFile(new URL('js/kana.js', root), 'utf8'))(window);
const K = window.KANA;
const voiceKey = s => K.toHira(s).replace(/\s/g, '');

// よみあげる ことばの いちらん（text: アプリが いう もじ、src: VOICEVOX に わたす もじ）
// ひらがな 1もじや かずは「は→ワ」「へ→エ」と じょしに よまれるので カタカナで わたす。
const phrases = new Map();
const add = (text, src = text) => phrases.set(voiceKey(text), { text, src });
for (const c of K.BASIC + K.DAKU) add(c, K.toKata(c));
for (const c of K.SMALL) add(K.sayChar(c), 'ちいさい ' + K.toKata(String.fromCodePoint(c.codePointAt(0) + 1)));
add(K.sayChar('ー'));
for (const kata of [false, true]) for (const [w] of K.words(kata)) add(w);
K.YOMI.forEach(y => add(y, K.toKata(y)));
const Y = n => K.toKata(K.YOMI[n]);
const math = (a, op, b, ans) => {
  const head = `${Y(a)}${op === '+' ? 'たす' : 'ひく'}${Y(b)}は`;
  add(K.mathSay(a, op, b), head + '？');
  add(K.mathSay(a, op, b, ans), `${head}、${Y(ans)}`);
};
for (let a = 1; a <= 9; a++) for (let b = 1; a + b <= 10; b++) math(a, '+', b, a + b);
for (let a = 2; a <= 10; a++) for (let b = 1; b < a; b++) math(a, '-', b, a - b);
K.PRAISE.forEach(p => add(p));

async function api(path, init) {
  const res = await fetch(ENGINE + path, init);
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res;
}

function wavToMp3(buf) {
  // WAV の data チャンクを さがして 16bit PCM を とりだす
  let p = 12;
  let rate = 24000;
  while (p < buf.length) {
    const id = buf.toString('ascii', p, p + 4);
    const size = buf.readUInt32LE(p + 4);
    if (id === 'fmt ') rate = buf.readUInt32LE(p + 12);
    if (id === 'data') {
      const pcm = new Int16Array(buf.buffer.slice(buf.byteOffset + p + 8, buf.byteOffset + p + 8 + size));
      const enc = new Mp3Encoder(1, rate, 48);
      const chunks = [];
      for (let i = 0; i < pcm.length; i += 1152) chunks.push(enc.encodeBuffer(pcm.subarray(i, i + 1152)));
      chunks.push(enc.flush());
      return Buffer.concat(chunks.map(c => Buffer.from(c)));
    }
    p += 8 + size + (size % 2);
  }
  throw new Error('data chunk not found');
}

await api('/version');
await mkdir(out, { recursive: true });
const index = {};
const readings = [];
let made = 0;
for (const [key, { src }] of phrases) {
  const file = createHash('sha1').update(JSON.stringify([key, src, SPEAKER, PARAMS])).digest('hex').slice(0, 10) + '.mp3';
  index[key] = file;
  const q = await (await api(`/audio_query?speaker=${SPEAKER}&text=${encodeURIComponent(src)}`, { method: 'POST' })).json();
  readings.push(`${key}	${q.kana}`);
  try { await access(new URL(file, out)); continue; } catch { /* まだ ない */ }
  Object.assign(q, PARAMS);
  const wav = Buffer.from(await (await api(`/synthesis?speaker=${SPEAKER}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q),
  })).arrayBuffer());
  await writeFile(new URL(file, out), wavToMp3(wav));
  made++;
  if (made % 25 === 0) console.log(made, 'made');
}

// つかわなく なった ファイルを けす
const keep = new Set(Object.values(index));
for (const f of await readdir(out)) if (f.endsWith('.mp3') && !keep.has(f)) await unlink(new URL(f, out));

await writeFile(new URL('index.js', out),
  '// 自動生成: tools/build-voice.mjs — 音声: VOICEVOX:ずんだもん\nwindow.VOICE = ' + JSON.stringify(index) + ';\n');
await writeFile(new URL('tools/voice-readings.tsv', root), readings.join('\n') + '\n');
console.log(`phrases ${phrases.size}, newly made ${made}`);
