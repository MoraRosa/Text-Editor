import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const html = readFileSync('public/writer/index.html', 'utf8');
const script = readFileSync('public/writer/writer.js', 'utf8');

describe('Writer image editing', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('writer_docs_v1', JSON.stringify({ test: {
      title: 'Image draft', html: '<p>Before</p><img src="https://example.com/photo.png" style="width:50%"><p>After</p>',
    } }));
    localStorage.setItem('writer_current_v1', 'test');
    document.documentElement.innerHTML = html.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');
    vi.stubGlobal('ResizeObserver', class { observe() {} });
    window.eval(script);
  });

  it('resizes through handles and restores the image width with undo and redo', () => {
    const image = document.querySelector<HTMLImageElement>('#paper img');
    const handle = document.querySelector<HTMLButtonElement>('.image-resize-handle.se');
    if (!image || !handle) throw new Error('Missing image controls');
    image.click();
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(image.style.width).toBe('51%');
    document.getElementById('undoBtn')?.click();
    expect(document.querySelector<HTMLImageElement>('#paper img')?.style.width).toBe('50%');
    document.getElementById('redoBtn')?.click();
    expect(document.querySelector<HTMLImageElement>('#paper img')?.style.width).toBe('51%');
  });

  it('keeps arbitrary resized widths when changing placement and saving the draft', () => {
    const image = document.querySelector<HTMLImageElement>('#paper img');
    const alignment = document.querySelector<HTMLSelectElement>('#imageAlign');
    if (!image || !alignment) throw new Error('Missing image controls');
    image.style.width = '63.75%'; image.click();
    alignment.value = 'center'; alignment.dispatchEvent(new Event('change', { bubbles: true }));
    expect(image.style.width).toBe('63.75%');
    expect(image.style.marginLeft).toBe('auto');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }));
    const drafts = JSON.parse(localStorage.getItem('writer_docs_v1') || '{}');
    expect(drafts.test.html).toContain('width: 63.75%');
    expect(drafts.test.html).not.toContain('selected-image');
    expect(drafts.test.html).not.toContain('image-handles');
  });
});