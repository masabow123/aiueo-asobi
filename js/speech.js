// こえ（よみあげ）と こうかおん
(function () {
  const synth = window.speechSynthesis;
  let voice = null;

  function pickVoice() {
    if (!synth) return;
    const ja = synth.getVoices().filter(v => /^ja/i.test(v.lang));
    // Google の こえが あれば それを つかう（Android で いちばん しぜん）
    voice = ja.find(v => /google/i.test(v.name)) || ja[0] || null;
  }
  if (synth) {
    pickVoice();
    synth.addEventListener?.('voiceschanged', pickVoice);
  }

  // ずんだもんの こえ（voice/index.js）。よみの キーは ひらがなで くうはく なし。
  const VOICE = window.VOICE || {};
  const voiceKey = s => window.KANA.toHira(s).replace(/\s/g, '');
  const audio = new Audio();
  let queue = [];
  let queueEnd = null;

  let gen = 0;
  function playNext() {
    const file = queue.shift();
    if (!file) { const f = queueEnd; queueEnd = null; f?.(); return; }
    const mine = ++gen;
    audio.src = 'voice/' + file;
    // つぎの こえに きりかわって とまった（AbortError）ときは なにも しない。
    // よみこめない ファイルは 'error' イベントで つぎへ すすむ。
    audio.play().catch(e => {
      if (mine !== gen || e.name === 'AbortError') return;
      queue = [];
      playNext();
    });
  }
  audio.addEventListener('ended', playNext);
  audio.addEventListener('error', playNext);

  function stop() {
    gen++;
    queue = [];
    queueEnd = null;
    audio.pause();
    synth?.cancel();
  }

  function say(text, opts = {}) {
    if (!text) { opts.onend?.(); return; }
    stop();
    const key = voiceKey(text);
    // まるごとの こえが あれば それ、なければ 1もじずつ つなげる
    const chars = [...key].filter(c => c !== 'ー');
    const charFile = c => VOICE[voiceKey(window.KANA.sayChar(c))];
    const files = VOICE[key] ? [VOICE[key]]
      : chars.length && chars.every(charFile) ? chars.map(charFile)
      : null;
    if (files) {
      queue = files;
      queueEnd = opts.onend || null;
      playNext();
      return;
    }
    sayTTS(text, opts);
  }

  function sayTTS(text, { rate = 0.8, onend } = {}) {
    if (!synth) { onend?.(); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    if (voice) u.voice = voice;
    u.rate = rate;
    u.pitch = 1.1;
    if (onend) { u.onend = onend; u.onerror = onend; }
    synth.speak(u);
  }

  // こうかおん は WebAudio で つくる（ファイル いらず）
  let ctx = null;
  function tone(freqs, { dur = 0.12, type = 'sine', gap = 0.09, vol = 0.18 } = {}) {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = ctx.currentTime;
      freqs.forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type;
        o.frequency.value = f;
        const t = t0 + i * gap;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g).connect(ctx.destination);
        o.start(t);
        o.stop(t + dur + 0.02);
      });
    } catch (e) { /* おとが でなくても うごく */ }
  }

  window.SPEECH = {
    say,
    stop,
    hasJapanese: () => !!voice || Object.keys(VOICE).length > 0,
    ding: () => tone([880, 1320], { dur: 0.18 }),
    fanfare: () => tone([523, 659, 784, 1047], { dur: 0.25, gap: 0.11 }),
    boo: () => tone([220, 180], { type: 'triangle', dur: 0.18, gap: 0.12, vol: 0.12 }),
    pop: () => tone([660], { dur: 0.06, vol: 0.1 }),
  };
})();
