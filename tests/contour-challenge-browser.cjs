const assert = require('node:assert/strict');
const { chromium } = require(process.env.GEOLAB_PLAYWRIGHT || 'playwright');
const { moveTo } = require('./lesson-flow.cjs');
const base = process.env.GEOLAB_URL || 'http://127.0.0.1:8773/';
const course = '#/lesson/contours';
const challenge = '#/challenge/contours';
const stateKey = 'geography-lab:learning:v2:activities:contours-challenge';

async function hold(browser, test) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await test(page);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
}

const action = (page, name) => page.locator(`[data-challenge-action="${name}"]`);
const option = (page, index) => page.locator(`[data-challenge-option="${index}"]`);
const diagram = (page) => page.locator('.contour-challenge-map svg');
const timer = (page) => page.locator('[data-challenge-clock]');
const selectedFeedback = (page) => page.locator('[data-challenge-feedback]');
const score = (page) => page.locator('.contour-challenge-rail > p > span').textContent();
const current = (page) => page.locator('.contour-challenge-rail [aria-current="step"]').textContent();
const challengeEntry = (page) => page.getByRole('link', { name: /课后闯关\s*《等高线与路线选择》/ });

async function firstScreenEntry(page) {
  const entry = challengeEntry(page);
  await entry.waitFor({ state: 'visible' });
  assert.equal(await page.locator('[data-contour-challenge-entry]').count(), 1);
  assert.equal(await page.evaluate(() => scrollY), 0);
  const box = await entry.boundingBox();
  assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 1280 && box.y + box.height <= 720);
  assert.equal(await entry.evaluate(link => link.classList.contains('primary')), false);
  return entry;
}

async function directoryEntries(page, questions) {
  await page.goto(base);
  assert.equal(new URL(page.url()).hash, '');
  await page.locator('.volume-resume.primary').waitFor();
  await (await firstScreenEntry(page)).click();
  await action(page, 'start').click();
  await option(page, questions[0].answer).click();
  await action(page, 'next').click();
  const homeReturn = page.getByRole('link', { name: /返回首页/ });
  await homeReturn.click();
  await page.waitForFunction(() => document.activeElement?.matches('[data-contour-challenge-entry]'));
  assert.equal(new URL(page.url()).hash, '#/');
  assert.equal(await page.locator('.volume-resume.primary').getAttribute('href'), '#/lesson/intro');

  await page.getByRole('link', { name: /七年级上册\s*从地球仪出发/ }).click();
  await page.locator('.home-entry.primary').waitFor();
  assert.equal(new URL(page.url()).hash, '#/term/7a');
  await (await firstScreenEntry(page)).click();
  await diagram(page).waitFor();
  assert.match(await current(page), /读线上的海拔/);
  assert.equal(await score(page), '1 / 10 分');
  await page.reload();
  await page.getByRole('link', { name: /返回七上目录/ }).click();
  await page.waitForFunction(() => document.activeElement?.matches('[data-contour-challenge-entry]'));
  assert.equal(new URL(page.url()).hash, '#/term/7a');
}

