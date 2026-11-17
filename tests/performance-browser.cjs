/* GEOLAB_PERF_MODE=baseline records the previous deployment without enforcing the new behavior. */
const assert = require('node:assert/strict');
const { chromium } = require(process.env.GEOLAB_PLAYWRIGHT || 'playwright');

const origin = new URL(process.env.GEOLAB_URL || 'https://peteryang0802.github.io/geography-lab/');
const mode = process.env.GEOLAB_PERF_MODE || 'verify';
const verify = mode === 'verify';
const bandwidth = Number(process.env.GEOLAB_NETWORK_KIB || 60);
const latency = Number(process.env.GEOLAB_LATENCY_MS || 360);
const cpuRate = Number(process.env.GEOLAB_CPU_RATE || 1);
const handset = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
};
const galleryPath = /\/assets\/gallery\//;
const appPath = /\/src\/app-runtime\.js(?:\?|$)/;
const runtimePath = /\/(?:three-runtime|scenes)\.js(?:\?|$)/;
const threePath = /\/vendor\/three\/|\/(?:three-runtime|scenes)\.js(?:\?|$)/;
const flatCanvas = '.flat-host canvas';
const threeState = '[data-three-state]';
const status = '[data-stage-state]';

assert.ok(['baseline', 'verify'].includes(mode), 'GEOLAB_PERF_MODE must be baseline or verify');
assert.ok(bandwidth > 0 && latency >= 0 && cpuRate >= 1, 'Invalid network or CPU settings');

async function coldPage(browser, { kib = bandwidth, delay = latency, rate = cpuRate } = {}, run) {
  const context = await browser.newContext(handset);
  try {
    const page = await context.newPage();
    const session = await context.newCDPSession(page);
    const requests = new Map();
    const since = performance.now();
    const elapsed = () => Math.round(performance.now() - since);
    await session.send('Network.enable');
    await session.send('Network.setCacheDisabled', { cacheDisabled: true });
    await session.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: delay,
      downloadThroughput: kib * 1024,
      uploadThroughput: 25 * 1024,
    });
    if (rate > 1) await session.send('Emulation.setCPUThrottlingRate', { rate });
    session.on('Network.requestWillBeSent', ({ request, requestId }) => {
      const url = new URL(request.url);
      if (url.origin === origin.origin) {
        requests.set(requestId, { path: url.pathname + url.search, startMs: elapsed() });
      }
    });
    session.on('Network.responseReceived', ({ requestId, response }) => {
      const item = requests.get(requestId);
      if (!item) return;
      const headers = new Map(Object.entries(response.headers).map(([name, value]) => [name.toLowerCase(), value]));
      item.status = response.status;
      item.encoding = headers.get('content-encoding') || 'identity';
      if (headers.has('content-length')) item.bodyBytes = Number(headers.get('content-length'));
    });
    session.on('Network.loadingFinished', ({ requestId, encodedDataLength }) => {
      const item = requests.get(requestId);
      if (!item) return;
      item.endMs = elapsed();
      item.transferredBytes = encodedDataLength;
    });
    session.on('Network.loadingFailed', ({ requestId, errorText }) => {
      const item = requests.get(requestId);
      if (item) item.error = errorText;
    });
    return await run({
      page, elapsed,
      load: hash => page.goto(new URL(hash, origin).href, { waitUntil: 'commit', timeout: 35000 }),
      assets: pattern => Array.from(requests.values()).filter(item => pattern.test(item.path)),
    });
  } finally {
    await context.close();
  }
}

const emit = value => console.log(JSON.stringify(value));
const size = asset => asset?.bodyBytes ?? asset?.transferredBytes ?? 0;

function assertEarlyPhoto(cover, requests) {
  assert.equal(requests.length, 1, 'The application made extra shell requests');
  assert.ok(cover.startMs < requests[0].endMs, 'The photo waited for application startup');
}

function currentImage(img) {
  if (img?.complete && img.naturalWidth && img.currentSrc) {
    const url = new URL(img.currentSrc);
    return url.pathname + url.search;
  }
  return null;
}

