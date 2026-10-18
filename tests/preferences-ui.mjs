import assert from 'node:assert/strict';

export async function checkPreferences(browser, url, check) {
  await check('appearance, legacy migration, custom history retention and request-free reopening', async () => {
    const page = await browser.newPage({viewport:{width:1280,height:900}});
    const errors = []; page.on('pageerror',error => errors.push(error.message));
    try {
      await page.goto(url);
      await page.evaluate(() => {
        localStorage.setItem('bw_settings_v2',JSON.stringify({timeoutSeconds:300,extendedOutput:true}));
        localStorage.setItem('bw_query_history',JSON.stringify(Array.from({length:5},(_,i) => ({query:`Legacy ${i}`,mode:'tot',answer:`Legacy answer ${i}`}))));
      });
      await page.reload();
      const book=page.locator('#bw-popup-window');
      const settings=page.getByRole('button',{name:'Book settings',exact:true});
      const open=page.getByRole('button',{name:'Open BookWorm'});
      await open.click();
      assert.equal(await book.getAttribute('data-theme'),'paper');
      await page.getByRole('button',{name:'Recent questions'}).click();
      assert.equal(await page.locator('[data-history]').count(),5);
      await page.locator('[data-history="4"]').click();
      assert.equal(await page.locator('#bw-query-input').inputValue(),'Legacy 4');
      assert.match(await page.locator('#bw-output-box').textContent(),/Legacy answer 4/);
      assert.deepEqual(await page.evaluate(()=>bookwormTest.messages),[]);
      await settings.click();
      assert.equal(await page.locator('#bw-history-limit').inputValue(),'5');
      assert.equal(await page.locator('#bw-timeout').inputValue(),'300');
      assert.equal(await page.locator('#bw-length').inputValue(),'extended');
      await page.locator('#bw-theme').selectOption('dark');
      assert.equal(await book.getAttribute('data-theme'),'dark');
      assert.equal(await book.evaluate(el=>getComputedStyle(el).colorScheme),'dark');
      const contrast = await page.evaluate(() => {
        const luminance = hex => {
          const rgb=hex.match(/\w\w/g).map(c=>parseInt(c,16)/255).map(c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4);
          return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
        };
        const root=getComputedStyle(document.querySelector('#bw-popup-window'));
        const ink=luminance(root.getPropertyValue('--bw-ink').trim().slice(1));
        const paper=luminance(root.getPropertyValue('--bw-paper').trim().slice(1));
        const muted=luminance(root.getPropertyValue('--bw-muted').trim().slice(1));
        return [(ink+0.05)/(paper+0.05),(muted+0.05)/(paper+0.05)];
      });
      assert(contrast.every(ratio=>ratio>=4.5));
      assert.equal(await page.locator('html').getAttribute('data-theme'),null);
      await page.locator('#bw-history-limit').fill('8'); await page.locator('#bw-history-limit').press('Tab');
      await page.screenshot({path:'work/screenshots/dark-settings.png',animations:'disabled'});
      await page.keyboard.press('Escape');
      await page.locator('[data-tab=research]').click();
      await page.evaluate(()=>{bookwormTest.manual=true;});
      await page.locator('#bw-query-input').fill('Arrives while history is open');
      await page.locator('#bw-ask-btn').click();
      const pending=await page.evaluate(()=>bookwormTest.messages.at(-1).requestId);
      await page.getByRole('button',{name:'Recent questions'}).click();
      await page.evaluate(requestId=>bookwormTest.receive({type:'bookworm:result',requestId,answer:'Newly finished result'}),pending);
      await page.locator('[data-history="0"]').click();
      assert.equal(await page.locator('#bw-query-input').inputValue(),'Legacy 0');
      await page.locator('[data-tab=research]').click();
      for (let i=0;i<10;i++) {
        await page.locator('#bw-query-input').fill(`Search ${i}`);
        await page.locator('#bw-ask-btn').click();
        await page.evaluate(i=>{
          const requestId=bookwormTest.messages.at(-1).requestId;
          bookwormTest.receive({type:'bookworm:result',requestId,answer:`# Answer ${i}\n\n> A remembered quotation.\n\n**Keep these words.**\n\n\`an inline note\`\n\n\`\`\`text\nA block of code\n\`\`\``,warning:i===2?'Partial answer saved.':''});
        },i);
      }
      const items=await page.evaluate(()=>JSON.parse(localStorage.getItem('bw_query_history')));
      assert.deepEqual(items.map(h=>h.query),['Search 9','Search 8','Search 7','Search 6','Search 5','Search 4','Search 3','Search 2']);
      await page.getByRole('button',{name:'Close BookWorm'}).click(); await open.click();
      await page.getByRole('button',{name:'Recent questions'}).click();
      assert.equal(await page.locator('[data-history]').count(),8);
      await page.screenshot({path:'work/screenshots/dark-history.png',animations:'disabled'});
      const before=await page.evaluate(()=>bookwormTest.messages.length);
      await page.locator('[data-history="7"]').click();
      assert.equal(await page.locator('#bw-query-input').inputValue(),'Search 2');
      assert.match(await page.locator('#bw-output-box').textContent(),/Answer 2/);
      assert.match(await page.locator('#bw-notice').textContent(),/Partial answer/);
      assert.equal(await page.evaluate(()=>bookwormTest.messages.length),before);
      await page.screenshot({path:'work/screenshots/dark-answer.png',animations:'disabled'});
      await page.reload(); await open.click(); await settings.click();
      assert.equal(await book.getAttribute('data-theme'),'dark');
      assert.equal(await page.locator('#bw-history-limit').inputValue(),'8');
      await page.emulateMedia({colorScheme:'dark'});
      await page.locator('#bw-theme').selectOption('system');
      assert.equal(await book.getAttribute('data-theme'),'dark');
      await page.emulateMedia({colorScheme:'light'});
      await page.waitForFunction(()=>document.querySelector('#bw-popup-window').dataset.theme==='paper');
      await page.locator('#bw-theme').selectOption('dark');
      assert.equal(await book.getAttribute('data-theme'),'dark');
      await page.locator('#bw-history-limit').fill('3'); await page.locator('#bw-history-limit').press('Tab');
      for (const invalid of ['0','51','2.5','']) {
        await page.locator('#bw-history-limit').fill(invalid); await page.locator('#bw-history-limit').press('Tab');
        assert.equal(await page.locator('#bw-history-limit').inputValue(),'3');
      }
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('bw_query_history')).length),3);
      await page.locator('#bw-history-limit').fill('50'); await page.locator('#bw-history-limit').press('Tab');
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('bw_query_history')).length),3);
      await page.keyboard.press('Escape');
      await page.locator('[data-tab=thesaurus]').click();
      await page.locator('#bw-query-input').fill('luminous'); await page.locator('#bw-query-input').press('Enter');
      await page.locator('.bw-sense').first().waitFor();
      await page.screenshot({path:'work/screenshots/dark-dictionary.png',animations:'disabled'});
      await page.setViewportSize({width:390,height:844});
      assert(await page.locator('#bw-scroll').evaluate(el=>el.clientHeight>100));
      await page.screenshot({path:'work/screenshots/dark-mobile.png',animations:'disabled'});
      await settings.click();
      assert.equal(await page.locator('#bw-theme').inputValue(),'dark');
      assert.equal(await book.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
      assert.deepEqual(errors,[]);
    } finally {await page.close();}
  });
  await check('history remains usable for the session when browser storage is full', async () => {
    const page=await browser.newPage();
    try {
      await page.addInitScript(()=>{
        const original=Storage.prototype.setItem;
        Storage.prototype.setItem=function(key,value) {
          if (key==='bw_query_history') throw new DOMException('Full','QuotaExceededError');
          return original.call(this,key,value);
        };
      });
      await page.goto(url); await page.getByRole('button',{name:'Open BookWorm'}).click();
      await page.locator('#bw-query-input').fill('happy'); await page.locator('#bw-query-input').press('Enter');
      await page.locator('.bw-sense').first().waitFor();
      assert.match(await page.locator('#bw-notice').textContent(),/only for this session/);
      await page.getByRole('button',{name:'Close BookWorm'}).click();
      await page.getByRole('button',{name:'Open BookWorm'}).click();
      const before=await page.evaluate(()=>bookwormTest.messages.length);
      await page.getByRole('button',{name:'Recent questions'}).click();
      await page.locator('[data-history="0"]').click();
      assert.match(await page.locator('#bw-output-box').textContent(),/happy/);
      assert.equal(await page.evaluate(()=>bookwormTest.messages.length),before);
    } finally {await page.close();}
  });
}
