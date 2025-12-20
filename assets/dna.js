(() => {
  const canvas = document.getElementById("dna-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true });

  // Respect reduced motion
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

  // Device pixel ratio for crisp rendering
  const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  function resize() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * DPR);
    canvas.height = Math.floor(rect.height * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); // draw in CSS pixels
  }

  window.addEventListener("resize", resize, { passive: true });
  resize();

  // ===== TUNING =====
  // Position DNA on the left
  function getParams() {
    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().height;

    return {
        cx: Math.max(140, w * 0.16),        // left placement
        cy: h * 0.52,

        radius: Math.min(70, w * 0.055),    // THIN DNA
        height: Math.min(h * 0.98, 1400),   // LONG DNA
        turns: 6.2,                         // MORE LOOPS

        rungEvery: 12,
        points: 520,

        drift: reduceMotion ? 0 : 8,
        speed: reduceMotion ? 0 : 0.65
    };
  }


  // Particles for "sparkly" look
  const sparkleCount = 180;
  const sparkles = Array.from({ length: sparkleCount }, () => ({
    t: Math.random(),                // normalized 0..1 along helix
    lane: Math.random() < 0.5 ? 0 : 1,
    jitter: Math.random() * 2.5,
    size: 1 + Math.random() * 1.8,
    alpha: 0.15 + Math.random() * 0.35,
    phase: Math.random() * Math.PI * 2
  }));

  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  function clear(w, h) {
    ctx.clearRect(0, 0, w, h);
  }

  function drawGlowDot(x, y, r, a, hueShift = 0) {
    // Soft glow using shadow
    ctx.save();
    ctx.globalAlpha = a;

    // Subtle cyan/purple-ish tint (no hard-coded palette required, but we keep it gentle)
    ctx.fillStyle = `rgba(165, 180, 252, ${a})`;
    ctx.shadowBlur = 12;
    ctx.shadowColor = `rgba(125, 211, 252, ${a * 0.9})`;

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Main animation
  let last = performance.now();
  let time = 0;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    clear(w, h);

    const p = getParams();

    // Background fade for softer look (optional)
    // ctx.fillStyle = "rgba(255,255,255,0.00)";
    // ctx.fillRect(0, 0, w, h);

    // Twisting phase
    time += dt * p.speed;

    // Helix coordinate mapping
    // u in [0,1] -> y from top..bottom
    const topY = p.cy - p.height / 2;
    const botY = p.cy + p.height / 2;

    // Gentle drift to feel alive
    const driftX = reduceMotion ? 0 : Math.sin(time * 0.7) * p.drift;
    const driftY = reduceMotion ? 0 : Math.cos(time * 0.5) * (p.drift * 0.7);

    // Helper: returns point for strand A/B at normalized u
    function strandPoint(u, strand /*0/1*/) {
      const y = topY + u * (botY - topY);

      // Angle increases with u (turns) + time (twist)
      const angle = u * (Math.PI * 2 * p.turns) + time;

      // Strand B is phase-shifted by PI
      const ang = strand === 0 ? angle : angle + Math.PI;

      // "3D depth" illusion: z based on cos, then scale radius a bit
      const z = Math.cos(ang); // -1..1 (front/back)
      const r = p.radius * (0.78 + 0.22 * (z + 1) / 2); // slightly larger when front

      const x = p.cx + driftX + Math.sin(ang) * r;
      const y2 = y + driftY;

      // alpha stronger when front
      const a = 0.10 + 0.35 * ((z + 1) / 2);

      return { x, y: y2, z, a };
    }

    // Draw rungs (base pairs) with depth fade
    ctx.save();
    ctx.lineCap = "round";
    for (let i = 0; i <= p.points; i += p.rungEvery) {
      const u = i / p.points;

      const a = strandPoint(u, 0);
      const b = strandPoint(u, 1);

      // Use depth to fade rungs: stronger when front-most strand is front
      const depth = (a.z + b.z) / 2; // -1..1
      const rungAlpha = 0.05 + 0.20 * ((depth + 1) / 2);

      ctx.globalAlpha = rungAlpha;
      ctx.strokeStyle = "rgba(99, 102, 241, 1)";
      ctx.lineWidth = 2.2;

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();

    // Draw strands as dotted glow points (sample along u)
    for (let i = 0; i <= p.points; i++) {
      const u = i / p.points;

      const A = strandPoint(u, 0);
      const B = strandPoint(u, 1);

      // Dot size: slightly larger when in front
      const rA = 1.2 + 1.5 * ((A.z + 1) / 2);
      const rB = 1.2 + 1.5 * ((B.z + 1) / 2);

      drawGlowDot(A.x, A.y, rA, A.a);
      drawGlowDot(B.x, B.y, rB, B.a);
    }

    // Extra sparkles that travel along strands (particle feel)
    if (!reduceMotion) {
      for (const s of sparkles) {
        // move along helix
        s.t += dt * (0.03 + 0.02 * Math.sin(s.phase + time));
        if (s.t > 1) s.t -= 1;

        const u = clamp01(s.t);
        const P = strandPoint(u, s.lane);

        // jitter around the strand
        const jx = (Math.random() - 0.5) * s.jitter;
        const jy = (Math.random() - 0.5) * s.jitter;

        const frontBoost = (P.z + 1) / 2; // 0..1
        const a = (0.08 + s.alpha * 0.5) * (0.35 + 0.65 * frontBoost);

        drawGlowDot(P.x + jx, P.y + jy, s.size, a);
      }
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