async function checkHome(browser) {
  await coldPage(browser, undefined, async ({ page, load, elapsed, assets }) => {
    await load('#/');
    const image = page.locator('.inquiry-home img');
    await image.waitFor();
    const path = await (await page.waitForFunction(source => {
      const img = document.querySelector(source);
      if (!img?.complete || !img.naturalWidth) return false;
      const url = new URL(img.currentSrc);
      return url.pathname + url.search;
    }, '.inquiry-home img', { timeout: 20000 })).jsonValue();
    const readyMs = elapsed();
    const requested = assets(/\.(png|jpg|webp|avif)(?:\?|$)/i);
    const cover = requested.find(item => item.path === path);
    emit({ scenario: 'cold home', readyMs, cover });
    if (verify) {
      assert.ok(size(cover) > 0 && size(cover) <= 25 * 1024, 'The phone requested an oversized cover');
      assert.equal(cover.status, 200);
      assertEarlyPhoto(cover, assets(appPath));
      assert.equal(requested.filter(item => /landscape-.*\.webp/.test(item.path)).length, 1, 'The cover loaded twice');
      assert.equal(assets(threePath).length, 0, 'The homepage downloaded 3D code');
    }
  });
}

async function checkGallery(browser) {
  await coldPage(browser, undefined, async ({ page, load, elapsed, assets }) => {
    await load('#/concept/himalayas');
    const first = page.locator('.gallery-slide').first();
    await page.locator('.gallery-slide[data-image-state="loaded"]').first().waitFor({ timeout: 20000 });
    const readyMs = elapsed();
    const path = await first.locator('img').evaluate(currentImage);
    await page.waitForTimeout(950);
    const requested = assets(galleryPath);
    const cover = requested.find(item => item.path === path);
    emit({ scenario: 'cold Himalayas gallery', readyMs, photos: requested });
    if (!verify) return;
    assert.ok(size(cover) > 0 && size(cover) <= 28 * 1024, 'The active phone photo exceeded its budget');
    assert.equal(cover.status, 200);
    assertEarlyPhoto(cover, assets(appPath));
    assert.equal(requested.filter(item => item.path === cover.path).length, 1, 'The first gallery photo loaded twice');
    assert.ok(requested.length <= 2, 'The gallery downloaded more than one unviewed neighbor');
    assert.ok(requested.every(item => item === cover || item.startMs >= cover.endMs),
      'A neighbor competed with the first photo');
    assert.equal(assets(threePath).length, 0, 'The gallery downloaded 3D code');
    const hash = new URL(page.url()).hash;
    await page.locator('[data-next]').click();
    await page.locator('.gallery-slide').nth(1).locator('img').waitFor({ timeout: 15000 });
    await page.waitForFunction(() => document.querySelectorAll('.gallery-slide')[1]?.dataset.imageState === 'loaded',
      null, { timeout: 15000 });
    assert.equal(new URL(page.url()).hash, hash);
  });
}

async function useTerrainControl(page, mountain, name) {
  await page.locator('[data-terrain-focus]').selectOption(mountain);
  assert.ok((await page.locator('[data-live]').innerText()).includes(name));
}

async function checkColdGlobe(browser) {
  await coldPage(browser, undefined, async ({ page, load, elapsed, assets }) => {
    await load('#/lab/globe?mode=terrain');
    await page.locator(flatCanvas).waitFor({ timeout: 20000 });
    const flatMs = elapsed();
    if (!verify) {
      await page.waitForFunction(selector => /三维|较慢|无法/.test(document.querySelector(selector)?.textContent),
        status, { timeout: 20000 });
      const settledMs = elapsed();
      const message = await page.locator(status).innerText();
      await page.waitForTimeout(4000);
      emit({ scenario: 'cold globe with automatic 3D', flatMs, settledMs, message,
        requests: assets(/\/(?:vendor\/three\/|scenes\.js|relief-world)/) });
      return;
    }
    assert.equal(await page.locator(threeState).getAttribute('data-three-state'), 'flat');
    await useTerrainControl(page, 'alps', '阿尔卑斯');
    await page.waitForTimeout(650);
    assert.equal(assets(threePath).length, 0, 'The flat globe still downloaded 3D code');
    const clickMs = elapsed();
    await page.locator('[data-toggle-view]').click();
    await page.locator('[data-three-state="three"], [data-three-state="failed"]').waitFor({ timeout: 9000 });
    const outcome = await page.locator(threeState).getAttribute('data-three-state');
    const attemptMs = elapsed() - clickMs;
    emit({ scenario: 'cold globe with requested 3D', flatMs, attemptMs, outcome,
      message: await page.locator(status).innerText(),
      requests: assets(/\/(?:vendor\/three\/|(?:three-runtime|scenes)\.js|relief-world)/) });
    assert.ok(attemptMs <= 8500, '3D did not settle within the loading deadline');
    if (outcome === 'three') await page.locator('.scene-host canvas').waitFor();
    else await page.locator(flatCanvas).waitFor();
    await useTerrainControl(page, 'andes', '安第斯');
  });
}

