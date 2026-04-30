(() => {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const container = document.querySelector('.particles');
  if (!container) return;

  const els = Array.from(container.querySelectorAll('.particle'));
  if (!els.length) return;

  let W = container.offsetWidth;
  let H = container.offsetHeight;

  const particles = els.map((el, i) => {
    const leftPct = parseFloat(el.style.left) / 100;
    const topPct  = parseFloat(el.style.top)  / 100;
    el.style.animation = 'none';
    const isBacteria = (i % 2 === 1);
    return {
      el,
      isBacteria,
      x: leftPct * W,
      y: topPct  * H,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      wander: Math.random() * Math.PI * 2,
      angle: Math.random() * 360,
      baseOpacity: 0.15 + Math.random() * 0.1,
    };
  });

  particles.forEach(p => {
    p.el.style.left    = p.x + 'px';
    p.el.style.top     = p.y + 'px';
    p.el.style.opacity = p.baseOpacity;
  });

  window.addEventListener('resize', () => {
    W = container.offsetWidth;
    H = container.offsetHeight;
  });

  const mouse = { x: -9999, y: -9999 };
  let clickImpulse = null;

  window.addEventListener('mousemove', e => {
    const r = container.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });

  window.addEventListener('mouseleave', () => {
    mouse.x = -9999;
    mouse.y = -9999;
  });

  window.addEventListener('click', e => {
    const r = container.getBoundingClientRect();
    const ix = e.clientX - r.left;
    const iy = e.clientY - r.top;
    clickImpulse = { x: ix, y: iy };

    const ripple = document.createElement('div');
    ripple.className = 'particle-ripple';
    ripple.style.left = ix + 'px';
    ripple.style.top  = iy + 'px';
    container.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  });

  const HOVER_R  = 80;
  const CLICK_R  = 150;
  const WANDER   = 0.018;
  const DAMP     = 0.985;
  const MAX_V    = 0.3;
  const MAX_FLEE = 4;

  function frame() {
    particles.forEach(p => {
      const hx = p.x - mouse.x;
      const hy = p.y - mouse.y;
      const hd = Math.sqrt(hx * hx + hy * hy) || 1;
      const near = hd < HOVER_R;

      // Hover repulsion
      if (near) {
        const f = ((HOVER_R - hd) / HOVER_R) * 0.5;
        p.vx += (hx / hd) * f;
        p.vy += (hy / hd) * f;
        p.el.style.opacity = Math.min(0.35, p.baseOpacity + 0.12);
      } else {
        p.el.style.opacity = p.baseOpacity;
      }

      // Click impulse
      if (clickImpulse) {
        const cx = p.x - clickImpulse.x;
        const cy = p.y - clickImpulse.y;
        const cd = Math.sqrt(cx * cx + cy * cy) || 1;
        if (cd < CLICK_R) {
          const f = ((CLICK_R - cd) / CLICK_R) * 3;
          p.vx += (cx / cd) * f;
          p.vy += (cy / cd) * f;
        }
      }

      // Wander: slowly steer in a shifting direction
      p.wander += (Math.random() - 0.5) * 0.22;
      p.vx += Math.cos(p.wander) * WANDER;
      p.vy += Math.sin(p.wander) * WANDER;

      // Damping
      p.vx *= DAMP;
      p.vy *= DAMP;

      // Speed cap
      const maxV = near ? MAX_FLEE : MAX_V;
      const spd  = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (spd > maxV) {
        p.vx = (p.vx / spd) * maxV;
        p.vy = (p.vy / spd) * maxV;
      }

      p.x += p.vx;
      p.y += p.vy;

      // Wrap around edges
      const pad = 52;
      if      (p.x < -pad)  p.x = W + pad;
      else if (p.x > W+pad) p.x = -pad;
      if      (p.y < -pad)  p.y = H + pad;
      else if (p.y > H+pad) p.y = -pad;

      p.el.style.left = p.x + 'px';
      p.el.style.top  = p.y + 'px';

      // Bacteria tumble with movement direction; virus stays upright
      if (p.isBacteria && spd > 0.05) {
        const targetAngle = Math.atan2(p.vy, p.vx) * (180 / Math.PI) + 90;
        p.angle += (targetAngle - p.angle) * 0.04;
        p.el.style.transform = `rotate(${p.angle}deg)`;
      }
    });

    clickImpulse = null;
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
