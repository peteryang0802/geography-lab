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
      assert.ok(size(cover) > 0 && size(cover) <= 70 * 1024, 'The phone requested an oversized cover');
      assert.equal(cover.status, 200);
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
    assert.ok(size(cover) > 0 && size(cover) <= 55 * 1024, 'The active phone photo exceeded its budget');
    assert.equal(cover.status, 200);
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
    }
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
