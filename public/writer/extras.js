/* Writer extras: animated favicon + offline support (vanilla, device-only). */
(function () {
  'use strict';

  // ---- Animated favicon ----
  // Glows while you type, pulses a red dot while dictating, ripples while reading aloud.
  const link = document.getElementById('favicon');
  const base = new Image();
  base.src = './icons/favicon-64.png';
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  let typingUntil = 0, frame = 0, wasActive = false;
  const paper = document.getElementById('paper') || document.querySelector('[contenteditable="true"]');
  if (paper) paper.addEventListener('input', () => { typingUntil = Date.now() + 1200; });
  const isOn = id => { const b = document.getElementById(id); return !!(b && b.classList.contains('listening')); };

  function draw() {
    const mic = isOn('micBtn'), speak = isOn('speakBtn'), typing = Date.now() < typingUntil;
    const active = mic || speak || typing;
    if (!active) {
      if (wasActive) { link.href = './icons/favicon-64.png'; wasActive = false; }
      return;
    }
    wasActive = true; frame++;
    const t = frame / 8;
    ctx.clearRect(0, 0, 64, 64);
    if (typing && !mic && !speak) { ctx.shadowColor = 'rgba(120,200,255,.9)'; ctx.shadowBlur = 6 + 6 * Math.abs(Math.sin(t)); }
    ctx.drawImage(base, 0, 0, 64, 64); ctx.shadowBlur = 0;
    if (mic) {
      const r = 9 + 3 * Math.sin(t * 1.5);
      ctx.fillStyle = 'rgba(255,70,90,.35)'; ctx.beginPath(); ctx.arc(50, 14, r + 4, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff4a5f'; ctx.beginPath(); ctx.arc(50, 14, 8, 0, 7); ctx.fill();
    }
    if (speak) {
      for (let i = 0; i < 3; i++) {
        const p = ((t / 3) + i / 3) % 1;
        ctx.strokeStyle = 'rgba(150,210,255,' + (1 - p) + ')'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(32, 32, 10 + p * 22, 0, 7); ctx.stroke();
      }
    }
    try { link.href = cv.toDataURL('image/png'); } catch (_) {}
  }
  if (link) setInterval(draw, 120);

  // ---- Offline support ----
  // Never in previews, iframes or local dev, so stale copies can't haunt editing.
  if (!('serviceWorker' in navigator)) return;
  const host = location.hostname.toLowerCase();
  const swOff = new URLSearchParams(location.search).has('sw') && new URLSearchParams(location.search).get('sw') === 'off';
  let inFrame = false; try { inFrame = window.self !== window.top; } catch (_) { inFrame = true; }
  const isPreview =
    inFrame || swOff || host === 'localhost' || host === '127.0.0.1' ||
    /\.(lovable\.app|gpt-eng\.com|gptengineer\.run)$/.test(host) && /^(?:id-preview|preview)(?:-[a-z0-9]+)?--/.test(host) ||
    /^project--.+-dev\./.test(host) ||
    /(^|\.)lovableproject(-dev)?\.com$/.test(host) || /(^|\.)beta\.lovable\.dev$/.test(host);
  const swUrl = new URL('./sw.js', location.href).href;
  if (isPreview) {
    navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => {
      const w = r.active || r.waiting || r.installing;
      if (w && w.scriptURL === swUrl) r.unregister();
    })).catch(() => {});
    return;
  }
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
})();
