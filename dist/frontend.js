

// ─── 🐛 SPRITE URLS ───────────────────────────
const SLEEPING_WORM_IMG = "https://files.catbox.moe/zjfl6h.png";
const AWAKE_WORM_IMG    = "https://files.catbox.moe/xg4da6.png";

if (typeof Image !== 'undefined') {
  const preloadImg = new Image();
  preloadImg.src = AWAKE_WORM_IMG;
}

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
      /* Anchors his feet to the top border of the composer */
      bottom: calc(100% - 4px);
      right: 26px;
      z-index: 40;
      background: transparent;
      border: none;
      padding: 0;
      margin: 0;
      cursor: pointer;
      user-select: none;
      display: inline-flex;
      align-items: flex-end;
      line-height: 0;
      transition: transform 0.16s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    #bw-corner-widget:hover {
      transform: translateY(-2px) scale(1.05);
    }

    #bw-corner-widget:active {
      transform: translateY(1px) scale(0.96);
    }

    .bw-sprite-img {
      height: 42px;
      width: auto;
      object-fit: contain;
      filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.55));
      pointer-events: none;
      -webkit-user-drag: none;
      transition: opacity 0.12s ease;
    }

    .bw-popup-card {
      position: absolute;
      bottom: calc(100% + 14px);
      right: 12px;
      width: 420px;
      max-width: calc(100vw - 24px);
      background: var(--lumiverse-bg-elevated, #141721);
      border: 1px solid var(--lumiverse-border, #334155);
      border-radius: 12px;
      box-shadow: 0 14px 40px rgba(0,0,0,0.7), 0 0 14px color-mix(in srgb, var(--lumiverse-primary, #8c82ff) 20%, transparent);
      z-index: 60;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px;
      box-sizing: border-box;
      font-family: inherit;
      color: var(--lumiverse-text, #e2e8f0);
      animation: bwPopIn 0.14s ease-out;
    }

    @keyframes bwPopIn {
      from { opacity: 0; transform: translateY(8px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
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

  function updateWidgetSprite() {
    const img = document.querySelector('#bw-corner-widget img');
    if (!img) return;
    img.src = isOpen ? AWAKE_WORM_IMG : SLEEPING_WORM_IMG;
  }

  function populateComposer(text) {
    const ta = document.querySelector('[data-component="InputArea"] textarea, textarea[name="chat-message"], textarea');[cite: 2]
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
    toggleWidget(false); // Put him back to sleep after inserting text!
  }

  function getRecentSceneContext() {
    const cards = document.querySelectorAll('[data-component="MessageContent"], [class*="_content_"], [class*="_prose_"]');[cite: 2]
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

      <div class="bw-results-box" id="bw-output-box">BookWorm is awake and awaiting your inquiry!</div>
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
    const inputArea = document.querySelector('[data-component="InputArea"]');[cite: 2]
    if (!inputArea) return;

    isOpen = typeof forceState === 'boolean' ? forceState : !isOpen;
    updateWidgetSprite();

    if (isOpen) {
      ctx.sendToBackend({ type: 'bookworm:get_connections' });
      renderPopup(inputArea);
    } else {
      document.getElementById('bw-popup-window')?.remove();
    }
  }

  // ─── BACKEND IPC HANDLERS ──────────────────────────────────────────────────
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

  // ─── MOUNT PERCHED WIDGET ───────────────────────────────────────────────────
  function mountPerchedWidget() {
    document.getElementById('bw-toolbar-btn')?.remove();

    if (document.getElementById('bw-corner-widget')) return;

    const inputArea = document.querySelector('[data-component="InputArea"]');[cite: 2]
    if (!inputArea) return;

    const btn = document.createElement('button');
    btn.id = 'bw-corner-widget';
    btn.type = 'button';
    btn.title = 'BookWorm (Click to wake/consult)';
    btn.innerHTML = `<img src="${isOpen ? AWAKE_WORM_IMG : SLEEPING_WORM_IMG}" class="bw-sprite-img" alt="BookWorm" />`;

    btn.onclick = (e) => {
      e.preventDefault();
      toggleWidget();
    };

    inputArea.appendChild(btn);
  }

  const obs = new MutationObserver(() => mountPerchedWidget());
  obs.observe(document.body, { childList: true, subtree: true });
  mountPerchedWidget();
  ctx.sendToBackend({ type: 'bookworm:get_connections' });

  return () => {
    obs.disconnect();
    unsubMsg();
    removeStyle();
    document.getElementById('bw-corner-widget')?.remove();
    document.getElementById('bw-popup-window')?.remove();
  };
}
