export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInlineMarkdown(value) {
  const codeSpans = [];
  let text = String(value).replace(/(`+)(.*?)\1(?!`)/g, (_, ticks, code) => {
    const normalized = code.startsWith(' ') && code.endsWith(' ') && code.trim()
      ? code.slice(1, -1)
      : code;
    const token = `\u0000BWCODE${codeSpans.length}\u0000`;
    codeSpans.push(`<code class="bw-md-inline-code">${escapeHtml(normalized)}</code>`);
    return token;
  });

  text = escapeHtml(text)
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/___(.+?)___/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|[^_])_([^_\n]+?)_(?!_)/g, '$1<em>$2</em>');

  return text.replace(/\u0000BWCODE(\d+)\u0000/g, (_, index) => codeSpans[Number(index)] || '');
}

// Safe, dependency-free Markdown for model output. Block parsing prevents
// headings, quotes, lists, and code fences from leaking their source markers.
export function renderMarkdown(text) {
  if (!text) return '';

  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const html = [];
  let paragraph = [];
  let listType = null;
  let listItems = [];
  let quoteLines = [];
  let codeLines = [];
  let codeLanguage = '';
  let inCodeFence = false;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p class="bw-md-paragraph">${paragraph.map(renderInlineMarkdown).join('<br>')}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!listType || !listItems.length) return;
    html.push(`<${listType} class="bw-md-list">${listItems.map(item => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</${listType}>`);
    listType = null;
    listItems = [];
  };
  const flushQuote = () => {
    if (!quoteLines.length) return;
    html.push(`<blockquote class="bw-md-quote">${quoteLines.map(renderInlineMarkdown).join('<br>')}</blockquote>`);
    quoteLines = [];
  };
  const flushTextBlocks = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };
  const flushCode = () => {
    const languageClass = codeLanguage ? ` language-${escapeHtml(codeLanguage)}` : '';
    html.push(`<pre class="bw-md-code-block"><code class="${languageClass.trim()}">${escapeHtml(codeLines.join('\n'))}</code></pre>`);
    codeLines = [];
    codeLanguage = '';
  };

  for (const line of lines) {
    const fence = line.match(/^\s*```\s*([\w+-]*)\s*$/);
    if (fence) {
      if (inCodeFence) {
        flushCode();
        inCodeFence = false;
      } else {
        flushTextBlocks();
        inCodeFence = true;
        codeLanguage = fence[1] || '';
      }
      continue;
    }
    if (inCodeFence) {
      codeLines.push(line);
      continue;
    }

    const heading = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
    const quote = line.match(/^\s*>\s?(.*)$/);
    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);

    if (!line.trim()) {
      flushTextBlocks();
    } else if (heading) {
      flushTextBlocks();
      const level = heading[1].length;
      html.push(`<h${level} class="bw-md-heading bw-md-h${level}">${renderInlineMarkdown(heading[2])}</h${level}>`);
    } else if (quote) {
      flushParagraph();
      flushList();
      quoteLines.push(quote[1]);
    } else if (unordered || ordered) {
      flushParagraph();
      flushQuote();
      const nextListType = unordered ? 'ul' : 'ol';
      if (listType && listType !== nextListType) flushList();
      listType = nextListType;
      listItems.push((unordered || ordered)[1]);
    } else if (/^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line)) {
      flushTextBlocks();
      html.push('<hr class="bw-md-rule">');
    } else {
      flushList();
      flushQuote();
      paragraph.push(line);
    }
  }

  if (inCodeFence) flushCode();
  flushTextBlocks();
  return html.join('');
}
