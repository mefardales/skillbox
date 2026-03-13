import { useRef, useEffect, useState, useCallback } from 'react';

// ── Lazy Monaco Loader ───────────────────────────
let monacoPromise = null;
let monacoModule = null;

function loadMonaco() {
  if (monacoModule) return Promise.resolve(monacoModule);
  if (!monacoPromise) {
    monacoPromise = import('monaco-editor').then((mod) => {
      monacoModule = mod;

      // Set worker environment
      self.MonacoEnvironment = {
        getWorker() {
          return new Worker(
            new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url),
            { type: 'module' }
          );
        },
      };

      // Register custom themes
      mod.editor.defineTheme('skillbox-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '6a737d', fontStyle: 'italic' },
          { token: 'keyword', foreground: '7c9aed' },
          { token: 'string', foreground: '9ecbff' },
          { token: 'number', foreground: '79c0ff' },
          { token: 'type', foreground: '7ee787' },
          { token: 'variable', foreground: 'e4e4e7' },
          { token: 'keyword.md', foreground: '7c9aed', fontStyle: 'bold' },
          { token: 'string.link.md', foreground: '58a6ff' },
          { token: 'variable.md', foreground: 'ffa657' },
          { token: 'markup.heading', foreground: '7ee787', fontStyle: 'bold' },
        ],
        colors: {
          'editor.background': '#00000000',
          'editor.foreground': '#c9d1d9',
          'editor.lineHighlightBackground': '#ffffff08',
          'editorLineNumber.foreground': '#3a3f47',
          'editorLineNumber.activeForeground': '#6a737d',
          'editor.selectionBackground': '#3b82f630',
          'editorCursor.foreground': '#58a6ff',
          'editorIndentGuide.background': '#21262d',
          'editorIndentGuide.activeBackground': '#30363d',
          'scrollbarSlider.background': '#484f5820',
          'scrollbarSlider.hoverBackground': '#484f5840',
          'editorGutter.background': '#00000000',
          'minimap.background': '#00000000',
        },
      });

      mod.editor.defineTheme('skillbox-light', {
        base: 'vs',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '6a737d', fontStyle: 'italic' },
          { token: 'keyword', foreground: '5a67d8' },
          { token: 'string', foreground: '0550ae' },
          { token: 'number', foreground: '0550ae' },
          { token: 'type', foreground: '116329' },
          { token: 'variable', foreground: '24292f' },
          { token: 'keyword.md', foreground: '5a67d8', fontStyle: 'bold' },
          { token: 'string.link.md', foreground: '0969da' },
          { token: 'variable.md', foreground: 'cf222e' },
          { token: 'markup.heading', foreground: '116329', fontStyle: 'bold' },
        ],
        colors: {
          'editor.background': '#00000000',
          'editor.foreground': '#24292f',
          'editor.lineHighlightBackground': '#00000006',
          'editorLineNumber.foreground': '#c0c4cc',
          'editorLineNumber.activeForeground': '#8b949e',
          'editor.selectionBackground': '#3b82f625',
          'editorCursor.foreground': '#0969da',
          'editorIndentGuide.background': '#e8e8e8',
          'editorIndentGuide.activeBackground': '#d0d0d0',
          'scrollbarSlider.background': '#00000010',
          'scrollbarSlider.hoverBackground': '#00000020',
          'editorGutter.background': '#00000000',
          'minimap.background': '#00000000',
        },
      });

      return mod;
    });
  }
  return monacoPromise;
}

