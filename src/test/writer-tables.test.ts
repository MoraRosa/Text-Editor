import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const html = readFileSync('public/writer/index.html', 'utf8');
const script = readFileSync('public/writer/writer.js', 'utf8');

describe('Writer table columns', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('writer_docs_v1', JSON.stringify({ test: {
      title: 'Table draft', html: '<table style="table-layout:fixed"><colgroup><col style="width:40%"><col style="width:60%"></colgroup><tbody><tr><td>Topic</td><td>Notes</td></tr><tr><td>A</td><td>B</td></tr></tbody></table>',
    } }));
    localStorage.setItem('writer_current_v1', 'test');
    document.documentElement.innerHTML = html.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');
    vi.stubGlobal('ResizeObserver', class { observe() {} });
    vi.stubGlobal('MutationObserver', class { observe() {} });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const width = this instanceof HTMLTableCellElement ? (this.cellIndex === 0 ? 120 : 180) : 300;
      return { x: 0, y: 0, left: 0, top: 0, right: width, bottom: 100, width, height: 100, toJSON: () => ({}) };
    });
    window.eval(script);
    const cell = document.querySelector('#paper td');
    if (!cell) throw new Error('Missing table');
    const range = document.createRange(); range.selectNodeContents(cell); range.collapse(true);
    const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });

  it('resizes adjacent columns without changing total width, with undo and redo', () => {
    const handle = document.querySelector('.table-column-handle');
    if (!handle) throw new Error('Missing column handle');
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    let cols = document.querySelectorAll<HTMLTableColElement>('#paper col');
    expect(parseFloat(cols[0]?.style.width || '0')).toBeCloseTo(125 / 300 * 100);
    expect(parseFloat(cols[1]?.style.width || '0')).toBeCloseTo(175 / 300 * 100);
    document.getElementById('undoBtn')?.click();
    expect(document.querySelector<HTMLTableColElement>('#paper col')?.style.width).toBe('40%');
    document.getElementById('redoBtn')?.click();
    cols = document.querySelectorAll<HTMLTableColElement>('#paper col');
    expect(parseFloat(cols[0]?.style.width || '0')).toBeCloseTo(125 / 300 * 100);
  });

  it('restores column widths and maintains them when columns are added or deleted', () => {
    expect(document.querySelector<HTMLTableElement>('#paper table')?.style.tableLayout).toBe('fixed');
    expect(document.querySelector<HTMLTableColElement>('#paper col')?.style.width).toBe('40%');
    document.getElementById('addColumn')?.click();
    expect(document.querySelectorAll('#paper col')).toHaveLength(3);
    expect(document.querySelectorAll('#paper tr:first-child td')).toHaveLength(3);
    document.getElementById('deleteColumn')?.click();
    const cols = [...document.querySelectorAll<HTMLTableColElement>('#paper col')];
    expect(cols).toHaveLength(2);
    expect(cols.reduce((sum,c) => sum + parseFloat(c.style.width),0)).toBeCloseTo(100);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }));
    const drafts = JSON.parse(localStorage.getItem('writer_docs_v1') || '{}');
    expect(drafts.test.html).toContain('<colgroup>');
    expect(drafts.test.html).not.toContain('table-column-handle');
  });

  it('toggles the first row into column headers without losing content or widths, with undo and redo', () => {
    document.getElementById('tableHeader')?.click();
    const headers = [...document.querySelectorAll('#paper tr:first-child th')];
    expect(headers.map(cell => cell.textContent)).toEqual(['Topic', 'Notes']);
    expect(headers.map(cell => cell.getAttribute('scope'))).toEqual(['col', 'col']);
    expect(document.querySelectorAll('#paper tr:nth-child(2) td')).toHaveLength(2);
    expect(document.querySelector<HTMLTableColElement>('#paper col')?.style.width).toBe('40%');
    document.getElementById('undoBtn')?.click();
    expect(document.querySelectorAll('#paper th')).toHaveLength(0);
    document.getElementById('redoBtn')?.click();
    expect(document.querySelectorAll('#paper th')).toHaveLength(2);
    const cell = document.querySelector('#paper th');
    if (!cell) throw new Error('Missing header');
    const range = document.createRange(); range.selectNodeContents(cell); range.collapse(true);
    window.getSelection()?.removeAllRanges(); window.getSelection()?.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
    document.getElementById('tableHeader')?.click();
    expect([...document.querySelectorAll('#paper tr:first-child td')].map(cell => cell.textContent)).toEqual(['Topic', 'Notes']);
  });

  it('retains headers on new columns and local restore while new rows remain body cells', () => {
    document.getElementById('tableHeader')?.click();
    document.getElementById('addColumn')?.click();
    document.getElementById('addRow')?.click();
    expect(document.querySelectorAll('#paper tr:first-child th[scope="col"]')).toHaveLength(3);
    expect(document.querySelectorAll('#paper tr:last-child td')).toHaveLength(3);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }));
    document.documentElement.innerHTML = html.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');
    window.eval(script);
    expect(document.querySelectorAll('#paper tr:first-child th[scope="col"]')).toHaveLength(3);
    expect(document.querySelectorAll('#paper tr:last-child td')).toHaveLength(3);
  });
});