// あいうえお あそび — がめんの きりかえと 3つの あそび
(function () {
  const { say, ding, fanfare, boo, pop } = window.SPEECH;
  const K = window.KANA;
  const app = document.getElementById('app');
  const celebrateEl = document.getElementById('celebrate');

  // ---------- ちいさな どうぐ ----------
  function h(tag, props = {}, ...kids) {
    const e = document.createElement(tag);
    for (const k in props) {
      const v = props[k];
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== false) e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null) e.append(c);
    return e;
  }
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = arr => arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(v => v[1]);
  const bump = (e, cls) => { e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls); };

  const store = {
    get(k, d) { try { const v = localStorage.getItem('aiueo.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('aiueo.' + k, JSON.stringify(v)); } catch (e) { /* ほぞん できなくても うごく */ } },
  };

  const state = {
    kata: store.get('kata', false),
    written: new Set(store.get('written', [])),
    easy: store.get('easy', true),
  };
  const conv = s => (state.kata ? K.toKata(s) : s);

  function celebrate(text, ms = 1600) {
    celebrateEl.replaceChildren(
      h('div', { class: 'cele-box' }, h('div', { class: 'cele-emoji' }, pick(['🎉', '🌟', '💮', '🥳', '👏'])), h('div', { class: 'cele-text' }, text)),
      ...Array.from({ length: 14 }, (_, i) => h('span', {
        class: 'spark',
        style: `--a:${i * (360 / 14)}deg;--d:${30 + Math.random() * 15}vmin;--c:${pick(['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#c77dff'])}`,
      }, '★')),
    );
    celebrateEl.hidden = false;
    fanfare();
    return new Promise(r => setTimeout(() => { celebrateEl.hidden = true; r(); }, ms));
  }

  // ---------- がめん の きりかえ（Android の もどる ボタン に たいおう） ----------
  const screens = {};
  function go(name, arg, push = true) {
    window.speechSynthesis?.cancel();
    if (push) history.pushState({ name, arg }, '');
    app.replaceChildren(screens[name](arg));
    app.dataset.screen = name;
  }
  window.addEventListener('popstate', e => go(e.state?.name || 'home', e.state?.arg, false));

  function topbar(title, ...right) {
    return h('header', { class: 'topbar' },
      h('button', { class: 'btn-home', 'aria-label': 'もどる', onclick: () => history.back() }, '◀'),
      h('h1', {}, title),
      h('div', { class: 'topbar-right' }, ...right));
  }

  // ---------- もじばん（あいうえお表） ----------
  function makeBoard({ onKey, extraKeys = [] }) {
    let tab = 'basic';
    const grid = h('div', { class: 'board-grid' });
    const tabs = h('div', { class: 'board-tabs' });
    const keys = new Map();

    function render() {
      const cols = tab === 'basic' ? K.BASIC_COLS : K.EXTRA_COLS;
      keys.clear();
      grid.style.setProperty('--cols', cols.length);
      grid.replaceChildren(...cols.flatMap((col, ci) => col.map((c, ri) => {
        const ch = conv(c);
        const b = h('button', {
          class: 'key' + (c ? '' : ' empty') + (ci % 2 ? ' alt' : ''),
          style: `grid-column:${cols.length - ci};grid-row:${ri + 1}`,
          disabled: !c,
          onpointerdown: e => { if (!c) return; e.preventDefault(); bump(b, 'pressed'); onKey(ch); },
        }, ch);
        if (c) keys.set(ch, b);
        return b;
      })));
      tabs.replaceChildren(
        h('button', { class: 'tab' + (tab === 'basic' ? ' on' : ''), onclick: () => { tab = 'basic'; render(); } }, conv('あいう')),
        h('button', { class: 'tab' + (tab === 'extra' ? ' on' : ''), onclick: () => { tab = 'extra'; render(); } }, conv('がぱゃ')),
        ...(state.kata ? [h('button', { class: 'key key-bar', onpointerdown: e => { e.preventDefault(); onKey('ー'); } }, 'ー')] : []),
        ...extraKeys,
      );
    }
    render();

    return {
      el: h('div', { class: 'board' }, tabs, grid),
      // こたえの キーを ひからせる（ひつようなら タブも きりかえる）
      highlight(ch) {
        const base = K.toHira(ch);
        const want = K.BASIC.includes(base) ? 'basic' : 'extra';
        if (ch !== 'ー' && want !== tab) { tab = want; render(); }
        const k = ch === 'ー' ? tabs.querySelector('.key-bar') : keys.get(ch);
        k?.classList.add('hint');
      },
      clearHint() { app.querySelectorAll('.hint').forEach(e => e.classList.remove('hint')); },
    };
  }

  // ---------- ホーム ----------
  screens.home = () => {
    const toggle = h('div', { class: 'mode-toggle' },
      h('button', { class: !state.kata ? 'on' : '', onclick: () => setKata(false) }, 'ひらがな'),
      h('button', { class: state.kata ? 'on' : '', onclick: () => setKata(true) }, 'カタカナ'));
    function setKata(v) { state.kata = v; store.set('kata', v); pop(); go('home', null, false); }

    const card = (emoji, label, sub, color, onclick) =>
      h('button', { class: 'menu-card', style: `--c:${color}`, onclick },
        h('span', { class: 'menu-emoji' }, emoji), h('span', { class: 'menu-label' }, label), h('span', { class: 'menu-sub' }, sub));

    const total = K.BASIC.length + K.DAKU.length;
    // こえの リストは あとから とどくので すこし まってから しらべる
    const warn = h('p', { class: 'warn', hidden: true }, 'にほんごの こえが みつかりません（おとなの かたへ: Android の せってい →「テキスト読み上げ」で 日本語を いれてください）');
    setTimeout(() => { warn.hidden = window.SPEECH.hasJapanese(); }, 1500);
    const mine = [...state.written].filter(c => (state.kata ? /[ァ-ヶ]/ : /[ぁ-ゖ]/).test(c)).length;

    return h('div', { class: 'home' },
      h('h1', { class: 'title' }, conv('あいうえお'), h('small', {}, ' あそび')),
      toggle,
      h('div', { class: 'menu' },
        card('👂', 'きいて あてよう', conv('もじ・ことば'), '#4d96ff', () => go('quizMenu')),
        card('🗣️', 'おして きこう', conv('もじばん'), '#6bcb77', () => go('board')),
        card('✏️', 'かいて みよう', `★ ${mine} / ${total}`, '#ff8c42', () => go('pick')),
        card('🍎', 'かず あそび', 'たしざん・ひきざん', '#e0a800', () => go('mathMenu'))),
      warn);
  };

  // ---------- おして きこう（うった もじを よみあげ） ----------
  screens.board = () => {
    let text = '';
    const out = h('div', { class: 'compose' });
    const show = () => {
      out.replaceChildren(...(text ? [...text].map(c => h('span', { class: 'compose-ch' }, c)) : [h('span', { class: 'compose-ph' }, conv('もじを おしてね'))]));
    };
    const board = makeBoard({
      onKey(ch) {
        if ([...text].length >= 12) return;
        text += ch;
        say(K.sayChar(ch));
        show();
        bump(out.lastChild, 'popin');
      },
      extraKeys: [
        h('button', { class: 'key key-tool', onclick: () => { text = [...text].slice(0, -1).join(''); show(); } }, '⌫ けす'),
      ],
    });
    show();
    return h('div', { class: 'screen screen-board' },
      topbar('おして きこう'),
      h('div', { class: 'compose-row' },
        out,
        h('button', { class: 'btn-big btn-speak', onclick: () => text && say(text, { rate: 0.75 }) }, '🔊'),
        h('button', { class: 'btn-big btn-clear', onclick: () => { text = ''; show(); } }, '🗑️')),
      board.el);
  };

  // ---------- きいて あてよう: えらぶ ----------
  screens.quizMenu = () => h('div', { class: 'screen screen-quizmenu' },
    topbar('きいて あてよう'),
    h('div', { class: 'menu' },
      h('button', { class: 'menu-card', style: '--c:#4d96ff', onclick: () => go('quizChar') },
        h('span', { class: 'menu-emoji' }, conv('あ')), h('span', { class: 'menu-label' }, '1もじ'), h('span', { class: 'menu-sub' }, '3つから えらぶ')),
      h('button', { class: 'menu-card', style: '--c:#c77dff', onclick: () => { state.easy = true; store.set('easy', true); go('quizWord'); } },
        h('span', { class: 'menu-emoji' }, '🐶'), h('span', { class: 'menu-label' }, 'ことば'), h('span', { class: 'menu-sub' }, 'かんたん')),
      h('button', { class: 'menu-card', style: '--c:#ff6b6b', onclick: () => { state.easy = false; store.set('easy', false); go('quizWord'); } },
        h('span', { class: 'menu-emoji' }, '🚃'), h('span', { class: 'menu-label' }, 'ことば'), h('span', { class: 'menu-sub' }, 'むずかしい'))));

  function starRow(n, max = 10) {
    return h('div', { class: 'stars' }, ...Array.from({ length: max }, (_, i) => h('span', { class: i < n ? 'on' : '' }, '★')));
  }

  // 1もじ: きこえた もじを 3つから えらぶ
  screens.quizChar = () => {
    let score = 0;
    let answer = '';
    let locked = false;
    let last = '';
    const stars = h('div');
    const choices = h('div', { class: 'choices' });
    const speak = () => say(K.sayChar(answer), { rate: 0.7 });

    function next() {
      locked = false;
      const pool = [...K.BASIC].map(conv);
      do { answer = pick(pool); } while (answer === last);
      last = answer;
      const others = shuffle(pool.filter(c => c !== answer)).slice(0, 2);
      stars.replaceChildren(starRow(score));
      choices.replaceChildren(...shuffle([answer, ...others]).map(c => {
        const b = h('button', {
          class: 'choice',
          onclick: async () => {
            if (locked || b.disabled) return;
            if (c === answer) {
              locked = true;
              b.classList.add('right');
              ding();
              score++;
              stars.replaceChildren(starRow(score));
              await new Promise(r => setTimeout(r, 500));
              say(answer);
              if (score >= 10) { await celebrate('ぜんぶ できた！', 2200); score = 0; }
              else await new Promise(r => setTimeout(r, 900));
              next();
            } else {
              b.disabled = true;
              bump(b, 'shake');
              boo();
              setTimeout(speak, 500);
            }
          },
        }, c);
        return b;
      }));
      setTimeout(speak, 300);
    }
    next();
    return h('div', { class: 'screen screen-quizchar' },
      topbar('どの もじ かな？', stars),
      h('button', { class: 'btn-listen', onclick: speak }, '🔊', h('span', {}, 'もういちど')),
      choices);
  };

  // ことば: きこえた ことばを もじばんで うつ
  screens.quizWord = () => {
    let score = 0;
    let word = [];
    let pos = 0;
    let fails = 0;
    let last = '';
    const stars = h('div');
    const pic = h('button', { class: 'word-pic', onclick: () => speak() });
    const boxes = h('div', { class: 'word-boxes' });
    const speak = () => say(word.join(''), { rate: 0.7 });

    const board = makeBoard({
      onKey(ch) {
        if (pos >= word.length) return;
        if (ch === word[pos]) {
          board.clearHint();
          const box = boxes.children[pos];
          box.textContent = ch;
          box.classList.add('filled');
          bump(box, 'popin');
          say(K.sayChar(ch));
          pos++;
          fails = 0;
          if (pos >= word.length) done();
          else boxes.children[pos].classList.add('cur');
        } else {
          fails++;
          boo();
          bump(boxes.children[pos], 'shake');
          if (fails >= 2) board.highlight(word[pos]);
        }
      },
      extraKeys: [h('button', { class: 'key key-tool', onclick: () => next() }, 'つぎ ▶')],
    });

    async function done() {
      ding();
      score++;
      stars.replaceChildren(starRow(score, 5));
      await new Promise(r => setTimeout(r, 450));
      say(word.join(''), { rate: 0.75 });
      await new Promise(r => setTimeout(r, 1200));
      if (score >= 5) { await celebrate('すごい！ 5こ できた！', 2200); score = 0; }
      next();
    }

    function next() {
      board.clearHint();
      const list = K.words(state.kata).filter(([w]) => (state.easy ? K.isEasy(w) : true));
      let item;
      do { item = pick(list); } while (item[0] === last && list.length > 1);
      last = item[0];
      word = [...item[0]];
      pos = 0;
      fails = 0;
      pic.textContent = item[1];
      boxes.replaceChildren(...word.map((_, i) => h('div', { class: 'box' + (i === 0 ? ' cur' : '') })));
      stars.replaceChildren(starRow(score, 5));
      setTimeout(speak, 300);
    }
    next();

    return h('div', { class: 'screen screen-quizword' },
      topbar('きこえた ことばを うとう', stars),
      h('div', { class: 'word-row' }, pic, boxes, h('button', { class: 'btn-big btn-speak', onclick: speak }, '🔊')),
      board.el);
  };

  // ---------- かず あそび（たしざん・ひきざん） ----------
  const YOMI = ['ぜろ', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう', 'じゅう'];
  const THINGS = ['🍎', '🍓', '🐟', '⭐', '🚗', '🍬', '🐤', '🌷', '🍩', '🐞'];

  screens.mathMenu = () => {
    const item = (emoji, label, sub, color, arg) =>
      h('button', { class: 'menu-card', style: `--c:${color}`, onclick: () => go('math', arg) },
        h('span', { class: 'menu-emoji' }, emoji), h('span', { class: 'menu-label' }, label), h('span', { class: 'menu-sub' }, sub));
    return h('div', { class: 'screen screen-quizmenu' },
      topbar('かず あそび'),
      h('div', { class: 'menu' },
        item('➕', 'たしざん', '5まで', '#6bcb77', { op: '+', max: 5 }),
        item('➕', 'たしざん', '10まで', '#4d96ff', { op: '+', max: 10 }),
        item('➖', 'ひきざん', '5まで', '#ff8c42', { op: '-', max: 5 }),
        item('➖', 'ひきざん', '10まで', '#ff6b6b', { op: '-', max: 10 })));
  };

  // え（10マスに ならべた もの）を みて こたえの かずを おす。えを タップすると かぞえて くれる。
  screens.math = ({ op, max }) => {
    let score = 0;
    let a = 0, b = 0, answer = 0;
    let fails = 0;
    let locked = false;
    let last = '';
    let counted = 0;
    const stars = h('div');
    const eq = h('div', { class: 'math-eq' });
    const pad = h('div', { class: 'num-pad' });
    const sign = op === '+' ? 'たす' : 'ひく';
    const speak = () => say(`${YOMI[a]} ${sign} ${YOMI[b]} は？`, { rate: 0.75 });

    // 5こずつ ならべた かたまり。gone の ぶんは ひきざんで へる もの。
    function group(n, thing, gone = 0) {
      return h('div', { class: 'math-group' + (n > 5 ? ' ten' : '') },
        ...Array.from({ length: n > 5 ? 10 : 5 }, (_, i) => {
          if (i >= n) return h('span', { class: 'math-cell empty' });
          const cell = h('button', {
            class: 'math-cell' + (i >= n - gone ? ' gone' : ''),
            onclick: () => {
              if (cell.classList.contains('gone') || cell.dataset.n) return;
              counted++;
              cell.dataset.n = counted;
              say(YOMI[counted], { rate: 0.9 });
            },
          }, thing);
          return cell;
        }));
    }

    function next() {
      locked = false;
      fails = 0;
      counted = 0;
      let key;
      do {
        if (op === '+') { a = 1 + Math.floor(Math.random() * (max - 1)); b = 1 + Math.floor(Math.random() * (max - a)); answer = a + b; }
        else { a = 2 + Math.floor(Math.random() * (max - 1)); b = 1 + Math.floor(Math.random() * (a - 1)); answer = a - b; }
        key = `${a}${op}${b}`;
      } while (key === last);
      last = key;
      const thing = pick(THINGS);
      const ans = h('div', { class: 'math-ans' }, '?');
      eq.replaceChildren(
        h('div', { class: 'math-pics' },
          ...(op === '+'
            ? [group(a, thing), h('span', { class: 'math-op' }, '+'), group(b, thing)]
            : [group(a, thing, b)])),
        h('div', { class: 'math-line' },
          h('span', {}, a), h('span', { class: 'math-op' }, op === '+' ? '+' : '−'), h('span', {}, b),
          h('span', { class: 'math-op' }, '='), ans));
      // ひきざんは すこし まってから へる ぶんを けす
      if (op === '-') setTimeout(() => eq.querySelectorAll('.math-cell.gone').forEach(c => c.classList.add('out')), 700);

      pad.replaceChildren(...Array.from({ length: max + 1 }, (_, n) => {
        const btn = h('button', {
          class: 'num-key',
          onclick: async () => {
            if (locked || btn.disabled) return;
            if (n === answer) {
              locked = true;
              btn.classList.add('right');
              ans.textContent = n;
              ans.classList.add('filled');
              bump(ans, 'popin');
              ding();
              score++;
              stars.replaceChildren(starRow(score));
              await new Promise(r => setTimeout(r, 400));
              say(`${YOMI[a]} ${sign} ${YOMI[b]} は ${YOMI[answer]}`, { rate: 0.8 });
              await new Promise(r => setTimeout(r, 2200));
              if (score >= 10) { await celebrate('かずの めいじん！', 2200); score = 0; }
              next();
            } else {
              fails++;
              btn.disabled = true;
              bump(btn, 'shake');
              boo();
              if (fails >= 2) pad.children[answer].classList.add('hint');
            }
          },
        }, n);
        return btn;
      }));
      stars.replaceChildren(starRow(score));
      setTimeout(speak, 300);
    }
    next();

    return h('div', { class: 'screen screen-math' },
      topbar(op === '+' ? 'たしざん' : 'ひきざん', stars),
      h('div', { class: 'math-body' }, eq, h('button', { class: 'btn-big btn-speak', onclick: speak }, '🔊')),
      pad);
  };

  // ---------- かいて みよう ----------
  const writeOrder = () => [...(K.BASIC + K.DAKU)].map(conv);

  screens.pick = () => {
    let tab = 'basic';
    const grid = h('div', { class: 'board-grid pick-grid' });
    const tabs = h('div', { class: 'board-tabs' });
    function render() {
      const cols = tab === 'basic' ? K.BASIC_COLS : K.EXTRA_COLS.slice(0, 5);
      grid.style.setProperty('--cols', cols.length);
      grid.replaceChildren(...cols.flatMap((col, ci) => col.map((c, ri) => {
        const ch = conv(c);
        return h('button', {
          class: 'key' + (c ? '' : ' empty') + (ci % 2 ? ' alt' : '') + (state.written.has(ch) ? ' got' : ''),
          style: `grid-column:${cols.length - ci};grid-row:${ri + 1}`,
          disabled: !c,
          onclick: () => go('write', ch),
        }, ch);
      })));
      tabs.replaceChildren(
        h('button', { class: 'tab' + (tab === 'basic' ? ' on' : ''), onclick: () => { tab = 'basic'; render(); } }, conv('あいう')),
        h('button', { class: 'tab' + (tab === 'extra' ? ' on' : ''), onclick: () => { tab = 'extra'; render(); } }, conv('がぱ')));
    }
    render();
    return h('div', { class: 'screen screen-pick' }, topbar('どの もじを かく？'), h('div', { class: 'board' }, tabs, grid));
  };

  screens.write = ch => {
    const order = writeOrder();
    let guide = store.get('guide', true);
    const pad = h('div', { class: 'write-pad' });
    const info = h('div', { class: 'write-info' });
    const big = h('div', { class: 'write-big' }, ch);

    const writer = window.WRITE.createWriter(pad, ch, {
      guide,
      onStroke(r) { if (r === 'ok') pop(); else boo(); },
      async onDone() {
        state.written.add(ch);
        store.set('written', [...state.written]);
        say(ch);
        await celebrate('じょうずに かけたね！');
        info.replaceChildren(h('button', { class: 'btn-next', onclick: () => move(1) }, 'つぎの もじ ▶'));
      },
    });
    info.textContent = `${writer.strokeCount}かく`;

    const guideBtn = h('button', { class: 'tool', onclick: () => {
      guide = !guide;
      store.set('guide', guide);
      writer.setGuide(guide);
      guideBtn.lastChild.textContent = guide ? 'なぞる' : 'みないで';
    } }, h('span', {}, '✋'), h('span', {}, guide ? 'なぞる' : 'みないで'));

    function move(d) {
      const i = order.indexOf(ch);
      history.replaceState({ name: 'write', arg: order[(i + d + order.length) % order.length] }, '');
      go('write', order[(i + d + order.length) % order.length], false);
    }

    setTimeout(() => say(ch), 200);
    return h('div', { class: 'screen screen-write' },
      topbar('かいて みよう'),
      h('div', { class: 'write-body' },
        h('button', { class: 'nav-arrow', onclick: () => move(-1) }, '◀'),
        pad,
        h('div', { class: 'write-side' },
          big,
          info,
          h('div', { class: 'tools' },
            h('button', { class: 'tool', onclick: () => say(ch) }, h('span', {}, '🔊'), h('span', {}, 'きく')),
            h('button', { class: 'tool', onclick: () => writer.demo() }, h('span', {}, '👀'), h('span', {}, 'おてほん')),
            guideBtn,
            h('button', { class: 'tool', onclick: () => { writer.reset(); info.textContent = `${writer.strokeCount}かく`; } }, h('span', {}, '↺'), h('span', {}, 'もういちど')))),
        h('button', { class: 'nav-arrow', onclick: () => move(1) }, '▶')));
  };

  // ---------- はじめる ----------
  history.replaceState({ name: 'home' }, '');
  go('home', null, false);

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
