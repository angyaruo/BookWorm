import { chromium } from '@playwright/test';
import { strict as assert } from 'node:assert';
import { mkdir } from 'node:fs/promises';
import { previewServer } from '../scripts/preview.mjs';

const server = previewServer();
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch(process.env.BOOKWORM_BROWSER ? {executablePath:process.env.BOOKWORM_BROWSER} : {channel:process.platform === 'win32' ? 'msedge' : undefined});
await mkdir('work/screenshots',{recursive:true});
let checks = 0;
async function check(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
try {
  const page = await browser.newPage({viewport:{width:1280,height:900}});
  const errors = [], external = [];
  page.on('pageerror',error => errors.push(error.message));
  page.on('request',request => { if (!request.url().startsWith(url) && !request.url().startsWith('data:')) external.push(request.url()); });
  await page.goto(url);
  const popup = page.locator('#bw-popup-window');
  const input = page.locator('#bw-query-input');
  const output = page.locator('#bw-output-box');
  await page.getByRole('button',{name:'Open BookWorm'}).click();
  await check('book opens in viewport and uses offline default', async () => {
    await popup.waitFor();
    await page.waitForFunction(() => document.getAnimations().every(a => a.playState === 'finished'));
    const box = await popup.boundingBox();
    assert(box.x >= 0 && box.y >= 0 && box.x+box.width <= 1280 && box.y+box.height <= 900);
    assert.equal(await page.getByRole('tab',{name:'01 Thesaurus'}).getAttribute('aria-selected'),'true');
    assert.deepEqual(await page.evaluate(() => bookwormTest.messages),[]);
    await page.screenshot({path:'work/screenshots/desktop-welcome.png',animations:'disabled'});
  });
  await check('real offline lookup, clickable relations and history', async () => {
    await input.fill('happy'); await input.press('Enter');
    await output.locator('.bw-sense').first().waitFor();
    assert.match(await output.textContent(),/Antonyms/);
    await output.getByRole('button',{name:'unhappy',exact:true}).first().click();
    await page.waitForFunction(() => document.querySelector('.bw-result-heading h3')?.textContent === 'unhappy');
    await page.getByRole('button',{name:'Recent questions'}).click();
    await page.locator('[data-history="1"]').click();
    assert.equal(await input.inputValue(),'happy');
    assert.match(await output.textContent(),/happy/);
    assert((await page.evaluate(() => bookwormTest.messages)).every(m => m.type === 'bookworm:lookup_word'));
    await page.screenshot({path:'work/screenshots/desktop-dictionary.png',animations:'disabled'});
  });
  await check('feeding changes sprite only on click and persists until closing', async () => {
    const mascot = page.locator('#bw-desk-mascot-img');
    const original = await mascot.getAttribute('src');
    await page.getByRole('button',{name:'Give Buggy a leaf'}).hover();
    assert.equal(await mascot.getAttribute('src'),original);
    await page.getByRole('button',{name:'Give Buggy a leaf'}).click();
    const fed = await mascot.getAttribute('src'); assert.notEqual(fed,original);
    await page.getByRole('tab',{name:'Research',exact:false}).click();
    assert.equal(await mascot.getAttribute('src'),fed);
    assert.equal(await input.inputValue(),'');
    assert.equal(await output.locator('.bw-sense').count(),0);
    await page.getByRole('button',{name:'Close BookWorm'}).click();
    await page.getByRole('button',{name:'Open BookWorm'}).click();
    assert.notEqual(await mascot.getAttribute('src'),fed);
  });
  await check('settings propagate budget and timeout without changing user draft', async () => {
    await page.locator('#composer').fill('Keep my draft.');
    await page.getByRole('button',{name:'Book settings',exact:true}).click();
    await page.locator('#bw-length').selectOption('extended');
    await page.locator('#bw-timeout').selectOption('300');
    await page.locator('#bw-connection').selectOption('preview');
    await page.keyboard.press('Escape');
    await page.evaluate(() => { bookwormTest.manual=true; });
    await input.fill('Explain the old library'); await input.press('Control+Enter');
    const msg = await page.evaluate(() => bookwormTest.messages.at(-1));
    assert.equal(msg.extendedOutput,true); assert.equal(msg.timeoutSeconds,300); assert.equal(msg.connectionId,'preview');
    await page.evaluate(id => bookwormTest.receive({type:'bookworm:result_chunk',requestId:id,text:'# Partial\n\n> A quotation\n\n`code`'}),msg.requestId);
    await page.getByRole('button',{name:'Stop',exact:true}).click();
    assert.equal(await output.locator('h1').textContent(),'Partial');
    assert.equal(await output.locator('blockquote').count(),1); assert.equal(await output.locator('code').count(),1);
    await page.getByRole('button',{name:'Inscribe into composer'}).click();
    assert.match(await page.locator('#composer').inputValue(),/^Keep my draft\.\n\n# Partial/);
  });
  await check('tab changes cancel and ignore stale responses', async () => {
    await page.getByRole('button',{name:'Open BookWorm'}).click();
    await input.fill('first request'); await input.press('Control+Enter');
    const id = await page.evaluate(() => bookwormTest.messages.at(-1).requestId);
    await page.getByRole('tab',{name:'Translator',exact:false}).click();
    assert.equal(await input.inputValue(),'');
    assert.equal(await page.evaluate(() => bookwormTest.messages.at(-1).type),'bookworm:cancel');
    await page.evaluate(id => bookwormTest.receive({type:'bookworm:result',requestId:id,answer:'STALE ANSWER'}),id);
    assert(!(await output.textContent()).includes('STALE'));
    await input.fill('Translate this'); await input.press('Control+Enter');
    const nextId = await page.evaluate(() => bookwormTest.messages.at(-1).requestId);
    await page.evaluate(id => bookwormTest.receive({type:'bookworm:result',requestId:id,answer:'# The garden\n\n> The roses remember.\n\n**One leaf** is a fair price.\n\n`fin`',warning:'The model reached its output limit.'}),nextId);
    assert.match(await page.locator('#bw-notice').textContent(),/output limit/);
    await page.screenshot({path:'work/screenshots/desktop-answer.png',animations:'disabled'});
  });
  await check('small-screen layout and reduced motion', async () => {
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.setViewportSize({width:390,height:844});
    await page.getByRole('tab',{name:'Thesaurus',exact:false}).click();
    await page.evaluate(() => { bookwormTest.manual=false; });
    await input.fill('luminous'); await input.press('Enter');
    await output.locator('.bw-sense').first().waitFor();
    const box = await popup.boundingBox();
    assert(box.x >= 0 && box.y >= 0 && box.x+box.width <= 391 && box.y+box.height <= 845);
    assert.equal(await page.getByRole('tablist').getAttribute('aria-orientation'),'horizontal');
    assert.equal(await popup.evaluate(el => getComputedStyle(el).animationName),'none');
    assert.equal(await popup.evaluate(el => el.scrollWidth <= el.clientWidth+1),true);
    assert(await page.locator('#bw-scroll').evaluate(el => el.clientHeight > 100));
    await page.screenshot({path:'work/screenshots/mobile.png'});
    await page.setViewportSize({width:844,height:390});
    assert(await page.locator('#bw-scroll').evaluate(el => el.clientHeight > 30));
    await page.screenshot({path:'work/screenshots/landscape.png'});
  });
  await check('keyboard navigation, composer remount and cleanup', async () => {
    await page.getByRole('tab',{name:'Thesaurus',exact:false}).focus();
    await page.keyboard.press('End');
    assert.equal(await page.getByRole('tab',{name:'Translator',exact:false}).getAttribute('aria-selected'),'true');
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      const old=document.querySelector('[data-component=InputArea]');
      const fresh=document.createElement('div'); fresh.dataset.component='InputArea'; fresh.innerHTML='<textarea id="composer"></textarea>'; old.replaceWith(fresh);
    });
    await page.getByRole('button',{name:'Open BookWorm'}).waitFor();
    assert.equal(await page.locator('#bw-corner-widget').count(),1);
    await page.evaluate(() => bookwormTest.dispose());
    assert.equal(await popup.count(),0); assert.equal(await page.locator('#bw-corner-widget').count(),0);
    assert.deepEqual(errors,[]); assert.deepEqual(external,[]);
  });
  console.log(`${checks} UI checks passed; screenshots in work/screenshots`);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
