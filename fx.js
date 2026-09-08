// Visual effects. Same art rules as everything else: solid shapes, thick dark
// outlines, no blurs and no glows -- impact comes from timing and scale, not from
// soft light.
//
// Anything anchored to a card or a seat is measured from the viewport and dropped
// into #fxLayer. Effects that have to outlive the match screen (reward flights on
// the results panel) go on <body> instead.

const FX = (() => {
  const layer = () => document.getElementById('fxLayer');
  const rnd = (a, b) => a + Math.random() * (b - a);

  function add(node, life, host) {
    (host || layer()).appendChild(node);
    setTimeout(() => node.remove(), life);
    return node;
  }

  function div(cls, style) {
    const n = document.createElement('div');
    n.className = cls;
    if (style) Object.assign(n.style, style);
    return n;
  }

  // Centre of any element, in viewport coordinates.
  function centreOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  }

  const api = {
    centreOf,

    // Expanding outline ring -- the workhorse impact effect.
    ring(x, y, { size = 220, color = '#ffc93c', life = 520, thick = 7 } = {}) {
      const n = div('fx-ring', {
        left: x + 'px', top: y + 'px',
        width: size + 'px', height: size + 'px',
        borderColor: color, borderWidth: thick + 'px',
        animationDuration: life + 'ms',
      });
      return add(n, life + 60);
    },

    // Chunky spikes thrown out from a point. Reads as force without any glow.
    burst(x, y, { n = 10, color = '#ffc93c', dist = 120, life = 560, size = 16 } = {}) {
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + rnd(-0.18, 0.18);
        const d = dist * rnd(0.7, 1.25);
        const s = div('fx-spike', {
          left: x + 'px', top: y + 'px',
          width: size + 'px', height: size * 1.9 + 'px',
          background: color,
          animationDuration: life + 'ms',
          animationDelay: rnd(0, 90) + 'ms',
        });
        s.style.setProperty('--a', (a * 180 / Math.PI + 90) + 'deg');
        s.style.setProperty('--dx', Math.cos(a) * d + 'px');
        s.style.setProperty('--dy', Math.sin(a) * d + 'px');
        add(s, life + 160);
      }
    },

    // Dust kicked up where a card lands.
    dust(x, y, { n = 7, color = 'rgba(255,255,255,0.75)', life = 480 } = {}) {
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1;
        const p = div('fx-dust', {
          left: x + 'px', top: y + 'px',
          width: rnd(8, 17) + 'px', height: rnd(8, 17) + 'px',
          background: color,
          animationDuration: life + 'ms',
          animationDelay: rnd(0, 70) + 'ms',
        });
        p.style.setProperty('--dx', side * rnd(24, 74) + 'px');
        p.style.setProperty('--dy', rnd(-26, -6) + 'px');
        add(p, life + 120);
      }
    },

    // Confetti squares raining from a point.
    confetti(x, y, { n = 22, life = 1100 } = {}) {
      const cols = ['#ffd447', '#ff5d73', '#4fd1ff', '#8affc1', '#c78bff', '#ffffff'];
      for (let i = 0; i < n; i++) {
        const c = div('fx-confetti', {
          left: x + 'px', top: y + 'px',
          width: rnd(7, 13) + 'px', height: rnd(9, 16) + 'px',
          background: cols[(Math.random() * cols.length) | 0],
          animationDuration: life * rnd(0.7, 1.3) + 'ms',
          animationDelay: rnd(0, 140) + 'ms',
        });
        c.style.setProperty('--dx', rnd(-150, 150) + 'px');
        c.style.setProperty('--dy', rnd(90, 230) + 'px');
        c.style.setProperty('--rot', rnd(-540, 540) + 'deg');
        add(c, life * 1.4 + 200);
      }
    },

    // Text that pops up and floats away. Used for scores, misses, peeks.
    floatText(x, y, text, tone = 'gold') {
      const n = div('fx-float fx-float-' + tone, { left: x + 'px', top: y + 'px' });
      n.textContent = text;
      return add(n, 1100);
    },

    // Stamped over a card that cancelled out.
    stamp(el, text = '✕', tone = 'bad') {
      const c = centreOf(el);
      const n = div('fx-stamp fx-stamp-' + tone, { left: c.x + 'px', top: c.y + 'px' });
      n.textContent = text;
      return add(n, 900);
    },

    // Crown drops onto whoever took the round.
    crown(el) {
      const r = el.getBoundingClientRect();
      const n = div('fx-crown', { left: (r.left + r.width / 2) + 'px', top: r.top + 'px' });
      n.textContent = '👑';
      return add(n, 1200);
    },

    // Streaks in from the screen edges. Saved for the big moments.
    speedLines(color = '#ffffff') {
      const host = layer();
      if (!host) return;
      for (let i = 0; i < 14; i++) {
        const fromLeft = i % 2 === 0;
        const n = div('fx-speed', {
          top: rnd(0, 100) + '%',
          [fromLeft ? 'left' : 'right']: '0',
          width: rnd(60, 190) + 'px',
          background: color,
          animationDelay: rnd(0, 140) + 'ms',
        });
        n.style.setProperty('--dir', fromLeft ? '1' : '-1');
        add(n, 620);
      }
    },

    // A number or icon flying from one point to another -- rewards heading for the
    // top bar, a prize card heading for a player.
    fly(fromX, fromY, toX, toY, content, { life = 620, cls = '', host = document.body } = {}) {
      const n = div('fx-fly ' + cls, { left: fromX + 'px', top: fromY + 'px' });
      n.textContent = content;
      n.style.setProperty('--dx', (toX - fromX) + 'px');
      n.style.setProperty('--dy', (toY - fromY) + 'px');
      n.style.animationDuration = life + 'ms';
      return add(n, life + 80, host);
    },

    // Coins arcing up to the coin counter after a match.
    rewardRain(targetEl, icon, count) {
      if (!targetEl) return;
      const t = centreOf(targetEl);
      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          const sx = innerWidth / 2 + rnd(-90, 90);
          const sy = innerHeight * 0.55 + rnd(-30, 30);
          FX.fly(sx, sy, t.x, t.y, icon, { life: 600, cls: 'fx-fly-coin' });
          if (window.SFX) SFX.coin();
        }, i * 90);
      }
    },
  };

  return api;
})();
