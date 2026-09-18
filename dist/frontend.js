

// ─── 🐛 fumckin buge ────────────────────
const SPRITES = {
  sleeping: "https://files.catbox.moe/fsxx8g.png",
  awake:    "https://files.catbox.moe/dyulgy.png",
  reading:  "https://files.catbox.moe/ayrl12.png",
  thinking: "https://files.catbox.moe/goxqqa.png",
  munching: "https://files.catbox.moe/1njkd6.png",
  singing:  "https://files.catbox.moe/cvud99.png",
};

// One line per opening, rotating through the full set before repeating.
const BUGGY_MESSAGES = [
  "i am buge. i dig in book for you. is this okay? let me know.",
  "hello writer person. buggy has arrive, with several thought and one leaf crumb.",
  "the words is hiding again? typical words. we find them.",
  "good day for make sentence. bad day for sentence escape.",
  "buggy was thinking very loud. nobody complain because buggy is small.",
  "welcome back. book is open and brain is mostly also open.",
  "you bring question, i bring suspicious amount of vocabulary.",
  "buggy report for duty. duty is reading. excellent duty.",
  "hmm. perhaps today we put a very good word in a very good place.",
  "i have polish the tiny spectacles. now we see all the metaphor.",
  "bug fact: beetles is about one quarter of all known animal species. very overachieve.",
  "bug fact: butterfly taste with the feet. imagine step on soup and know it.",
  "bug fact: ants do not have lungs. air go in little body holes, very efficient.",
  "bug fact: honeybee can tell direction by doing dance. buggy also dance but give no direction.",
  "bug fact: dragonfly was here before dinosaur. extremely old zooming fellow.",
  "bug fact: ladybug may eat thousands of aphid. tiny red vacuum with fashion.",
  "bug fact: cricket ears is on the front legs. please speak toward knee.",
  "bug fact: firefly light make almost no heat. is called cold light, but look warm to buggy.",
  "bug fact: praying mantis can turn head very far. excellent for seeing unfinished paragraph.",
  "bug fact: some moth drink tears from sleeping animal. rude beverage, beautiful moth.",
];

function getNextBuggyMessage() {
  const stored = Number.parseInt(localStorage.getItem('bw_buggy_message_index') || '-1', 10);
  const nextIndex = (Number.isFinite(stored) ? stored + 1 : 0) % BUGGY_MESSAGES.length;
  localStorage.setItem('bw_buggy_message_index', String(nextIndex));
  return BUGGY_MESSAGES[nextIndex];
}

// Preload sprites into memory
if (typeof Image !== 'undefined') {
  Object.values(SPRITES).forEach((src) => {
    if (src && !src.includes('YOUR_')) {
      const img = new Image();
      img.src = src;
    }
  });
}

