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
  const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, layout: innerWidth }));
  assert.equal(size.layout, page.viewportSize().width, page.url() + ' layout viewport');
  assert.equal(size.scroll, size.layout, page.url() + ' horizontal overflow');
}

async function sameScreen(activity, selectors) {
  const sizes = await activity.evaluate((root, selectors) => {
    const boxes = selectors.flatMap(selector => [...root.querySelectorAll(selector)])
      .filter(element => element.getClientRects().length)
      .map(element => element.getBoundingClientRect());
    return {
      items: boxes.length,
      height: Math.max(...boxes.map(box => box.bottom)) - Math.min(...boxes.map(box => box.top)),
      limit: innerHeight,
    };
  }, selectors);
  assert.ok(sizes.items >= 2 && sizes.height <= sizes.limit + 2,
    `${await activity.getAttribute('data-activity')} exceeds one viewport: ${JSON.stringify(sizes)}`);
}

async function verifyPrimary(page, lesson, id) {
  const activity = lesson.locator('[data-activity]').first();
  await activity.locator('canvas').first().waitFor({ timeout: 10000 });
  await activity.scrollIntoViewIfNeeded();
  const canvas = activity.locator('canvas:visible').first();
  const controls = activity.locator('button:visible:enabled:not([data-toggle-view]):not([aria-pressed="true"])');
  const route = new URL(page.url()).hash;
  const snapshot = () => canvas.evaluate(el => el.toDataURL());
  await canvas.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const before = await snapshot();
  if (id === 'contours') await activity.locator('[data-rain-test]').click();
  else if (id === 'land-ocean') await activity.locator('[data-world-reveal]').click();
  else if (id === 'earth-model') await setRange(page, '#lab-lat', 22);
  else if (id === 'earth-motion') await setRange(page, '#lab-hour', 0);
  else if (await controls.count()) await controls.first().click();
  else {
    const dropdown = activity.locator('select:visible').first();
    const choices = await dropdown.locator('option').count();
    assert.ok(choices > 1, id);
    await dropdown.selectOption({ index: 1 });
  }
  await canvas.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.notEqual(await snapshot(), before, id + ' control updates the diagram');
  assert.equal(new URL(page.url()).hash, route, id + ' primary interaction keeps the lesson open');
  assert.equal(await activity.locator('.activity-wait:visible').count(), 0, id + ' no stale placeholder');
  await sameScreen(activity, ['canvas', 'button', 'select', 'input', '[role=status]', '[data-live]']);
  if (id === 'contours') await activity.locator('[data-rain-test]').click();
}

async function verifyTransfer(page, lesson, id) {
  const activity = lesson.locator('[data-activity="' + id + '-transfer"]');
  await activity.scrollIntoViewIfNeeded();
  const control = activity.locator('[data-transfer-action]');
  const gate = activity.locator('[data-lesson-transfer]');
  const result = activity.locator('[data-transfer-feedback]');
  const image = activity.locator('canvas');
  await control.waitFor();
  const before = await image.evaluate(el => el.toDataURL());
  const caption = await result.innerText();
  const route = new URL(page.url()).hash;
  await control.click();
  assert.equal(await gate.getAttribute('data-compared'), 'true', id);
  assert.notEqual(await image.evaluate(el => el.toDataURL()), before, id + ' transfer changes the drawing');
  assert.notEqual(await result.innerText(), caption, id + ' transfer explains the change');
  assert.equal(new URL(page.url()).hash, route);
  await sameScreen(activity, ['.transfer-question', 'canvas', '.transfer-diagram', 'button', '[role=status]']);
  await control.click();
  assert.equal(await gate.getAttribute('data-compared'), 'false', id + ' transfer can be reset');
}