async function checkWorking3D(browser) {
  await coldPage(browser, { kib: 2048, delay: 75, rate: cpuRate }, async ({ page, load, elapsed, assets }) => {
    await load('#/lab/globe?mode=terrain');
    await page.locator(flatCanvas).waitFor({ timeout: 15000 });
    assert.equal(assets(threePath).length, 0);
    const clickMs = elapsed();
    await page.locator('[data-toggle-view]').click();
    await page.locator('[data-three-state="three"]').waitFor({ timeout: 8500 });
    const readyMs = elapsed() - clickMs;
    await page.locator('.scene-host canvas').waitFor();
    await useTerrainControl(page, 'alps', '阿尔卑斯');
    const requests = assets(threePath);
    emit({ scenario: 'cold requested 3D', networkKiB: 2048, latencyMs: 75, readyMs, requests });
    assert.ok(readyMs <= 7000, '3D exceeded the deadline on an ordinary connection');
    assert.equal(requests.length, 1, '3D made additional code requests');
    const runtime = requests[0];
    const maximum = runtime.encoding === 'identity' ? 650 : 175;
    assert.ok(size(runtime) > 0 && size(runtime) <= maximum * 1024, '3D runtime exceeded its transfer budget');
  });
}

async function checkGalleryRetry(browser) {
  await coldPage(browser, { kib: 2048, delay: 75 }, async ({ page, load }) => {
    let failedPhoto = false;
    await page.route(/\/assets\/gallery\/himalayas-everest(?:-\d+)?\.webp(?:\?|$)/, route => {
      if (new URL(route.request().url()).searchParams.has('retry')) return route.continue();
      failedPhoto = true;
      return route.abort();
    });
    await load('#/concept/himalayas');
    const first = page.locator('.gallery-slide').first();
    const retry = first.getByRole('button', { name: /重试/ });
    await retry.waitFor({ timeout: 15000 });
    assert.ok(failedPhoto);
    await retry.click();
    await page.locator('.gallery-slide[data-image-state="loaded"]').first().waitFor({ timeout: 15000 });
    emit({ scenario: 'failed first photo', outcome: 'retry decoded the same slide' });
  });
}

async function checkHung3D(browser) {
  await coldPage(browser, { kib: 2048, delay: 75 }, async ({ page, load, elapsed }) => {
    let heldRequest;
    await page.route(runtimePath, route => { heldRequest ||= route; });
    try {
      await load('#/lab/globe?mode=terrain');
      await page.locator(flatCanvas).waitFor({ timeout: 15000 });
      const clickMs = elapsed();
      await page.locator('[data-toggle-view]').click();
      await page.locator('[data-three-state="loading"]').waitFor();
      await useTerrainControl(page, 'alps', '阿尔卑斯');
      await page.locator('[data-three-state="failed"]').waitFor({ timeout: 9000 });
      const attemptMs = elapsed() - clickMs;
      await page.locator(flatCanvas).waitFor();
      assert.ok(heldRequest, 'The mock did not intercept the 3D import');
      assert.match(await page.locator(status).innerText(), /超时/);
      assert.match(await page.locator('[data-toggle-view]').innerText(), /重试/);
      await useTerrainControl(page, 'andes', '安第斯');
      assert.ok(attemptMs >= 6200 && attemptMs <= 8500, 'A stalled 3D request did not time out after about seven seconds');
      await heldRequest.abort();
      heldRequest = null;
      await page.unroute(runtimePath);
      await page.locator('[data-toggle-view]').click();
      await page.locator('[data-three-state="three"]').waitFor({ timeout: 8500 });
      emit({ scenario: 'hung 3D request', attemptMs, outcome: 'flat control worked before and after timeout, and 3D retried successfully' });
    } finally {
      await heldRequest?.abort();
    }
  });
}

