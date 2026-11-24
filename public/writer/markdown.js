/* Device-only Markdown serialization. Input is sanitized by the editor first. */
window.scribeMarkdown = function (html) {
  const root = document.createElement('template');
  root.innerHTML = html;
  const escape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/([\\`*_\[\]{}#!|~])/g, '\\$1').replace(/^(\s*\d+)\./gm, '$1\\.').replace(/^(\s*)([-+>])/gm, '$1\\$2');
  const children = node => Array.from(node.childNodes).map(render).join('');
  const wrap = (text, marker) => text.trim() ? text.replace(/^(\s*)([\s\S]*?)(\s*)$/, (_, before, body, after) => before + marker + body + marker + after) : text;
  const destination = url => '<' + url.replace(/\s/g, c => encodeURIComponent(c)).replace(/</g, '%3C').replace(/>/g, '%3E') + '>';
  function list(node, depth = 0) {
    return Array.from(node.children).filter(item => item.tagName === 'LI').map((item, index) => {
      const checkbox = item.querySelector(':scope > input[type="checkbox"]');
      const prefix = checkbox ? '- [' + (checkbox.hasAttribute('checked') ? 'x' : ' ') + '] ' : node.tagName === 'OL' ? (index + 1) + '. ' : '- ';
      const body = Array.from(item.childNodes).filter(child => !['UL', 'OL'].includes(child.nodeName)).map(render).join('').trim();
      const indent = ' '.repeat(depth);
      const lines = body.split('\n').map((line, i) => (i ? indent + ' '.repeat(prefix.length) : indent + prefix) + line).join('\n');
      const nested = Array.from(item.children).filter(child => ['UL', 'OL'].includes(child.tagName)).map(child => list(child, depth + prefix.length)).join('\n');
      return lines + (nested ? '\n' + nested : '');
    }).join('\n');
  }
  function render(node) {
    if (node.nodeType === 3) return escape(node.textContent.replace(/\s+/g, ' '));
    if (node.nodeType !== 1) return '';
    const tag = node.tagName;
    if (['SCRIPT', 'STYLE', 'COLGROUP', 'INPUT'].includes(tag)) return '';
    if (tag === 'BR') return '  \n';
    if (tag === 'HR') return '\n\n---\n\n';
    if (tag === 'UL' || tag === 'OL') return '\n\n' + list(node) + '\n\n';
    if (tag === 'IMG') return '![' + escape(node.getAttribute('alt') || '') + '](' + destination(node.getAttribute('src') || '') + ')';
    const text = children(node);
    if (tag === 'A') return '[' + text + '](' + destination(node.getAttribute('href') || '') + ')';
    if (/^H[1-3]$/.test(tag)) return '\n\n' + '#'.repeat(Number(tag.slice(1))) + ' ' + text.trim() + '\n\n';
    if (tag === 'BLOCKQUOTE') return '\n\n' + text.trim().split('\n').map(line => '> ' + line).join('\n') + '\n\n';
    if (tag === 'TABLE') {
      const rows = Array.from(node.rows);
      const columns = Math.max(0, ...rows.map(row => row.cells.length));
      if (!columns) return '';
      const rowText = row => '| ' + Array.from({ length: columns }, (_, index) => {
        const cell = row?.cells[index];
        return cell ? children(cell).trim().replace(/\n+/g, '<br>') : '';
      }).join(' | ') + ' |';
      const header = rows[0] && Array.from(rows[0].cells).every(cell => cell.tagName === 'TH');
      return '\n\n' + [rowText(header ? rows[0] : null), '| ' + Array(columns).fill('---').join(' | ') + ' |', ...rows.slice(header ? 1 : 0).map(rowText)].join('\n') + '\n\n';
    }
    if (tag === 'P' || tag === 'DIV') return '\n\n' + text.trim() + '\n\n';
    let formatted = text;
    if (['B', 'STRONG'].includes(tag) || /^(bold|[6-9]00)$/.test(node.style.fontWeight)) formatted = wrap(formatted, '**');
    if (['I', 'EM'].includes(tag) || node.style.fontStyle === 'italic') formatted = wrap(formatted, '*');
    if (['S', 'STRIKE', 'DEL'].includes(tag) || node.style.textDecoration.includes('line-through')) formatted = wrap(formatted, '~~');
    if (tag === 'U' || node.style.textDecoration.includes('underline')) formatted = '<u>' + formatted + '</u>';
    return formatted;
  }
  return children(root.content).replace(/\n{3,}/g, '\n\n').trim() + '\n';
};