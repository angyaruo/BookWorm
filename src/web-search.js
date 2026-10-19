// Only host-returned HTTP(S) links become sources; model text never supplies them.
export function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}
export function normalizeSources(rows) {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : []).flatMap(row => {
    const url = safeUrl(row?.url);
    if (!url || seen.has(url)) return [];
    seen.add(url);
    return [{ url, title: String(row.title || url).slice(0, 240), snippet: String(row.snippet || '').slice(0, 1600) }];
  }).slice(0, 5);
}
export async function searchWeb(api, query, userId, wait) {
  if (typeof query !== 'string' || !query.trim() || query.trim().length > 500) throw new Error('Enter search terms of up to 500 characters. Only these terms are sent to the search provider.');
  if (!api.webSearch?.query || !api.webSearch?.getSettings) throw new Error('This Lumiverse version does not expose web search. Update Lumiverse to use online research.');
  if (api.permissions?.has && !api.permissions.has('web_search')) throw new Error('Grant BookWorm the Web Search permission in Settings → Extensions.');
  const settings = await wait(api.webSearch.getSettings(userId));
  if (!settings.enabled) throw new Error('Enable and configure a provider in Lumiverse Settings → Web Search.');
  if (settings.provider === 'searxng' && !settings.apiUrl) throw new Error('Configure the SearXNG URL in Settings → Web Search.');
  if (['exa', 'tavily'].includes(settings.provider) && !settings.hasApiKey) throw new Error('Add your search provider API key in Settings → Web Search.');
  // Snippets keep this path quick and bounded. No hidden page crawling or chat context.
  const response = await wait(api.webSearch.query({ query: query.trim(), count: 5, scrape: false, userId }));
  const sources = normalizeSources(response?.results);
  if (!sources.length) throw new Error('No usable web results were returned. Try narrower search terms.');
  return sources;
}