async function check3DPreparation(browser, { saveData = false, effectiveType = '4g' } = {}) {
  await coldPage(browser, { kib: 2048, delay: 75 }, async ({ page, load, assets }) => {
    const anticipate = !saveData && effectiveType === '4g';
    await page.addInitScript(({ saveData, effectiveType }) => {
      Object.defineProperty(navigator, 'connection', {
        value: { saveData, effectiveType, downlink: 10, rtt: 75 },
      });
    }, { saveData, effectiveType });
    await load('#/lab/globe?mode=terrain');
    await page.locator(flatCanvas).scrollIntoViewIfNeeded({ timeout: 15000 });
    if (!anticipate) {
      await page.waitForTimeout(1750);
      assert.equal(assets(threePath).length, 0, 'A restricted connection still preloaded 3D');
    } else {
      await page.waitForFunction(() => performance.getEntriesByType('resource')
        .some(entry => new URL(entry.name).pathname.endsWith('/three-runtime.js')), null, { timeout: 5000 });
      assert.equal(assets(threePath).length, 1, 'A visible fast-link lab should prepare exactly one module');
    }
    assert.equal(await page.locator(threeState).getAttribute('data-three-state'), 'flat');
    await page.locator('[data-toggle-view]').click();
    await page.locator('[data-three-state="three"]').waitFor({ timeout: 8500 });
    assert.equal(assets(threePath).length, 1, 'Opening the globe should reuse the one runtime request');
    if (!anticipate) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator(flatCanvas).waitFor();
      await page.waitForTimeout(700);
      assert.equal(await page.locator(threeState).getAttribute('data-three-state'), 'flat');
      assert.equal(assets(threePath).length, 1, 'A remembered 3D view restored itself on a restricted connection');
    }
    emit({ scenario: saveData ? 'data saver 3D' : effectiveType === '3g' ? 'remembered 3D on 3g' : 'prepared 3D', outcome: !anticipate
      ? 'one runtime only after click; the next visit waited for the learner'
      : 'the flat view stayed visible and the click reused the one preloaded runtime' });
  });
}

async function checkUnsupported3D(browser) {
  await coldPage(browser, { kib: 2048, delay: 75 }, async ({ page, load, assets }) => {
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...options) {
        if (type === 'webgl' || type === 'webgl2') return null;
        return getContext.call(this, type, ...options);
      };
    });
    await load('#/lab/globe?mode=terrain');
    await page.locator(flatCanvas).waitFor();
    await page.locator('[data-toggle-view]').click();
    await page.locator('[data-three-state="failed"]').waitFor();
    assert.equal(assets(threePath).length, 0, 'Missing WebGL started fetching the runtime');
    await useTerrainControl(page, 'alps', '阿尔卑斯');
    emit({ scenario: 'unavailable WebGL', outcome: 'flat controls remained usable and no runtime was requested' });
  });
}

async function main() {
  emit({ mode, origin: origin.href, bandwidthKiB: bandwidth, latencyMs: latency, cpuRate, handset });
  const browser = await chromium.launch({ executablePath: process.env.GEOLAB_CHROME });
  try {
    await checkHome(browser);
    await checkGallery(browser);
    await checkColdGlobe(browser);
    if (verify) {
      await checkWorking3D(browser);
      await checkGalleryRetry(browser);
      await checkHung3D(browser);
      await check3DPreparation(browser);
      await check3DPreparation(browser, { saveData: true });
      await check3DPreparation(browser, { effectiveType: '3g' });
      await checkUnsupported3D(browser);
    }
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
