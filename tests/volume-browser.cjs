/* Run against a local static server or the published site. */
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { chromium, webkit } = require(process.env.GEOLAB_PLAYWRIGHT || 'playwright');

const base = process.env.GEOLAB_URL || 'http://127.0.0.1:8773/';
const snapshots = process.env.GEOLAB_SCREENSHOTS;
const terms = ['7b', '8a', '8b'];
const appendixPages = [132, 133, 125];
const pageNumbers = [
  [5, 16, 27, 29, 39, 48, 57, 69, 71, 80, 89, 99, 107, 118, 119, 131],
  [5, 11, 16, 25, 27, 34, 45, 60, 69, 71, 77, 83, 90, 97, 99, 108, 115, 124, 132],
  [5, 12, 20, 22, 48, 71, 82, 95, 96, 106, 108, 116, 124],
];

async function check(engine, name, viewport) {
  const browser = await engine.launch(engine === chromium && process.env.GEOLAB_CHROME ?
    { executablePath: process.env.GEOLAB_CHROME } : {});
  try {
    const context = await browser.newContext({viewport, deviceScaleFactor: 2, hasTouch: name !== 'desktop',
      isMobile: name !== 'desktop', acceptDownloads: true});
    const page = await context.newPage();
    const failures = [];
    const fetched = [];
    const tallBoards = [];
    page.on('pageerror', error => failures.push(String(error)));
    page.on('response', response => {
      fetched.push(response.url());
      if (response.status() >= 400 && response.url().startsWith(base)) failures.push(response.status() + ' ' + response.url());
    });
    const go = hash => page.evaluate(hash => { location.hash = hash; }, hash);
    const screenshot = label => name === 'mobile' && snapshots
      ? page.screenshot({path: path.join(snapshots, label + '.png')}) : undefined;
    const fit = async label => {
      const widths = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
      assert.equal(widths[0], widths[1], label + ' horizontal overflow');
    };
    await page.goto(base);
    await page.locator('[data-course-hub] h1').waitFor();
    assert.deepEqual(await page.locator('[data-volume]').evaluateAll(links => links.map(link => link.dataset.volume)), ['7a', ...terms]);
    assert.ok(fetched.every(url => !/\/term-(7b|8a|8b|lesson|diagram)\.js|\/three-runtime\.js/.test(url)));
    await fit('four-volume home');
    await screenshot('home');
    await page.locator('[data-volume="7a"]').click();
    await page.locator('.book-chapter').first().waitFor();
    assert.equal(await page.locator('.book-chapter .chapter-row').count(), 20);
    await go('#/lesson/contours');
    await page.locator('.inquiry-lesson').waitFor();
    await go('#/');

    for (const [bookIndex, book] of terms.entries()) {
      const {default: data} = await import('../src/term-' + book + '.js');
      const entries = data.chapters.flatMap(chapter => chapter.lessons);
      assert.deepEqual(entries.map(lesson => lesson.page), pageNumbers[bookIndex]);
      await page.locator('[data-volume="' + book + '"]').click();
      await page.locator('[data-volume-directory="' + book + '"]').waitFor();
      assert.deepEqual(await page.locator('[data-volume-entry]').evaluateAll(links => links.map(link => link.dataset.volumeEntry)), entries.map(entry => entry.id));
      await fit(book + ' directory');
      await screenshot(book + '-directory');
      await page.locator('a[href="#/legend?term=' + book + '"]').click();
      await page.locator('[data-legend-example]').waitFor();
      assert.match(await page.locator('main').innerText(), new RegExp('课本附录 · 第 ' + appendixPages[bookIndex] + ' 页'));
      await page.locator('main a[href="#/term/' + book + '"]').first().click();
      await page.locator('[data-volume-directory="' + book + '"]').waitFor();

      for (const [index, entry] of entries.entries()) {
        await go('#/lesson/' + entry.id);
        const lesson = page.locator('[data-extended-lesson="' + entry.id + '"]');
        await lesson.waitFor();
        assert.equal(await lesson.locator('h1').innerText(), entry.question, entry.id);
        assert.match(await lesson.locator('.term-anchor summary').innerText(), new RegExp(String(entry.page)));
        const station = lesson.locator('.term-station');
        const point = station.locator('[data-bar], [data-key]').first();
        await point.click();
        assert.ok((await station.locator('[data-term-feedback]').innerText()).length > 0, entry.id);
        const choice = station.locator('[data-term-choice="0"]');
        await choice.click();
        assert.match(await station.locator('[data-term-feedback]').innerText(), /记下了/);
        await station.locator('[data-term-see]').click();
        assert.equal(await station.locator('[data-term-feedback]').innerText(), entry.activity.choices[0].feedback, entry.id);
        if (entry.activity.choices[0].focus.length) assert.ok(await station.locator('.mark-selected').count() > 0, entry.id);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const display = await station.evaluate(section => {
          const picture = section.querySelector('.term-figure').getBoundingClientRect();
          const answer = section.querySelector('[data-term-feedback]').getBoundingClientRect();
          const action = section.querySelector('[data-term-see]').getBoundingClientRect();
          return {top: Math.round(picture.top), bottom: Math.round(answer.bottom), control: Math.round(action.top), height: innerHeight};
        });
        if (name !== 'desktop' && (display.top < -1 || display.bottom > display.height + 1)) tallBoards.push([entry.id, display]);
        if (index === 0) await screenshot(book + '-station');
        if (entry.project) {
          const draft = lesson.locator('#term-project-note');
          await lesson.locator('summary').filter({hasText: '写下我的探究方案'}).click();
          await draft.fill('我会记录同一地点的两次观察。');
          assert.match(await lesson.locator('.term-note-status').innerText(), /已更新/);
        }
        const review = lesson.locator('[data-term-review]');
        await review.locator('summary').click();
        await review.locator('[data-term-answer]').nth(entry.review.answer).click();
        assert.ok((await review.locator('[role=status]').innerText()).endsWith(entry.review.options[entry.review.answer][1]));
        await review.locator('[data-term-retry]').click();
        assert.equal(await review.locator('button[aria-pressed=true]').count(), 0);
        const next = lesson.locator('.next-lesson');
        assert.equal(await next.getAttribute('href'), entries[index + 1] ? '#/lesson/' + entries[index + 1].id : '#/term/' + book);
        await fit(entry.id);
      }
      await go('#/');
      await page.locator('.volume-resume').waitFor();
      assert.match(await page.locator('.volume-resume').innerText(), new RegExp(entries.at(-1).title));
    }
    assert.deepEqual(failures, []);
    assert.deepEqual(tallBoards, []);
    assert.ok(fetched.every(url => !/\/three-runtime\.js/.test(url)));
    console.log(JSON.stringify({profile:name, entries:48, tallBoards}));
  } finally {
    await browser.close();
  }
}

