import assert from 'node:assert/strict';

export async function checkQuickActions(browser, url, check) {
  for (const mobile of [false, true]) {
    await check(`saved translation and direct phrase search on ${mobile ? 'mobile' : 'desktop'} HTTP`, async () => {
      const page = await browser.newPage({viewport:mobile ? {width:390,height:844} : {width:1280,height:900},hasTouch:mobile,isMobile:mobile});
      const errors=[]; page.on('pageerror', error=>errors.push(error.message));
      await page.route('http://bookworm.test/**', async route => {
        const target=new URL(route.request().url());
        await route.fulfill({response:await route.fetch({url:url+target.pathname+target.search})});
      });
      const helper=page.locator('#bw-selection-helper');
      const requests=()=>page.evaluate(()=>bookwormTest.messages.filter(m=>['bookworm:consult','bookworm:web_search'].includes(m.type)));
      const deliver=async result=>page.evaluate(result=>bookwormTest.receive({type:'bookworm:result',requestId:bookwormTest.messages.at(-1).requestId,...result}),result);
      const selectChat=async text=>{
        await page.evaluate(text=>{
          const p=document.querySelector('[data-component=MessageContent] p'); p.textContent=text;
          document.activeElement?.blur();
          const range=document.createRange(); range.selectNodeContents(p);
          const selection=getSelection(); selection.removeAllRanges(); selection.addRange(range);
        },text);
        await helper.waitFor();
      };
      const dismiss=()=>helper.getByRole('button',{name:'Dismiss selection helper'}).click();
      try {
        await page.goto('http://bookworm.test/');
        await page.getByRole('button',{name:'Open BookWorm'}).click();
        await page.getByRole('button',{name:'Book settings',exact:true}).click();
        const setting=page.getByLabel('Default translation language',{exact:true});
        assert.equal(await setting.inputValue(),'');
        await setting.fill('  Spanish  '); await setting.press('Tab');
        assert.equal(await setting.inputValue(),'Spanish');
        await page.reload(); await page.evaluate(()=>{bookwormTest.manual=true;});
        await page.getByRole('button',{name:'Open BookWorm'}).click();
        await page.getByRole('button',{name:'Book settings',exact:true}).click();
        assert.equal(await setting.inputValue(),'Spanish');
        await page.keyboard.press('Escape'); await page.locator('[data-tab=translate]').click();
        const query=page.locator('#bw-query-input');
        assert.equal(await query.inputValue(),'Translate into Spanish:\n\n');
        await page.locator('#bw-ask-btn').click(); assert.equal((await requests()).length,0);
        await query.fill('Translate into Spanish:\n\nHello there.'); await query.press('Control+Enter');
        assert.equal((await requests()).at(-1).query,'Translate into Spanish:\n\nHello there.');
        await deliver({answer:'Hola.',complete:true});
        await page.getByRole('button',{name:'Book settings',exact:true}).click();
        await setting.fill('French'); await setting.press('Tab');
        assert.equal(await query.inputValue(),'Translate into Spanish:\n\nHello there.'); // never overwrite a written request
        await page.keyboard.press('Escape'); await page.getByRole('button',{name:'Close BookWorm'}).click();
        await page.getByRole('button',{name:'Open BookWorm'}).click();
        assert.equal(await query.inputValue(),'Translate into French:\n\n');
        await page.getByRole('button',{name:'Close BookWorm'}).click();

        await selectChat('canted draw');
        const before=(await requests()).length;
        await page.waitForTimeout(300); assert.equal((await requests()).length,before);
        await helper.getByRole('button',{name:'Search online',exact:true}).click();
        const search=(await requests()).at(-1);
        assert.equal(search.type,'bookworm:web_search'); assert.equal(search.query,'canted draw');
        assert.equal((await requests()).length,before+1); assert.equal(await helper.locator('form').isVisible(),false);
        await deliver({error:'Web search disabled.'});
        await helper.getByRole('button',{name:'Edit search…'}).click();
        assert.equal(await helper.locator('input').inputValue(),'canted draw');
        await helper.locator('input').fill('canted draw sword technique');
        await helper.locator('form button').click();
        assert.equal((await requests()).at(-1).query,'canted draw sword technique');
        await deliver({sources:[{url:'https://example.org/swords',title:'Sword terminology',snippet:'Preview search result.'}]});
        await helper.getByRole('button',{name:'Translate → French',exact:true}).click();
        assert.equal((await requests()).at(-1).query,'Translate into French.\n\ncanted draw');
        assert.equal((await requests()).at(-1).mode,'translate');
        await deliver({answer:'Traduction.',complete:true});
        await helper.getByRole('button',{name:'Change language…'}).click();
        assert.equal(await helper.locator('input').inputValue(),'French');
        await helper.locator('input').fill('Japanese'); await helper.locator('form button').click();
        assert.equal((await requests()).at(-1).query,'Translate into Japanese.\n\ncanted draw');
        await deliver({answer:'翻訳',complete:true});
        assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('bw_settings_v2')).translationLanguage),'French');
        await dismiss();

        const draft=page.locator('#composer');
        await draft.fill('Before. Hello there. After.');
        await draft.evaluate(el=>{el.focus();el.setSelectionRange(8,20);el.dispatchEvent(new Event('select',{bubbles:true}));});
        await helper.waitFor();
        await helper.getByRole('button',{name:'Translate → French',exact:true}).click();
        assert.equal((await requests()).at(-1).mode,'transform');
        assert.equal((await requests()).at(-1).direction,'Translate into French.');
        assert.equal(await draft.inputValue(),'Before. Hello there. After.');
        await deliver({answer:'Bonjour.',complete:true});
        assert.equal(await draft.inputValue(),'Before. Bonjour. After.');
        await helper.getByRole('button',{name:'Undo replacement'}).click();
        assert.equal(await draft.inputValue(),'Before. Hello there. After.');
        await dismiss();

        const long='A much longer passage with several sentences. '.repeat(13);
        await selectChat(long);
        const count=(await requests()).length;
        await helper.getByRole('button',{name:'Search online…',exact:true}).click();
        assert.equal((await requests()).length,count);
        assert.equal(await helper.locator('input').inputValue(),long.trim().slice(0,500));
        await dismiss();
        await page.getByRole('button',{name:'Open BookWorm'}).click();
        await page.getByRole('button',{name:'Book settings',exact:true}).click();
        await page.screenshot({path:`work/screenshots/quick-settings-${mobile?'mobile':'desktop'}.png`,animations:'disabled'});
        await setting.fill(''); await setting.press('Tab');
        await page.keyboard.press('Escape'); await page.getByRole('button',{name:'Close BookWorm'}).click();
        await selectChat('another phrase');
        await helper.getByRole('button',{name:'Translate…',exact:true}).click();
        assert.equal(await helper.locator('input').inputValue(),'');
        assert.equal((await requests()).length,count);
        assert.deepEqual(errors,[]);
      } finally { await page.close(); }
    });
  }
}
