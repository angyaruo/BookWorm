import { escapeHtml as esc, renderMarkdown } from './markdown.js';
import { createRequestId } from './request-id.js';
import { NATIVE_COMPOSER, selectedKind, replacementFor, preserveCase, setDraft } from './selection.js';
import { sourceCards } from './source-cards.js';

const MESSAGE = '[data-component="MessageContent"], [class*="_prose_"]';
const OWN = '#bw-selection-helper, #bw-popup-window, #bw-corner-widget';
export function createSelectionAssistant({ ctx, getComposer, getWidget, getSettings, getConnection, getTheme, bookOpen, openBook, perk }) {
  let panel, snapshot, dismissed, active, timer, debounce, undo, composing = false, revision = 0, epoch = 0, lastScope = '', lastInput;
  let applied = false, answer = '';
  const cache = new Map(), lifetime = new AbortController();
  const on = (el, name, fn) => el.addEventListener(name, fn, { signal: lifetime.signal });
  const input = () => getComposer()?.querySelector(NATIVE_COMPOSER);
  function scope() {
    const host = getComposer();
    const markers = [...(host?.querySelectorAll('[data-spindle-scope^="chat:"]') || [])];
    // Scope markers may live in the composer's sibling mount points.
    if (!markers.length) markers.push(...document.querySelectorAll('[data-spindle-scope^="chat:"]'));
    return location.href + '|' + markers.map(el => el.getAttribute('data-spindle-scope')).sort().join('|');
  }
  function checkContext() {
    const now = scope(), node = input();
    if (now !== lastScope || node !== lastInput) { epoch++; lastScope = now; lastInput = node; undo = null; }
  }
  function valid(s) {
    checkContext();
    return s?.origin === 'draft' && s.node.isConnected && s.node === input() && !s.node.readOnly && !s.node.disabled && !composing && s.epoch === epoch && s.revision === revision && s.scope === scope() && s.node.value === s.value;
  }
  function send(payload) {
    try { Promise.resolve(ctx.sendToBackend(payload)).catch(() => receive({ type: 'bookworm:result', requestId: payload.requestId, error: 'Lumiverse disconnected. Your draft was not changed.' })); }
    catch { receive({ type: 'bookworm:result', requestId: payload.requestId, error: 'Lumiverse disconnected. Your draft was not changed.' }); }
  }
  function cancel() {
    const previous = active; active = null; clearTimeout(timer);
    if (previous) send({ type: 'bookworm:cancel', requestId: previous.id });
    panel?.querySelector('[data-help=stop]')?.setAttribute('hidden', '');
  }
  function dismiss() {
    clearTimeout(debounce); dismissed = snapshot?.origin === 'draft' ? { ...snapshot, revision } : snapshot;
    cancel(); panel?.remove(); panel = null; snapshot = null; answer = ''; undo = null; applied = false; perk(false);
  }
  function status(text) { if (panel) { panel.querySelector('[role=status]').textContent = text; position(); } }
  function position() {
    if (!panel) return;
    const vv = window.visualViewport, x = vv?.offsetLeft || 0, y = vv?.offsetTop || 0;
    const w = vv?.width || innerWidth, h = vv?.height || innerHeight;
    panel.style.maxWidth = `${Math.max(160, w - 24)}px`;
    const rect = getWidget()?.getBoundingClientRect();
    const above = (rect?.top ?? y + h) - y - 22, below = y + h - (rect?.bottom ?? y + h) - 22;
    const useAbove = above >= below;
    panel.style.maxHeight = `${Math.max(80, Math.min(h - 24, useAbove ? above : below))}px`;
    const size = panel.getBoundingClientRect();
    panel.style.left = `${Math.max(x + 12, Math.min((rect?.right ?? x + w - 12) - size.width, x + w - size.width - 12))}px`;
    panel.style.top = `${Math.max(y + 12, Math.min(useAbove ? (rect?.top ?? y + h) - size.height - 10 : rect.bottom + 10, y + h - size.height - 12))}px`;
  }
  function theme() { if (panel) panel.dataset.theme = getTheme(); }
  function show(s) {
    cancel(); snapshot = s; dismissed = null; answer = ''; undo = null; applied = false;
    panel?.remove(); panel = document.createElement('section');
    panel.id = 'bw-selection-helper'; panel.setAttribute('role', 'region'); panel.setAttribute('aria-label', 'Buggy selection helper');
    const draft = s.origin === 'draft';
    panel.innerHTML = `<header><div><small>${draft ? 'A note in the margin' : 'Between the lines'}</small><h2>little word. big possibilities.</h2></div><button type="button" data-help="close" aria-label="Dismiss selection helper">×</button></header>
      <p class="bw-selected">${esc(s.text.slice(0, 160))}${s.text.length > 160 ? '…' : ''}</p>
      <p role="status" aria-live="polite">${s.kind === 'word' ? 'Opening the local dictionary…' : 'Pick a tool. Highlighting alone never calls a model or searches online.'}</p>
      <div class="bw-help-result" aria-label="Selection answer"></div>
      <div class="bw-help-actions"><button type="button" data-help="explain">Explain meaning · AI</button><button type="button" data-help="translate">Translate…</button>${draft ? '<button type="button" data-help="polish">Polish draft · AI</button><button type="button" data-help="custom">Custom rewrite…</button>' : ''}<button type="button" data-help="web">Search online…</button><button type="button" data-help="desk">Open writing desk</button><button type="button" data-help="stop" hidden>Stop</button></div>
      <form class="bw-help-form" hidden><label for="bw-help-direction"></label><input id="bw-help-direction" maxlength="1000" autocomplete="off"><p class="bw-help-disclosure"></p><button type="submit">Continue</button></form>
      <div class="bw-help-actions"><button type="button" data-help="copy" hidden>Copy result</button><button type="button" data-help="undo" hidden>Undo replacement</button></div>`;
    document.body.append(panel); theme(); perk(true); position();
    // Keep native selection intact when buttons are clicked. Inputs remain focusable.
    panel.onpointerdown = e => { if (e.target.closest('button') && e.pointerType === 'mouse') e.preventDefault(); };
    panel.onclick = async e => {
      const button = e.target.closest('button'); if (!button) return;
      const action = button.dataset.help;
      if (button.dataset.synonym) { cancel(); replace(preserveCase(snapshot.text, button.dataset.synonym), snapshot); return; }
      if (action === 'close') { dismiss(); return; }
      if (action === 'desk') { dismiss(); openBook(); return; }
      if (action === 'stop') { cancel(); status('Stopped. Your draft was not changed.'); return; }
      if (action === 'undo') {
        if (!undo || !valid(undo)) { status('The draft or chat changed. Undo will not overwrite your new work.'); return; }
        const previous = undo; undo = null; setDraft(previous.node, previous.original);
        previous.node.focus(); previous.node.setSelectionRange(previous.start, previous.end);
        panel.querySelector('[data-help=undo]').hidden = true; status('Original wording restored.'); applied = true; return;
      }
      if (action === 'copy') {
        try { await navigator.clipboard.writeText(answer); status('Copied.'); }
        catch { status('Clipboard unavailable here. Select the result and copy it manually.'); }
        return;
      }
      if (active && active.kind !== 'lookup') { status('Stop the current request before starting another.'); return; }
      if (action === 'explain') { run('explain'); return; }
      if (action === 'polish') { run('transform', 'Polish clarity, flow, and grammar while preserving meaning, voice, point of view, tense, and all details.'); return; }
      if (['translate', 'custom', 'web'].includes(action)) {
        const form = panel.querySelector('form'), field = form.querySelector('input');
        form.dataset.kind = action; form.hidden = false;
        form.querySelector('label').textContent = action === 'web' ? 'Search terms (only this is sent to search)' : action === 'translate' ? 'Target language or register' : 'How should Buggy rewrite this?';
        field.maxLength = action === 'web' ? 500 : 1000;
        field.value = action === 'web' && s.kind === 'word' ? s.text : '';
        field.placeholder = action === 'web' ? 'e.g. Baldur’s Gate mind flayer lore' : action === 'translate' ? 'e.g. French' : 'e.g. A weary cowboy telling the story';
        form.querySelector('.bw-help-disclosure').textContent = action === 'web' ? 'Uses your configured Lumiverse search provider. No draft or chat context is added.' : draft ? 'AI will replace only the captured selection when complete, if the draft is unchanged. Undo is available. Nothing is sent as a chat message.' : 'Sends the selected passage to your writing model. The result stays here.';
        form.querySelector('button').textContent = action === 'web' ? 'Search online' : draft ? 'Transform selection' : 'Translate passage';
        field.focus(); position();
      }
    };
    panel.querySelector('form').onsubmit = e => {
      e.preventDefault();
      if (composing || active && active.kind !== 'lookup') return;
      const form = e.currentTarget, value = form.querySelector('input').value.trim();
      if (!value) return;
      const kind = form.dataset.kind;
      if (kind === 'web') run('search', value);
      else if (kind === 'translate') run(draft ? 'transform' : 'translate', `Translate into ${value}.`);
      else run('transform', value);
      form.hidden = true; position();
    };
    if (s.kind === 'word') {
      if (cache.has(s.text.toLowerCase())) showLookup(cache.get(s.text.toLowerCase()));
      else run('lookup');
    }
  }
  function showLookup(lookup) {
    if (!panel) return;
    const entries = (lookup.entries || []).slice(0, 6);
    panel.querySelector('.bw-help-result').innerHTML = entries.length ? entries.map(entry => `<section><small>${esc(entry.partOfSpeech)}</small><p>${esc(entry.definition)}</p>${snapshot.origin === 'draft' && entry.synonyms?.length ? `<div class="bw-help-actions">${entry.synonyms.slice(0, 10).map(word => `<button type="button" data-synonym="${esc(word)}">${esc(word)}</button>`).join('')}</div>` : ''}</section>`).join('') : '<p>No English dictionary entry. Try Explain meaning or an explicit online search.</p>';
    panel.querySelector('.bw-help-result').insertAdjacentHTML('beforeend', '<p><small><a href="https://en-word.net/" target="_blank" rel="noopener noreferrer">Open English WordNet 2025</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a></small></p>');
    status(snapshot.origin === 'draft' ? 'Local dictionary · choose a synonym to replace the selected word. Check its sense and inflection.' : 'Local dictionary · no AI or internet used.'); position();
  }
  function replace(text, captured) {
    if (!valid(captured)) { status('The draft or chat changed. Nothing was replaced; your result is kept here to copy.'); return false; }
    const value = replacementFor(captured, captured.node.value, text);
    if (value === null) return false;
    applied = true;
    setDraft(captured.node, value);
    undo = { ...captured, value, revision, original: captured.value };
    panel.querySelector('[data-help=undo]').hidden = false;
    const end = captured.end + value.length - captured.value.length;
    captured.node.focus(); captured.node.setSelectionRange(end, end);
    status('Selection replaced. Read it over, Undo if needed, then send it yourself when ready.');
    return true;
  }
  function run(kind, direction = '') {
    if (!snapshot || snapshot.text.length > 20000) { status('Select up to 20,000 characters.'); return; }
    if (kind === 'transform' && !valid(snapshot)) { status('The draft changed. Select the passage again before transforming it.'); return; }
    cancel();
    const id = createRequestId(), settings = getSettings();
    active = { id, kind, captured: snapshot, text: '' }; answer = '';
    panel.querySelector('[data-help=copy]').hidden = true;
    panel.querySelector('[data-help=stop]').hidden = false;
    status(kind === 'lookup' ? 'Opening the local dictionary…' : kind === 'search' ? 'Searching your configured web provider…' : 'Buggy is working. Your draft stays untouched until a complete replacement is ready.');
    timer = setTimeout(() => { if (active?.id === id) { cancel(); status('The request timed out. Your draft was not changed.'); } }, (kind === 'lookup' || kind === 'search' ? 60 : settings.timeoutSeconds + 15) * 1000);
    send({ type: kind === 'lookup' ? 'bookworm:lookup_word' : kind === 'search' ? 'bookworm:web_search' : 'bookworm:consult', requestId: id,
      query: kind === 'search' ? direction : kind === 'translate' ? `${direction}\n\n${snapshot.text}` : snapshot.text,
      ...(kind !== 'lookup' && kind !== 'search' ? { mode: kind, direction, connectionId: getConnection() || null, timeoutSeconds: settings.timeoutSeconds, extendedOutput: settings.extendedOutput } : {}),
    });
  }
  function receive(payload) {
    if (!active || payload.requestId !== active.id || !panel) return false;
    if (payload.type === 'bookworm:result_chunk') {
      // Keep streaming text as a preview; never mutate the draft incrementally.
      active.text += payload.text || '';
      panel.querySelector('.bw-help-result').textContent = active.text.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, ''); position(); return true;
    }
    if (payload.type !== 'bookworm:result') return false;
    const request = active; active = null; clearTimeout(timer);
    panel.querySelector('[data-help=stop]').hidden = true;
    if (payload.lookup) {
      cache.set(request.captured.text.toLowerCase(), payload.lookup);
      if (cache.size > 20) cache.delete(cache.keys().next().value);
      showLookup(payload.lookup); return true;
    }
    answer = payload.answer || '';
    const output = panel.querySelector('.bw-help-result');
    if (answer || payload.sources?.length) output.innerHTML = (request.kind === 'transform' ? `<p class="bw-replacement-preview">${esc(answer)}</p>` : renderMarkdown(answer)) + sourceCards(payload.sources);
    panel.querySelector('[data-help=copy]').hidden = !answer;
    status(payload.error || payload.warning || (request.kind === 'search' ? 'Search snippets returned. Open a source to verify the details.' : 'Ready. Nothing has been sent to chat.'));
    if (request.kind === 'transform' && answer) {
      if (payload.complete === true && !payload.error && !payload.warning) replace(answer, request.captured);
      else status((payload.error || payload.warning || 'The provider did not confirm a complete answer.') + ' Your draft was not changed.');
    }
    position(); return true;
  }
  function capture() {
    if (composing || bookOpen() || getSettings().selectionHelp === false || panel?.contains(document.activeElement)) return;
    checkContext();
    let s;
    const node = input();
    if (node && document.activeElement === node && node.selectionEnd > node.selectionStart) {
      const start = node.selectionStart, end = node.selectionEnd, text = node.value.slice(start, end);
      if (!text.trim()) return;
      s = { origin: 'draft', node, value: node.value, start, end, text, revision, epoch, scope: scope() };
    } else {
      const selection = document.getSelection();
      if (selection && !selection.isCollapsed && selection.rangeCount) {
        const start = selection.anchorNode?.parentElement, end = selection.focusNode?.parentElement;
        const message = start?.closest(MESSAGE);
        if (!start?.closest(OWN) && message && message === end?.closest(MESSAGE) && message.isConnected) s = { origin: 'chat', node: message, text: selection.toString(), epoch };
      }
    }
    if (!s?.text.trim()) { dismissed = null; return; }
    if (s.text.length > 20000) return;
    s.kind = selectedKind(s.text);
    if (dismissed?.node === s.node && dismissed.text === s.text && dismissed.start === s.start && dismissed.end === s.end && dismissed.epoch === s.epoch && dismissed.revision === s.revision) return;
    if (snapshot?.node === s.node && snapshot.text === s.text && snapshot.start === s.start && snapshot.end === s.end && snapshot.revision === s.revision && snapshot.epoch === s.epoch) return;
    show(s);
  }
  function schedule(e) {
    if (e?.target?.closest?.(OWN)) return;
    clearTimeout(debounce); debounce = setTimeout(capture, 220);
  }
  on(document, 'selectionchange', schedule); on(document, 'select', schedule); on(document, 'pointerup', schedule); on(document, 'keyup', schedule);
  on(document, 'compositionstart', () => { composing = true; });
  on(document, 'compositionend', e => { composing = false; schedule(e); });
  on(document, 'input', e => { if (e.target === input()) { revision++; if (panel && !applied) status('Draft edited. Select it again to replace text safely.'); } });
  on(document, 'pointerdown', e => {
    if (!panel || e.target.closest?.(OWN) || active || undo) return;
    if (e.target !== input()) dismiss();
  });
  on(document, 'keydown', e => { if (e.key === 'Escape' && panel && !bookOpen()) { e.preventDefault(); dismiss(); } });
  on(window, 'resize', position); on(document, 'scroll', position);
  if (window.visualViewport) { on(window.visualViewport, 'resize', position); on(window.visualViewport, 'scroll', position); }
  const observer = new MutationObserver(() => {
    const previous = epoch; checkContext();
    if (previous !== epoch && panel) { cancel(); status('Chat changed. Select text in this chat to continue.'); panel.querySelector('[data-help=undo]').hidden = true; }
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-spindle-scope'] }); checkContext();
  return {
    receive, dismiss, theme,
    activate() { if (!panel || !snapshot) return false; position(); panel.querySelector('[data-help=explain]').focus(); return true; },
    dispose() { dismiss(); clearTimeout(debounce); observer.disconnect(); lifetime.abort(); },
  };
}
