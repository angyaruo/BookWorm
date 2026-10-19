import { escapeHtml as esc } from './markdown.js';
import { normalizeSources } from './web-search.js';
export function sourceCards(sources) {
  const rows = normalizeSources(sources);
  return rows.length ? `<div class="bw-source-cards"><p>Web sources · search snippets, not full pages</p>${rows.map((row, i) => `<section><a href="${esc(row.url)}" target="_blank" rel="noopener noreferrer">[${i + 1}] ${esc(row.title)}</a><small>${esc(new URL(row.url).hostname)}</small><p>${esc(row.snippet)}</p></section>`).join('')}</div>` : '';
}
