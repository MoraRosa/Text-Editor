import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';

const script = readFileSync('public/writer/markdown.js', 'utf8');
const convert = (html: string): string => {
  const writer = window as unknown as { scribeMarkdown: (html: string) => string };
  return writer.scribeMarkdown(html);
};

describe('Scribe Markdown export', () => {
  beforeEach(() => window.eval(script));

  it('preserves headings, formatting, quotes, links and images', () => {
    expect(convert('<h2>Notes</h2><p><b>Bold</b> <i>italic</i> <s>old</s></p><blockquote><p>Quote</p></blockquote><p><a href="https://example.com">Site</a><br><img src="https://example.com/p.png" alt="Photo"></p>')))
      .toBe('## Notes\n\n**Bold** *italic* ~~old~~\n\n> Quote\n\n[Site](<https://example.com>)  \n![Photo](<https://example.com/p.png>)\n');
  });

  it('preserves nested lists and checked and unchecked tasks', () => {
    expect(convert('<ol><li>First<ul><li>Nested</li></ul></li><li>Second</li></ol><ul class="checklist"><li><input type="checkbox" checked>Done</li><li><input type="checkbox">Next</li></ul>')))
      .toBe('1. First\n   - Nested\n2. Second\n\n- [x] Done\n- [ ] Next\n');
  });

  it('preserves table headers and escapes literal pipes', () => {
    expect(convert('<table><tr><th>Topic</th><th>Notes</th></tr><tr><td>A | B</td><td>One<br>Two</td></tr></table>')))
      .toBe('| Topic | Notes |\n| --- | --- |\n| A \\| B | One  <br>Two |\n');
  });

  it('does not invent headings for tables without headers', () => {
    expect(convert('<table><tr><td>A</td><td>B</td></tr></table>')))
      .toBe('|  |  |\n| --- | --- |\n| A | B |\n');
  });

  it('escapes literal Markdown and HTML without exporting scripts', () => {
    expect(convert('<p>*literal* [notes] &lt;tag&gt;</p><script>alert(1)</script>')))
      .toBe('\\*literal\\* \\[notes\\] &lt;tag&gt;\n');
  });
});