// ─── ICONS ───────────────────────────────────────────────────────────────────
const IC = {
  link: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  history: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>`,
  close: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
};

export function setup(ctx) {
  let activeTab = 'tot';
  let isGenerating = false;
  let connectionsList = [];
  let selectedConnId = localStorage.getItem('bw_selected_connection_id') || '';
  let isOpen = false;
  let currentDeskMood = 'reading';
  let rawCurrentAnswer = '';
  let currentBuggyMessage = BUGGY_MESSAGES[0];
  let activeRequestId = null;
  let activeRequestQuery = '';
  let activeRequestMode = '';
  let streamingAnswer = '';

  function cancelActiveRequest() {
    if (activeRequestId) {
      ctx.sendToBackend({ type: 'bookworm:cancel', requestId: activeRequestId });
    }
    activeRequestId = null;
    activeRequestQuery = '';
    activeRequestMode = '';
    streamingAnswer = '';
    isGenerating = false;
  }

  // ─── STYLES ──────────────────────────────────────────────────────────────────
  const removeStyle = ctx.dom.addStyle(`
    [data-component="InputArea"],
    [class*="_inputArea_"],
    [class*="_composer_"],
    form:has([data-component="InputArea"]) {
      position: relative !important;
      overflow: visible !important;
    }

    /* ─── Perched Rim Widget (No Shadows) ─── */
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
    #bw-corner-widget:hover { transform: translateY(-3px) scale(1.08); }
    #bw-corner-widget:active { transform: translateY(1px) scale(0.96); }

    .bw-sprite-img {
      height: 38px;
      width: auto;
      min-width: 32px;
      object-fit: contain;
      pointer-events: none;
      -webkit-user-drag: none;
    }

    /* ─── Grimoire Window (Lifted Higher to Clear Sprite) ─── */
    .bw-book-card {
      position: absolute;
      bottom: calc(100% + 48px);
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
    .bw-header-title {
      font-size: 14px; font-weight: 700; color: #f4ecd8;
      letter-spacing: 0.05em; text-transform: uppercase;
    }
    .bw-header-subtitle { font-size: 11px; color: #a89a83; font-style: italic; }

    /* ─── Lumiverse Native Style Connection Picker & Action Icons ─── */
    .bw-header-actions { display: flex; align-items: center; gap: 6px; position: relative; }
    
    .bw-conn-pill-btn {
      display: inline-flex; align-items: center; gap: 5px;
      background: rgba(22, 19, 16, 0.8);
      border: 1px solid #8c6d37; border-radius: 14px;
      padding: 3px 8px; font-size: 11px; color: #f4ecd8;
      cursor: pointer; font-family: sans-serif; transition: all 0.12s ease;
      max-width: 135px;
    }
    .bw-conn-pill-btn:hover {
      background: rgba(140, 109, 55, 0.25);
      border-color: #ffd166;
    }
    .bw-conn-name {
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    .bw-icon-btn {
      background: transparent; border: none; color: #a89a83;
      cursor: pointer; padding: 4px; display: inline-flex;
      align-items: center; justify-content: center; border-radius: 4px;
      transition: color 0.12s;
    }
    .bw-icon-btn:hover { color: #ffd166; background: rgba(140, 109, 55, 0.15); }

    /* Floating Dropdown Menus (Connection & History) */
    .bw-dropdown-popover {
      position: absolute; top: calc(100% + 6px); right: 0;
      background: #14110f; border: 1px solid #8c6d37;
      border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,0.85);
      z-index: 100; min-width: 180px; max-height: 200px; overflow-y: auto;
      padding: 4px; display: flex; flex-direction: column; gap: 2px;
      font-family: sans-serif; font-size: 11px;
    }
    .bw-dropdown-item {
      padding: 5px 8px; border-radius: 4px; cursor: pointer;
      color: #ede2cd; transition: background 0.12s; text-align: left;
      border: none; background: transparent; display: flex; flex-direction: column;
    }
    .bw-dropdown-item:hover { background: rgba(140, 109, 55, 0.25); color: #ffd166; }
    .bw-dropdown-item.bw-selected { color: #ffd166; font-weight: 700; }
    .bw-history-badge { font-size: 9px; color: #8c6d37; text-transform: uppercase; }

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
      background: #2a221a; color: #ffd166; border-color: #8c6d37;
      box-shadow: 0 1px 4px rgba(0,0,0,0.5);
    }

    .bw-textarea {
      width: 100%; box-sizing: border-box; min-height: 60px; resize: vertical;
      background: #110e0c; border: 1px solid rgba(140, 109, 55, 0.45);
      border-radius: 4px; padding: 8px 10px; font-size: 12px; color: #fdfbf7;
      outline: none; font-family: Georgia, serif; line-height: 1.4;
    }
    .bw-textarea:focus { border-color: #d4af37; box-shadow: 0 0 8px rgba(212, 175, 55, 0.2); }

    .bw-btn-ask {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 5px 14px; border-radius: 4px; font-size: 11.5px; font-weight: 700;
      border: 1px solid #8c6d37;
      background: linear-gradient(to bottom, #382c20, #221b13);
      color: #ffd166; cursor: pointer; font-family: sans-serif;
      box-shadow: 0 2px 4px rgba(0,0,0,0.4); transition: all 0.12s ease;
    }
    .bw-btn-ask:hover:not(:disabled) {
      border-color: #d4af37; background: linear-gradient(to bottom, #4a3a2a, #2b2218);
      color: #ffffff;
    }
    .bw-btn-ask:disabled { opacity: 0.45; cursor: default; }

    /* ─── Bottom Dialogue Row & Off-White Speech Bubble ─── */
    .bw-dialogue-row {
      display: flex;
      align-items: flex-end;
      gap: 12px;
      margin-top: 4px;
      position: relative;
    }

    .bw-bottom-mascot-wrap {
      flex-shrink: 0;
      cursor: pointer;
      position: relative;
      user-select: none;
      line-height: 0;
    }
    .bw-desk-mascot {
      height: 64px;
      width: auto;
      object-fit: contain;
      pointer-events: none;
      -webkit-user-drag: none;
      transition: transform 0.15s ease;
    }
    .bw-bottom-mascot-wrap:hover .bw-desk-mascot {
      transform: scale(1.08) rotate(-3deg);
    }

    .bw-results-box {
      flex: 1;
      position: relative;
      border: 1.5px solid #dcd1be;
      background: #faf7ef;
      color: #241e17;
      border-radius: 9px;
      padding: 10px 12px;
      min-height: 85px;
      max-height: 180px;
      overflow-y: auto;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 12px;
      line-height: 1.55;
      box-shadow: 0 3px 8px rgba(0, 0, 0, 0.25);
    }

    /* Speech Bubble Pointer Tail pointing left towards Buggy */
    .bw-results-box::before {
      content: "";
      position: absolute;
      bottom: 14px;
      left: -8px;
      width: 0; height: 0;
      border-top: 6px solid transparent;
      border-bottom: 6px solid transparent;
      border-right: 8px solid #faf7ef;
      z-index: 2;
    }
    .bw-results-box::after {
      content: "";
      position: absolute;
      bottom: 13px;
      left: -10px;
      width: 0; height: 0;
      border-top: 7px solid transparent;
      border-bottom: 7px solid transparent;
      border-right: 9px solid #dcd1be;
      z-index: 1;
    }

    /* ─── Markdown Rendering Elements inside Dialogue ─── */
    .bw-md-bullet { display: flex; gap: 6px; margin: 3px 0; align-items: flex-start; }
    .bw-md-dot { color: #8c6d37; font-weight: bold; flex-shrink: 0; }
    .bw-md-gap { height: 7px; }
    .bw-results-box b { color: #16120e; font-weight: 700; }
    .bw-results-box i { font-style: italic; color: #3b3127; }

    .bw-card-action {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 8px; border-radius: 3px;
      border: 1px solid #8c6d37;
      background: rgba(140, 109, 55, 0.12); font-size: 11px; cursor: pointer;
      color: #ffd166; font-family: sans-serif;
    }
    .bw-card-action:hover { background: #8c6d37; color: #110e0c; }
  `);

  // ─── LIGHTWEIGHT MARKDOWN RESOLVER ──────────────────────────────────────────
  function renderMarkdown(text) {
    if (!text) return '';
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<b><i>$1</i></b>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    html = html.replace(/\*(.*?)\*/g, '<i>$1</i>');
    html = html.replace(/__(.*?)__/g, '<u>$1</u>');
    html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<div class="bw-md-bullet"><span class="bw-md-dot">•</span><span>$1</span></div>');
    html = html.replace(/\n\n+/g, '<div class="bw-md-gap"></div>');
    html = html.replace(/\n/g, '<br/>');
    return html;
  }

  // ─── QUERY HISTORY STORAGE (LAST 5) ─────────────────────────────────────────
  function getStoredHistory() {
    try {
      return JSON.parse(localStorage.getItem('bw_query_history') || '[]');
    } catch (_) {
      return [];
    }
  }

  function pushHistory(item) {
    const list = getStoredHistory();
    const updated = [item, ...list.filter(x => x.query !== item.query)].slice(0, 5);
    localStorage.setItem('bw_query_history', JSON.stringify(updated));
  }

  // ─── SPRITE STATE ENGINE ───────────────────────────────────────────────────
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

  // ─── RENDER POPUP ───────────────────────────────────────────────────────────
  function renderPopup(container) {
    let popup = document.getElementById('bw-popup-window');
    if (popup) {
      popup.remove();
      return;
    }

    popup = document.createElement('div');
    popup.id = 'bw-popup-window';
    popup.className = 'bw-book-card';

    const activeConnObj = connectionsList.find(c => c.id === selectedConnId);
    const connLabel = activeConnObj ? activeConnObj.name : 'Default Model';

    popup.innerHTML = `
      <div class="bw-header">
        <div>
          <div class="bw-header-title">Ask Buggy</div>
          <div class="bw-header-subtitle">Tip = 1 leaf</div>
        </div>
        <div class="bw-header-actions">
          <button class="bw-conn-pill-btn" id="bw-conn-toggle-btn" title="Select Model Connection">
            ${IC.link}
            <span class="bw-conn-name" id="bw-conn-label">${connLabel}</span>
          </button>
          <div id="bw-conn-menu" class="bw-dropdown-popover" style="display:none;"></div>

          <button class="bw-icon-btn" id="bw-history-toggle-btn" title="Recent Questions">
            ${IC.history}
          </button>
          <div id="bw-history-menu" class="bw-dropdown-popover" style="display:none;"></div>

          <button class="bw-icon-btn" id="bw-popup-close" title="Close Desk">
            ${IC.close}
          </button>
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
        <button class="bw-btn-ask" id="bw-ask-btn">Consult Buggy</button>
      </div>

      <!-- Dialogue Row: Mascot on Bottom Left, Speech Bubble on Right -->
      <div class="bw-dialogue-row">
        <div class="bw-bottom-mascot-wrap" id="bw-desk-mascot-btn" title="Click to give Buggy a leaf!">
          <img src="${getDeskSpriteUrl(currentDeskMood)}" id="bw-desk-mascot-img" class="bw-desk-mascot" alt="Buggy" />
        </div>
        <div class="bw-results-box" id="bw-output-box">${renderMarkdown(currentBuggyMessage)}</div>
      </div>

      <div id="bw-result-actions" style="display:none; justify-content:flex-end; gap:6px;">
        <button class="bw-card-action" id="bw-inject-btn">Inscribe into Composer</button>
      </div>
    `;

    container.appendChild(popup);

    const inputTa = popup.querySelector('#bw-query-input');
    const outputBox = popup.querySelector('#bw-output-box');
    const askBtn = popup.querySelector('#bw-ask-btn');
    const actionsRow = popup.querySelector('#bw-result-actions');
    const injectBtn = popup.querySelector('#bw-inject-btn');
    const closeBtn = popup.querySelector('#bw-popup-close');
    const mascotWrap = popup.querySelector('#bw-desk-mascot-btn');
    const connBtn = popup.querySelector('#bw-conn-toggle-btn');
    const connMenu = popup.querySelector('#bw-conn-menu');
    const histBtn = popup.querySelector('#bw-history-toggle-btn');
    const histMenu = popup.querySelector('#bw-history-menu');

    closeBtn.onclick = () => toggleWidget(false);

    // ─── Connection Dropdown ───
    connBtn.onclick = (e) => {
      e.stopPropagation();
      histMenu.style.display = 'none';
      const isClosed = connMenu.style.display === 'none';
      if (!isClosed) { connMenu.style.display = 'none'; return; }

      connMenu.innerHTML = '';
      const defBtn = document.createElement('button');
      defBtn.className = `bw-dropdown-item ${!selectedConnId ? 'bw-selected' : ''}`;
      defBtn.textContent = 'Default Model';
      defBtn.onclick = () => {
        selectedConnId = '';
        localStorage.removeItem('bw_selected_connection_id');
        popup.querySelector('#bw-conn-label').textContent = 'Default Model';
        connMenu.style.display = 'none';
      };
      connMenu.appendChild(defBtn);

      connectionsList.forEach(c => {
        const item = document.createElement('button');
        item.className = `bw-dropdown-item ${c.id === selectedConnId ? 'bw-selected' : ''}`;
        item.textContent = c.name;
        item.onclick = () => {
          selectedConnId = c.id;
          localStorage.setItem('bw_selected_connection_id', c.id);
          popup.querySelector('#bw-conn-label').textContent = c.name;
          connMenu.style.display = 'none';
        };
        connMenu.appendChild(item);
      });
      connMenu.style.display = 'flex';
    };

    // ─── History Dropdown ───
    histBtn.onclick = (e) => {
      e.stopPropagation();
      connMenu.style.display = 'none';
      const isClosed = histMenu.style.display === 'none';
      if (!isClosed) { histMenu.style.display = 'none'; return; }

      histMenu.innerHTML = '';
      const history = getStoredHistory();
      if (!history.length) {
        histMenu.innerHTML = '<div style="padding:6px; color:#a89a83; text-align:center;">No recent questions</div>';
      } else {
        history.forEach(h => {
          const item = document.createElement('button');
          item.className = 'bw-dropdown-item';
          item.innerHTML = `<span class="bw-history-badge">[${h.mode}]</span><span>${h.query.slice(0, 32)}…</span>`;
          item.onclick = () => {
            activeTab = h.mode;
            popup.querySelectorAll('.bw-tab-btn').forEach(b => b.classList.toggle('bw-active', b.dataset.tab === activeTab));
            inputTa.value = h.query;
            rawCurrentAnswer = h.answer;
            outputBox.innerHTML = renderMarkdown(h.answer);
            actionsRow.style.display = 'flex';
            setDeskMood('singing');
            histMenu.style.display = 'none';
          };
          histMenu.appendChild(item);
        });
      }
      histMenu.style.display = 'flex';
    };

    document.addEventListener('click', () => {
      connMenu.style.display = 'none';
      histMenu.style.display = 'none';
    }, { once: true });

    // Mascot Easter Egg: a click feeds Buggy until the desk is closed.
    mascotWrap.onclick = () => {
      if (!isGenerating) setDeskMood('munching');
    };

    function updatePlaceholder() {
      const placeholders = {
        tot: "Describe the concept or word on the tip of your tongue...",
        thesaurus: "Enter word or concept to spice up (e.g. 'condescending smirk')...",
        research: "Ask domain knowledge (e.g. '18th-century poison brewing protocols')...",
        next_step: "Ask what a persona or archetype should do next in this scene...",
        translate: "Enter phrase and target language/vernacular (e.g. 'Victorian French' or 'Dwarven dialect')...",
      };
      inputTa.placeholder = placeholders[activeTab];
    }
    updatePlaceholder();

    popup.querySelectorAll('.bw-tab-btn').forEach((btn) => {
      btn.onclick = () => {
        cancelActiveRequest();
        popup.querySelectorAll('.bw-tab-btn').forEach((b) => b.classList.remove('bw-active'));
        btn.classList.add('bw-active');
        activeTab = btn.dataset.tab;
        inputTa.value = '';
        rawCurrentAnswer = '';
        outputBox.innerHTML = renderMarkdown(currentBuggyMessage);
        actionsRow.style.display = 'none';
        askBtn.disabled = false;
        askBtn.textContent = 'Consult Buggy';
        setDeskMood('reading');
        updatePlaceholder();
        inputTa.focus();
      };
    });

    askBtn.onclick = () => {
      const query = inputTa.value.trim();
      if (!query || isGenerating) return;

      isGenerating = true;
      activeRequestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      activeRequestQuery = query;
      activeRequestMode = activeTab;
      streamingAnswer = '';
      setDeskMood('thinking');
      askBtn.disabled = true;
      askBtn.textContent = 'Buggy is reading…';
      outputBox.innerHTML = '<i>Buggy is consulting the archives…</i>';
      actionsRow.style.display = 'none';

      ctx.sendToBackend({
        type: 'bookworm:consult',
        mode: activeTab,
        query: query,
        connectionId: selectedConnId || null,
        sceneContext: activeTab === 'next_step' ? getRecentSceneContext() : '',
        requestId: activeRequestId,
      });
    };

    injectBtn.onclick = () => {
      if (rawCurrentAnswer) populateComposer(rawCurrentAnswer);
    };
  }

  function toggleWidget(forceState) {
    const inputArea = document.querySelector('[data-component="InputArea"]');
    if (!inputArea) return;

    isOpen = typeof forceState === 'boolean' ? forceState : !isOpen;
    updatePerchedSprite();

    if (isOpen) {
      cancelActiveRequest();
      currentDeskMood = 'reading';
      currentBuggyMessage = getNextBuggyMessage();
      rawCurrentAnswer = '';
      ctx.sendToBackend({ type: 'bookworm:get_connections' });
      renderPopup(inputArea);
    } else {
      cancelActiveRequest();
      currentDeskMood = 'reading';
      rawCurrentAnswer = '';
      document.getElementById('bw-popup-window')?.remove();
    }
  }

  // ─── BACKEND IPC RECEIVER ───────────────────────────────────────────────────
  const unsubMsg = ctx.onBackendMessage((payload) => {
    if (payload.type === 'bookworm:connections') {
      connectionsList = payload.connections || [];
      const label = document.getElementById('bw-conn-label');
      if (label) {
        const found = connectionsList.find(c => c.id === selectedConnId);
        label.textContent = found ? found.name : 'Default Model';
      }
    }

    if (payload.type === 'bookworm:result_chunk') {
      if (!activeRequestId || payload.requestId !== activeRequestId) return;
      streamingAnswer += payload.text || '';
      const outputBox = document.getElementById('bw-output-box');
      if (outputBox) {
        outputBox.innerHTML = renderMarkdown(streamingAnswer);
        outputBox.scrollTop = outputBox.scrollHeight;
      }
    }

    if (payload.type === 'bookworm:result') {
      if (!activeRequestId || payload.requestId !== activeRequestId) return;
      const completedQuery = activeRequestQuery;
      const completedMode = activeRequestMode;
      isGenerating = false;
      activeRequestId = null;
      activeRequestQuery = '';
      activeRequestMode = '';
      streamingAnswer = '';
      const askBtn = document.getElementById('bw-ask-btn');
      const outputBox = document.getElementById('bw-output-box');
      const actionsRow = document.getElementById('bw-result-actions');

      if (askBtn) {
        askBtn.disabled = false;
        askBtn.textContent = 'Consult Buggy';
      }

      if (payload.error) {
        setDeskMood('reading');
        if (outputBox) outputBox.textContent = `Error: ${payload.error}`;
        return;
      }

      rawCurrentAnswer = payload.answer;
      setDeskMood('singing');

      if (outputBox) {
        outputBox.innerHTML = renderMarkdown(payload.answer);
        if (actionsRow) actionsRow.style.display = 'flex';
      }

      // Record in recent history
      if (completedQuery) {
        pushHistory({
          mode: payload.mode || completedMode,
          query: completedQuery,
          answer: payload.answer
        });
      }
    }
  });

  // ─── MOUNT PERCHED WIDGET ON COMPOSER RIM ──────────────────────────────────
  function mountPerchedWidget() {
    document.getElementById('bw-toolbar-btn')?.remove();

    if (document.getElementById('bw-corner-widget')) return;

    const inputArea = document.querySelector('[data-component="InputArea"]');
    if (!inputArea) return;

    const btn = document.createElement('button');
    btn.id = 'bw-corner-widget';
    btn.type = 'button';
    btn.title = 'Ask Buggy (Click to consult)';

    const img = document.createElement('img');
    img.className = 'bw-sprite-img';
    img.alt = 'Buggy';
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
