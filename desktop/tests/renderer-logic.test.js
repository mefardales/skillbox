import { describe, it, expect } from 'vitest';

// ── Markdown Renderer (extracted from renderer.js for testing) ──
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inlineMd(text) {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
}

function renderMarkdown(md) {
  md = md.replace(/^---[\s\S]*?---\s*/, '');
  let html = '';
  const lines = md.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      let code = '';
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        code += lines[i] + '\n';
        i++;
      }
      i++;
      html += `<pre><code${lang ? ` class="language-${lang}"` : ''}>${escapeHtml(code.trimEnd())}</code></pre>`;
      continue;
    }

    if (line.startsWith('### ')) { html += `<h3>${inlineMd(line.slice(4))}</h3>`; i++; continue; }
    if (line.startsWith('## '))  { html += `<h2>${inlineMd(line.slice(3))}</h2>`; i++; continue; }
    if (line.startsWith('# '))   { html += `<h1>${inlineMd(line.slice(2))}</h1>`; i++; continue; }

    if (/^---+$/.test(line.trim())) { html += '<hr>'; i++; continue; }

    if (line.startsWith('> ')) {
      let bq = '';
      while (i < lines.length && lines[i].startsWith('> ')) {
        bq += lines[i].slice(2) + '\n';
        i++;
      }
      html += `<blockquote><p>${inlineMd(bq.trim())}</p></blockquote>`;
      continue;
    }

    if (line.includes('|') && i + 1 < lines.length && /^\|?\s*[-:]+/.test(lines[i + 1])) {
      const headers = line.split('|').map(c => c.trim()).filter(Boolean);
      i += 2;
      let rows = '';
      while (i < lines.length && lines[i].includes('|')) {
        const cells = lines[i].split('|').map(c => c.trim()).filter(Boolean);
        rows += '<tr>' + cells.map(c => `<td>${inlineMd(c)}</td>`).join('') + '</tr>';
        i++;
      }
      html += `<table><thead><tr>${headers.map(h => `<th>${inlineMd(h)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
      continue;
    }

    if (/^\s*[-*] /.test(line)) {
      let items = '';
      while (i < lines.length && /^\s*[-*] /.test(lines[i])) {
        items += `<li>${inlineMd(lines[i].replace(/^\s*[-*] /, ''))}</li>`;
        i++;
      }
      html += `<ul>${items}</ul>`;
      continue;
    }

    if (/^\s*\d+\. /.test(line)) {
      let items = '';
      while (i < lines.length && /^\s*\d+\. /.test(lines[i])) {
        items += `<li>${inlineMd(lines[i].replace(/^\s*\d+\. /, ''))}</li>`;
        i++;
      }
      html += `<ol>${items}</ol>`;
      continue;
    }

    if (line.trim() === '') { i++; continue; }

    let para = '';
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('#') && !lines[i].startsWith('```') && !lines[i].startsWith('> ') && !/^\s*[-*] /.test(lines[i]) && !/^\s*\d+\. /.test(lines[i])) {
      para += lines[i] + ' ';
      i++;
    }
    html += `<p>${inlineMd(para.trim())}</p>`;
  }

  return html;
}

