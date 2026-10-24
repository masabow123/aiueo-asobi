// かきじゅん れんしゅう
// KanjiVG の せん（109×109）を おてほんにして、ゆびで かいた せんを 1かくずつ くらべる。
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const N = 32;            // くらべる ときの てんの かず
  const el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const wait = ms => new Promise(r => setTimeout(r, ms));

  function samplePath(path, n = N) {
    const len = path.getTotalLength();
    const pts = [];
    for (let i = 0; i < n; i++) {
      const p = path.getPointAtLength((len * i) / (n - 1));
      pts.push({ x: p.x, y: p.y });
    }
    return { pts, len };
  }

  // てで かいた てんを ながさで とうかんかくに ならべなおす
  function resample(raw, n = N) {
    if (raw.length < 2) return Array(n).fill(raw[0]);
    const seg = [0];
    for (let i = 1; i < raw.length; i++) seg.push(seg[i - 1] + dist(raw[i - 1], raw[i]));
    const total = seg[seg.length - 1] || 1;
    const out = [];
    let j = 1;
    for (let i = 0; i < n; i++) {
      const d = (total * i) / (n - 1);
      while (j < raw.length - 1 && seg[j] < d) j++;
      const t = (d - seg[j - 1]) / ((seg[j] - seg[j - 1]) || 1);
      out.push({
        x: raw[j - 1].x + (raw[j].x - raw[j - 1].x) * Math.min(1, Math.max(0, t)),
        y: raw[j - 1].y + (raw[j].y - raw[j - 1].y) * Math.min(1, Math.max(0, t)),
      });
    }
    return out;
  }

  const avgDist = (a, b) => a.reduce((s, p, i) => s + dist(p, b[i]), 0) / a.length;
  const centroid = ps => ({
    x: ps.reduce((s, p) => s + p.x, 0) / ps.length,
    y: ps.reduce((s, p) => s + p.y, 0) / ps.length,
  });

  // 1かくを はんてい: 'ok' | 'reverse' | 'ng'
  function judge(user, target, loose) {
    const limit = loose ? 17 : 14;
    if (target.len < 14) {
      // てん（だくてん や 「う」の 1かくめ）は ばしょ だけ みる
      return dist(centroid(user), centroid(target.pts)) < (loose ? 15 : 12) ? 'ok' : 'ng';
    }
    if (avgDist(user, target.pts) < limit) return 'ok';
    if (avgDist([...user].reverse(), target.pts) < limit) return 'reverse';
    return 'ng';
  }

  /**
   * かく ばめんを つくる。
   * opts.guide: おてほんの うすい もじを みせる
   * opts.onDone(): ぜんぶ かけたら よばれる
   * opts.onStroke(result): 1かく かくごとに よばれる
   */
  function createWriter(host, ch, opts = {}) {
    host.innerHTML = '';
    const svg = el('svg', { viewBox: '0 0 109 109', class: 'writer' }, host);
    const grid = el('g', { class: 'w-grid' }, svg);
    el('rect', { x: 2, y: 2, width: 105, height: 105, rx: 6 }, grid);
    el('line', { x1: 54.5, y1: 4, x2: 54.5, y2: 105 }, grid);
    el('line', { x1: 4, y1: 54.5, x2: 105, y2: 54.5 }, grid);

    const guide = el('g', { class: 'w-guide' }, svg);
    const done = el('g', { class: 'w-done' }, svg);
    const demo = el('g', { class: 'w-demo' }, svg);
    const hint = el('g', { class: 'w-hint' }, svg);
    const ink = el('polyline', { class: 'w-ink' }, svg);

    const ds = window.STROKES[ch] || [];
    const targets = ds.map(d => {
      const p = el('path', { d }, guide);
      return { d, ...samplePath(p) };
    });
    guide.style.visibility = opts.guide === false ? 'hidden' : 'visible';

    let idx = 0;
    let fails = 0;
    let raw = [];
    let drawing = false;
    let busy = false;

    function showHint() {
      hint.innerHTML = '';
      if (idx >= targets.length || opts.guide === false && fails < 2) return;
      const t = targets[idx];
      const s = t.pts[0];
      const a = t.pts[Math.min(5, N - 1)];
      el('circle', { cx: s.x, cy: s.y, r: 6, class: 'w-start' }, hint);
      const num = el('text', { x: s.x, y: s.y + 0.3, class: 'w-num' }, hint);
      num.textContent = idx + 1;
      // すすむ むきの やじるし
      const ang = Math.atan2(a.y - s.y, a.x - s.x);
      const ax = s.x + Math.cos(ang) * 11;
      const ay = s.y + Math.sin(ang) * 11;
      const head = el('path', {
        d: 'M -3 -3 L 2 0 L -3 3',
        class: 'w-arrow',
        transform: `translate(${ax} ${ay}) rotate(${(ang * 180) / Math.PI})`,
      }, hint);
      head.style.display = t.len < 14 ? 'none' : '';
    }

    function drawPath(group, d, cls, ms) {
      const p = el('path', { d, class: cls }, group);
      if (!ms) return Promise.resolve(p);
      const len = p.getTotalLength();
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = len;
      p.getBoundingClientRect();
      p.style.transition = `stroke-dashoffset ${ms}ms linear`;
      p.style.strokeDashoffset = 0;
      return wait(ms).then(() => p);
    }

    // おてほん: 1かくずつ じゅんばんに かいて みせる
    async function playDemo(from = 0, only = false) {
      if (busy) return;
      busy = true;
      hint.innerHTML = '';
      demo.innerHTML = '';
      const end = only ? from + 1 : targets.length;
      for (let i = from; i < end; i++) {
        const ms = Math.max(350, targets[i].len * 12);
        await drawPath(demo, targets[i].d, 'w-demo-path', ms);
        await wait(200);
      }
      await wait(500);
      demo.innerHTML = '';
      busy = false;
      showHint();
    }

    function toSvg(e) {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      return { x: p.x, y: p.y };
    }

    svg.addEventListener('pointerdown', e => {
      if (busy || idx >= targets.length) return;
      e.preventDefault();
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* なくても かける */ }
      drawing = true;
      raw = [toSvg(e)];
      ink.setAttribute('points', '');
      ink.classList.remove('bad');
    });
    svg.addEventListener('pointermove', e => {
      if (!drawing) return;
      const evs = e.getCoalescedEvents?.() || [];
      for (const ev of evs.length ? evs : [e]) raw.push(toSvg(ev));
      ink.setAttribute('points', raw.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
    });
    const finish = async () => {
      if (!drawing) return;
      drawing = false;
      const user = resample(raw);
      const result = judge(user, targets[idx], opts.guide === false);
      opts.onStroke?.(result);
      if (result === 'ok') {
        ink.setAttribute('points', '');
        drawPath(done, targets[idx].d, 'w-done-path', 180);
        idx++;
        fails = 0;
        if (idx >= targets.length) {
          hint.innerHTML = '';
          opts.onDone?.();
        } else {
          showHint();
        }
      } else {
        fails++;
        ink.classList.add('bad');
        await wait(350);
        ink.setAttribute('points', '');
        ink.classList.remove('bad');
        // 2かい まちがえたら その 1かくだけ おてほんを みせる
        if (fails >= 2) playDemo(idx, true);
        else showHint();
      }
    };
    svg.addEventListener('pointerup', finish);
    svg.addEventListener('pointercancel', finish);

    showHint();

    return {
      demo: () => playDemo(0),
      reset() {
        idx = 0;
        fails = 0;
        done.innerHTML = '';
        demo.innerHTML = '';
        ink.setAttribute('points', '');
        showHint();
      },
      setGuide(on) {
        opts.guide = on;
        guide.style.visibility = on ? 'visible' : 'hidden';
        showHint();
      },
      get strokeCount() { return targets.length; },
    };
  }

  window.WRITE = { createWriter };
})();
