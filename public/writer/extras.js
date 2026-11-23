/* Scribe extras: animated favicon + offline support (vanilla, device-only). */

/* Browser fullscreen stays independent of distraction-free focus mode. */
(function () {
  const app = document.getElementById('app');
  const enter = document.getElementById('fullscreenBtn');
  const exit = document.getElementById('fullscreenExit');
  const root = document.documentElement;
  if (!app || !enter || !exit) return;
  const supported = Boolean(
    (document.fullscreenEnabled && root.requestFullscreen) ||
    (document.webkitFullscreenEnabled && root.webkitRequestFullscreen)
  );
  const active = () => Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  function sync() {
    const on = active();
    app.classList.toggle('browser-fullscreen', on);
    enter.setAttribute('aria-pressed', String(on));
    enter.setAttribute('aria-label', on ? 'Exit fullscreen' : 'Enter fullscreen');
    enter.title = supported ? (on ? 'Exit fullscreen' : 'Fullscreen (Ctrl+Shift+Enter)') : 'Fullscreen unavailable in this browser';
    enter.disabled = !supported;
  }
  async function toggle() {
    if (!supported) return;
    try {
      // Invoke directly within the click/keypress to preserve browser user activation.
      if (active()) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
      } else if (root.requestFullscreen) {
        await root.requestFullscreen();
      } else if (root.webkitRequestFullscreen) {
        await root.webkitRequestFullscreen();
      }
    } catch (_) {
      const status = document.getElementById('saveStatus');
      if (status) status.textContent = 'Fullscreen was blocked by your browser.';
    }
    sync();
  }
  enter.addEventListener('click', toggle);
  exit.addEventListener('click', toggle);
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'Enter' && supported) {
      event.preventDefault();
      toggle();
    }
  });
  sync();
})();

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

/* Toolbar up/down + floating top-bar menus */
(function () {
  const app = document.querySelector('.app'), btn = document.getElementById('tbPosBtn');
  const KEY = 'writer_toolbar_pos';
  function apply(bottom) {
    app.classList.toggle('toolbar-bottom', bottom);
    btn.setAttribute('aria-pressed', String(bottom));
    btn.setAttribute('aria-label', bottom ? 'Move toolbar to top' : 'Move toolbar to bottom');
  }
  let saved = null; try { saved = localStorage.getItem(KEY); } catch (_) {}
  apply(saved ? saved === 'bottom' : window.matchMedia('(max-width: 640px)').matches);
  btn.addEventListener('click', () => {
    const b = !app.classList.contains('toolbar-bottom'); apply(b);
    try { localStorage.setItem(KEY, b ? 'bottom' : 'top'); } catch (_) {}
  });

  function place(menu, trigger) {
    if (!menu.classList.contains('open')) return;
    menu.classList.add('floating');
    const r = trigger.getBoundingClientRect(), w = menu.offsetWidth || 200;
    menu.style.top = (r.bottom + 6) + 'px';
    menu.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)) + 'px';
    menu.style.right = 'auto';
  }
  [['themeBtn', 'themeMenu'], ['saveMenuBtn', 'saveMenu']].forEach(([b, m]) => {
    const t = document.getElementById(b), menu = document.getElementById(m);
    if (t && menu) t.addEventListener('click', () => requestAnimationFrame(() => place(menu, t)));
  });
})();
