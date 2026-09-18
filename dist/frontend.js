// dist/frontend.js — BookWorm Grimoire Edition

// ─── 🐛 SPRITE DIRECTORY (Paste your Catbox links here!) ─────────────────────
const SPRITES = {
  sleeping: "https://files.catbox.moe/fsxx8g.png",
  awake:    "https://files.catbox.moe/dyulgy.png",
  reading:  "https://files.catbox.moe/ayrl12.png",
  thinking: "https://files.catbox.moe/goxqqa.png",
  munching: "https://files.catbox.moe/1njkd6.png",
  singing:  "https://files.catbox.moe/cvud99.png",
};

// Preload all sprites into memory for instant transitions
if (typeof Image !== 'undefined') {
  Object.values(SPRITES).forEach((src) => {
    if (src && !src.includes('YOUR_')) {
      const img = new Image();
      img.src = src;
    }
  });
}

export function setup(ctx) {
  let activeTab = 'tot'; // 'tot' | 'thesaurus' | 'research' | 'next_step' | 'translate'
  let isGenerating = false;
  let connectionsList = [];
  let selectedConnId = '';
  let isOpen = false;
  let currentDeskMood = 'reading'; // 'reading' | 'thinking' | 'singing' | 'munching'

  // ─── GRIMOIRE BOOK STYLES ──────────────────────────────────────────────────
  const removeStyle = ctx.dom.addStyle(`
    [data-component="InputArea"],
    [class*="_inputArea_"],
    [class*="_composer_"],
    form:has([data-component="InputArea"]) {
      position: relative !important;
      overflow: visible !important;
    }

    #bw-corner-widget {
      position: absolute;
      top: -26px;
      right: 28px;
      z-index: 50;
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
      transform: translateY(-3px) scale(1.08);
    }

    #bw-corner-widget:active {
      transform: translateY(1px) scale(0.96);
    }

    .bw-sprite-img {
      height: 38px;
      width: auto;
      min-width: 32px;
      object-fit: contain;
      filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.65));
      pointer-events: none;
      -webkit-user-drag: none;
    }

    /* ─── Vintage Leather Tome Pop-up Card ─── */
    .bw-book-card {
      position: absolute;
      bottom: calc(100% + 14px);
      right: 8px;
      width: 440px;
      max-width: calc(100vw - 20px);
      background: #181412;
      background-image: 
        radial-gradient(ellipse at top left, rgba(212, 175, 55, 0.08) 0%, transparent 60%),
        linear-gradient(to right, #13100e 0%, #1f1a16 10%, #1f1a16 90%, #13100e 100%);
      border: 3px double #8c6d37;
      border-radius: 4px 10px 10px 4px;
      box-shadow: 
        -4px 0 0 #0d0b0a,
        -7px 0 0 #2b1f16,
        0 14px 42px rgba(0, 0, 0, 0.85),
        inset 0 0 20px rgba(0, 0, 0, 0.7);
      z-index: 60;
      display: flex;
      flex-direction: column;
      gap: 9px;
      padding: 14px 16px;
      box-sizing: border-box;
      font-family: Georgia, "Times New Roman", serif;
      color: #ede2cd;
      animation: bwBookOpen 0.18s ease-out;
    }

    /* Hanging Silk Ribbon Bookmark */
    .bw-book-card::before {
      content: "";
      position: absolute;
      top: -6px;
      right: 36px;
      width: 14px;
      height: 28px;
      background: #9b2226;
      border: 1px solid #5a1215;
      border-bottom: none;
      box-shadow: 0 4px 6px rgba(0,0,0,0.5);
      clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%);
      pointer-events: none;
    }

    @keyframes bwBookOpen {
      from { opacity: 0; transform: translateY(8px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .bw-header {
      display: flex; align-items: center; justify-content: space-between;
      padding-bottom: 7px; border-bottom: 1px dashed rgba(140, 109, 55, 0.4);
    }
    .bw-header-left { display: flex; align-items: center; gap: 10px; }
    .bw-desk-mascot-wrap {
      cursor: pointer;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .bw-desk-mascot {
      height: 42px; width: auto;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));
      transition: transform 0.14s ease;
    }
    .bw-desk-mascot-wrap:hover .bw-desk-mascot {
      transform: scale(1.1) rotate(-3deg);
    }
    .bw-header-title {
      font-size: 14px; font-weight: 700; color: #f4ecd8;
      letter-spacing: 0.05em; text-transform: uppercase;
    }
    .bw-header-subtitle { font-size: 11px; color: #a89a83; font-style: italic; }

    .bw-conn-select {
      background: rgba(14, 12, 10, 0.7);
      border: 1px solid #8c6d37; border-radius: 4px;
      padding: 3px 6px; font-size: 11px; color: #f4ecd8;
      outline: none; font-family: sans-serif;
    }

    /* Grimoire Bookmark Tabs */
    .bw-tabs {
      display: grid; grid-template-columns: repeat(5, 1fr); gap: 3px;
      background: rgba(10, 8, 7, 0.5);
      padding: 3px; border-radius: 6px; border: 1px solid rgba(140, 109, 55, 0.3);
    }
    .bw-tab-btn {
      background: transparent; border: 1px solid transparent; border-radius: 4px;
      padding: 5px 2px; font-size: 10.5px; font-weight: 600; cursor: pointer;
      color: #9c8e77; transition: all 0.12s ease;
      text-align: center; font-family: sans-serif;
    }
    .bw-tab-btn:hover { color: #f4ecd8; background: rgba(140, 109, 55, 0.15); }
    .bw-tab-btn.bw-active {
      background: #2a221a;
      color: #ffd166;
      border-color: #8c6d37;
      box-shadow: 0 1px 4px rgba(0,0,0,0.5);
    }

    /* Parchment Text Input */
    .bw-textarea {
      width: 100%; box-sizing: border-box; min-height: 64px; resize: vertical;
      background: #110e0c;
      border: 1px solid rgba(140, 109, 55, 0.45); border-radius: 4px;
      padding: 8px 10px; font-size: 12px; color: #fdfbf7;
      outline: none; font-family: Georgia, serif; line-height: 1.4;
    }
    .bw-textarea:focus {
      border-color: #d4af37;
      box-shadow: 0 0 8px rgba(212, 175, 55, 0.2);
    }

    .bw-btn-ask {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 5px 14px; border-radius: 4px; font-size: 11.5px; font-weight: 700;
      border: 1px solid #8c6d37;
      background: linear-gradient(to bottom, #382c20, #221b13);
      color: #ffd166; cursor: pointer; font-family: sans-serif;
      box-shadow: 0 2px 4px rgba(0,0,0,0.4);
      transition: all 0.12s ease;
    }
    .bw-btn-ask:hover:not(:disabled) {
      border-color: #d4af37;
      background: linear-gradient(to bottom, #4a3a2a, #2b2218);
      color: #ffffff;
    }
    .bw-btn-ask:disabled { opacity: 0.45; cursor: default; }

    /* Parchment Manuscript Result Display */
    .bw-results-box {
      border: 1px solid #5c4724;
      background: #100d0b;
      border-radius: 4px; padding: 10px; min-height: 80px; max-height: 180px;
      overflow-y: auto; font-size: 12.5px; line-height: 1.55; white-space: pre-wrap;
      color: #e8dcc4; font-family: Georgia, serif;
      box-shadow: inset 0 0 10px rgba(0,0,0,0.6);
    }

    .bw-card-action {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 8px; border-radius: 3px;
      border: 1px solid #8c6d37;
      background: rgba(140, 109, 55, 0.12); font-size: 11px; cursor: pointer;
      color: #ffd166; font-family: sans-serif;
    }
    .bw-card-action:hover {
      background: #8c6d37;
      color: #110e0c;
    }
  `);

  function getDeskSpriteUrl(mood) {
    switch (mood) {
      case 'thinking': return SPRITES.thinking || SPRITES.awake;
      case 'singing':  return SPRITES.singing  || SPRITES.awake;
      case 'munching': return SPRITES.munching || SPRITES.reading || SPRITES.awake;
      case 'reading':
      default:
        return SPRITES.reading || SPRITES.awake;
    }
  }

  function setDeskMood(mood) {
    currentDeskMood = mood;
    const img = document.querySelector('#bw-desk-mascot-img');
    if (img) img.src = getDeskSpriteUrl(mood);
  }

  function updatePerchedSprite() {
    const img = document.querySelector('#bw-corner-widget img');
    if (!img) return;
    img.src = isOpen ? (SPRITES.awake || SPRITES.sleeping) : SPRITES.sleeping;
  }

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
    toggleWidget(false);
  }

  function getRecentSceneContext() {
    const cards = document.querySelectorAll('[data-component="MessageContent"], [class*="_content_"], [class*="_prose_"]');
    const snippets = [];
    Array.from(cards).slice(-4).forEach((el) => {
      const txt = el.innerText?.trim();
      if (txt) snippets.push(txt.slice(0, 600));
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
    popup.className = 'bw-book-card';

    let connOptions = '<option value="">Default Connection</option>';
    connectionsList.forEach((c) => {
      const sel = c.id === selectedConnId ? 'selected' : '';
      connOptions += `<option value="${c.id}" ${sel}>${c.name}</option>`;
    });

    popup.innerHTML = `
      <div class="bw-header">
        <div class="bw-header-left">
          <div class="bw-desk-mascot-wrap" id="bw-desk-mascot-btn" title="Click to feed the scholar!">
            <img src="${getDeskSpriteUrl(currentDeskMood)}" id="bw-desk-mascot-img" class="bw-desk-mascot" alt="BookWorm Mascot" />
          </div>
          <div>
            <div class="bw-header-title">The BookWorm Grimoire</div>
            <div class="bw-header-subtitle">Literary desk & linguistic companion</div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <select class="bw-conn-select" id="bw-conn-picker">${connOptions}</select>
          <button id="bw-popup-close" style="background:transparent; border:none; color:#a89a83; cursor:pointer; font-size:14px;">✕</button>
        </div>
      </div>

      <div class="bw-tabs">
        <button class="bw-tab-btn ${activeTab === 'tot' ? 'bw-active' : ''}" data-tab="tot">Tip of Tongue</button>
        <button class="bw-tab-btn ${activeTab === 'thesaurus' ? 'bw-active' : ''}" data-tab="thesaurus">Thesaurus</button>
        <button class="bw-tab-btn ${activeTab === 'research' ? 'bw-active' : ''}" data-tab="research">Research</button>
        <button class="bw-tab-btn ${activeTab === 'next_step' ? 'bw-active' : ''}" data-tab="next_step">Consultant</button>
        <button class="bw-tab-btn ${activeTab === 'translate' ? 'bw-active' : ''}" data-tab="translate">Translator</button>
      </div>

      <textarea class="bw-textarea" id="bw-query-input"></textarea>

      <div style="display:flex; justify-content:flex-end;">
        <button class="bw-btn-ask" id="bw-ask-btn">Consult Tome</button>
      </div>

      <div class="bw-results-box" id="bw-output-box">The scholar awaits your inquiry upon the parchment.</div>
      <div id="bw-result-actions" style="display:none; justify-content:flex-end; gap:6px;">
        <button class="bw-card-action" id="bw-inject-btn">Inscribe into Composer</button>
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
    const mascotWrap = popup.querySelector('#bw-desk-mascot-btn');

    connPicker.onchange = (e) => { selectedConnId = e.target.value; };
    closeBtn.onclick = () => toggleWidget(false);

    // Mascot Easter Egg: Hover or click feeds him a leaf!
    mascotWrap.onmouseenter = () => {
      if (!isGenerating) setDeskMood('munching');
    };
    mascotWrap.onmouseleave = () => {
      if (!isGenerating) setDeskMood(outputBox.textContent.startsWith('The scholar') ? 'reading' : 'singing');
    };
    mascotWrap.onclick = () => {
      setDeskMood('munching');
      setTimeout(() => {
        if (!isGenerating) setDeskMood('reading');
      }, 1500);
    };

    function updatePlaceholder() {
      const placeholders = {
        tot: "Describe the concept or word on the tip of your tongue...",
        thesaurus: "Enter word or concept to spice up (e.g. 'condescending smirk')...",
        research: "Ask domain knowledge (e.g. '18th-century poison brewing protocols')...",
        next_step: "Ask what a persona or archetype should do next in this scene...",
        translate: "Enter phrase and target language/vernacular (e.g. 'Translate to Victorian French' or 'Dwarven dialect')...",
      };
      inputTa.placeholder = placeholders[activeTab];
    }
    updatePlaceholder();

    popup.querySelectorAll('.bw-tab-btn').forEach((btn) => {
      btn.onclick = () => {
        popup.querySelectorAll('.bw-tab-btn').forEach((b) => b.classList.remove('bw-active'));
        btn.classList.add('bw-active');
        activeTab = btn.dataset.tab;
        updatePlaceholder();
      };
    });

    askBtn.onclick = () => {
      const query = inputTa.value.trim();
      if (!query || isGenerating) return;

      isGenerating = true;
      setDeskMood('thinking');
      askBtn.disabled = true;
      askBtn.textContent = 'Scholar is reading…';
      outputBox.textContent = 'Consulting historical tomes…';
      actionsRow.style.display = 'none';

      ctx.sendToBackend({
        type: 'bookworm:consult',
        mode: activeTab,
        query: query,
        connectionId: selectedConnId || null,
        sceneContext: activeTab === 'next_step' ? getRecentSceneContext() : '',
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
    updatePerchedSprite();

    if (isOpen) {
      currentDeskMood = 'reading';
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
        connectionsList.forEach((c) => {
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
        askBtn.textContent = 'Consult Tome';
      }

      if (payload.error) {
        setDeskMood('reading');
        if (outputBox) outputBox.textContent = `Error: ${payload.error}`;
        return;
      }

      setDeskMood('singing'); // Mascot sings with joy upon delivering the answer!
      if (outputBox) {
        outputBox.textContent = payload.answer;
        if (actionsRow) actionsRow.style.display = 'flex';
      }
    }
  });

  // ─── MOUNT PERCHED WIDGET ON RIM ───────────────────────────────────────────
  function mountPerchedWidget() {
    document.getElementById('bw-toolbar-btn')?.remove();

    if (document.getElementById('bw-corner-widget')) return;

    const inputArea = document.querySelector('[data-component="InputArea"]');
    if (!inputArea) return;

    const btn = document.createElement('button');
    btn.id = 'bw-corner-widget';
    btn.type = 'button';
    btn.title = 'BookWorm (Click to open Grimoire)';

    const img = document.createElement('img');
    img.className = 'bw-sprite-img';
    img.alt = 'BookWorm';
    img.src = SPRITES.sleeping;

    btn.appendChild(img);

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
