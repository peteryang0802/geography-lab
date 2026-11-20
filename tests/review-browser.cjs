/* Exercise the course question, wrong-answer list and practice with one task identity. */
const assert = require('node:assert/strict');
const { chromium } = require(process.env.GEOLAB_PLAYWRIGHT || 'playwright');
const { moveTo } = require('./lesson-flow.cjs');
const base = process.env.GEOLAB_URL || 'http://127.0.0.1:8773/';
const state = (task) => task.getAttribute('data-assessment');
const options = (task) => task.locator('[data-option], [data-term-answer]');
const practiceRoute = (lesson, task) => '#/practice/' + lesson + '?task=' + encodeURIComponent(task);

async function verify(browser, {lesson, step, task}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await page.goto(base + '#/lesson/' + lesson);
    const course = page.locator('.geo-lesson');
    await moveTo(course, step);
    const current = course.locator('[data-geo-step]:visible');
    const next = current.locator('[data-geo-next]');
    const exercise = current.locator('[data-task], [data-term-review]');
    const title = await exercise.locator('h3').innerText();
    const material = exercise.locator('.geo-comparison, .evidence');
    const evidence = await material.allTextContents();
    assert.equal(await state(exercise), 'unchecked', task.id);
    assert.match(await next.innerText(), /暂时跳过/, task.id);
    const wrong = (task.answer + 1) % await options(exercise).count();
    await options(exercise).nth(wrong).click();
    assert.equal(await state(exercise), 'retry', task.id);
    assert.match(await next.innerText(), /先留待重试/, task.id);

    await page.goto(base + '#/review');
    const route = practiceRoute(lesson, task.id);
    const wrongAnswer = page.locator(`.review-list a[href="${route}"]`);
    await wrongAnswer.click();
    const practice = page.locator('[data-task], [data-term-review]');
    await practice.waitFor();
    assert.equal(await practice.count(), 1, task.id);
    assert.equal(await practice.locator('h3').innerText(), title, task.id);
    assert.deepEqual(await practice.locator('.geo-comparison, .evidence').allTextContents(), evidence, task.id);
    assert.equal(await options(practice).nth(wrong).getAttribute('aria-pressed'), 'true', task.id);
    assert.equal(await state(practice), 'retry', task.id);
    await options(practice).nth(task.answer).click();
    assert.equal(await state(practice), 'guided', task.id);
    await page.reload();
    await practice.waitFor();
    assert.equal(await options(practice).nth(task.answer).getAttribute('aria-pressed'), 'true', task.id);
    assert.equal(await state(practice), 'guided', task.id);
    await page.goto(base + '#/review');
    await page.getByRole('heading', { name: '再试一次' }).waitFor();
    assert.equal(await wrongAnswer.count(), 0, task.id);
    await page.locator('#practice-lesson').selectOption(lesson);
    await page.locator('.review-practice button').click();
    const listedTask = page.locator(`[data-task="${task.id}"], [data-task-id="${task.id}"]`);
    await listedTask.waitFor({state:'attached'});
    assert.equal(await listedTask.locator('h3').textContent(), title, task.id);
    if (step !== 'lesson-practice') {
      await page.goto(base + '#/lesson/' + lesson);
      await moveTo(course, 'recap');
      assert.match(await course.locator('[data-assessment-summary]').innerText(), /提示或重试后完成/, task.id);
    }
  } finally {
    await context.close();
  }
}

async function verifyFirstAndHinted(browser) {
  const page = await browser.newPage({viewport: {width: 1280, height: 720}});
  try {
    await page.goto(base + practiceRoute('intro', 'intro-puddles'));
    const task = page.locator('[data-task="intro-puddles"]');
    await task.locator('[data-assessment-hint] summary').click();
    await page.reload();
    await options(task).nth(1).click();
    assert.equal(await state(task), 'guided');

    await page.goto(base + practiceRoute('7b-asia', 'review-7b-asia'));
    const asia = page.locator('[data-term-review]');
    await options(asia).nth(0).click();
    assert.equal(await state(asia), 'independent');
    await page.reload();
    await options(asia).nth(1).click();
    assert.equal(await state(asia), 'retry');
    await options(asia).nth(0).click();
    assert.equal(await state(asia), 'guided');

    await page.evaluate(() => {
      localStorage.setItem('geography-lab:learning:v2:answers:review-7b-asia', JSON.stringify({option: 0, solved: true}));
    });
    await page.reload();
    await asia.waitFor();
    assert.equal(await state(asia), 'previous');
  } finally {
    await page.close();
  }
}

(async () => {
  const { alignedPractice, alignedTransfer } = await import('../src/lesson-practice-transfer.js');
  const { textbookEntries } = await import('../src/textbook.js');
  const entries = textbookEntries.flatMap(({id}) => [
    {lesson: id, step:'lesson-practice', task: alignedPractice(id)},
    {lesson: id, step:'lesson-practice-transfer', task: alignedTransfer(id)},
  ]).filter(({task}) => task);
  for (const volume of ['7b', '8a', '8b']) {
    const { default: book } = await import(`../src/term-${volume}.js`);
    for (const entry of book.chapters.flatMap(chapter => chapter.lessons)) {
      const task = alignedTransfer(entry.id) ?? (entry.id === '7b-asia' ? { id:'review-7b-asia', answer: entry.review.answer } : null);
      if (task) entries.push({ lesson: entry.id, step:'term-review', task });
    }
  }
  const browser = await chromium.launch(process.env.GEOLAB_CHROME ? { executablePath: process.env.GEOLAB_CHROME } : {});
  try {
    for (const entry of entries) await verify(browser, entry);
    await verifyFirstAndHinted(browser);
    console.log('PASS', entries.length, 'course questions, exact retry routes, resume, practice and recap');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