// Detect language from content or explicit prop
function detectLanguage(content, language) {
  if (language) return language;
  if (!content) return 'plaintext';

  const first = content.trim().substring(0, 200);
  if (first.startsWith('# ') || first.match(/^#{1,6} /m)) return 'markdown';
  if (first.startsWith('{') || first.startsWith('[')) return 'json';
  if (first.match(/^(import |export |const |function |class )/m)) return 'javascript';
  if (first.match(/^(FROM |RUN |COPY |CMD )/m)) return 'dockerfile';
  if (first.match(/^(apiVersion:|kind:|metadata:)/m)) return 'yaml';
  if (first.match(/^\s*<[a-zA-Z]/)) return 'html';
  if (first.match(/^(def |class |import |from )/m)) return 'python';
  if (first.match(/^(package |func |type |import \()/m)) return 'go';
  if (first.match(/\$ |^> |^bash|^sh/m)) return 'shell';
  return 'markdown';
}

/**
 * MonacoViewer — Read-only Monaco editor for displaying code/text.
 * Monaco is lazy-loaded on first mount to avoid impacting initial page load.
 *
 * @param {string}  value       - Content to display
 * @param {string}  language    - Language ID (auto-detected if omitted)
 * @param {number}  maxHeight   - Max height in px (default 400)
 * @param {number}  minHeight   - Min height in px (default 60)
 * @param {boolean} lineNumbers - Show line numbers (default true)
 * @param {boolean} wordWrap    - Enable word wrap (default true)
 * @param {string}  className   - Additional CSS classes for the container
 */
export default function MonacoViewer({
  value = '',
  language,
  maxHeight = 400,
  minHeight = 60,
  lineNumbers = true,
  wordWrap = true,
  className = '',
}) {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const [height, setHeight] = useState(minHeight);
  const [ready, setReady] = useState(!!monacoModule);

  const getTheme = useCallback(() => {
    return document.documentElement.classList.contains('light')
      ? 'skillbox-light'
      : 'skillbox-dark';
  }, []);

  // Read accent color from CSS variable for dynamic border
  const getAccentBorder = useCallback(() => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    if (raw.startsWith('#') && raw.length >= 7) return raw + '40'; // hex + 25% alpha
    return raw ? `${raw}40` : '#3b82f640';
  }, []);

  const [borderColor, setBorderColor] = useState(getAccentBorder);

  const lang = detectLanguage(value, language);

  // Load Monaco lazily
  useEffect(() => {
    if (!ready) {
      loadMonaco().then(() => setReady(true));
    }
  }, [ready]);

  // Create editor once Monaco + container are ready
  useEffect(() => {
    if (!ready || !containerRef.current || !monacoModule) return;

    const editor = monacoModule.editor.create(containerRef.current, {
      value,
      language: lang,
      theme: getTheme(),
      readOnly: true,
      domReadOnly: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        verticalScrollbarSize: 6,
        horizontalScrollbarSize: 6,
      },
      lineNumbers: lineNumbers ? 'on' : 'off',
      lineNumbersMinChars: 3,
      glyphMargin: false,
      folding: false,
      lineDecorationsWidth: 0,
      renderLineHighlight: 'none',
      matchBrackets: 'never',
      occurrencesHighlight: 'off',
      selectionHighlight: false,
      wordWrap: wordWrap ? 'on' : 'off',
      wrappingStrategy: 'advanced',
      fontSize: 12,
      lineHeight: 19,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', Consolas, monospace",
      fontLigatures: true,
      padding: { top: 8, bottom: 8 },
      overviewRulerLanes: 0,
      overviewRulerBorder: false,
      hideCursorInOverviewRuler: true,
      contextmenu: false,
      links: true,
      renderWhitespace: 'none',
      guides: { indentation: false, bracketPairs: false },
      cursorStyle: 'line-thin',
      cursorBlinking: 'solid',
    });

    editorRef.current = editor;

    // Auto-height based on content
    const updateHeight = () => {
      const contentH = editor.getContentHeight();
      const clamped = Math.max(minHeight, Math.min(maxHeight, contentH));
      setHeight(clamped);
      editor.layout();
    };

    editor.onDidContentSizeChange(updateHeight);
    updateHeight();

    return () => {
      editor.dispose();
      editorRef.current = null;
    };
  }, [ready, lang, lineNumbers]);

  // Update value without recreating
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (model && model.getValue() !== value) {
      model.setValue(value || '');
    }
  }, [value]);

  // Update word wrap
  useEffect(() => {
    editorRef.current?.updateOptions({ wordWrap: wordWrap ? 'on' : 'off' });
  }, [wordWrap]);

  // Theme + accent sync — watch for class/style/data-accent changes on <html>
  useEffect(() => {
    const observer = new MutationObserver(() => {
      editorRef.current?.updateOptions({ theme: getTheme() });
      setBorderColor(getAccentBorder());
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-accent'] });
    return () => observer.disconnect();
  }, [getTheme, getAccentBorder]);

  // Resize when container parent resizes
  useEffect(() => {
    const el = containerRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => editorRef.current?.layout());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden rounded-lg border ${className}`}
      style={{ height, minHeight, maxHeight, borderColor }}
    >
      {!ready && (
        <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
          <div className="animate-pulse">Loading editor...</div>
        </div>
      )}
    </div>
  );
}
