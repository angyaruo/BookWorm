// dist/frontend.js — BookWorm Composer Corner Widget

const SLEEPING_MASCOT_SVG = `
<svg width="44" height="26" viewBox="0 0 140 80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Body segments resting flat -->
  <circle cx="120" cy="56" r="13" fill="#84cc16" stroke="#0f172a" stroke-width="4"/>
  <circle cx="102" cy="54" r="15" fill="#22c55e" stroke="#0f172a" stroke-width="4"/>
  <circle cx="82" cy="52" r="16" fill="#84cc16" stroke="#0f172a" stroke-width="4"/>
  <circle cx="62" cy="54" r="17" fill="#22c55e" stroke="#0f172a" stroke-width="4"/>
  <!-- Feet -->
  <ellipse cx="62" cy="72" rx="4" ry="3" fill="#15803d" stroke="#0f172a" stroke-width="2"/>
  <ellipse cx="82" cy="70" rx="4" ry="3" fill="#15803d" stroke="#0f172a" stroke-width="2"/>
  <ellipse cx="102" cy="69" rx="4" ry="3" fill="#15803d" stroke="#0f172a" stroke-width="2"/>
  <ellipse cx="118" cy="68" rx="4" ry="3" fill="#15803d" stroke="#0f172a" stroke-width="2"/>
  <!-- Yellow Head -->
  <circle cx="38" cy="50" r="19" fill="#facc15" stroke="#0f172a" stroke-width="4"/>
  <!-- Relaxed Drooping Antennae -->
  <path d="M30 35 C24 24 16 22 14 26" stroke="#0f172a" stroke-width="4" stroke-linecap="round"/>
  <circle cx="13" cy="27" r="4.5" fill="#22c55e" stroke="#0f172a" stroke-width="2"/>
  <path d="M42 34 C46 23 54 23 56 27" stroke="#0f172a" stroke-width="4" stroke-linecap="round"/>
  <circle cx="57" cy="27" r="4.5" fill="#22c55e" stroke="#0f172a" stroke-width="2"/>
  <!-- Sleeping Curved Eyes -->
  <path d="M26 47 Q30 51 34 47" stroke="#0f172a" stroke-width="3" stroke-linecap="round" fill="none"/>
  <path d="M42 47 Q46 51 50 47" stroke="#0f172a" stroke-width="3" stroke-linecap="round" fill="none"/>
  <!-- Nose -->
  <circle cx="38" cy="52" r="3.5" fill="#ef4444"/>
  <!-- Zzz Bubble -->
  <path d="M12 28 C12 22 17 18 23 18 C29 18 34 22 34 28 C34 31 31 33 28 35 L27 40 L24 36 C17 36 12 33 12 28 Z" fill="#ffffff" stroke="#0f172a" stroke-width="2"/>
  <text x="23" y="30" font-family="monospace" font-size="11" font-weight="900" fill="#0f172a" text-anchor="middle">z</text>
</svg>
`;

