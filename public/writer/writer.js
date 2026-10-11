
(function () {
  // Feature block marker (find/replace, focus, docs) is defined before init below.
  'use strict';

  // --- DOM refs ---
  const app = document.getElementById('app');
  const paper = document.getElementById('paper');
  const docTitle = document.getElementById('docTitle');
  const pageScroll = document.getElementById('pageScroll');

  const styleBtn = document.getElementById('styleBtn');
  const styleMenu = document.getElementById('styleMenu');
  const styleLabel = document.getElementById('styleLabel');

  const saveMenuBtn = document.getElementById('saveMenuBtn');
  const saveMenu = document.getElementById('saveMenu');
  const themeBtn = document.getElementById('themeBtn');
  const themeMenu = document.getElementById('themeMenu');

  const wordCountEl = document.getElementById('wordCount');
  const charCountEl = document.getElementById('charCount');
  const saveStatusEl = document.getElementById('saveStatus');

  const linkModal = document.getElementById('linkModal');
  const imageModal = document.getElementById('imageModal');
  const tableModal = document.getElementById('tableModal');

  // --- Storage ---
  const STORAGE_KEY = 'writer_doc_v1'; // legacy single-doc key (migrated)
  const DOCS_KEY = 'writer_docs_v1';
  const CURRENT_KEY = 'writer_current_v1';
  const THEME_KEY = 'writer_theme_v1';

  let saveTimeout = null;
  let lastRange = null;

  // --- Theme ---
  const THEMES = ['theme-dark','theme-light','theme-pink','theme-sky','theme-emerald'];
  function setTheme(t) {
    THEMES.forEach(x => app.classList.remove(x));
    app.classList.add(t);
    document.body.className = t;
    try { localStorage.setItem(THEME_KEY, t); } catch (_) {}
  }
  function loadTheme() {
    let saved; try { saved = localStorage.getItem(THEME_KEY); } catch (_) {}
    if (saved && THEMES.includes(saved)) setTheme(saved);
    else setTheme('theme-dark');
  }

  // --- Load / save docs (multi-document, device-only) ---
  function getDocs() {
    try { return JSON.parse(localStorage.getItem(DOCS_KEY)) || {}; } catch (_) { return {}; }
  }
  function setDocs(d) {
    localStorage.setItem(DOCS_KEY, JSON.stringify(d));
  }
  let currentId = null;
  try { currentId = localStorage.getItem(CURRENT_KEY); } catch (_) {}

  // Migrate the old single-document save, if any.
  try {
    const legacy = localStorage.getItem(STORAGE_KEY);
    if (legacy) {
      const data = JSON.parse(legacy);
      const docs = getDocs();
      const id = 'doc-' + Date.now();
      docs[id] = { title: data.title || 'Untitled document', html: data.html || '', savedAt: data.savedAt || Date.now() };
      setDocs(docs);
      currentId = id;
      localStorage.setItem(CURRENT_KEY, id);
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (_) {}

  function ensureCurrentDoc() {
    const docs = getDocs();
    if (currentId && docs[currentId]) return;
    const ids = Object.keys(docs);
    if (ids.length) {
      currentId = ids.sort((a, b) => (docs[b].savedAt || 0) - (docs[a].savedAt || 0))[0];
    } else {
      currentId = 'doc-' + Date.now();
      docs[currentId] = { title: 'Untitled document', html: '', savedAt: Date.now() };
      setDocs(docs);
    }
    try { localStorage.setItem(CURRENT_KEY, currentId); } catch (_) {}
  }

  function renderDocList() {
    const docs = getDocs();
    const select = document.getElementById('docSelect');
    select.innerHTML = '';
    Object.keys(docs)
      .sort((a, b) => (docs[b].savedAt || 0) - (docs[a].savedAt || 0))
      .forEach(id => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = docs[id].title || 'Untitled document';
        select.appendChild(opt);
      });
    select.value = currentId;
  }

  function loadDoc() {
    ensureCurrentDoc();
    const docs = getDocs();
    const data = docs[currentId] || { title: 'Untitled document', html: '' };
    paper.innerHTML = sanitizeHtml(data.html || '', true);
    docTitle.value = data.title || 'Untitled document';
    renderDocList();
  }

  function saveDoc() {
    try {
      const docs = getDocs();
      docs[currentId] = { html: paper.innerHTML, title: docTitle.value, savedAt: Date.now() };
      setDocs(docs);
      setStatus('Saved');
    } catch (e) {
      setStatus('Storage full');
    }
  }

  function switchDoc(id) {
    if (id === currentId) return;
    saveDoc();
    currentId = id;
    try { localStorage.setItem(CURRENT_KEY, id); } catch (_) {}
    history = []; historyIndex = -1; lastRange = null;
    loadDoc();
    record(); refreshPlaceholder(); updateCounts(); updateToolbarState();
    setStatus('Saved on this device');
  }

  function setStatus(t) {
    saveStatusEl.textContent = t;
  }

  function scheduleSave() {
    record(); refreshPlaceholder(); updateCounts(); saveSelection();
    if (saveTimeout) clearTimeout(saveTimeout);
    setStatus('Saving…');
    saveTimeout = setTimeout(saveDoc, 500);
  }

  // --- Word / char count ---
  function updateCounts() {
    const text = paper.innerText || '';
    const chars = text.replace(/\s/g, '').length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    wordCountEl.textContent = words + (words === 1 ? ' word' : ' words');
    charCountEl.textContent = chars + (chars === 1 ? ' character' : ' characters');
    const mins = Math.ceil(words / 200);
    document.getElementById('readTime').textContent = words ? mins + (mins === 1 ? ' min read' : ' min read') : '0 min read';
  }

  // --- Selection preservation (important for toolbar clicks) ---
  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const r = sel.getRangeAt(0);
      if (paper.contains(r.commonAncestorContainer)) lastRange = r.cloneRange();
    }
  }
  function restoreSelection() {
    const sel = window.getSelection();
    if (!sel) return;
    if (!lastRange || !paper.contains(lastRange.commonAncestorContainer)) { lastRange = document.createRange(); lastRange.selectNodeContents(paper); lastRange.collapse(false); }
    sel.removeAllRanges(); sel.addRange(lastRange);
  }

  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const r = sel.getRangeAt(0);
      if (paper.contains(r.commonAncestorContainer)) lastRange = r.cloneRange();
    }
    updateToolbarState();
  });

  // --- execCommand helper ---
  function exec(cmd, val) {
    paper.focus();
    restoreSelection();
    document.execCommand(cmd, false, val || null);
    saveSelection();
    updateToolbarState();
    changed();
  }

  // --- Toolbar active state ---
  function updateToolbarState() {
    document.querySelectorAll('.tool[data-cmd]').forEach(btn => {
      const cmd = btn.dataset.cmd;
      let on = false;
      try { on = document.queryCommandState(cmd); } catch (_) {}
      if (cmd === 'removeFormat') on = false;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
    });

    // Block label
    let block = 'p';
    try {
      const b = (document.queryCommandValue('formatBlock') || '').toLowerCase();
      if (b === 'h1' || b === 'h2' || b === 'h3' || b === 'blockquote') block = b;
    } catch (_) {}
    const labels = { h1: 'Title', h2: 'Heading', h3: 'Subheading', p: 'Normal text', blockquote: 'Quote' };
    styleLabel.textContent = labels[block] || 'Normal text';
  }

  // --- Wire toolbar commands ---
  document.querySelectorAll('.tool[data-cmd]').forEach(btn => {
    btn.addEventListener('mousedown', e => e.preventDefault()); // keep selection
    btn.addEventListener('click', () => exec(btn.dataset.cmd));
  });

  // --- Style picker ---
  styleBtn.addEventListener('mousedown', e => e.preventDefault());
  styleBtn.addEventListener('click', e => {
    e.stopPropagation();
    const open = styleMenu.classList.contains('open');
    closeAllMenus();
    if (!open) styleMenu.classList.add('open');
  });
  styleMenu.querySelectorAll('button').forEach(b => {
    b.addEventListener('mousedown', e => e.preventDefault());
    b.addEventListener('click', () => {
      const tag = b.dataset.block;
      exec('formatBlock', '<' + tag + '>');
      styleMenu.classList.remove('open');
    });
  });

  // --- Checklists ---
  document.getElementById('checklistBtn').addEventListener('mousedown', e => e.preventDefault());
  document.getElementById('checklistBtn').addEventListener('click', () => {
    paper.focus();
    restoreSelection();

    // Wrap current line(s) in a checklist
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    let node = range.startContainer;
    while (node && node !== paper && node.nodeName !== 'DIV' && node.nodeName !== 'P' && node.nodeName !== 'LI') {
      node = node.parentNode;
    }
    if (!node || node === paper) {
      // insert fresh checklist
      const ul = document.createElement('ul');
      ul.className = 'checklist';
      const li = document.createElement('li');
        li.innerHTML = '<input type="checkbox" contenteditable="false" tabindex="0" aria-label="Complete task"><span><br></span>';
      ul.appendChild(li);
      range.insertNode(ul);
      // place caret inside span
      const span = li.querySelector('span');
      const r2 = document.createRange();
      r2.setStart(span, 0);
      r2.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r2);
    } else {
      // toggle: turn into checklist item if not already
      const isChecklist = node.closest && node.closest('.checklist');
      if (!isChecklist) {
        const ul = document.createElement('ul');
        ul.className = 'checklist';
        const li = document.createElement('li');
        li.innerHTML = '<input type="checkbox" contenteditable="false" tabindex="0" aria-label="Complete task"><span>' + node.innerHTML + '</span>';
        node.parentNode.replaceChild(ul, node);
        ul.appendChild(li);
        placeCaret(li.querySelector('span'), true);
      } else {
        const ul = node.closest('.checklist');
        Array.from(ul.children).forEach(li => {
          const paragraph = document.createElement('p');
          paragraph.innerHTML = li.querySelector('span')?.innerHTML || '<br>';
          ul.before(paragraph);
          if (li === node) placeCaret(paragraph, true);
        });
        ul.remove();
      }
    }
    scheduleSave();
  });

  // Checkbox clicks should toggle without editing
  paper.addEventListener('click', e => {
    if (e.target.matches('.checklist input[type="checkbox"]')) {
      e.target.toggleAttribute('checked', e.target.checked);
      changed();
    }
  });

  // --- Link ---
  document.getElementById('linkBtn').addEventListener('mousedown', e => e.preventDefault());
  document.getElementById('linkBtn').addEventListener('click', () => {
    const sel = window.getSelection();
    const selText = sel && sel.toString();
    document.getElementById('linkText').value = selText || '';
    document.getElementById('linkUrl').value = '';
    openModal('linkModal');
    setTimeout(() => document.getElementById('linkUrl').focus(), 60);
  });
  document.getElementById('linkConfirm').addEventListener('click', () => {
    const text = document.getElementById('linkText').value.trim();
    const url = document.getElementById('linkUrl').value.trim();
    if (!url) { modalError(linkModal, 'Enter a web address.'); return; }
    paper.focus();
    restoreSelection();
    const linkAddress = safeUrl(/^[a-z]+:/i.test(url) ? url : 'https://' + url);
    if (!linkAddress) { modalError(linkModal, 'Use an https, http, mailto, or tel address.'); return; }
    if (text) {
      document.execCommand('insertHTML', false,
        '<a href="' + escapeAttr(linkAddress) + '" target="_blank" rel="noopener">' + escapeHtml(text) + '</a>');
    } else {
      document.execCommand('createLink', false, linkAddress);
    }
    closeModal('linkModal');
    scheduleSave();
  });

  // --- Image ---
  document.getElementById('imageBtn').addEventListener('mousedown', e => e.preventDefault());
  document.getElementById('imageBtn').addEventListener('click', () => {
    document.getElementById('imageUrl').value = '';
    document.getElementById('imageFile').value = '';
    openModal('imageModal');
  });
  document.getElementById('imageConfirm').addEventListener('click', () => {
    const url = document.getElementById('imageUrl').value.trim();
    const file = document.getElementById('imageFile').files[0];
    if (file) {
      if (!/^image\/(png|jpeg|gif|webp|avif)$/.test(file.type) || file.size > 3 * 1024 * 1024) { modalError(imageModal, 'Choose a PNG, JPEG, GIF, WebP, or AVIF under 3 MB.'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        insertImage(reader.result);
        closeModal('imageModal');
      };
      reader.onerror = () => modalError(imageModal, 'The image could not be read.');
      reader.readAsDataURL(file);
    } else if (url) {
      if (!safeUrl(url, true)) { modalError(imageModal, 'Enter a valid http or https image address.'); return; }
      insertImage(url);
      closeModal('imageModal');
    } else {
      closeModal('imageModal');
    }
  });
  function insertImage(src) {
    paper.focus();
    restoreSelection();
    document.execCommand('insertHTML', false,
      '<img src="' + escapeAttr(src) + '" alt=""><p><br></p>');
    scheduleSave();
  }

  // --- Table ---
  document.getElementById('tableBtn').addEventListener('mousedown', e => e.preventDefault());
  document.getElementById('tableBtn').addEventListener('click', () => {
    buildTableGrid();
    openModal('tableModal');
  });

  let tableHover = { r: 1, c: 1 };
  function buildTableGrid() {
    const grid = document.getElementById('tableGrid');
    grid.innerHTML = '';
    tableHover = { r: 1, c: 1 };
    const label = document.getElementById('tableGridLabel');
    label.textContent = '1 × 1';
    const cells = [];
    for (let r = 1; r <= 8; r++) {
      for (let c = 1; c <= 8; c++) {
        const d = document.createElement('button');
        d.type = 'button'; d.setAttribute('aria-label', c + ' columns, ' + r + ' rows');
        d.className = 'cell';
        d.dataset.r = r;
        d.dataset.c = c;
        d.addEventListener('mouseenter', () => {
          tableHover = { r, c };
          label.textContent = c + ' × ' + r;
          cells.forEach(x => {
            const on = +x.dataset.r <= r && +x.dataset.c <= c;
            x.classList.toggle('on', on);
          });
        });
        d.addEventListener('click', () => insertTable(c, r));
        grid.appendChild(d);
        cells.push(d);
      }
    }
  }
  function insertTable(cols, rows) {
    paper.focus();
    restoreSelection();
    let html = '<table><tbody>';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        html += '<td><br></td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';
    document.execCommand('insertHTML', false, html);
    closeModal('tableModal');
    const tables = paper.querySelectorAll('table');
    const table = tables[tables.length - 1];
    if (table) placeCaret(table.rows[0].cells[0]);
    changed();
  }

  // --- Date ---
  document.getElementById('dateBtn').addEventListener('mousedown', e => e.preventDefault());
  document.getElementById('dateBtn').addEventListener('click', () => {
    const d = new Date(); document.getElementById('dateValue').value = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); openModal('dateModal');
  });
  document.getElementById('dateConfirm').addEventListener('click', () => {
    const value = document.getElementById('dateValue').value;
    if (!value) return;
    exec('insertText', new Date(value + 'T12:00:00').toLocaleDateString(undefined, {year:'numeric',month:'long',day:'numeric'})); closeModal('dateModal');
  });

  // --- Divider ---
  document.getElementById('dividerBtn').addEventListener('mousedown', e => e.preventDefault());
  document.getElementById('dividerBtn').addEventListener('click', () => {
    paper.focus();
    restoreSelection();
    document.execCommand('insertHTML', false, '<hr><p><br></p>');
    scheduleSave();
  });

  // --- Undo / Redo ---
  document.getElementById('undoBtn').addEventListener('mousedown', e => e.preventDefault());
  document.getElementById('undoBtn').addEventListener('click', () => travel(-1));
  document.getElementById('redoBtn').addEventListener('mousedown', e => e.preventDefault());
  document.getElementById('redoBtn').addEventListener('click', () => travel(1));

  // --- Paper input ---
  paper.addEventListener('input', () => {
    if (findBar.classList.contains('open')) { clearHighlights(); runFind(); }
    scheduleSave();
    updateCounts();
    updateToolbarState();
  });
  paper.addEventListener('keyup', updateToolbarState);
  paper.addEventListener('mouseup', updateToolbarState);

  // --- Placeholder trick (contenteditable with empty content) ---
  function refreshPlaceholder() {
    const hasContent = paper.textContent.trim().length > 0 || paper.querySelector('img,hr,table');
    paper.setAttribute('data-placeholder', hasContent ? '' : 'Start writing…');
    paper.classList.toggle('is-empty', !hasContent);
  }
  paper.addEventListener('input', refreshPlaceholder);
  refreshPlaceholder();

  // --- Title ---
  docTitle.addEventListener('input', scheduleSave);

  // --- Paste cleaning (strip Word/Docs junk) ---
  paper.addEventListener('paste', e => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    if (html) {
      const cleaned = sanitizeHtml(html);
      document.execCommand('insertHTML', false, cleaned);
    } else {
      document.execCommand('insertText', false, text);
    }
    scheduleSave();
    updateCounts();
  });

  function safeUrl(url, image = false) {
    const value = String(url || '').trim();
    if (image && /^data:image\/(png|jpeg|gif|webp|avif);base64,/i.test(value)) return value;
    try { const parsed = new URL(value); return (image ? ['https:', 'http:'] : ['https:', 'http:', 'mailto:', 'tel:']).includes(parsed.protocol) ? parsed.href : ''; } catch (_) { return ''; }
  }
  function sanitizeHtml(html, local = false) {
    const tmp = document.createElement('template'); tmp.innerHTML = html;
    const allowed = new Set('P BR B STRONG I EM U S STRIKE DEL H1 H2 H3 UL OL LI BLOCKQUOTE A IMG HR TABLE THEAD TBODY TR TD TH SPAN DIV INPUT'.split(' '));
    function walk(node) {
      if (node.nodeType !== 1) return;
      if (['SCRIPT','STYLE','IFRAME','OBJECT','SVG','MATH','FORM','BUTTON'].includes(node.tagName)) { node.remove(); return; }
      Array.from(node.children).forEach(walk);
      if (!allowed.has(node.tagName)) { node.replaceWith(...node.childNodes); return; }
      const attrs = {};
      if (node.tagName === 'A') { attrs.href = safeUrl(node.getAttribute('href')); attrs.rel = 'noopener noreferrer'; attrs.target = '_blank'; }
      if (node.tagName === 'IMG') { attrs.src = safeUrl(node.getAttribute('src'), true); attrs.alt = node.getAttribute('alt') || ''; }
      if (['TD','TH'].includes(node.tagName)) for (const k of ['colspan','rowspan']) { const v = parseInt(node.getAttribute(k)); if (v > 0 && v <= 20) attrs[k] = v; }
      if (local) {
        if (node.classList.contains('checklist')) attrs.class = 'checklist';
        if (node.tagName === 'INPUT') { if (node.type !== 'checkbox') { node.remove(); return; } attrs.type = 'checkbox'; attrs.contenteditable = 'false'; attrs.tabindex = '0'; attrs['aria-label'] = 'Complete task'; if (node.hasAttribute('checked')) attrs.checked = ''; }
        const style = node.style;
        const values = {};
        for (const k of ['textAlign','fontWeight','fontStyle','textDecoration','width','marginLeft','marginRight','display']) if (style[k] && /^[a-z0-9%. ()-]+$/i.test(style[k])) values[k] = style[k];
        Array.from(node.attributes).forEach(a => node.removeAttribute(a.name)); Object.assign(node.style, values);
      } else { if (node.tagName === 'INPUT') { node.remove(); return; } Array.from(node.attributes).forEach(a => node.removeAttribute(a.name)); }
      for (const [k,v] of Object.entries(attrs)) node.setAttribute(k,v);
      if (node.tagName === 'IMG' && !attrs.src) node.remove();
    }
    Array.from(tmp.content.children).forEach(walk); return tmp.innerHTML;
  }

  // --- Menus ---
  function closeAllMenus() {
    saveMenu.classList.remove('open');
    themeMenu.classList.remove('open');
    styleMenu.classList.remove('open');
  }
  saveMenuBtn.addEventListener('click', e => {
    e.stopPropagation();
    const open = saveMenu.classList.contains('open');
    closeAllMenus();
    if (!open) saveMenu.classList.add('open');
  });
  themeBtn.addEventListener('click', e => {
    e.stopPropagation();
    const open = themeMenu.classList.contains('open');
    closeAllMenus();
    if (!open) themeMenu.classList.add('open');
  });
  document.addEventListener('click', () => closeAllMenus());

  // --- Theme buttons ---
  themeMenu.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      setTheme(b.dataset.theme);
      closeAllMenus();
    });
  });

  // --- Export ---
  saveMenu.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      const kind = b.dataset.export;
      closeAllMenus();
      if (kind === 'doc') exportDoc();
      else if (kind === 'pdf') exportPdf();
      else if (kind === 'txt') exportTxt();
      else if (kind === 'html') exportHtml();
    });
  });

  function docName(ext) {
    const t = (docTitle.value || 'document').replace(/[^\w\-\s]/g, '').trim() || 'document';
    return t + '.' + ext;
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function buildFullHtml() {
    const styles = Array.from(document.styleSheets).map(sheet => { try { return Array.from(sheet.cssRules).map(r=>r.cssText).join('\n'); } catch (_) { return ''; } }).join('\n');
    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + escapeHtml(docTitle.value || 'Document') + '</title><style>' + styles + 'body{overflow:auto}.paper{margin:40px auto;min-height:0}</style></head><body class="' + THEMES.find(t=>app.classList.contains(t)) + '"><article class="paper">' + sanitizeHtml(paper.innerHTML, true) + '</article></body></html>';
  }

  function exportHtml() {
    download(new Blob([buildFullHtml()], { type: 'text/html' }), docName('html'));
    setStatus('Downloaded');
    setTimeout(() => setStatus('Saved'), 1400);
  }

  function exportTxt() {
    const text = (docTitle.value ? docTitle.value + '\n\n' : '') + (paper.innerText || '');
    download(new Blob([text], { type: 'text/plain' }), docName('txt'));
    setStatus('Downloaded');
    setTimeout(() => setStatus('Saved'), 1400);
  }

  function exportDoc() {
    // Word opens HTML files with a .doc extension just fine.
    const html = buildFullHtml();
    const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
    download(blob, docName('doc'));
    setStatus('Downloaded');
    setTimeout(() => setStatus('Saved'), 1400);
  }

  function exportPdf() {
    // Open a print-ready window; user picks "Save as PDF" in the dialog.
    const w = window.open('', '_blank');
    if (!w) { setStatus('Allow popups to save PDF'); return; }
    w.document.write(buildFullHtml());
    w.document.close();
    w.focus();
    setTimeout(() => { try { w.print(); } catch (_) {} }, 400);
    setStatus('Choose “Save as PDF”');
    setTimeout(() => setStatus('Saved'), 2000);
  }

  // --- Modals ---
  function openModal(id) {
    saveSelection(); closeAllMenus(); const modal = document.getElementById(id);
    modal.querySelector('.modal-error')?.remove(); modal.setAttribute('aria-label', modal.querySelector('h3').textContent); modal.classList.add('active');
    setTimeout(() => modal.querySelector('input,button')?.focus(), 0);
  }
  function closeModal(id) { document.getElementById(id).classList.remove('active'); paper.focus(); restoreSelection(); saveSelection(); }
  function modalError(modal, text) { let el = modal.querySelector('.modal-error'); if (!el) { el = document.createElement('div'); el.className = 'modal-error'; el.setAttribute('role','alert'); modal.querySelector('.modal').append(el); } el.textContent = text; }

  document.querySelectorAll('[data-close-modal]').forEach(b => {
    b.addEventListener('click', () => closeModal(b.dataset.closeModal));
  });
  [linkModal, imageModal, tableModal, document.getElementById('dateModal')].forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); });
  });

  // --- Keyboard shortcuts ---
  document.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod || document.querySelector('.modal-overlay.active')) return;
    const k = e.key.toLowerCase();
    if (k === 'f' && e.shiftKey) { e.preventDefault(); toggleFocus(); return; }
    if (k === '/' ) { e.preventDefault(); openModal('shortcutModal'); return; }
    if (k === 'f') { e.preventDefault(); openFind(); return; }
    if (e.key.toLowerCase() !== 's' && document.activeElement !== paper && !paper.contains(document.activeElement)) return;
    if (k === 'b') { e.preventDefault(); exec('bold'); }
    else if (k === 'i') { e.preventDefault(); exec('italic'); }
    else if (k === 'u') { e.preventDefault(); exec('underline'); }
    else if (k === 'k') { e.preventDefault(); document.getElementById('linkBtn').click(); }
    else if (k === 's') { e.preventDefault(); saveDoc(); }
    else if (k === 'z') { e.preventDefault(); travel(e.shiftKey ? 1 : -1); }
    else if (k === 'y') { e.preventDefault(); travel(1); }
  });

  // --- Helpers ---
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }
  function escapeAttr(s) { return escapeHtml(s); }


  // Unified snapshots make insertions, checkboxes, and typing undoable together.
  let history = [], historyIndex = -1, restoring = false;
  let selectedImage = null, selectedTable = null;
  function record() {
    if (restoring) return;
    const clone = paper.cloneNode(true);
    clone.querySelectorAll('mark[data-find]').forEach(m => m.replaceWith(...m.childNodes));
    const value = clone.innerHTML.replace(/ selected-image/g, '');
    if (history[historyIndex] === value) return;
    history = history.slice(0, historyIndex + 1); history.push(value);
    if (history.length > 150) history.shift(); historyIndex = history.length - 1;
    updateHistoryButtons();
  }
  function updateHistoryButtons() { document.getElementById('undoBtn').disabled = historyIndex <= 0; document.getElementById('redoBtn').disabled = historyIndex >= history.length - 1; }
  function travel(direction) {
    const next = historyIndex + direction; if (next < 0 || next >= history.length) return;
    restoring = true; historyIndex = next; paper.innerHTML = history[next]; lastRange = null; selectedImage = null; selectedTable = null;
    paper.focus(); restoreSelection(); scheduleSave(); restoring = false; updateHistoryButtons(); contextTools();
  }
  function changed() { refreshPlaceholder(); updateCounts(); scheduleSave(); updateToolbarState(); }
  function placeCaret(node, end = false) { const r = document.createRange(); r.selectNodeContents(node); r.collapse(!end); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); paper.focus(); lastRange = r.cloneRange(); }
  function selectionElement() { const node = getSelection()?.anchorNode; return node?.nodeType === 1 ? node : node?.parentElement; }
  function contextTools() {
    selectedTable = selectionElement()?.closest('table');
    document.getElementById('tableTools').classList.toggle('visible', !!selectedTable && paper.contains(selectedTable));
    document.getElementById('imageTools').classList.toggle('visible', !!selectedImage && paper.contains(selectedImage));
  }
  document.addEventListener('selectionchange', contextTools);
  paper.addEventListener('click', e => {
    paper.querySelectorAll('.selected-image').forEach(i => i.classList.remove('selected-image'));
    selectedImage = e.target.tagName === 'IMG' ? e.target : null;
    if (selectedImage) { selectedImage.classList.add('selected-image'); document.getElementById('imageSize').value = String(parseInt(selectedImage.style.width) || 100); document.getElementById('imageAlign').value = selectedImage.style.marginLeft === 'auto' ? (selectedImage.style.marginRight === 'auto' ? 'center' : 'right') : 'left'; }
    contextTools();
  });
  for (const id of ['imageAlign','imageSize']) document.getElementById(id).addEventListener('change', e => {
    if (!selectedImage) return;
    const align = document.getElementById('imageAlign').value;
    selectedImage.style.width = document.getElementById('imageSize').value + '%';
    selectedImage.style.marginLeft = align === 'left' ? '0' : 'auto'; selectedImage.style.marginRight = align === 'right' ? '0' : 'auto'; changed();
  });
  document.getElementById('deleteImage').addEventListener('click', () => { selectedImage?.remove(); selectedImage = null; changed(); contextTools(); });
  document.getElementById('addRow').addEventListener('click', () => { if (!selectedTable) return; const row = selectedTable.insertRow(); for (let i=0;i<selectedTable.rows[0].cells.length;i++) row.insertCell().innerHTML = '<br>'; placeCaret(row.cells[0]); changed(); });
  document.getElementById('addColumn').addEventListener('click', () => { if (!selectedTable) return; Array.from(selectedTable.rows).forEach(row => row.insertCell().innerHTML = '<br>'); changed(); });
  document.getElementById('deleteTable').addEventListener('click', () => { selectedTable?.remove(); selectedTable = null; lastRange = null; changed(); contextTools(); });
  paper.addEventListener('keydown', e => {
    if (e.target.matches('input[type="checkbox"]')) return;
    const el = selectionElement(); const cell = el?.closest('td,th'); const li = el?.closest('.checklist li');
    if (e.key === 'Tab') {
      e.preventDefault();
      if (cell) {
        const table = cell.closest('table'); const cells = Array.from(table.querySelectorAll('td,th')); let index = cells.indexOf(cell) + (e.shiftKey ? -1 : 1);
        if (index === cells.length) { const row = table.insertRow(); for(let i=0;i<table.rows[0].cells.length;i++) row.insertCell().innerHTML='<br>'; placeCaret(row.cells[0]); changed(); }
        else if (index >= 0) placeCaret(cells[index]);
      } else if (el?.closest('li')) exec(e.shiftKey ? 'outdent' : 'indent');
      else if (!e.shiftKey) exec('insertText', '\u2003');
    }
    if (e.key === 'Enter' && !e.shiftKey && li) {
      e.preventDefault(); const span = li.querySelector('span');
      if (!span?.textContent.trim()) { const ul = li.closest('ul'); const p = document.createElement('p'); p.innerHTML = '<br>'; ul.after(p); li.remove(); if (!ul.children.length) ul.remove(); placeCaret(p); }
      else { const next = document.createElement('li'); next.innerHTML = '<input type="checkbox" contenteditable="false" tabindex="0" aria-label="Complete task"><span><br></span>'; const r=getSelection().getRangeAt(0); const tail=document.createRange(); tail.selectNodeContents(span); if (span.contains(r.endContainer)) tail.setStart(r.endContainer,r.endOffset); else tail.collapse(false); const frag=tail.extractContents(); const target=next.querySelector('span'); if(frag.textContent) {target.replaceChildren(frag);} li.after(next); placeCaret(target); }
      changed();
    }
  });
  paper.addEventListener('beforeinput', e => {
    if (e.inputType === 'historyUndo' || e.inputType === 'historyRedo') { e.preventDefault(); travel(e.inputType === 'historyUndo' ? -1 : 1); }
  });
  paper.addEventListener('change', e => {
    if (e.target.matches('input[type="checkbox"]')) { e.target.toggleAttribute('checked', e.target.checked); changed(); }
  });
  document.addEventListener('keydown', e => {
    const modal = document.querySelector('.modal-overlay.active');
    if (e.key === 'Escape') { closeAllMenus(); if (modal) closeModal(modal.id); }
    if (modal && e.key === 'Tab') {
      const controls = Array.from(modal.querySelectorAll('button,input,select')).filter(el => !el.disabled); const first=controls[0], last=controls[controls.length-1];
      if (e.shiftKey && document.activeElement === first) {e.preventDefault();last.focus();} else if (!e.shiftKey && document.activeElement === last) {e.preventDefault();first.focus();}
    }
    if (modal && e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'file') { e.preventDefault(); modal.querySelector('.btn-primary')?.click(); }
  });
  document.querySelectorAll('.tool,.style-btn,.style-menu button').forEach(b => b.addEventListener('mousedown', e => e.preventDefault()));
  document.querySelectorAll('.menu-wrap > button,.style-btn').forEach(b => { b.setAttribute('aria-haspopup','true'); });
  window.addEventListener('pagehide', saveDoc);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveDoc(); });

  // --- Dictation (speech to text, Web Speech API) ---
  const micBtn = document.getElementById('micBtn');
  const speakBtn = document.getElementById('speakBtn');
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null, dictating = false;

  if (!SpeechRecognition) {
    micBtn.disabled = true;
    micBtn.title = 'Dictation is not supported in this browser (try Chrome or Edge)';
  } else {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';

    recognition.addEventListener('result', e => {
      let finalText = '', interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else interimText += e.results[i][0].transcript;
      }
      if (finalText) {
        paper.focus();
        restoreSelection();
        document.execCommand('insertText', false, finalText.replace(/^\s+/, ' '));
        saveSelection();
        scheduleSave();
      }
      setStatus(interimText ? 'Listening: ' + interimText.slice(-40) : 'Listening…');
    });
    recognition.addEventListener('end', () => { if (dictating) recognition.start(); });
    recognition.addEventListener('error', e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') stopDictation('Microphone blocked');
      else if (e.error === 'no-speech') setStatus('Listening…');
      else stopDictation('Dictation stopped');
    });
  }

  function startDictation() {
    stopSpeaking();
    saveSelection();
    dictating = true;
    micBtn.classList.add('listening');
    micBtn.setAttribute('aria-pressed', 'true');
    try { recognition.start(); } catch (_) {}
    setStatus('Listening…');
  }
  function stopDictation(status) {
    dictating = false;
    micBtn.classList.remove('listening');
    micBtn.setAttribute('aria-pressed', 'false');
    if (recognition) try { recognition.stop(); } catch (_) {}
    setStatus(status || 'Saved');
  }
  micBtn.addEventListener('mousedown', e => e.preventDefault());
  micBtn.addEventListener('click', () => { if (dictating) stopDictation(); else startDictation(); });

  // --- Read aloud (text to speech) ---
  let speaking = false;
  if (!('speechSynthesis' in window)) {
    speakBtn.disabled = true;
    speakBtn.title = 'Read aloud is not supported in this browser';
  }
  function stopSpeaking() {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    speaking = false;
    speakBtn.classList.remove('listening');
    speakBtn.setAttribute('aria-pressed', 'false');
  }
  speakBtn.addEventListener('mousedown', e => e.preventDefault());
  speakBtn.addEventListener('click', () => {
    if (speaking) { stopSpeaking(); setStatus('Saved'); return; }
    const sel = window.getSelection();
    const selected = sel && sel.rangeCount && paper.contains(sel.getRangeAt(0).commonAncestorContainer) ? sel.toString().trim() : '';
    const text = selected || (paper.innerText || '').trim();
    if (!text) { setStatus('Nothing to read'); return; }
    if (dictating) stopDictation();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    utter.addEventListener('end', () => { stopSpeaking(); setStatus('Saved'); });
    utter.addEventListener('error', () => { stopSpeaking(); setStatus('Saved'); });
    speaking = true;
    speakBtn.classList.add('listening');
    speakBtn.setAttribute('aria-pressed', 'true');
    setStatus(selected ? 'Reading selection…' : 'Reading document…');
    speechSynthesis.speak(utter);
  });
  window.addEventListener('pagehide', () => { stopSpeaking(); if (dictating) stopDictation(); });

  // --- Init ---
  loadTheme();
  loadDoc();
  updateCounts();
  updateToolbarState();
  refreshPlaceholder(); record(); setStatus('Saved on this device');
})();
