import css from './book.css';
import { SPRITES, getNextBuggyMessage } from './buggy.js';
import { escapeHtml as esc, renderMarkdown } from './markdown.js';
import { createRequestId } from './request-id.js';

const MODES = {
  thesaurus: { label: 'Thesaurus', title: 'Find the right word.', description: 'An English dictionary & thesaurus, right here on your desk.', placeholder: 'A word to explore…', number: '01', sample: ['serendipity', 'haunting', 'luminous'] },
  tot: { label: 'Tip of tongue', title: 'It’s on the tip of your tongue.', description: 'Describe the meaning. Buggy will help you find its name.', placeholder: 'A word for something no longer in use…', number: '02' },
  research: { label: 'Research', title: 'Follow your curiosity.', description: 'Small details that make a fictional world feel lived in.', placeholder: 'What would a Victorian apothecary carry?', number: '03' },
  next_step: { label: 'Consultant', title: 'Turn the next page.', description: 'Find a new direction for your scene, with a little help from Buggy.', placeholder: 'What could my character do next?', number: '04' },
  translate: { label: 'Translator', title: 'Let the words travel.', description: 'Keep the voice. Change the language. Include your target language below.', placeholder: 'Translate into French: …', number: '05' },
};
const icon = paths => `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const ICONS = {
  book: icon('<path d="M12 5v15M3 4c4-1 7 0 9 2 2-2 5-3 9-2v14c-4-1-7 0-9 2-2-2-5-3-9-2z"/>'),
  close: icon('<path d="m6 6 12 12M6 18 18 6"/>'),
  history: icon('<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2"/>'),
  settings: icon('<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3" fill="currentColor"/><circle cx="16" cy="17" r="3" fill="currentColor"/>'),
};
function readSaved(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage may be disabled */ } }
function safeConnection() { try { return localStorage.getItem('bw_selected_connection_id') || ''; } catch { return ''; } }
function readableStream(text) { return text.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, ''); }

export function setup(ctx) {
  let popup, widget, composer, fields, active = null, watchdog;
  let activeTab = 'thesaurus';
  let connections = [], selectedConnection = safeConnection();
  let fed = false, disposed = false, rawAnswer = '';
  const savedSettings = readSaved('bw_settings_v2', {});
  const settings = { timeoutSeconds: [120,180,300].includes(savedSettings.timeoutSeconds) ? savedSettings.timeoutSeconds : 180, extendedOutput: savedSettings.extendedOutput === true };
  const cachedLookups = new Map();
  const domLifetime = new AbortController();
  const removeStyle = ctx.dom.addStyle(css);
  const listen = (el, type, fn) => el.addEventListener(type, fn, { signal: domLifetime.signal });
  const history = () => {
    const saved = readSaved('bw_query_history', []);
    return Array.isArray(saved) ? saved.filter(h => h && Object.hasOwn(MODES,h.mode) && typeof h.query === 'string' && typeof h.answer === 'string').slice(0,5) : [];
  };
  function record(item) { save('bw_query_history', [item, ...history().filter(h => h.mode !== item.mode || h.query !== item.query)].slice(0,5)); }
  function mood(value) { if (fields) fields.mascot.src = SPRITES[fed ? 'munching' : value]; }
  function notice(text = '') {
    if (!fields) return;
    fields.notice.textContent = text;
    fields.notice.hidden = !text;
  }
  function send(payload) {
    try {
      const pending = ctx.sendToBackend(payload);
      if (pending?.catch) pending.catch(() => transportFailure(payload.requestId));
    } catch { transportFailure(payload.requestId); }
  }
  function transportFailure(id) {
    if (active?.id === id) finish({ answer: readableStream(active.text), error: 'The connection to Lumiverse was interrupted. Try again when it reconnects.' });
  }
  function setBusy(busy) {
    fields.ask.textContent = busy ? 'Stop' : activeTab === 'thesaurus' ? 'Look up →' : 'Ask Buggy →';
    fields.output.setAttribute('aria-busy', String(busy));
    fields.status.textContent = busy ? (activeTab === 'thesaurus' ? 'Opening the dictionary…' : 'Buggy is reading…') : activeTab === 'thesaurus' ? 'Local dictionary · no AI' : 'Model-assisted writing';
  }
  function cancel(keep = false) {
    if (!active) return;
    const request = active;
    active = null;
    clearTimeout(watchdog);
    send({ type: 'bookworm:cancel', requestId: request.id });
    if (keep && fields) {
      rawAnswer = readableStream(request.text).trim();
      fields.output.innerHTML = rawAnswer ? renderMarkdown(rawAnswer) : '';
      fields.actions.hidden = !rawAnswer;
      notice(rawAnswer ? 'Stopped. Your partial answer is kept.' : 'Stopped. You can try another question.');
      if (rawAnswer) record({ mode: request.mode, query: request.query, answer: rawAnswer });
      setBusy(false); mood('reading');
    }
  }
  function pageTurn() {
    fields.page.classList.remove('bw-turn');
    void fields.page.offsetWidth;
    fields.page.classList.add('bw-turn');
  }
  function updateMode() {
    const mode = MODES[activeTab];
    popup.querySelectorAll('[data-tab]').forEach(button => {
      const selected = button.dataset.tab === activeTab;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    fields.page.setAttribute('aria-labelledby', `bw-tab-${activeTab}`);
    fields.chapter.textContent = `Chapter ${mode.number} / Your writing companion`;
    fields.title.textContent = mode.title;
    fields.description.textContent = mode.description;
    fields.input.placeholder = mode.placeholder;
    fields.input.maxLength = activeTab === 'thesaurus' ? 100 : 20000;
    fields.label.textContent = activeTab === 'thesaurus' ? 'Find a word or phrase' : 'Your question';
    fields.badge.textContent = activeTab === 'thesaurus' ? 'Offline library' : 'AI assistance';
    fields.source.hidden = activeTab !== 'thesaurus';
    fields.shortcut.textContent = activeTab === 'thesaurus' ? 'Enter to look up' : 'Ctrl / ⌘ + Enter';
    setBusy(false);
  }
  function emptyPage() {
    rawAnswer = '';
    fields.actions.hidden = true;
    notice();
    fields.scroll.scrollTop = 0;
    const offline = activeTab === 'thesaurus';
    fields.output.innerHTML = `<div class="bw-welcome"><div class="bw-welcome-mark" aria-hidden="true">❧</div><h3>${offline ? 'Every word opens a door.' : 'A little room for your next idea.'}</h3><p>${offline ? 'Explore meanings, find a synonym, or follow a word somewhere unexpected. Your dictionary is already on the shelf.' : 'Set down a question. Buggy will consult your chosen model and bring the answer back to this page.'}</p>${offline ? `<div class="bw-suggestions">${MODES.thesaurus.sample.map(wordButton).join('')}</div>` : ''}</div>`;
  }
  function selectTab(tab, focus = true) {
    cancel(); activeTab = tab;
    fields.input.value = '';
    fields.history.hidden = true; fields.settings.hidden = true;
    updateExpanded();
    updateMode(); emptyPage(); pageTurn(); mood('reading');
    if (focus) fields.input.focus();
  }
  function wordButton(word) { return `<button type="button" class="bw-word" data-word="${esc(word)}">${esc(word)}</button>`; }
  function showLookup(lookup) {
    const entries = Array.isArray(lookup.entries) ? lookup.entries : [];
    const relations = (label, words) => words?.length ? `<div class="bw-relations"><span class="bw-relations-label">${label}</span><div class="bw-suggestions">${words.map(wordButton).join('')}</div></div>` : '';
    fields.output.innerHTML = `<div class="bw-result-heading"><h3>${esc(lookup.query)}</h3><span>${entries.length} ${entries.length === 1 ? 'meaning' : 'meanings'}</span></div>` + (entries.length
      ? entries.map((entry, i) => `<section class="bw-sense"><div class="bw-sense-label"><span class="bw-sense-number">${String(i+1).padStart(2,'0')}</span><span>${esc(entry.partOfSpeech)}${entry.word !== lookup.query ? ` · ${esc(entry.word)}` : ''}</span></div><p class="bw-definition">${esc(entry.definition)}</p>${entry.examples.map(example => `<blockquote class="bw-example">${esc(example)}</blockquote>`).join('')}${relations('Synonyms', entry.synonyms)}${relations('Antonyms', entry.antonyms)}${relations('Related words', entry.related)}</section>`).join('')
      : `<div class="bw-welcome"><h3>No entry on this shelf.</h3><p>Try a different spelling or a shorter English phrase.${lookup.suggestions?.length ? ' Did you mean one of these?' : ''}</p><div class="bw-suggestions">${(lookup.suggestions || []).map(wordButton).join('')}</div></div>`);
    rawAnswer = entries.length ? `# ${lookup.query}\n\n` + entries.map(entry => `## ${entry.word} · ${entry.partOfSpeech}\n${entry.definition}${entry.examples.length ? '\n' + entry.examples.map(s => `> ${s}`).join('\n') : ''}${entry.synonyms.length ? '\nSynonyms: ' + entry.synonyms.join(', ') : ''}${entry.antonyms.length ? '\nAntonyms: ' + entry.antonyms.join(', ') : ''}`).join('\n\n') : '';
    fields.actions.hidden = !rawAnswer;
  }
  function start(queryOverride) {
    if (active) { cancel(true); return; }
    const query = (queryOverride ?? fields.input.value).trim();
    if (!query) { fields.input.focus(); return; }
    fields.input.value = query;
    rawAnswer = ''; fields.actions.hidden = true; notice();
    fields.scroll.scrollTop = 0;
    const id = createRequestId();
    active = { id, query, mode: activeTab, text: '' };
    setBusy(true); mood('thinking');
    fields.output.innerHTML = '<div class="bw-loading">one moment. finding the good words…</div>';
    if (activeTab === 'thesaurus' && cachedLookups.has(query.toLowerCase())) {
      finish({ lookup: cachedLookups.get(query.toLowerCase()) });
      return;
    }
    watchdog = setTimeout(() => {
      if (active?.id !== id) return;
      const text = readableStream(active.text);
      send({ type: 'bookworm:cancel', requestId: id });
      finish({ answer: text, error: 'Lumiverse did not finish the request. Your partial answer has been kept; try again when the connection is ready.' });
    }, (activeTab === 'thesaurus' ? 45 : settings.timeoutSeconds + 15) * 1000);
    send({ type: activeTab === 'thesaurus' ? 'bookworm:lookup_word' : 'bookworm:consult', requestId: id, mode: activeTab, query,
      ...(activeTab !== 'thesaurus' ? { connectionId: selectedConnection || null, ...settings, sceneContext: activeTab === 'next_step' ? recentScene() : '' } : {}),
    });
  }
  function finish(payload) {
    if (!active || !fields) return;
    const request = active;
    active = null; clearTimeout(watchdog);
    if (payload.lookup) {
      cachedLookups.set(request.query.toLowerCase(), payload.lookup);
      if (cachedLookups.size > 20) cachedLookups.delete(cachedLookups.keys().next().value);
      showLookup(payload.lookup);
    } else {
      rawAnswer = payload.answer || '';
      fields.output.innerHTML = renderMarkdown(rawAnswer);
      fields.actions.hidden = !rawAnswer;
    }
    notice(payload.error || payload.warning || '');
    setBusy(false); mood(payload.error ? 'reading' : 'singing');
    fields.status.textContent = payload.error ? 'Couldn’t finish this request' : payload.warning ? 'Partial answer saved' : request.mode === 'thesaurus' ? 'From your local dictionary' : 'Ready for your next thought';
    if (rawAnswer) record({ mode: request.mode, query: request.query, answer: rawAnswer, ...(payload.lookup ? { lookup: payload.lookup } : {}) });
  }
  function recentScene() {
    const cards = [...document.querySelectorAll('[data-component="MessageContent"], [class*="_prose_"]')].filter(el => !popup?.contains(el));
    return cards.slice(-4).map(el => (el.innerText || '').trim().slice(0,1200)).join('\n---\n');
  }
  function refreshConnections() {
    if (!fields) return;
    const options = [{ id: '', name: 'Default model' }, ...connections];
    if (selectedConnection && !connections.some(c => c.id === selectedConnection)) options.push({ id: selectedConnection, name: 'Saved connection (unavailable)' });
    fields.connection.replaceChildren(...options.map(c => {
      const option = document.createElement('option'); option.value = c.id; option.textContent = c.name; return option;
    }));
    fields.connection.value = selectedConnection;
  }
  function updateExpanded() {
    popup.querySelector('[data-action=settings]').setAttribute('aria-expanded', String(!fields.settings.hidden));
    popup.querySelector('[data-action=history]').setAttribute('aria-expanded', String(!fields.history.hidden));
  }
  function togglePopover(kind) {
    const target = fields[kind]; const open = target.hidden;
    fields.settings.hidden = true; fields.history.hidden = true;
    target.hidden = !open;
    if (kind === 'history' && open) {
      const items = history();
      fields.history.innerHTML = '<h2>Recently opened</h2>' + (items.length ? items.map((item,i) => `<button type="button" class="bw-history-item" data-history="${i}"><small>${esc(MODES[item.mode].label)}</small>${esc(item.query.slice(0,80))}</button>`).join('') : '<p>Your last five answers will appear here.</p>');
    }
    if (kind === 'settings' && open) { refreshConnections(); send({ type: 'bookworm:get_connections' }); }
    updateExpanded();
    if (open) target.querySelector('select,button')?.focus();
  }
  function position() {
    if (!popup || !composer) return;
    popup.querySelector('[role=tablist]').setAttribute('aria-orientation', window.matchMedia('(max-width:600px)').matches ? 'horizontal' : 'vertical');
    const anchor = composer.getBoundingClientRect();
    const viewport = window.visualViewport;
    const width = viewport?.width || window.innerWidth, height = viewport?.height || window.innerHeight;
    const offsetX = viewport?.offsetLeft || 0, offsetY = viewport?.offsetTop || 0;
    popup.style.maxHeight = `${Math.max(160,height - 28)}px`;
    popup.style.maxWidth = `${Math.max(200,width - 28)}px`;
    const rect = popup.getBoundingClientRect();
    const left = Math.max(offsetX+12, Math.min(anchor.right - rect.width, offsetX+width - rect.width - 16));
    const top = Math.max(offsetY+12, Math.min(anchor.top - rect.height - 44, offsetY+height - rect.height - 16));
    popup.style.left = `${left}px`; popup.style.top = `${top}px`;
  }
  function close(focus = true) {
    cancel(); popup?.remove(); popup = null; fields = null; rawAnswer = ''; fed = false;
    if (widget) { widget.setAttribute('aria-expanded','false'); widget.querySelector('img').src = SPRITES.sleeping; if (focus) widget.focus(); }
  }
  function open() {
    if (popup) { close(); return; }
    fed = false;
    popup = document.createElement('section');
    popup.id = 'bw-popup-window'; popup.setAttribute('role','dialog'); popup.setAttribute('aria-label','BookWorm writing desk');
    popup.innerHTML = `
      <header class="bw-header"><div class="bw-brand"><div class="bw-seal">${ICONS.book}</div><div><h1>BookWorm</h1><p class="bw-edition">A small companion for big ideas</p></div></div><div class="bw-tools">
        <button type="button" class="bw-icon-btn" data-action="history" aria-label="Recent questions" aria-expanded="false" aria-controls="bw-history">${ICONS.history}</button>
        <button type="button" class="bw-icon-btn" data-action="settings" aria-label="Book settings" aria-expanded="false" aria-controls="bw-settings">${ICONS.settings}</button>
        <button type="button" class="bw-icon-btn" data-action="close" aria-label="Close BookWorm">${ICONS.close}</button>
      </div></header>
      <div class="bw-book-body"><aside class="bw-left"><p class="bw-eyebrow">The writing desk</p><div class="bw-tabs" role="tablist" aria-label="Writing tools" aria-orientation="vertical">${Object.entries(MODES).map(([key,mode]) => `<button type="button" id="bw-tab-${key}" role="tab" class="bw-tab" data-tab="${key}" aria-selected="${key === activeTab}" aria-controls="bw-page"><small>${mode.number}</small><span>${mode.label}</span><span class="bw-tab-dot"></span></button>`).join('')}</div>
      <div class="bw-buggy-note"><button type="button" class="bw-mascot-button" data-action="feed" aria-label="Give Buggy a leaf" title="Give Buggy a leaf"><img id="bw-desk-mascot-img" src="${SPRITES.reading}" alt="Buggy" draggable="false"></button><p class="bw-buggy-name">A note from Buggy</p><p class="bw-buggy-line">${esc(getNextBuggyMessage())}</p><p class="bw-leaf-note">Good words. Fair price. One leaf.</p></div></aside>
      <section class="bw-page" id="bw-page" role="tabpanel"><div class="bw-page-header"><span class="bw-eyebrow" id="bw-chapter"></span><span class="bw-badge" id="bw-badge"></span></div><h2 class="bw-page-title" id="bw-title"></h2><p class="bw-description" id="bw-description"></p>
      <label class="bw-query-label" id="bw-query-label" for="bw-query-input"></label><div class="bw-input-shell"><textarea id="bw-query-input" rows="2" spellcheck="true"></textarea><button type="button" class="bw-primary" id="bw-ask-btn" data-action="ask"></button></div><div class="bw-query-meta"><span id="bw-status" role="status"></span><span id="bw-shortcut"></span></div>
      <div id="bw-notice" class="bw-notice" role="status" hidden></div><div class="bw-output-scroll" id="bw-scroll"><article class="bw-output" id="bw-output-box" aria-label="Answer" aria-busy="false"></article></div>
      <footer class="bw-footer"><span id="bw-source"><a href="https://en-word.net/" target="_blank" rel="noopener noreferrer">Open English WordNet 2025</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a></span><div class="bw-result-actions" id="bw-result-actions" hidden><button type="button" class="bw-action" data-action="copy">Copy</button><button type="button" class="bw-action" data-action="insert">Inscribe into composer ↗</button></div></footer>
      </section></div>
      <section class="bw-popover" id="bw-settings" aria-label="Book settings" hidden><h2>Book settings</h2><label for="bw-connection">Writing model</label><select id="bw-connection"></select><label for="bw-length">Answer length</label><select id="bw-length"><option value="standard">Standard</option><option value="extended">Extended · longer passages</option></select><label for="bw-timeout">Time to wait</label><select id="bw-timeout"><option value="120">2 minutes</option><option value="180">3 minutes</option><option value="300">5 minutes</option></select><p>Extended answers allow up to 8,192 output tokens and may cost more. The thesaurus always uses the installed dictionary.</p></section>
      <section class="bw-popover" id="bw-history" aria-label="Recent questions" hidden></section>`;
    // Portal outside the host composer: transformed ancestors otherwise change
    // the containing block of position:fixed and can clip or offset the book.
    document.body.appendChild(popup);
    const find = id => popup.querySelector(`#${id}`);
    fields = { page:find('bw-page'), input:find('bw-query-input'), label:find('bw-query-label'), output:find('bw-output-box'), ask:find('bw-ask-btn'), scroll:find('bw-scroll'), notice:find('bw-notice'), status:find('bw-status'), shortcut:find('bw-shortcut'), title:find('bw-title'), description:find('bw-description'), chapter:find('bw-chapter'), badge:find('bw-badge'), source:find('bw-source'), actions:find('bw-result-actions'), mascot:find('bw-desk-mascot-img'), settings:find('bw-settings'), history:find('bw-history'), connection:find('bw-connection') };
    find('bw-length').value = settings.extendedOutput ? 'extended' : 'standard';
    find('bw-timeout').value = String(settings.timeoutSeconds);
    popup.onchange = e => {
      if (e.target.id === 'bw-connection') {
        selectedConnection = e.target.value;
        try { localStorage.setItem('bw_selected_connection_id', selectedConnection); } catch {}
      }
      if (e.target.id === 'bw-length') settings.extendedOutput = e.target.value === 'extended';
      if (e.target.id === 'bw-timeout') settings.timeoutSeconds = Number(e.target.value);
      save('bw_settings_v2', settings);
    };
    popup.onclick = async e => {
      const button = e.target.closest('button'); if (!button || !popup.contains(button)) return;
      e.preventDefault();
      if (button.dataset.tab) { selectTab(button.dataset.tab); return; }
      if (button.dataset.word) { cancel(); if (activeTab !== 'thesaurus') selectTab('thesaurus'); start(button.dataset.word); return; }
      if (button.dataset.history !== undefined) {
        const item = history()[Number(button.dataset.history)]; if (!item) return;
        selectTab(item.mode); fields.input.value = item.query;
        if (item.lookup) showLookup(item.lookup); else { rawAnswer = item.answer; fields.output.innerHTML = renderMarkdown(item.answer); fields.actions.hidden = !rawAnswer; }
        fields.status.textContent = 'From your recent questions'; mood('singing'); return;
      }
      switch (button.dataset.action) {
        case 'close': close(); break;
        case 'settings': togglePopover('settings'); break;
        case 'history': togglePopover('history'); break;
        case 'feed': fed = true; mood('munching'); break;
        case 'ask': start(); break;
        case 'copy':
          try { await navigator.clipboard.writeText(rawAnswer); if (fields) fields.status.textContent = 'Copied to clipboard'; }
          catch { notice('Clipboard access is unavailable. You can select and copy the answer directly.'); }
          break;
        case 'insert': {
          const input = composer?.querySelector('textarea:not(#bw-query-input)');
          if (!input || !rawAnswer) { notice('The chat composer is unavailable. Copy the answer instead.'); break; }
          const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value')?.set;
          const value = input.value ? `${input.value}\n\n${rawAnswer}` : rawAnswer;
          if (setter) setter.call(input,value); else input.value = value;
          input.dispatchEvent(new Event('input',{ bubbles:true })); input.dispatchEvent(new Event('change',{ bubbles:true }));
          close(false); input.focus(); break;
        }
      }
    };
    popup.onkeydown = e => {
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation();
        if (!fields.settings.hidden || !fields.history.hidden) { fields.settings.hidden = true; fields.history.hidden = true; updateExpanded(); fields.input.focus(); }
        else close();
        return;
      }
      if (e.target === fields.input && e.key === 'Enter' && !e.isComposing && (e.ctrlKey || e.metaKey || (activeTab === 'thesaurus' && !e.shiftKey))) { e.preventDefault(); start(); }
      const tab = e.target.closest('[role=tab]');
      if (tab && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(e.key)) {
        e.preventDefault(); const keys = Object.keys(MODES); const i = keys.indexOf(activeTab);
        const target = e.key === 'Home' ? keys[0] : e.key === 'End' ? keys.at(-1) : keys[(i + (['ArrowUp','ArrowLeft'].includes(e.key) ? -1 : 1) + keys.length) % keys.length];
        selectTab(target,false); popup.querySelector(`[data-tab=${target}]`).focus();
      }
    };
    updateMode(); emptyPage(); position();
    widget.setAttribute('aria-expanded','true'); widget.querySelector('img').src = SPRITES.awake;
    fields.input.focus();
  }
  const unsubscribe = ctx.onBackendMessage(payload => {
    if (!payload) return;
    if (payload.type === 'bookworm:connections') { connections = payload.connections || []; refreshConnections(); return; }
    if (!active || payload.requestId !== active.id || !fields) return;
    if (payload.type === 'bookworm:result_chunk') {
      const nearBottom = fields.scroll.scrollHeight - fields.scroll.scrollTop - fields.scroll.clientHeight < 70;
      active.text += payload.text || '';
      fields.output.innerHTML = renderMarkdown(readableStream(active.text));
      if (nearBottom) fields.scroll.scrollTop = fields.scroll.scrollHeight;
    } else if (payload.type === 'bookworm:result') finish(payload);
  });
  function mount() {
    if (disposed) return;
    if (widget?.isConnected) return;
    if (popup) close(false);
    composer?.classList.remove('bw-composer-host');
    composer = document.querySelector('[data-component="InputArea"]');
    if (!composer) return;
    composer.classList.add('bw-composer-host');
    widget = document.createElement('button'); widget.id = 'bw-corner-widget'; widget.type = 'button';
    widget.setAttribute('aria-label','Open BookWorm'); widget.setAttribute('aria-expanded','false'); widget.setAttribute('aria-controls','bw-popup-window');
    widget.innerHTML = `<img src="${SPRITES.sleeping}" alt="" draggable="false">`;
    widget.onclick = e => { e.preventDefault(); open(); };
    composer.appendChild(widget);
  }
  listen(document,'click',e => {
    if (!popup || popup.contains(e.target) || widget?.contains(e.target)) return;
    fields.settings.hidden = true; fields.history.hidden = true; updateExpanded();
  });
  listen(window,'resize',position);
  if (window.visualViewport) listen(window.visualViewport,'resize',position);
  const observer = new MutationObserver(mount);
  observer.observe(document.body,{childList:true,subtree:true}); mount();
  return () => { disposed = true; observer.disconnect(); domLifetime.abort(); close(false); widget?.remove(); composer?.classList.remove('bw-composer-host'); unsubscribe(); removeStyle(); };
}