function escapeAttr(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// ── Tests ─────────────────────────────────────────────────────

describe('escapeHtml', () => {
  it('should escape HTML entities', () => {
    expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
    expect(escapeHtml('"quotes"')).toBe('&quot;quotes&quot;');
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('should handle empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('should handle strings without special chars', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});

describe('inlineMd', () => {
  it('should render inline code', () => {
    expect(inlineMd('use `useState`')).toBe('use <code>useState</code>');
  });

  it('should render bold', () => {
    expect(inlineMd('this is **bold**')).toBe('this is <strong>bold</strong>');
  });

  it('should render italic', () => {
    expect(inlineMd('this is *italic*')).toBe('this is <em>italic</em>');
  });

  it('should render links', () => {
    expect(inlineMd('[text](url)')).toBe('<a href="url" target="_blank">text</a>');
  });

  it('should handle nested inline formatting', () => {
    const result = inlineMd('use **`code`** here');
    expect(result).toContain('<strong>');
    expect(result).toContain('<code>');
  });

  it('should handle text without formatting', () => {
    expect(inlineMd('plain text')).toBe('plain text');
  });
});

describe('renderMarkdown', () => {
  it('should strip YAML frontmatter', () => {
    const md = '---\nname: test\n---\n\n# Hello';
    expect(renderMarkdown(md)).toBe('<h1>Hello</h1>');
  });

  it('should render headings', () => {
    expect(renderMarkdown('# H1')).toBe('<h1>H1</h1>');
    expect(renderMarkdown('## H2')).toBe('<h2>H2</h2>');
    expect(renderMarkdown('### H3')).toBe('<h3>H3</h3>');
  });

  it('should render paragraphs', () => {
    expect(renderMarkdown('Hello world')).toBe('<p>Hello world</p>');
  });

  it('should render code blocks', () => {
    const md = '```javascript\nconst x = 1;\n```';
    const html = renderMarkdown(md);
    expect(html).toContain('<pre>');
    expect(html).toContain('<code class="language-javascript">');
    expect(html).toContain('const x = 1;');
  });

  it('should render code blocks without language', () => {
    const md = '```\nsome code\n```';
    const html = renderMarkdown(md);
    expect(html).toContain('<pre>');
    expect(html).toContain('<code>');
  });

  it('should escape HTML in code blocks', () => {
    const md = '```\n<div class="test">\n```';
    const html = renderMarkdown(md);
    expect(html).toContain('&lt;div');
    expect(html).not.toContain('<div class="test">');
  });

  it('should render unordered lists', () => {
    const md = '- item 1\n- item 2\n- item 3';
    const html = renderMarkdown(md);
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>item 1</li>');
    expect(html).toContain('<li>item 2</li>');
    expect(html).toContain('<li>item 3</li>');
  });

  it('should render ordered lists', () => {
    const md = '1. first\n2. second';
    const html = renderMarkdown(md);
    expect(html).toContain('<ol>');
    expect(html).toContain('<li>first</li>');
    expect(html).toContain('<li>second</li>');
  });

  it('should render blockquotes', () => {
    const md = '> This is a quote';
    const html = renderMarkdown(md);
    expect(html).toContain('<blockquote>');
    expect(html).toContain('This is a quote');
  });

  it('should render horizontal rules', () => {
    expect(renderMarkdown('---')).toBe('<hr>');
    expect(renderMarkdown('-----')).toBe('<hr>');
  });

  it('should render tables', () => {
    const md = '| Header 1 | Header 2 |\n| --- | --- |\n| cell 1 | cell 2 |';
    const html = renderMarkdown(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<th>Header 1</th>');
    expect(html).toContain('<td>cell 1</td>');
  });

  it('should handle empty input', () => {
    expect(renderMarkdown('')).toBe('');
  });

  it('should handle only frontmatter', () => {
    expect(renderMarkdown('---\nname: test\n---')).toBe('');
  });

  it('should handle multiple paragraphs separated by blank lines', () => {
    const md = 'First paragraph.\n\nSecond paragraph.';
    const html = renderMarkdown(md);
    expect(html).toContain('<p>First paragraph.</p>');
    expect(html).toContain('<p>Second paragraph.</p>');
  });

  it('should render mixed content correctly', () => {
    const md = '# Title\n\nSome text.\n\n- item 1\n- item 2\n\n```js\ncode()\n```\n\n## Subtitle\n\nMore text.';
    const html = renderMarkdown(md);
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<p>Some text.</p>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<pre>');
    expect(html).toContain('<h2>Subtitle</h2>');
    expect(html).toContain('<p>More text.</p>');
  });
});

describe('escapeAttr', () => {
  it('should escape backslashes', () => {
    expect(escapeAttr('C:\\Users\\test')).toBe("C:\\\\Users\\\\test");
  });

  it('should escape single quotes', () => {
    expect(escapeAttr("it's")).toBe("it\\'s");
  });

  it('should handle path with mixed separators', () => {
    const result = escapeAttr('C:\\path/to\\file');
    expect(result).toContain('\\\\');
  });
});
