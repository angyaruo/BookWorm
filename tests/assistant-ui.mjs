import { strict as assert } from 'node:assert';

export async function checkAssistant(browser, url, check) {
  async function selectDraft(page, text, start = 0, end = text.length) {
    await page.locator('#composer').fill(text);
    await page.locator('#composer').evaluate((el, range) => { el.focus(); el.setSelectionRange(...range); el.dispatchEvent(new Event('select', { bubbles: true })); }, [start, end]);
    await page.locator('#bw-selection-helper').waitFor();
  }
  const lastRequest = page => page.evaluate(() => bookwormTest.messages.filter(m => m.type !== 'bookworm:cancel').at(-1));
  async function deliver(page, request, result) {
    await page.evaluate(({ requestId, result }) => bookwormTest.receive({ type: 'bookworm:result', requestId, ...result }), { requestId: request.requestId, result });
  }
  for (const mobile of [false, true]) {
    const page = await browser.newPage({viewport:mobile ? {width:390,height:844} : {width:1280,height:900}, hasTouch: mobile, isMobile: mobile});
    const errors = [], external = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (!r.url().startsWith('http://bookworm.test') && !r.url().startsWith('data:')) external.push(r.url()); });
    await page.route('http://bookworm.test/**', async route => {
      const target = new URL(route.request().url());
      await route.fulfill({response: await route.fetch({url:url + target.pathname + target.search})});
    });
    if (mobile) await page.addInitScript(() => localStorage.setItem('bw_settings_v2', JSON.stringify({theme:'dark'})));
    await page.goto('http://bookworm.test/');
    const helper = page.locator('#bw-selection-helper'), draft = page.locator('#composer');
    const label = mobile ? 'mobile HTTP' : 'desktop HTTP';
    try {
      await check(`${label}: local chat definition and composer synonyms, with guarded Undo`, async () => {
        await page.evaluate(() => {
          const p = document.querySelector('[data-component=MessageContent] p').firstChild;
          const range = document.createRange(); range.setStart(p, 0); range.setEnd(p, 4);
          const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
        });
        await helper.locator('.bw-help-result section').first().waitFor();
        assert.equal((await lastRequest(page)).type, 'bookworm:lookup_word');
        assert.equal((await lastRequest(page)).query, 'Rain');
        assert(!(await helper.textContent()).includes('little word. big possibilities.'));
        assert.equal(await helper.locator('.bw-selected').textContent(),'Rain');
        assert.equal(await helper.locator('[data-synonym]').count(), 0);
        await helper.getByRole('button', {name:'Dismiss selection helper'}).click();
        await page.evaluate(() => document.dispatchEvent(new Event('selectionchange')));
        await page.waitForTimeout(300); assert.equal(await helper.count(),0);
        await selectDraft(page, 'An obsolete map.', 3, 11);
        const synonym = helper.locator('[data-synonym]').first(); await synonym.waitFor();
        assert.equal(await helper.getAttribute('data-theme'), mobile ? 'dark' : 'paper');
        const word = await synonym.textContent();
        await synonym.click();
        assert.equal(await draft.inputValue(), `An ${word} map.`);
        await helper.getByRole('button', {name:'Undo replacement'}).click();
        assert.equal(await draft.inputValue(), 'An obsolete map.');
        assert((await page.evaluate(() => bookwormTest.messages)).every(m => ['bookworm:lookup_word','bookworm:cancel'].includes(m.type)));
        const box = await helper.boundingBox(), viewport = page.viewportSize();
        assert(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1);
        await page.screenshot({path:`work/screenshots/selection-${mobile ? 'mobile' : 'desktop'}.png`, animations:'disabled'});
      });
      await check(`${label}: explicit custom transformation applies only completed selection and never sends`, async () => {
        await helper.getByRole('button', {name:'Dismiss selection helper'}).click();
        await page.evaluate(() => { bookwormTest.manual = true; window.nativeInputs = []; window.enterKeys = 0;
          document.querySelector('#composer').addEventListener('input', e => nativeInputs.push(e.target.value));
          document.querySelector('#composer').addEventListener('keydown', e => { if (e.key === 'Enter') enterKeys++; });
        });
        const original = 'Before. The moon was bright. After.';
        await selectDraft(page, original, 8, 28);
        const before = (await page.evaluate(() => bookwormTest.messages)).length;
        assert.equal((await lastRequest(page)).type, 'bookworm:lookup_word'); // no automatic AI for phrase
        await page.getByRole('button', {name:'Open BookWorm',exact:true}).click();
        assert.equal(await page.locator('#bw-popup-window').count(), 0);
        await helper.getByRole('button', {name:'Custom rewrite…'}).click();
        await helper.locator('input').fill('A weary cowboy telling the story');
        await helper.getByRole('button', {name:'Transform selection',exact:true}).click();
        const request = await lastRequest(page);
        assert.equal(request.mode, 'transform'); assert.match(request.direction, /cowboy/);
        assert.equal(request.polishContext,undefined);
        assert.equal(request.query, original.slice(8, 28));
        assert.equal((await page.evaluate(() => bookwormTest.messages)).length, before + 1);
        await page.evaluate(id => bookwormTest.receive({type:'bookworm:result_chunk',requestId:id,text:'That moon'}), request.requestId);
        assert.equal(await draft.inputValue(), original);
        await deliver(page, request, { answer:'That moon sure shone.', complete:true });
        assert.equal(await draft.inputValue(), 'Before. That moon sure shone. After.');
        assert((await page.evaluate(() => nativeInputs)).includes('Before. That moon sure shone. After.'));
        assert.equal(await page.evaluate(() => enterKeys), 0);
        await helper.getByRole('button', {name:'Undo replacement'}).click();
        assert.equal(await draft.inputValue(), original);
      });
      await check(`${label}: edited drafts, IME, truncation, stale replies and changed chat cannot be overwritten`, async () => {
        for (const scenario of ['edit','truncated','stop','scope','ime']) {
          await helper.getByRole('button', {name:'Dismiss selection helper'}).click();
          const original = 'A passage to polish.';
          await selectDraft(page, original);
          await helper.getByRole('button', {name:'Polish draft · AI'}).click();
          const request = await lastRequest(page); assert.equal(request.mode, 'polish');
          assert.match(request.polishContext.recentMessages[0].content,/library/);
          if (scenario === 'edit') await draft.fill('My newer words.');
          if (scenario === 'stop') await helper.getByRole('button', {name:'Stop',exact:true}).click();
          if (scenario === 'scope') await page.evaluate(() => { document.querySelector('[data-spindle-scope]').setAttribute('data-spindle-scope', 'chat:another:chat_input_tools_left'); });
          if (scenario === 'ime') await draft.dispatchEvent('compositionstart');
          await deliver(page, request, {answer:'Do not insert this.',complete:scenario !== 'truncated', ...(scenario === 'truncated' ? {warning:'The model reached its output limit.'} : {})});
          assert.equal(await draft.inputValue(), scenario === 'edit' ? 'My newer words.' : original);
          if (scenario === 'ime') await draft.dispatchEvent('compositionend');
        }
      });
      await check(`${label}: contextual Polish replaces only selected prose and reports unchanged model output`, async () => {
        await helper.getByRole('button', {name:'Dismiss selection helper'}).click();
        await page.evaluate(() => { bookwormTest.identity={chatId:'preview',personaId:'mira'}; bookwormTest.history=[{role:'assistant',name:'Mira',content:'A quiet door in the library.'}]; });
        const original = 'Before. I wait at the door. After.';
        await selectDraft(page,original,8,27);
        await helper.getByRole('button',{name:'Polish draft · AI'}).click();
        let request = await lastRequest(page);
        assert.equal(request.mode,'polish'); assert.equal(request.query,'I wait at the door.');
        assert.equal(request.polishContext.beforeSelection,'Before. '); assert.equal(request.polishContext.afterSelection,' After.');
        assert.equal(request.polishContext.personaId,'mira'); assert.equal(request.polishContext.chatId,'preview');
        assert.equal(request.polishContext.recentMessages[0].name,'Mira');
        await deliver(page,request,{answer:request.query,complete:true,contextNote:'No active persona was available.'});
        assert.equal(await draft.inputValue(),original);
        assert.match(await helper.locator('[role=status]').textContent(),/original wording/);
        assert.match(await helper.locator('[role=status]').textContent(),/No active persona/);
        assert.equal(await helper.locator('[data-help=undo]').isVisible(),false);
        await helper.getByRole('button',{name:'Polish draft · AI'}).click(); request = await lastRequest(page);
        await deliver(page,request,{answer:'At the door, I linger in uneasy stillness.',complete:true});
        assert.equal(await draft.inputValue(),'Before. At the door, I linger in uneasy stillness. After.');
        await helper.getByRole('button',{name:'Undo replacement'}).click(); assert.equal(await draft.inputValue(),original);
        await helper.getByRole('button', {name:'Dismiss selection helper'}).click();
        await selectDraft(page,original,8,27); await helper.getByRole('button',{name:'Polish draft · AI'}).click(); request = await lastRequest(page);
        await page.evaluate(() => {bookwormTest.identity.personaId='other-persona';});
        await deliver(page,request,{answer:'An obsolete persona must not replace this.',complete:true});
        assert.equal(await draft.inputValue(),original);
        await page.evaluate(() => {delete bookwormTest.identity;delete bookwormTest.history;});
      });
      await check(`${label}: explicit translation, online query privacy, safe sources, and cleanup`, async () => {
        await helper.getByRole('button', {name:'Dismiss selection helper'}).click();
        await selectDraft(page, 'Translate my private prose.');
        await helper.getByRole('button', {name:'Translate…',exact:true}).click();
        await helper.locator('input').fill('French');
        await helper.getByRole('button', {name:'Transform selection',exact:true}).click();
        let request = await lastRequest(page); assert.match(request.direction, /French/);
        await deliver(page, request, {answer:'Mon texte.',complete:true});
        assert.equal(await draft.inputValue(),'Mon texte.');
        // Undo must not overwrite typing done after an applied change.
        await draft.fill('Keep this newer draft.');
        await helper.getByRole('button', {name:'Undo replacement'}).click();
        assert.equal(await draft.inputValue(),'Keep this newer draft.');
        await helper.getByRole('button', {name:'Edit search…',exact:true}).click();
        assert.equal(await helper.locator('input').inputValue(), 'Translate my private prose.');
        await helper.locator('input').fill('public lore term');
        await helper.locator('form').getByRole('button', {name:'Search online',exact:true}).click();
        request = await lastRequest(page);
        assert.equal(request.type,'bookworm:web_search'); assert.equal(request.query,'public lore term');
        assert(!JSON.stringify(request).includes('private prose'));
        await deliver(page, request, {sources:[{url:'https://example.org/lore',title:'Genuine returned link',snippet:'<img src=x onerror=evil()>'},{url:'javascript:evil()',title:'Unsafe'}]});
        assert.equal(await helper.locator('.bw-source-cards a').count(),1);
        assert.equal(await helper.locator('.bw-source-cards img').count(),0);
        assert.equal(await helper.locator('a').getAttribute('rel'),'noopener noreferrer');
        assert.equal(await draft.inputValue(),'Keep this newer draft.');
        await page.screenshot({path:`work/screenshots/search-${mobile ? 'mobile' : 'desktop'}.png`,animations:'disabled'});
        await page.evaluate(() => bookwormTest.dispose()); assert.equal(await helper.count(),0);
        assert.deepEqual(errors,[]); assert.deepEqual(external,[]);
      });
    } finally { await page.close(); }
  }
  await check('book web search preserves answers on errors, grounds only opted-in research and keeps source history', async () => {
    const page = await browser.newPage({viewport:{width:1280,height:900}});
    try {
      await page.goto(url); await page.evaluate(() => { bookwormTest.manual = true; });
      await page.getByRole('button', {name:'Open BookWorm'}).click();
      await page.locator('[data-tab=research]').click();
      await page.locator('#bw-query-input').fill('Original question'); await page.locator('#bw-ask-btn').click();
      let request = await lastRequest(page); await deliver(page,request,{answer:'Keep this original answer.'});
      await page.getByRole('button',{name:'Look this up online…'}).click();
      await page.locator('#bw-web-query').fill('public details'); await page.locator('#bw-web-run').click();
      request = await lastRequest(page); assert.equal(request.type,'bookworm:web_search');
      await deliver(page,request,{error:'Grant Web Search permission.'});
      assert.match(await page.locator('#bw-output-box').textContent(), /original answer/);
      assert.match(await page.locator('#bw-web-status').textContent(), /permission/);
      await page.locator('#bw-search-before').check(); await page.locator('#bw-ask-btn').click();
      request = await lastRequest(page); assert.equal(request.searchBefore,true); assert.equal(request.webQuery,'public details');
      await deliver(page,request,{error:'Search unavailable'});
      assert.match(await page.locator('#bw-output-box').textContent(), /original answer/);
      await page.locator('#bw-ask-btn').click(); request = await lastRequest(page);
      await deliver(page,request,{answer:'Supported answer [1].',complete:true,sources:[{url:'https://example.org/evidence',title:'Evidence',snippet:'An actual source snippet.'}]});
      await page.getByRole('button',{name:'Recent questions'}).click(); await page.locator('[data-history="0"]').click();
      assert.equal(await page.locator('#bw-output-box a').getAttribute('href'),'https://example.org/evidence');
      await page.locator('#bw-search-before').check(); await page.locator('#bw-web-query').fill('public details');
      await page.locator('#bw-ask-btn').click(); request = await lastRequest(page);
      await page.evaluate(id => {
        bookwormTest.receive({type:'bookworm:sources',requestId:id,sources:[{url:'https://example.org/partial',title:'Partial source',snippet:'Evidence.'}]});
        bookwormTest.receive({type:'bookworm:result_chunk',requestId:id,text:'Partial claim [1].'});
      },request.requestId);
      await page.locator('#bw-ask-btn').click();
      assert.equal(await page.locator('#bw-output-box a').getAttribute('href'),'https://example.org/partial');
      await page.getByRole('button',{name:'Recent questions'}).click(); await page.locator('[data-history="0"]').click();
      assert.equal(await page.locator('#bw-output-box a').getAttribute('href'),'https://example.org/partial');
      await page.getByRole('button',{name:'Book settings',exact:true}).click(); await page.locator('#bw-selection-help').selectOption('off');
      await page.keyboard.press('Escape'); await page.getByRole('button',{name:'Close BookWorm'}).click();
      await page.locator('#composer').fill('obsolete');
      await page.locator('#composer').evaluate(el => { el.focus(); el.select(); });
      await page.waitForTimeout(350); assert.equal(await page.locator('#bw-selection-helper').count(),0);
    } finally { await page.close(); }
  });
}
