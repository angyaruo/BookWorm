// dist/frontend.js — BookWorm Frontend Companion

const MASCOT_SVG = `
<svg width="34" height="24" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="102" cy="56" r="14" fill="#38a169" stroke="#1a202c" stroke-width="4"/>
  <circle cx="86" cy="52" r="16" fill="#48bb78" stroke="#1a202c" stroke-width="4"/>
  <circle cx="68" cy="50" r="17" fill="#38a169" stroke="#1a202c" stroke-width="4"/>
  <circle cx="50" cy="54" r="18" fill="#48bb78" stroke="#1a202c" stroke-width="4"/>
  <ellipse cx="44" cy="73" rx="4" ry="3" fill="#276749" stroke="#1a202c" stroke-width="2"/>
  <ellipse cx="56" cy="73" rx="4" ry="3" fill="#276749" stroke="#1a202c" stroke-width="2"/>
  <ellipse cx="78" cy="71" rx="4" ry="3" fill="#276749" stroke="#1a202c" stroke-width="2"/>
  <ellipse cx="94" cy="70" rx="4" ry="3" fill="#276749" stroke="#1a202c" stroke-width="2"/>
  <path d="M28 32 C24 18 16 14 14 18" stroke="#1a202c" stroke-width="4" stroke-linecap="round"/>
  <circle cx="13" cy="18" r="5" fill="#48bb78" stroke="#1a202c" stroke-width="2"/>
  <path d="M38 30 C42 16 50 14 52 18" stroke="#1a202c" stroke-width="4" stroke-linecap="round"/>
  <circle cx="53" cy="18" r="5" fill="#48bb78" stroke="#1a202c" stroke-width="2"/>
  <circle cx="34" cy="46" r="19" fill="#fbd38d" stroke="#1a202c" stroke-width="4"/>
  <circle cx="28" cy="44" r="2.5" fill="#1a202c"/>
  <circle cx="42" cy="44" r="2.5" fill="#1a202c"/>
  <circle cx="34" cy="48" r="3.5" fill="#e53e3e"/>
  <polygon points="34,16 6,28 34,36 62,28" fill="#1a202c" stroke="#1a202c" stroke-width="2"/>
  <rect x="23" y="31" width="22" height="7" rx="2" fill="#2d3748"/>
  <path d="M18 28 L14 38" stroke="#ecc94b" stroke-width="2"/>
  <circle cx="13" cy="41" r="2.5" fill="#d69e2e"/>
</svg>
`;

