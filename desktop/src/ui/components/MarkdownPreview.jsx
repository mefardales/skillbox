import { useMemo, lazy, Suspense } from 'react';

const MonacoViewer = lazy(() => import('@/components/MonacoViewer'));

// ── Markdown Parser ──────────────────────────────
// Parses markdown into an array of block tokens for rendering.
// Supports: headings, fenced code blocks, blockquotes, ordered/unordered lists,
// horizontal rules, tables, and paragraphs with inline formatting.

function tokenize(md) {
  if (!md) return [];
  const lines = md.split('\n');
  const tokens = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    const fenceMatch = line.match(/^```(\w*)/);
    if (fenceMatch) {
      const lang = fenceMatch[1] || '';
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      tokens.push({ type: 'code', lang, content: codeLines.join('\n') });
      i++; // skip closing ```
      continue;
    }

    // Horizontal rule
    if (line.match(/^(-{3,}|\*{3,}|_{3,})\s*$/)) {
      tokens.push({ type: 'hr' });
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      tokens.push({ type: 'heading', level: headingMatch[1].length, content: headingMatch[2] });
      i++;
      continue;
    }

    // Blockquote (collect consecutive > lines)
    if (line.match(/^>\s?/)) {
      const quoteLines = [];
      while (i < lines.length && lines[i].match(/^>\s?/)) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      tokens.push({ type: 'blockquote', content: quoteLines.join('\n') });
      continue;
    }

    // Table (line with | and next line is separator)
    if (line.includes('|') && i + 1 < lines.length && lines[i + 1].match(/^\|?\s*[-:]+[-|:\s]+$/)) {
      const headerCells = line.split('|').map(c => c.trim()).filter(Boolean);
      const alignLine = lines[i + 1];
      const aligns = alignLine.split('|').map(c => c.trim()).filter(Boolean).map(c => {
        if (c.startsWith(':') && c.endsWith(':')) return 'center';
        if (c.endsWith(':')) return 'right';
        return 'left';
      });
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|')) {
        rows.push(lines[i].split('|').map(c => c.trim()).filter(Boolean));
        i++;
      }
      tokens.push({ type: 'table', headers: headerCells, aligns, rows });
      continue;
    }

    // Unordered list
    if (line.match(/^[\s]*[-*+]\s/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^[\s]*[-*+]\s/)) {
        const indent = lines[i].match(/^(\s*)/)[1].length;
        items.push({ content: lines[i].replace(/^[\s]*[-*+]\s/, ''), indent });
        i++;
      }
      tokens.push({ type: 'ul', items });
      continue;
    }

    // Ordered list
    if (line.match(/^[\s]*\d+\.\s/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^[\s]*\d+\.\s/)) {
        const indent = lines[i].match(/^(\s*)/)[1].length;
        items.push({ content: lines[i].replace(/^[\s]*\d+\.\s/, ''), indent });
        i++;
      }
      tokens.push({ type: 'ol', items });
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph (collect consecutive non-empty lines that aren't other blocks)
    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].match(/^```/) &&
      !lines[i].match(/^#{1,6}\s/) &&
      !lines[i].match(/^>\s?/) &&
      !lines[i].match(/^[\s]*[-*+]\s/) &&
      !lines[i].match(/^[\s]*\d+\.\s/) &&
      !lines[i].match(/^(-{3,}|\*{3,}|_{3,})\s*$/)
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      tokens.push({ type: 'paragraph', content: paraLines.join('\n') });
    }
  }

  return tokens;
}

// ── Inline Formatting ────────────────────────────
// Renders inline markdown: bold, italic, code, links, images
function InlineText({ text }) {
  if (!text) return null;

  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Image: ![alt](url)
    let match = remaining.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (match) {
      parts.push(
        <img key={key++} src={match[2]} alt={match[1]} className="inline max-h-32 rounded" />
      );
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Link: [text](url)
    match = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (match) {
      parts.push(
        <a key={key++} href={match[2]} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
          {match[1]}
        </a>
      );
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Inline code: `code`
    match = remaining.match(/^`([^`]+)`/);
    if (match) {
      parts.push(
        <code key={key++} className="text-[0.9em] bg-muted px-1 py-0.5 rounded font-mono text-primary/90">
          {match[1]}
        </code>
      );
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Bold: **text**
    match = remaining.match(/^\*\*(.+?)\*\*/);
    if (match) {
      parts.push(<strong key={key++}>{match[1]}</strong>);
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Italic: *text*
    match = remaining.match(/^\*(.+?)\*/);
    if (match) {
      parts.push(<em key={key++}>{match[1]}</em>);
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Plain text (consume until next special char)
    match = remaining.match(/^[^`*!\[]+/);
    if (match) {
      parts.push(<span key={key++}>{match[0]}</span>);
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Single special char that didn't match a pattern
    parts.push(<span key={key++}>{remaining[0]}</span>);
    remaining = remaining.slice(1);
  }

  return <>{parts}</>;
}

// ── Code Block with Monaco ───────────────────────
function CodeBlock({ lang, content }) {
  return (
    <Suspense
      fallback={
        <pre className="text-[12px] font-mono bg-muted rounded-lg p-3 overflow-x-auto border border-border/50">
          {content}
        </pre>
      }
    >
      <MonacoViewer
        value={content}
        language={lang || undefined}
        maxHeight={300}
        minHeight={40}
        lineNumbers={content.split('\n').length > 3}
        wordWrap={false}
      />
    </Suspense>
  );
}

// ── Block Renderer ───────────────────────────────
function BlockRenderer({ token }) {
  switch (token.type) {
    case 'heading': {
      const Tag = `h${token.level}`;
      const sizes = {
        1: 'text-lg font-bold mt-5 mb-2 text-foreground',
        2: 'text-base font-semibold mt-4 mb-2 text-foreground',
        3: 'text-sm font-semibold mt-3 mb-1.5 text-foreground',
        4: 'text-sm font-medium mt-2 mb-1 text-foreground/90',
        5: 'text-xs font-medium mt-2 mb-1 text-foreground/80',
        6: 'text-xs font-medium mt-2 mb-1 text-muted-foreground',
      };
      return (
        <Tag className={sizes[token.level] || sizes[3]}>
          <InlineText text={token.content} />
        </Tag>
      );
    }

    case 'paragraph':
      return (
        <p className="text-[13px] leading-relaxed mb-2 text-foreground/90">
          <InlineText text={token.content} />
        </p>
      );

    case 'code':
      return (
        <div className="my-2">
          <CodeBlock lang={token.lang} content={token.content} />
        </div>
      );

    case 'blockquote':
      return (
        <blockquote className="border-l-2 border-primary/40 pl-3 my-2 text-[13px] text-muted-foreground italic">
          <InlineText text={token.content} />
        </blockquote>
      );

    case 'ul':
      return (
        <ul className="list-disc pl-5 my-1.5 space-y-0.5">
          {token.items.map((item, i) => (
            <li key={i} className="text-[13px] text-foreground/90" style={{ marginLeft: item.indent > 0 ? 16 : 0 }}>
              <InlineText text={item.content} />
            </li>
          ))}
        </ul>
      );

    case 'ol':
      return (
        <ol className="list-decimal pl-5 my-1.5 space-y-0.5">
          {token.items.map((item, i) => (
            <li key={i} className="text-[13px] text-foreground/90" style={{ marginLeft: item.indent > 0 ? 16 : 0 }}>
              <InlineText text={item.content} />
            </li>
          ))}
        </ol>
      );

    case 'hr':
      return <hr className="border-border my-3" />;

    case 'table':
      return (
        <div className="overflow-x-auto my-2">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                {token.headers.map((h, i) => (
                  <th
                    key={i}
                    className="px-2 py-1.5 font-semibold text-foreground/90"
                    style={{ textAlign: token.aligns[i] || 'left' }}
                  >
                    <InlineText text={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {token.rows.map((row, ri) => (
                <tr key={ri} className="border-b border-border/50 hover:bg-accent/20">
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className="px-2 py-1 text-foreground/80"
                      style={{ textAlign: token.aligns[ci] || 'left' }}
                    >
                      <InlineText text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    default:
      return null;
  }
}

/**
 * MarkdownPreview — Renders markdown as formatted content.
 * Fenced code blocks are rendered with MonacoViewer (lazy-loaded).
 * Everything else (headings, lists, tables, inline formatting) is rendered as styled JSX.
 *
 * @param {string} content  - Raw markdown string
 * @param {string} className - Additional CSS classes
 */
export default function MarkdownPreview({ content, className = '' }) {
  const tokens = useMemo(() => tokenize(content), [content]);

  if (!content) {
    return <div className="text-[13px] text-muted-foreground py-2">No content</div>;
  }

  return (
    <div className={`markdown-preview ${className}`}>
      {tokens.map((token, i) => (
        <BlockRenderer key={i} token={token} />
      ))}
    </div>
  );
}