async function flow(page, questions) {
  await page.goto(base + course);
  const entry = page.locator('[data-contour-challenge-entry]');
  assert.equal(await entry.count(), 1);
  await moveTo(page.locator('.geo-lesson'), 'recap');
  await entry.click();
  await action(page, 'start').waitFor();
  assert.equal(new URL(page.url()).hash, challenge);
  assert.equal(await page.locator('.contour-challenge-rail button, .contour-challenge-rail a').count(), 0);
  assert.equal(await page.locator('.contour-challenge a[href^="http"]').count(), 0);
  assert.equal(await page.locator('[data-challenge-timed]').isChecked(), false);
  await page.locator('[data-challenge-timed]').check();
  await action(page, 'start').click();
  assert.equal(await timer(page).isVisible(), true);

  const first = questions[0];
  const initialWrong = (first.answer + 1) % first.options.length;
  await option(page, initialWrong).click();
  assert.match(await selectedFeedback(page).textContent(), /线索/);
  assert.equal(await action(page, 'next').count(), 0);
  assert.equal(await score(page), '0 / 10 分');
  await page.reload();
  await option(page, initialWrong).waitFor();
  assert.equal(await option(page, initialWrong).getAttribute('aria-pressed'), 'true');
  assert.match(await selectedFeedback(page).textContent(), /线索/);
  assert.equal(await timer(page).isVisible(), false);
  await option(page, first.answer).click();
  assert.equal(await score(page), '0 / 10 分');
  assert.match(await selectedFeedback(page).textContent(), /原题订正成功/);
  await action(page, 'next').click();
  assert.equal(await timer(page).isVisible(), false);
  await option(page, first.variant.answer).click();
  assert.equal(await score(page), '1 / 10 分');
  await action(page, 'next').click();

  assert.match(await current(page), /读线上的海拔/);
  assert.equal(await timer(page).isVisible(), false);
  await diagram(page).waitFor();
  const box = async selector => page.locator(selector).boundingBox();
  const [rail, map, choices] = await Promise.all([
    box('.contour-challenge-rail'), diagram(page).boundingBox(), box('.contour-challenge-options'),
  ]);
  assert.ok(rail && map && choices && map.width >= 300);
  assert.ok(rail.x + rail.width < map.x && map.x + map.width < choices.x);
  assert.ok(map.y + map.height < 720 && choices.y + choices.height < 720);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const originalImage = await diagram(page).innerHTML();

  await page.locator('[data-nav="home"]').click();
  assert.equal(new URL(page.url()).hash, course);
  await entry.waitFor();
  await page.waitForFunction(() => document.activeElement?.matches('[data-contour-challenge-entry]'));
  await entry.click();
  await diagram(page).waitFor();
  assert.equal(await diagram(page).innerHTML(), originalImage);
  assert.equal(await score(page), '1 / 10 分');

  for (const [index, task] of questions.entries()) {
    if (index === 0) continue;
    assert.ok(await diagram(page).isVisible(), task.id);
    assert.equal(await timer(page).isVisible(), false, task.id);
    await option(page, task.answer).click();
    assert.equal(await score(page), `${index + 1} / 10 分`, task.id);
    assert.doesNotMatch(await selectedFeedback(page).textContent(), /考法参考|期中第|期末第/, task.id);
    if (index === questions.length - 1) {
      assert.match(await selectedFeedback(page).textContent(), /原题已得分/);
      const finalMain = await diagram(page).innerHTML();
      await action(page, 'next').click();
      assert.notEqual(await diagram(page).innerHTML(), finalMain);
      assert.match(await diagram(page).locator('title').textContent(), /桦谷/);
      await option(page, task.variant.answer).click();
      assert.equal(await score(page), '10 / 10 分');
    }
    await action(page, 'next').click();
  }
  await page.getByRole('heading', { name: '收藏卡 · 读图领队' }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: '收藏卡 · 读图领队' }).waitFor();
}

async function expiry(page, questions) {
  await page.clock.install();
  await page.goto(base + challenge);
  await page.locator('[data-challenge-timed]').check();
  await action(page, 'start').click();
  await page.clock.runFor(31_000);
  assert.match(await selectedFeedback(page).textContent(), /时间到/);
  assert.equal(await timer(page).isVisible(), false);
  assert.equal(await action(page, 'next').count(), 0);
  assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).records[0].timedOut, stateKey), true);
  await option(page, questions[0].answer).click();
  assert.equal(await score(page), '0 / 10 分');
  await action(page, 'next').click();
  assert.equal(await timer(page).isVisible(), false);
  await option(page, questions[0].variant.answer).click();
  assert.equal(await score(page), '1 / 10 分');
}

async function directReturn(page) {
  const resumeKey = 'geography-lab:learning:v2:resume';
  await page.goto(base + '#/lesson/intro');
  await page.locator('[data-inquiry-lesson="intro"]').waitFor();
  const prior = await page.evaluate(key => localStorage.getItem(key), resumeKey);
  assert.equal(JSON.parse(prior).lessonId, 'intro');
  await page.goto(base + challenge);
  await action(page, 'start').waitFor();
  await page.locator('[data-nav="home"]').click();
  await page.locator('[data-inquiry-lesson="contours"]').waitFor();
  assert.equal(await page.evaluate(key => localStorage.getItem(key), resumeKey), prior);
}

(async () => {
  const { questions } = await import('../src/contour-challenge-questions.js');
  assert.equal(questions.length, 10);
  const prompts = questions.flatMap(task => [task.prompt, task.variant.prompt]);
  assert.equal(new Set(prompts).size, 20);
  for (const task of questions) {
    for (const exercise of [task, task.variant]) {
      assert.equal(exercise.options.length, exercise.feedback.length);
      assert.ok(exercise.options[exercise.answer] && exercise.hint && exercise.explanation);
    }
  }
  const browser = await chromium.launch({ executablePath: process.env.GEOLAB_CHROME || undefined });
  try {
    await hold(browser, page => directoryEntries(page, questions));
    await hold(browser, page => flow(page, questions));
    await hold(browser, page => expiry(page, questions));
    await hold(browser, directReturn);
    console.log('Contour challenge checked in Chrome at 1280×720.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
