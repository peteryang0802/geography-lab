const assert = require('node:assert/strict');

async function prepareForward(lesson, current, step) {
  const id = await lesson.getAttribute('data-inquiry-lesson') || await lesson.getAttribute('data-extended-lesson');
  assert.ok(id, 'No lesson data for mandatory ' + step);
  if (step === 'proof') {
    const { inquiries } = await import('../src/inquiries.js');
    const { lessonReadingPractice } = await import('../src/reading-practice.js');
    const plan = lessonReadingPractice({ id }, inquiries[id]);
    await current.locator('[data-reading-evidence]').nth(plan.answer).click();
    return;
  }
  if (step.startsWith('lesson-practice')) {
    const { lessons, projects } = await import('../src/catalog.js');
    const { alignedPractice, alignedTransfer } = await import('../src/lesson-practice-transfer.js');
    const entry = [...lessons, ...projects].find(lesson => lesson.id === id);
    const task = step === 'lesson-practice' ? alignedPractice(id) || entry.tasks[0] : alignedTransfer(id) || entry.tasks[1];
    await current.locator('[data-option]').nth(task.answer).click();
    return;
  }
  if (step === 'term-observation' && id !== '8a-relief') {
    const { termMarkPlan } = await import('../src/term-practice-evidence.js');
    if (await current.locator('[data-term-proof-start]').isVisible()) await current.locator('[data-term-proof-start]').click();
    const controls = current.locator('[data-key], [data-bar]');
    const reset = current.locator('[data-term-proof-reset]');
    if (await reset.isVisible() && await current.locator('[data-term-proof-check]').isVisible()) await reset.click();
    if (await current.locator('[data-term-proof-check]').isVisible()) {
      for (const index of termMarkPlan(id).indices) await controls.nth(index).click();
      await current.locator('[data-term-proof-check]').click();
    }
    await current.locator('[data-term-proof-transfer]').click();
    return;
  }
  const { default: book } = await import(`../src/term-${id.slice(0, 2)}.js`);
  const entry = book.chapters.flatMap(chapter => chapter.lessons).find(lesson => lesson.id === id);
  if (step === 'term-observation') {
    if (!(await current.locator('[data-term-comparison]').isVisible())) {
      await current.locator('[data-term-compare]').click();
    }
    const reset = current.locator('[data-term-compare-reset]');
    if (!(await current.locator('[data-profile-conclude]').isVisible())) {
      if (await reset.isVisible()) await reset.click();
      for (const index of entry.comparison.pairs[0]) await current.locator('[data-key]').nth(index).click();
    }
    await current.locator('[data-profile-conclude]').click();
  } else if (step === 'profile') {
    await current.locator('[data-scope-choice]').nth(entry.profilePractice.scope.answer).click();
  } else if (step === 'term-review' && entry.profilePractice) {
    const points = current.locator('[data-key]');
    const reset = current.locator('[data-profile-pair-reset]');
    if (await reset.isVisible()) await reset.click();
    await points.nth(1).click();
    await points.nth(2).click();
    await current.locator('[data-profile-pair-submit]').click();
  } else {
    const { alignedTransfer } = await import('../src/lesson-practice-transfer.js');
    const task = step === 'term-apply' ? entry.profilePractice.application : alignedTransfer(id) || entry.review;
    await current.locator('[data-term-answer]').nth(task.answer).click();
  }
}

async function moveTo(lesson, target) {
  const steps = lesson.locator('[data-geo-step]');
  await steps.first().waitFor({ state: 'attached' });
  const ids = await steps.evaluateAll(items => items.map(item => item.dataset.geoStep));
  assert.ok(ids.includes(target), 'Missing lesson step ' + target);
  const current = lesson.locator('[data-geo-step]:visible');
  for (let index = 0; index < ids.length; index++) {
    const active = await current.getAttribute('data-geo-step');
    if (active === target) return;
    const forward = ids.indexOf(active) < ids.indexOf(target);
    const button = current.locator(forward ? '[data-geo-next]' : '[data-geo-back]');
    if (forward && !(await button.isVisible())) {
      await prepareForward(lesson, current, active);
      if ((await current.getAttribute('data-geo-step')) !== active) continue;
    }
    await button.click();
  }
  assert.fail('Did not reach lesson step ' + target);
}

module.exports = { moveTo };
