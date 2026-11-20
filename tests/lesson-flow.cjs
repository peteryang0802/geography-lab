const assert = require('node:assert/strict');

async function moveTo(lesson, target) {
  const steps = lesson.locator('[data-geo-step]');
  await steps.first().waitFor({ state: 'attached' });
  const ids = await steps.evaluateAll(items => items.map(item => item.dataset.geoStep));
  assert.ok(ids.includes(target), 'Missing lesson step ' + target);
  const current = lesson.locator('[data-geo-step]:visible');
  for (let index = 0; index < ids.length; index++) {
    const active = await current.getAttribute('data-geo-step');
    if (active === target) return;
    await current.locator(ids.indexOf(active) < ids.indexOf(target) ? '[data-geo-next]' : '[data-geo-back]').click();
  }
  assert.fail('Did not reach lesson step ' + target);
}

module.exports = { moveTo };