async function verifyLesson(page, id, next) {
  const lesson = page.locator('[data-inquiry-lesson="' + id + '"]');
  await lesson.waitFor();
  await verifyPrimary(page, lesson, id);
  if (id === 'land-ocean') {
    assert.equal(await lesson.locator('.inquiry-copy').count(), 0, 'inline evidence replaces reading paragraphs');
    assert.equal(await lesson.locator('.inquiry-picture-note img').count(), 2);
    assert.equal(await lesson.locator('[data-world-ratio] button, [data-world-ratio] a').count(), 0);
    assert.equal(await lesson.locator('.world-ratio-bar').count(), 1);
  } else {
    assert.ok(await lesson.locator('.inquiry-copy > section').count() >= 2, id);
    await verifyTransfer(page, lesson, id);
  }
  assert.equal(await lesson.locator(section('outside')).getByRole('heading').innerText(),
    id === 'land-ocean' ? '换张地图试一试' : '课外观察');
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
  await page.locator('[data-activity="contours-lab-contour"][data-three-state=three]').waitFor();
  await sameLabScreen(page);
  await page.reload();
  await page.locator('[data-rain-drain]').waitFor();
  assert.equal(await page.locator('[data-rain-drain]').getAttribute('aria-pressed'), 'true');
  const slopes = page.locator('[data-activity=contours-transfer]');
  await slopes.scrollIntoViewIfNeeded();
  await slopes.locator('[data-transfer-action]').click();
  await page.reload();
  await slopes.scrollIntoViewIfNeeded();
  assert.equal(await slopes.locator('[data-lesson-transfer]').getAttribute('data-compared'), 'true');
  await slopes.locator('[data-transfer-action]').click();

  await go(page, '#/lesson/maps');
  const keys = page.locator('[data-legend-pick]');
  await keys.first().waitFor();
  assert.ok(await keys.count() >= 4);
  await keys.last().click();
  assert.match(await page.locator('.legend-inquiry [role="status"]').innerText(), /注记|海拔/);
  const direction = page.locator('[data-activity=maps-direction]');
  await direction.scrollIntoViewIfNeeded();
  await direction.locator('[data-example=north-arrow]').click();
  await direction.locator('[data-bearing="0"]').click();
  assert.match(await direction.getByRole('status').innerText(), /右上/);
  await sameScreen(direction, ['.direction-map', 'button', '[role=status]']);
  assert.equal(new URL(page.url()).hash, '#/lesson/maps');

  await go(page, '#/lesson/earth-motion');
  await page.locator('[data-day-pair]').waitFor();
  await page.locator('[data-day-pair]').click();
  await setRange(page, '#lab-month', 12);
  assert.match(await page.locator('.lab-live').innerText(), /北纬 40° 约 9 小时白天.*南纬 40° 约 15 小时白天/);
  await sameLabScreen(page);

  await go(page, '#/lesson/land-ocean');
  const world = page.locator('[data-world-activity]');
  const map = world.locator('canvas');
  await map.waitFor();
  if (await world.getAttribute('data-world-revealed') === 'false') await world.locator('[data-world-reveal]').click();
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
  await sameScreen(landform, ['canvas', 'button', '[role=status]']);
  const seafloor = page.locator('[data-activity=land-ocean-seafloor]');
  await seafloor.scrollIntoViewIfNeeded();
  await seafloor.locator('[data-seafloor-stop=slope]').click();
  assert.match(await seafloor.locator('.seafloor-feedback').innerText(), /大陆坡/);
  await sameScreen(seafloor, ['canvas', 'button', '[role=status]']);
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
  const check = page.locator('[data-activity=land-ocean-world-check]');
  await check.scrollIntoViewIfNeeded();
  const checkMap = check.locator('canvas');
  const mapBefore = await checkMap.evaluate(canvas => canvas.toDataURL());
  await check.getByRole('button', { name: '大西洋' }).click();
  assert.match(await check.getByRole('status').innerText(), /再看看/);
  await check.getByRole('button', { name: '印度洋' }).click();
  assert.match(await check.getByRole('status').innerText(), /跨过印度洋/);
  assert.notEqual(await checkMap.evaluate(canvas => canvas.toDataURL()), mapBefore);
  const fitsInViewport = await check.evaluate(host => host.getBoundingClientRect().height <= innerHeight);
  assert.ok(fitsInViewport, 'regional map and answer choices fit in one screen');
  assert.equal(new URL(page.url()).hash, '#/lesson/land-ocean');
  await page.reload();
  await page.locator('[data-activity="land-ocean-lab-globe"]').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('[data-inline-photos] [data-count]')?.textContent === '3 / 3');
  assert.equal(await world.getAttribute('data-world-active-route'), 'atlantic');
  assert.equal(await world.getAttribute('data-world-revealed'), 'true');
  await check.scrollIntoViewIfNeeded();
  assert.equal(await check.getByRole('button', { name: '印度洋' }).getAttribute('aria-pressed'), 'true');
  await checkWidth(page);

  await go(page, '#/lesson/weather');
  const weather = page.locator('[data-activity=weather-chart-weather]');
  const forecast = weather.locator('canvas');
  await forecast.waitFor();
  await weather.locator('select').first().selectOption('a');
  const forecastWidth = (await forecast.boundingBox()).width;
  await forecast.click({ position: { x: Math.round(forecastWidth / 2), y: 60 } });
  assert.equal(await weather.locator('select').nth(1).inputValue(), 'noon');
  assert.match(await weather.getByRole('status').innerText(), /雷电预警/);
  assert.equal(new URL(page.url()).hash, '#/lesson/weather');

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