export function setup(ctx) {
  let activeTab = 'tot';
  let currentModal = null;
  let isGenerating = false;
  let connectionsList = [];
  let selectedConnId = '';

  const removeStyle = ctx.dom.addStyle(`
    #bw-toolbar-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; border-radius: 6px;
      border: 1px solid transparent; background: transparent;
      color: var(--lumiverse-text-dim, #888899); cursor: pointer;
      transition: all 0.15s ease; padding: 2px;
    }
    #bw-toolbar-btn:hover {
      background: color-mix(in srgb, var(--lumiverse-primary, #8c82ff) 15%, transparent);
      color: var(--lumiverse-primary, #8c82ff);
      border-color: color-mix(in srgb, var(--lumiverse-primary, #8c82ff) 30%, transparent);
    }
    .bw-modal-wrap {
      display: flex; flex-direction: column; gap: 10px; font-family: inherit;
      color: var(--lumiverse-text, #e2e8f0);
    }
    .bw-header {
      display: flex; align-items: center; justify-content: space-between;
      padding-bottom: 8px; border-bottom: 1px solid var(--lumiverse-border, #334155);
    }
    .bw-header-left { display: flex; align-items: center; gap: 10px; }
    .bw-header-title { font-size: 14px; font-weight: 700; }
    .bw-header-subtitle { font-size: 11px; color: var(--lumiverse-text-dim, #94a3b8); }
    .bw-conn-select {
      background: var(--lumiverse-fill-subtle, rgba(0,0,0,0.2));
      border: 1px solid var(--lumiverse-border, #334155); border-radius: 6px;
      padding: 3px 6px; font-size: 11px; color: var(--lumiverse-text, #e2e8f0); outline: none;
    }
    .bw-tabs {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;
      background: var(--lumiverse-fill-subtle, rgba(0,0,0,0.2));
      padding: 3px; border-radius: 8px; border: 1px solid var(--lumiverse-border, #334155);
    }
    .bw-tab-btn {
      background: transparent; border: none; border-radius: 6px;
      padding: 6px 3px; font-size: 11px; font-weight: 600; cursor: pointer;
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
      width: 100%; box-sizing: border-box; min-height: 70px; resize: vertical;
      background: var(--lumiverse-fill-subtle, rgba(0,0,0,0.2));
      border: 1px solid var(--lumiverse-border, #334155); border-radius: 6px;
      padding: 8px 10px; font-size: 12px; color: var(--lumiverse-text, #f8fafc);
      outline: none; font-family: inherit;
    }
    .bw-textarea:focus { border-color: var(--lumiverse-primary, #8c82ff); }
    .bw-btn-ask {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600;
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
      border-radius: 6px; padding: 10px; min-height: 90px; max-height: 190px;
      overflow-y: auto; font-size: 12px; line-height: 1.5; white-space: pre-wrap;
    }
    .bw-card-action {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 4px 9px; border-radius: 4px;
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
    currentModal?.dismiss();
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

  function openBookwormModal() {
    currentModal = ctx.ui.showModal({ title: 'BookWorm Desk', width: 440 });
    const root = currentModal.root;
    root.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'bw-modal-wrap';

    let connOptions = '<option value="">Default Connection</option>';
    connectionsList.forEach(c => {
      const sel = c.id === selectedConnId ? 'selected' : '';
      connOptions += `<option value="${c.id}" ${sel}>${c.name}</option>`;
    });

    wrap.innerHTML = `
      <div class="bw-header">
        <div class="bw-header-left">
          ${MASCOT_SVG}
          <div>
            <div class="bw-header-title">BookWorm Research Desk</div>
            <div class="bw-header-subtitle">Literary companion & domain savant</div>
          </div>
        </div>
        <select class="bw-conn-select" id="bw-conn-picker">${connOptions}</select>
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

      <div class="bw-results-box" id="bw-output-box">Ask the worm above to begin!</div>
      <div id="bw-result-actions" style="display:none; justify-content:flex-end; gap:6px;">
        <button class="bw-card-action" id="bw-inject-btn">Insert into Composer</button>
      </div>
    `;

    root.appendChild(wrap);

    const inputTa = wrap.querySelector('#bw-query-input');
    const outputBox = wrap.querySelector('#bw-output-box');
    const askBtn = wrap.querySelector('#bw-ask-btn');
    const connPicker = wrap.querySelector('#bw-conn-picker');
    const actionsRow = wrap.querySelector('#bw-result-actions');
    const injectBtn = wrap.querySelector('#bw-inject-btn');

    connPicker.onchange = (e) => { selectedConnId = e.target.value; };

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

    wrap.querySelectorAll('.bw-tab-btn').forEach(btn => {
      btn.onclick = () => {
        wrap.querySelectorAll('.bw-tab-btn').forEach(b => b.classList.remove('bw-active'));
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

    currentModal.onDismiss(() => { currentModal = null; });
  }

  const unsubMsg = ctx.onBackendMessage((payload) => {
    if (payload.type === 'bookworm:connections') {
      connectionsList = payload.connections || [];
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

  function mountToolbar() {
    if (document.getElementById('bw-toolbar-btn')) return;
    const inputArea = document.querySelector('[data-component="InputArea"]');
    if (!inputArea) return;

    const anchor = inputArea.querySelector(
      'button:has(svg.lucide-wand-2), button:has(svg.lucide-file-text), button[title*="Seasoning"]'
    );
    const targetRow = anchor ? anchor.parentElement : (inputArea.querySelector('div') || inputArea);

    const btn = document.createElement('button');
    btn.id = 'bw-toolbar-btn';
    btn.type = 'button';
    btn.title = 'BookWorm Assistant';
    btn.innerHTML = MASCOT_SVG;

    btn.onclick = (e) => {
      e.preventDefault();
      ctx.sendToBackend({ type: 'bookworm:get_connections' });
      openBookwormModal();
    };

    targetRow.appendChild(btn);
  }

  const obs = new MutationObserver(() => mountToolbar());
  obs.observe(document.body, { childList: true, subtree: true });
  mountToolbar();
  ctx.sendToBackend({ type: 'bookworm:get_connections' });

  return () => {
    obs.disconnect();
    unsubMsg();
    removeStyle();
    document.getElementById('bw-toolbar-btn')?.remove();
    currentModal?.dismiss();
  };
}