async function checkOptionalAndRecovery() {
  const browser = await chromium.launch({
    executablePath: process.env.GEOLAB_CHROME || undefined,
    args: ['--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
    const fetched = [];
    page.on('request', request => fetched.push(request.url()));
    await page.goto(base + '#/term/7b');
    const link = page.locator('[data-volume-entry="7b-asia"]');
    await link.click();
    await page.locator('[data-extended-lesson="7b-asia"]').waitFor();
    assert.ok(fetched.every(url => !/\/three-runtime\.js|\/assets\/gallery\//.test(url)));

    await page.locator('[data-term-photos] summary').click();
    const gallery = page.locator('[data-term-gallery]');
    await gallery.locator('.gallery-slide[data-image-state=loaded]').first().waitFor();
    const caption = await gallery.locator('[data-active-caption]').innerText();
    await gallery.locator('[data-next]').click();
    await gallery.locator('.gallery-slide:nth-child(2)[data-image-state=loaded]').waitFor();
    await page.waitForFunction(previous => document.querySelector('[data-term-gallery] [data-active-caption]').textContent !== previous, caption);
    assert.notEqual(await gallery.locator('[data-active-caption]').innerText(), caption);

    await page.locator('[data-term-globe] summary').click();
    const globe = page.locator('[data-term-globe-stage]');
    await page.locator('[data-term-globe-stage][data-three-state=flat]').waitFor();
    await globe.locator('[data-toggle-view]').click();
    await page.locator('[data-term-globe-stage][data-three-state=three]').waitFor({timeout: 12_000});
    await globe.locator('[data-toggle-view]').click();
    await page.locator('[data-term-globe-stage][data-three-state=flat]').waitFor();
    await page.locator('.term-lesson a.volume-back').click();
    await page.waitForFunction(() => document.activeElement?.dataset.volumeEntry === '7b-asia');

    await page.route('**/src/term-8b.js*', route => route.abort());
    await page.goto(base + '#/term/8b');
    await page.locator('[data-volume-entry]').first().click();
    await page.locator('[data-volume-retry]').waitFor();
    await page.unroute('**/src/term-8b.js*');
    await page.locator('[data-volume-retry]').click();
    await page.locator('[data-extended-lesson]').waitFor();

    await page.route('**/src/app-runtime.js*', route => route.abort());
    await page.reload();
    const startupError = page.locator('[data-startup-error]');
    await startupError.waitFor();
    await page.unroute('**/src/app-runtime.js*');
    await startupError.getByRole('button').click();
    await page.locator('[data-extended-lesson]').waitFor();
    console.log('PASS page-local photos, flat-to-3D and back, return focus, and blocked script recovery');
  } finally {
    await browser.close();
  }
}

(async () => {
  if (snapshots) await fs.mkdir(snapshots, { recursive: true });
  const profiles = [
    [chromium, 'mobile', {width:390,height:844}], [webkit, 'narrow', {width:320,height:568}],
    [chromium, 'landscape', {width:844,height:390}], [chromium, 'desktop', {width:1440,height:900}],
    [webkit, 'short-landscape', {width:568,height:320}],
  ];
  const results = await Promise.allSettled([...profiles.map(args => check(...args)), checkOptionalAndRecovery()]);
  for (const result of results) if (result.status === 'rejected') { console.error(result.reason); process.exitCode = 1; }
})();