export function setup(ctx) {
  let activeTab = 'tot';
  let isGenerating = false;
  let connectionsList = [];
  let selectedConnId = '';
  let isOpen = false;

  // ─── STYLES ──────────────────────────────────────────────────────────────────
  const removeStyle = ctx.dom.addStyle(`
    [data-component="InputArea"] {
      position: relative !important;
      overflow: visible !important;
    }
    #bw-corner-widget {
      position: absolute;
      top: 6px;
      right: 12px;
      z-index: 35;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 2px 6px;
      border-radius: 8px;
      background: transparent;
      border: 1px solid transparent;
      cursor: pointer;
      user-select: none;
      transition: all 0.15s ease;
    }
    #bw-corner-widget:hover {
      background: color-mix(in srgb, var(--lumiverse-primary, #8c82ff) 10%, transparent);
      border-color: color-mix(in srgb, var(--lumiverse-primary, #8c82ff) 30%, transparent);
      transform: translateY(-1px);
    }
    #bw-corner-widget.bw-active {
      background: color-mix(in srgb, var(--lumiverse-primary, #8c82ff) 18%, transparent);
      border-color: var(--lumiverse-primary, #8c82ff);
    }
    .bw-popup-card {
      position: absolute;
      bottom: calc(100% + 10px);
      right: 8px;
      width: 420px;
      max-width: calc(100vw - 24px);
      background: var(--lumiverse-bg-elevated, #141721);
      border: 1px solid var(--lumiverse-border, #334155);
      border-radius: 12px;
      box-shadow: 0 12px 36px rgba(0,0,0,0.65), 0 0 12px color-mix(in srgb, var(--lumiverse-primary, #8c82ff) 20%, transparent);
      z-index: 50;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px;
      box-sizing: border-box;
      font-family: inherit;
      color: var(--lumiverse-text, #e2e8f0);
      animation: bwFadeIn 0.14s ease-out;
    }
    @keyframes bwFadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .bw-header {
      display: flex; align-items: center; justify-content: space-between;
      padding-bottom: 6px; border-bottom: 1px solid var(--lumiverse-border, #334155);
    }
    .bw-header-title { font-size: 13.5px; font-weight: 700; color: var(--lumiverse-text, #f8fafc); }
    .bw-header-subtitle { font-size: 10.5px; color: var(--lumiverse-text-dim, #94a3b8); }
    .bw-conn-select {
      background: var(--lumiverse-fill-subtle, rgba(0,0,0,0.25));
      border: 1px solid var(--lumiverse-border, #334155); border-radius: 6px;
      padding: 3px 6px; font-size: 11px; color: var(--lumiverse-text, #e2e8f0); outline: none;
    }
    .bw-tabs {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;
      background: var(--lumiverse-fill-subtle, rgba(0,0,0,0.25));
      padding: 3px; border-radius: 8px; border: 1px solid var(--lumiverse-border, #334155);
    }
    .bw-tab-btn {
      background: transparent; border: none; border-radius: 6px;
      padding: 5px 3px; font-size: 11px; font-weight: 600; cursor: pointer;
      color: var(--lumiverse-text-dim, #94a3b8); transition: all 0.12s ease;
      text-align: center;
    }
    .bw-tab-btn:hover { color: var(--lumiverse-text, #f8fafc); }
    .bw-tab-btn.bw-active {
      background: var(--lumiverse-fill, #1e293b);
      color: var(--lumiverse-primary, #8c82ff);
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }
    .bw-textarea {
      width: 100%; box-sizing: border-box; min-height: 65px; resize: vertical;
      background: var(--lumiverse-fill-subtle, rgba(0,0,0,0.25));
      border: 1px solid var(--lumiverse-border, #334155); border-radius: 6px;
      padding: 8px 10px; font-size: 12px; color: var(--lumiverse-text, #f8fafc);
      outline: none; font-family: inherit;
    }
    .bw-textarea:focus { border-color: var(--lumiverse-primary, #8c82ff); }
    .bw-btn-ask {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 5px 12px; border-radius: 6px; font-size: 11.5px; font-weight: 600;
      border: 1px solid var(--lumiverse-primary, #8c82ff);
      background: color-mix(in srgb, var(--lumiverse-primary, #8c82ff) 20%, transparent);
      color: var(--lumiverse-primary, #8c82ff); cursor: pointer; transition: background 0.12s;
    }
    .bw-btn-ask:hover:not(:disabled) {
      background: color-mix(in srgb, var(--lumiverse-primary, #8c82ff) 35%, transparent);
    }
    .bw-btn-ask:disabled { opacity: 0.45; cursor: default; }
    .bw-results-box {
      border: 1px solid var(--lumiverse-border, #334155);
      background: var(--lumiverse-fill-subtle, rgba(0,0,0,0.15));
      border-radius: 6px; padding: 8px 10px; min-height: 80px; max-height: 180px;
      overflow-y: auto; font-size: 12px; line-height: 1.5; white-space: pre-wrap;
    }
    .bw-card-action {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 8px; border-radius: 4px;
      border: 1px solid var(--lumiverse-border, #334155);
      background: transparent; font-size: 11px; cursor: pointer;
      color: var(--lumiverse-text-muted, #94a3b8);
    }
    .bw-card-action:hover {
      color: var(--lumiverse-primary, #8c82ff);
      border-color: var(--lumiverse-primary, #8c82ff);
    }
  `);

  function populateComposer(text) {
    const ta = document.querySelector('[data-component="InputArea"] textarea, textarea[name="chat-message"], textarea');
    if (!ta) return;
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )?.set;
    if (nativeSetter) {
      nativeSetter.call(ta, text);
    } else {
      ta.value = text;
    }
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.dispatchEvent(new Event('change', { bubbles: true }));
    ta.focus();
  }

  function getRecentSceneContext() {
    const cards = document.querySelectorAll('[data-component="MessageContent"], [class*="_content_"], [class*="prose"]');
    const snippets = [];
    Array.from(cards).slice(-4).forEach(el => {
      const txt = el.innerText?.trim();
      if (txt) snippets.push(txt.slice(0, 500));
    });
    return snippets.join('\n---\n');
  }

  function renderPopup(container) {
    let popup = document.getElementById('bw-popup-window');
    if (popup) {
      popup.remove();
      return;
    }

    popup = document.createElement('div');
    popup.id = 'bw-popup-window';
    popup.className = 'bw-popup-card';

    let connOptions = '<option value="">Default Connection</option>';
    connectionsList.forEach(c => {
      const sel = c.id === selectedConnId ? 'selected' : '';
      connOptions += `<option value="${c.id}" ${sel}>${c.name}</option>`;
    });

    popup.innerHTML = `
      <div class="bw-header">
        <div>
          <div class="bw-header-title">BookWorm Desk</div>
          <div class="bw-header-subtitle">Literary assistant & domain guide</div>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <select class="bw-conn-select" id="bw-conn-picker">${connOptions}</select>
          <button id="bw-popup-close" style="background:transparent; border:none; color:var(--lumiverse-text-dim,#94a3b8); cursor:pointer; font-size:14px;">✕</button>
        </div>
      </div>

      <div class="bw-tabs">
        <button class="bw-tab-btn ${activeTab === 'tot' ? 'bw-active' : ''}" data-tab="tot">Tip of Tongue</button>
        <button class="bw-tab-btn ${activeTab === 'thesaurus' ? 'bw-active' : ''}" data-tab="thesaurus">Thesaurus</button>
        <button class="bw-tab-btn ${activeTab === 'research' ? 'bw-active' : ''}" data-tab="research">Research</button>
        <button class="bw-tab-btn ${activeTab === 'next_step' ? 'bw-active' : ''}" data-tab="next_step">Consultant</button>
      </div>

      <textarea class="bw-textarea" id="bw-query-input"></textarea>

      <div style="display:flex; justify-content:flex-end;">
        <button class="bw-btn-ask" id="bw-ask-btn">Consult BookWorm</button>
      </div>

      <div class="bw-results-box" id="bw-output-box">Ask the sleeping scholar anything above to wake him!</div>
      <div id="bw-result-actions" style="display:none; justify-content:flex-end; gap:6px;">
        <button class="bw-card-action" id="bw-inject-btn">Insert into Composer</button>
      </div>
    `;

    container.appendChild(popup);

    const inputTa = popup.querySelector('#bw-query-input');
    const outputBox = popup.querySelector('#bw-output-box');
    const askBtn = popup.querySelector('#bw-ask-btn');
    const connPicker = popup.querySelector('#bw-conn-picker');
    const actionsRow = popup.querySelector('#bw-result-actions');
    const injectBtn = popup.querySelector('#bw-inject-btn');
    const closeBtn = popup.querySelector('#bw-popup-close');

    connPicker.onchange = (e) => { selectedConnId = e.target.value; };
    closeBtn.onclick = () => toggleWidget(false);

    function updatePlaceholder() {
      const placeholders = {
        tot: "Describe the concept or word on the tip of your tongue...",
        thesaurus: "Enter word or concept to spice up (e.g. 'condescending smirk')...",
        research: "Ask domain knowledge (e.g. '18th-century poison brewing protocols')...",
        next_step: "Ask what a persona or archetype should do next in this scene...",
      };
      inputTa.placeholder = placeholders[activeTab];
    }
    updatePlaceholder();

    popup.querySelectorAll('.bw-tab-btn').forEach(btn => {
      btn.onclick = () => {
        popup.querySelectorAll('.bw-tab-btn').forEach(b => b.classList.remove('bw-active'));
        btn.classList.add('bw-active');
        activeTab = btn.dataset.tab;
        updatePlaceholder();
      };
    });

    askBtn.onclick = () => {
      const query = inputTa.value.trim();
      if (!query || isGenerating) return;

      isGenerating = true;
      askBtn.disabled = true;
      askBtn.textContent = 'Worm is reading…';
      outputBox.textContent = 'Consulting notes…';
      actionsRow.style.display = 'none';

      ctx.sendToBackend({
        type: 'bookworm:consult',
        mode: activeTab,
        query: query,
        connectionId: selectedConnId || null,
        sceneContext: activeTab === 'next_step' ? getRecentSceneContext() : ''
      });
    };

    injectBtn.onclick = () => {
      const text = outputBox.textContent.trim();
      if (text) populateComposer(text);
    };
  }

  function toggleWidget(forceState) {
    const inputArea = document.querySelector('[data-component="InputArea"]');
    if (!inputArea) return;

    isOpen = typeof forceState === 'boolean' ? forceState : !isOpen;
    const widgetBtn = document.getElementById('bw-corner-widget');
    if (widgetBtn) {
      widgetBtn.classList.toggle('bw-active', isOpen);
    }

    if (isOpen) {
      ctx.sendToBackend({ type: 'bookworm:get_connections' });
      renderPopup(inputArea);
    } else {
      document.getElementById('bw-popup-window')?.remove();
    }
  }

  // ─── RECEIVE BACKEND MESSAGES ──────────────────────────────────────────────
  const unsubMsg = ctx.onBackendMessage((payload) => {
    if (payload.type === 'bookworm:connections') {
      connectionsList = payload.connections || [];
      const connPicker = document.getElementById('bw-conn-picker');
      if (connPicker) {
        let connOptions = '<option value="">Default Connection</option>';
        connectionsList.forEach(c => {
          const sel = c.id === selectedConnId ? 'selected' : '';
          connOptions += `<option value="${c.id}" ${sel}>${c.name}</option>`;
        });
        connPicker.innerHTML = connOptions;
      }
    }

    if (payload.type === 'bookworm:result') {
      isGenerating = false;
      const askBtn = document.getElementById('bw-ask-btn');
      const outputBox = document.getElementById('bw-output-box');
      const actionsRow = document.getElementById('bw-result-actions');

      if (askBtn) {
        askBtn.disabled = false;
        askBtn.textContent = 'Consult BookWorm';
      }

      if (payload.error) {
        if (outputBox) outputBox.textContent = `Error: ${payload.error}`;
        return;
      }

      if (outputBox) {
        outputBox.textContent = payload.answer;
        if (actionsRow) actionsRow.style.display = 'flex';
      }
    }
  });

  // ─── MOUNT CORNER WIDGET ────────────────────────────────────────────────────
  function mountCornerWidget() {
    // Remove old middle-row toolbar button if present
    document.getElementById('bw-toolbar-btn')?.remove();

    if (document.getElementById('bw-corner-widget')) return;

    const inputArea = document.querySelector('[data-component="InputArea"]');
    if (!inputArea) return;

    const btn = document.createElement('button');
    btn.id = 'bw-corner-widget';
    btn.type = 'button';
    btn.title = 'BookWorm (Click to wake/consult)';
    btn.innerHTML = SLEEPING_MASCOT_SVG;

    btn.onclick = (e) => {
      e.preventDefault();
      toggleWidget();
    };

    inputArea.appendChild(btn);
  }

  const obs = new MutationObserver(() => mountCornerWidget());
  obs.observe(document.body, { childList: true, subtree: true });
  mountCornerWidget();
  ctx.sendToBackend({ type: 'bookworm:get_connections' });

  return () => {
    obs.disconnect();
    unsubMsg();
    removeStyle();
    document.getElementById('bw-corner-widget')?.remove();
    document.getElementById('bw-popup-window')?.remove();
  };
}
