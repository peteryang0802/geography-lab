/* Run against a local static server or the published site. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require(process.env.GEOLAB_PLAYWRIGHT || 'playwright');

const origin = process.env.GEOLAB_URL || 'http://127.0.0.1:8773/';
const round = Number(process.env.GEOLAB_ROUND || 1);
const output = process.env.GEOLAB_SCREENSHOTS;
const variants = ['recall', 'nearby', 'fieldwork'];
const ids = ['intro', 'earth-space', 'spaceflight', 'earth-model', 'earth-motion', 'project-earth', 'maps',
  'contours', 'project-orienteering', 'land-ocean', 'land-change', 'project-seafloor', 'weather',
  'temp-rain', 'climate', 'climate-life', 'project-nest', 'people', 'cooperation', 'project-made-in-china'];
const { width, height } = [{ width: 360, height: 640 }, { width: 390, height: 844 }, { width: 667, height: 335 }][round - 1];
const url = (view, hash = '#/') => new URL('?view=' + view + hash, origin).href;
const go = (p, hash) => p.evaluate(hash => { location.hash = hash; }, hash);
const section = name => '[data-inquiry-section="' + name + '"]';

async function checkWidth(page) {
  const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, screen: innerWidth }));
  assert.equal(size.scroll, size.screen, page.url());
}

async function verifyLesson(page, id, next) {
  const lesson = page.locator('[data-inquiry-lesson="' + id + '"]');
  await lesson.waitFor();
  await lesson.locator('[data-activity]').first().locator('canvas, .direction-map').first().waitFor({ timeout: 10000 });
  if (id === 'land-ocean') {
    assert.equal(await lesson.locator('.inquiry-copy').count(), 0, 'inline evidence replaces reading paragraphs');
    assert.equal(await lesson.locator('.inquiry-picture-note img').count(), 2);
  } else assert.ok(await lesson.locator('.inquiry-copy > section').count() >= 2, id);
  assert.ok((await lesson.locator(section('outside')).innerText()).includes('回到现实'));
  assert.equal(await lesson.locator('a:visible').count(), 1, id + ' visible exits');
  assert.equal(await lesson.locator('.next-lesson').getAttribute('href'), next ? '#/lesson/' + next : '#/textbook');
  assert.ok(await page.evaluate(() => {
    const outside = document.querySelector('.inquiry-outside');
    return Boolean(outside.compareDocumentPosition(document.querySelector('.course-next')) & Node.DOCUMENT_POSITION_FOLLOWING);
  }), id);
  for (const img of await lesson.locator('.inquiry-photo img').all()) {
    await img.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.querySelectorAll('.inquiry-photo img')].every(item => item.naturalWidth > 0));
  }
  await checkWidth(page);
}

async function setRange(page, selector, number) {
  await page.locator(selector).evaluate((input, value) => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, number);
}

async function sameLabScreen(page) {
  const result = await page.evaluate(() => {
    const stage = document.querySelector('.lab-stage');
    const dock = document.querySelector('.lab-dock');
    stage.scrollIntoView({ block: 'start', behavior: 'instant' });
    const bounds = [stage, dock].map(el => el.getBoundingClientRect());
    return { top: Math.min(...bounds.map(b => b.top)), bottom: Math.max(...bounds.map(b => b.bottom)), height: innerHeight };
  });
  assert.ok(result.top >= -2 && result.bottom <= result.height + 2, JSON.stringify(result));
}

async function importantFlows(page) {
  await go(page, '#/lesson/contours');
  await page.locator('[data-rain-test]').waitFor();
  const route = new URL(page.url()).hash;
  const canvas = page.locator('.rain-inquiry canvas');
  const snap = () => canvas.evaluate(el => el.toDataURL());
  const initial = await snap();
  await page.locator('[data-rain-predict]').last().click();
  await page.locator('[data-rain-test]').click();
  assert.notEqual(await snap(), initial);
  const puddle = await snap();
  await page.locator('[data-rain-drain]').click();
  assert.notEqual(await snap(), puddle);
  assert.match(await page.locator('.rain-inquiry [role="status"]').innerText(), /排水/);
  assert.equal(new URL(page.url()).hash, route);
  const beforeWalk = page.locator('[data-activity="contours-lab-contour"]');
  await beforeWalk.scrollIntoViewIfNeeded();
  await page.locator('#lab-walk').waitFor();
  await sameLabScreen(page);
  await page.locator('[data-section=cd]').click();
  await setRange(page, '#lab-walk', 8);
  assert.match(await page.locator('.lab-live').innerText(), /C 到 D.*米/);
  await page.locator('[data-toggle-view]').click();
  await page.waitForFunction(() => document.querySelector('[data-stage-state]')?.textContent.includes('三维'));
  await sameLabScreen(page);
  await page.reload();
  await page.locator('[data-rain-drain]').waitFor();
  assert.equal(await page.locator('[data-rain-drain]').getAttribute('aria-pressed'), 'true');

  await go(page, '#/lesson/maps');
  const keys = page.locator('[data-legend-pick]');
  await keys.first().waitFor();
  assert.ok(await keys.count() >= 4);
  await keys.last().click();
  assert.match(await page.locator('.legend-inquiry [role="status"]').innerText(), /注记|海拔/);
  assert.equal(new URL(page.url()).hash, '#/lesson/maps');

  await go(page, '#/lesson/earth-motion');
  await page.locator('[data-day-pair]').waitFor();
  await page.locator('[data-day-pair]').click();
  await setRange(page, '#lab-month', 12);
  assert.match(await page.locator('.lab-live').innerText(), /北纬 40° 约 9 小时白天.*南纬 40° 约 15 小时白天/);
  await sameLabScreen(page);
  await page.locator('[data-mode=circulation]').click();
  await page.locator('[data-flow]').selectOption('monsoon');
  await page.locator('[data-season]').selectOption('winter');
  assert.match(await page.locator('.lab-live').innerText(), /冬季风/);
  await sameLabScreen(page);

  await go(page, '#/lesson/land-ocean');
  const world = page.locator('[data-world-activity]');
  const map = world.locator('canvas');
  await map.waitFor();
  await world.locator('[data-world-reveal]').click();
  assert.match(await world.locator('[data-world-feedback]').innerText(), /跨过太平洋/);
  await world.locator('[data-world-route=atlantic]').click();
  assert.doesNotMatch(await world.locator('[data-world-feedback]').innerText(), /大西洋/);
  await world.locator('[data-world-reveal]').click();
  assert.match(await world.locator('[data-world-feedback]').innerText(), /跨过大西洋/);
  await world.locator('[data-world-labels]').click();
  const labels = await map.getAttribute('aria-label');
  for (const name of ['亚洲', '欧洲', '非洲', '北美洲', '南美洲', '大洋洲', '南极洲', '太平洋', '大西洋', '印度洋', '北冰洋']) {
    assert.ok(labels.includes(name), name);
  }
  await world.locator('[data-world-labels]').click();

  const landform = page.locator('[data-activity=land-ocean-landform]');
  await landform.scrollIntoViewIfNeeded();
  await landform.locator('[data-landform-spot=plateau]').click();
  assert.match(await landform.locator('[data-landform-feedback]').innerText(), /高原|平缓|起伏小/);
  const seafloor = page.locator('[data-activity=land-ocean-seafloor]');
  await seafloor.scrollIntoViewIfNeeded();
  await seafloor.locator('[data-seafloor-stop=slope]').click();
  assert.match(await seafloor.locator('.seafloor-feedback').innerText(), /大陆坡/);
  assert.equal(new URL(page.url()).hash, '#/lesson/land-ocean');
  const globe = page.locator('.inquiry-optional-experiment');
  assert.equal(await globe.getAttribute('open'), null);
  assert.equal(await page.locator('[data-activity=land-ocean-lab-globe] canvas').count(), 0);
  await globe.locator('summary').click();
  await page.locator('[data-terrain-focus]').selectOption('himalayas');
  await page.locator('[data-terrain-knowledge]').click();
  const gallery = page.locator('[data-inline-photos]');
  await gallery.locator('[data-image-state=loaded]').first().waitFor();
  await gallery.locator('[data-next]').click();
  await gallery.locator('[data-next]').click();
  await page.waitForFunction(() => document.querySelector('[data-inline-photos] [data-count]')?.textContent === '3 / 3');
  assert.equal(new URL(page.url()).hash, '#/lesson/land-ocean');
  await page.reload();
  await page.locator('[data-activity="land-ocean-lab-globe"]').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('[data-inline-photos] [data-count]')?.textContent === '3 / 3');
  assert.equal(await world.getAttribute('data-world-active-route'), 'atlantic');
  assert.equal(await world.getAttribute('data-world-revealed'), 'true');
  await checkWidth(page);

  await go(page, '#/concept/legend?from=%23%2Flesson%2Fmaps');
  await page.locator('[data-concept-example] canvas').waitFor();
  assert.equal(await page.locator('[data-context-return]').getAttribute('href'), '#/lesson/maps');
  await page.locator('[data-context-return]').click();
  await page.locator('[data-inquiry-lesson=maps]').waitFor();

  await go(page, '#/legend');
  await page.locator('[data-legend-example] canvas').waitFor();
  await go(page, '#/review');
  await page.locator('#practice-lesson').selectOption('maps');
  await page.locator('.review-practice button').click();
  await page.locator('[data-task] button').first().click();
  assert.ok(await page.locator('[data-task] .feedback:visible').count() >= 1);
  await go(page, '#/lab/globe?mode=circulation&flow=monsoon&season=winter');
  await page.locator('[data-flow]').waitFor({ state: 'visible' });
  assert.match(await page.locator('.lab-live').innerText(), /冬季风/);
}

async function screenshotSet(browser, view) {
  if (!output) return;
  await fs.mkdir(output, { recursive: true });
  const p = await browser.newPage({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true });
  await p.goto(url(view));
  await p.locator('.inquiry-home-image img').evaluate(img => img.decode());
  const shot = (name) => p.screenshot({ path: output + '/' + view + '-' + name + '.png', animations: 'disabled' });
  await shot('01-home');
  await p.goto(url(view, '#/lesson/contours'));
  await p.locator('[data-rain-test]').waitFor();
  await p.evaluate(() => scrollTo(0, 0));
  await shot('02-opening');
  await p.locator('[data-rain-predict=low]').click();
  await p.locator('[data-rain-test]').click();
  await p.locator('.rain-inquiry').evaluate(el => el.scrollIntoView({ block: 'start' }));
  await shot('08-before-drain');
  await p.locator('[data-rain-drain]').click();
  await p.locator('.rain-inquiry').evaluate(el => el.scrollIntoView({ block: 'start' }));
  await shot('03-observe');
  await p.locator('[data-activity="contours-lab-contour"]').scrollIntoViewIfNeeded();
  await p.locator('#lab-walk').waitFor();
  await setRange(p, '#lab-walk', 7);
  await p.locator('.lab-stage').evaluate(el => el.scrollIntoView({ block: 'start' }));
  await shot('09-second-activity');
  await p.locator(section('reading')).evaluate(el => el.scrollIntoView({ block: 'start' }));
  await shot('04-read');
  await p.locator(section('outside')).evaluate(el => el.scrollIntoView({ block: 'start' }));
  await shot('05-outside');
  await p.close();
  const landscape = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  await landscape.goto(url(view, '#/lesson/contours'));
  await landscape.locator('[data-rain-test]').click();
  await landscape.locator('[data-rain-drain]').click();
  await landscape.locator('.rain-inquiry').evaluate(el => el.scrollIntoView({ block: 'start' }));
  await landscape.screenshot({ path: output + '/' + view + '-06-landscape.png', animations: 'disabled' });
  await landscape.close();
  const desktop = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await desktop.goto(url(view, '#/lesson/contours'));
  await desktop.locator('[data-rain-test]').waitFor();
  await desktop.locator('[data-rain-test]').click();
  await desktop.screenshot({ path: output + '/' + view + '-10-desktop-rain.png', animations: 'disabled' });
  await desktop.goto(url(view, '#/lesson/maps'));
  await desktop.locator('[data-legend-pick]').first().click();
  await desktop.screenshot({ path: output + '/' + view + '-07-desktop.png', animations: 'disabled' });
  await desktop.close();
}

async function verifySlowGallery(browser) {
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await context.newPage();
  let failed = false;
  await p.route('**/himalayas-cho-la-640.webp*', async route => {
    if (!failed && !route.request().url().includes('?retry=')) { failed = true; await route.abort(); }
    else await route.continue();
  });
  const client = await context.newCDPSession(p);
  await client.send('Network.enable');
  await client.send('Network.setCacheDisabled', { cacheDisabled: true });
  await client.send('Network.emulateNetworkConditions', { offline: false, latency: 360, downloadThroughput: 60 * 1024, uploadThroughput: 40 * 1024 });
  const photoRequests = [];
  p.on('request', request => { if (request.url().includes('/gallery/')) photoRequests.push(request.url()); });
  await p.goto(url('recall', '#/concept/himalayas'));
  const init = Date.now();
  await p.locator('.gallery-slide').first().waitFor();
  await p.locator('.gallery-slide').first().locator('img').evaluate(img => img.decode());
  assert.match(photoRequests[0], /himalayas-everest-640/);
  assert.ok(Date.now() - init < 4500, 'first phone image');
  await p.locator('[data-next]').click();
  const retry = p.locator('.gallery-slide').nth(1).getByRole('button', { name: /重试/ });
  await retry.waitFor();
  await retry.click();
  await p.waitForFunction(() => document.querySelectorAll('.gallery-slide')[1]?.dataset.imageState === 'loaded');
  await p.locator('[data-next]').click();
  await p.waitForFunction(() => document.querySelector('[data-count]')?.textContent === '3 / 3');
  await p.reload();
  await p.waitForFunction(() => document.querySelector('[data-count]')?.textContent === '3 / 3');
  await context.close();
  console.log('PASS throttled first image, forced error, retry, saved image index');
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.GEOLAB_CHROME || undefined });
  try {
    if (process.env.GEOLAB_CAPTURE_ONLY) {
      for (const view of variants) await screenshotSet(browser, view);
      return;
    }
    for (const view of variants) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const errors = [];
      page.on('pageerror', error => errors.push(String(error)));
      page.on('response', resp => {
        if (resp.url().startsWith(origin) && resp.status() >= 400) errors.push(resp.status() + ' ' + resp.url());
      });
      await page.goto(url(view));
      await page.locator('.inquiry-home').waitFor();
      assert.equal(await page.locator('html').getAttribute('data-inquiry-view'), view);
      assert.equal(await page.locator('.book-chapters .chapter-entries a').count(), 20);
      assert.equal(await page.locator('.home-entry').count(), 1);
      for (const [index, id] of ids.entries()) {
        if (index === 0) await go(page, '#/lesson/intro');
        else await page.locator('.next-lesson').click();
        if (process.env.GEOLAB_TRACE) console.log('CHECK', view, id);
        await verifyLesson(page, id, ids[index + 1]);
      }
      await importantFlows(page);
      assert.deepEqual(errors, []);
      await context.close();
      await screenshotSet(browser, view);
      console.log('PASS round', round, view, width, height, '20 lessons, inquiry flows, Three.js, legacy routes, review and gallery');
    }
    await verifySlowGallery(browser);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
