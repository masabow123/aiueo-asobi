// 1もじ（1おん）の こえを はっきり させる ちょうせい。build-voice と voice-compare で つかう。
// VOICEVOX の audio_query を じかに いじる: ぼいんを ながく、こえを おおきく、すこし たかく。
export const EMPHASIS = {
  0: null,
  1: { vowel: 1.4, consonant: 1.2, pitch: 0.1, volume: 1.25 },
  2: { vowel: 1.7, consonant: 1.3, pitch: 0.2, volume: 1.4 },
  3: { vowel: 2.0, consonant: 1.4, pitch: 0.3, volume: 1.5 },
};

export function emphasize(q, level) {
  const e = EMPHASIS[level];
  if (!e) return q;
  for (const ap of q.accent_phrases) {
    for (const m of ap.moras) {
      m.vowel_length *= e.vowel;
      if (m.consonant_length != null) m.consonant_length *= e.consonant;
      if (m.pitch > 0) m.pitch += e.pitch;
    }
  }
  q.volumeScale = e.volume;
  return q;
}

// WAV の ピーク（0〜1）。おとが われて いないか みる ため。
export function wavPeak(buf) {
  let p = 12;
  while (p < buf.length) {
    const id = buf.toString('ascii', p, p + 4);
    const size = buf.readUInt32LE(p + 4);
    if (id === 'data') {
      let peak = 0;
      for (let i = p + 8; i < p + 8 + size; i += 2) peak = Math.max(peak, Math.abs(buf.readInt16LE(i)));
      return peak / 32768;
    }
    p += 8 + size + (size % 2);
  }
  return 0;
}
