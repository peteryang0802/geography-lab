const assert = require('node:assert/strict');
const { chromium } = require(process.env.GEOLAB_PLAYWRIGHT || 'playwright');
const { moveTo } = require('./lesson-flow.cjs');
const base = process.env.GEOLAB_URL || 'http://127.0.0.1:8773/';

async function verifyCourse(page, item, viewport) {
  const errors = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  try {
    await page.goto(base + '#/lesson/' + item.id);
    const course = page.locator('.geo-lesson');
    const active = course.locator('[data-geo-step]:visible');
    await active.waitFor();
    assert.ok(await active.locator('[data-geo-next]').isVisible(), item.id + ' opening remains a prediction');
    const evidenceStep = item.term ? 'term-observation' : 'proof';
    await moveTo(course, evidenceStep);
    assert.equal(await active.locator('[data-geo-next]').isVisible(), false, item.id + ' evidence must be checked');
    if (!item.term) {
      const evidenceOptions = active.locator('[data-reading-evidence]');
      await evidenceOptions.nth((item.readingAnswer + 1) % await evidenceOptions.count()).click();
      assert.equal(await active.locator('[data-geo-next]').isVisible(), false, item.id + ' incorrect reading cannot advance');
      await moveTo(course, 'lesson-practice');
      const options = active.locator('[data-option]');
      await options.nth((item.practice.answer + 1) % await options.count()).click();
      assert.equal(await active.locator('[data-geo-next]').isVisible(), false, item.id + ' incorrect in-lesson answer cannot advance');
    }
    await moveTo(course, item.profile ? 'term-apply' : item.term ? 'term-review' : 'lesson-practice-transfer');
    const review = active.locator('[data-task], [data-term-review]');
    const graphic = review.locator('figure');
    await graphic.waitFor();
    const materialBox = await graphic.boundingBox();
    assert.ok(materialBox?.width > 150 && materialBox.height > 50, item.id + ' readable material');
    const choices = review.locator('[data-option], [data-term-answer]');
    const next = active.locator('[data-geo-next]');
    assert.equal(await next.isVisible(), false, item.id + ' unattempted transfer');
    await choices.nth((item.transfer.answer + 1) % await choices.count()).click();
    assert.equal(await review.getAttribute('data-assessment'), 'retry', item.id);
    assert.equal(await next.isVisible(), false, item.id + ' wrong transfer cannot advance');
    const feedback = review.locator('.feedback, [data-review-feedback]');
    assert.ok((await feedback.innerText()).length > 10, item.id + ' feedback');
    const coordinates = await review.evaluate(node => ({
      width: document.documentElement.scrollWidth, view: innerWidth,
      graphic: node.querySelector('figure').getBoundingClientRect().toJSON(),
      feedback: node.querySelector('.feedback, [data-review-feedback]').getBoundingClientRect().toJSON(),
    }));
    assert.equal(coordinates.width, coordinates.view, item.id + ' no horizontal overflow');
    if (viewport.width >= 1280) assert.ok(coordinates.graphic.top >= -1 && coordinates.feedback.bottom <= viewport.height + 1 &&
      coordinates.graphic.right <= coordinates.feedback.left, item.id + ' diagram and feedback fit together: ' + JSON.stringify(coordinates));
    await choices.nth(item.transfer.answer).click();
    assert.equal(await review.getAttribute('data-assessment'), 'guided', item.id);
    assert.equal(await next.isVisible(), true, item.id + ' corrected transfer may advance');
    await next.click();
    const summary = course.locator('[data-assessment-summary]');
    assert.match(await summary.innerText(), /提示或重试后完成/, item.id);
    await page.reload();
    await summary.waitFor();
    assert.match(await summary.innerText(), /提示或重试后完成/, item.id + ' recap after reload');
    assert.deepEqual(errors, [], item.id);
  } finally {
    page.off('pageerror', onError);
  }
}

(async () => {
  const { textbookEntries } = await import('../src/textbook.js');
  const { lessons, projects } = await import('../src/catalog.js');
  const { inquiries } = await import('../src/inquiries.js');
  const { lessonReadingPractice } = await import('../src/reading-practice.js');
  const { alignedPractice, alignedTransfer } = await import('../src/lesson-practice-transfer.js');
  const byId = new Map([...lessons, ...projects].map(lesson => [lesson.id, lesson]));
  const sets = [textbookEntries.map(({id}) => ({id,
    readingAnswer: lessonReadingPractice(byId.get(id), inquiries[id]).answer,
    practice: alignedPractice(id) || byId.get(id).tasks[0], transfer: alignedTransfer(id) || byId.get(id).tasks[1],
  }))];
  for (const term of ['7b', '8a', '8b']) {
    const {default: book} = await import(`../src/term-${term}.js`);
    sets.push(book.chapters.flatMap(chapter => chapter.lessons).map(entry => ({
      id: entry.id, term, profile: entry.profilePractice,
      transfer: entry.profilePractice?.application || alignedTransfer(entry.id) || entry.review,
    })));
  }
  const browser = await chromium.launch(process.env.GEOLAB_CHROME ? {executablePath: process.env.GEOLAB_CHROME} : {});
  try {
    const viewports = [{width: 1280, height: 720}, {width: 1420, height: 1112}, {width: 390, height: 844}];
    const errors = [];
    for (const viewport of viewports) {
      await Promise.all(sets.map(async set => {
        const context = await browser.newContext({viewport, reducedMotion: 'reduce'});
        const page = await context.newPage();
        page.setDefaultTimeout(7000);
        const group = viewport.width === 390 ? set.slice(0, 1) : set;
        try {
          for (const item of group) {
            try { await verifyCourse(page, item, viewport); }
            catch (error) { errors.push([viewport.width, item.id, error.message]); }
          }
        } finally { await context.close(); }
      }));
      console.log(`${viewport.width}×${viewport.height}: ${viewport.width === 390 ? 4 : 68} courses checked`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
