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

  function say(text, { rate = 0.8, onend } = {}) {
    if (!synth || !text) { onend?.(); return; }
    synth.cancel();
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
    hasJapanese: () => !!voice,
    ding: () => tone([880, 1320], { dur: 0.18 }),
    fanfare: () => tone([523, 659, 784, 1047], { dur: 0.25, gap: 0.11 }),
    boo: () => tone([220, 180], { type: 'triangle', dur: 0.18, gap: 0.12, vol: 0.12 }),
    pop: () => tone([660], { dur: 0.06, vol: 0.1 }),
  };
})();
