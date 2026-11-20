import { questions } from './contour-challenge-questions.js';
import { renderContourMap } from './contour-challenge-map.js';

const shortTime = 30_000;
const total = questions.length;

const makeRun = (timed, collected = false) => ({
  version: 1, timed, collected, index: 0, phase: 'main',
  remainingMs: shortTime,
  records: questions.map(() => ({ main: [], variant: [], timedOut: false })),
});

function restore(saved) {
  if (saved?.version !== 1 || !Array.isArray(saved.records)) return null;

  const run = makeRun(saved.timed === true, saved.collected === true);
  const clean = (values, task) => Array.isArray(values)
    ? values.filter(value => Number.isInteger(value) && value >= 0 && value < task.options.length)
    : [];
  run.records = questions.map((task, index) => {
    const record = saved.records[index];
    return { main: clean(record?.main, task), variant: clean(record?.variant, task.variant), timedOut: record?.timedOut === true };
  });
  if (Number.isInteger(saved.index)) run.index = Math.min(total, Math.max(0, saved.index));
  if (saved.phase === 'variant' && run.index < total && run.records[run.index].main.at(-1) === questions[run.index].answer) {
    run.phase = 'variant';
  }
  if (Number.isFinite(saved.remainingMs)) run.remainingMs = Math.max(0, Math.min(shortTime, saved.remainingMs));
  return run;
}

function points(run) {
  return run.records.reduce((sum, record, index) => {
    const task = questions[index];
    return sum + Number(!record.timedOut && record.main[0] === task.answer || record.variant[0] === task.variant.answer);
  }, 0);
}

const esc = text => String(text).replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function mountContourChallenge(root, { read, save }) {
  let run = restore(read());
  let showIntro = !run;
  let deadline = null;
  let timer = null;
  let storageFailed = false;
  let resetting = false;
  let live = true;
  const task = () => questions[run.index];
  const record = () => run.records[run.index];
  const question = () => run.phase === 'variant' ? task().variant : task();
  const attempts = () => record()[run.phase];
  const currentCorrect = () => attempts().at(-1) === question().answer;
  const canRecover = () => record().timedOut || record().main[0] !== task().answer;
  const needsVariant = () => run.phase === 'main' && (canRecover() || run.index + 1 === total);
  const isClocked = () => !showIntro && run?.index < total && run.timed
    && run.phase === 'main' && !question().diagram && attempts().length === 0 && !record().timedOut;

  function persist() {
    if (!run || !live || resetting) return;
    storageFailed = !save(run);
    const warning = root.querySelector('.contour-challenge-warning');
    if (warning) warning.hidden = !storageFailed;
  }

  function stopClock() {
    clearInterval(timer);
    timer = null;
    deadline = null;
  }

  function rememberClock() {
    if (deadline === null) return;
    run.remainingMs = Math.max(0, Math.ceil(deadline - performance.now()));
    stopClock();
    persist();
  }

  function paintRail() {
    return `<aside class="contour-challenge-rail" aria-label="闯关进度">
      <h2>闯关进度</h2><p>${showIntro ? '准备开始' : run.index === total ? '已完成' : `第 ${run.index + 1} / ${total} 题`}<span>${showIntro ? 0 : points(run)} / 10 分</span></p>
      <ol>${questions.map(({topic}, i) => `<li ${!showIntro && i === run.index ? 'aria-current="step"' : ''}>
        <span class="challenge-order" aria-hidden="true">${run && !showIntro && i < run.index ? '✓' : i + 1}</span>${topic}</li>`).join('')}</ol>
    </aside>`;
  }

  function intro() {
    return `<section class="contour-challenge-screen">
      <p class="eyebrow">七年级上册 · 地形图的判读</p>
      <h1 tabindex="-1" data-challenge-focus>等高线与路线选择</h1>
      <p class="contour-challenge-hook">两条路都能登顶，一条近、一条缓。你能从等高线里找出证据吗？</p>
      <p>一关 10 题。首答正确得 1 分，答错订正后，换题首答正确也能补回这 1 分。最后会换一张图独立验证。攒够 10 分收藏「读图领队」。</p>
      <label class="contour-challenge-timing"><input type="checkbox" data-challenge-timed ${run?.timed ? 'checked' : ''}>
        短题首答限时 30 秒 <small>看图题、订正和换题不限时，也能得分。</small></label>
      <button type="button" class="button primary" data-challenge-action="start">开始闯关</button>
    </section>`;
  }

  function feedback() {
    const exercise = question();
    const last = attempts().at(-1);
    const timedOut = last === undefined && run.phase === 'main' && record().timedOut;
    if (last === undefined && !timedOut) return '<div aria-live="polite"></div>';
    const correct = currentCorrect();
    return `<div class="contour-challenge-feedback ${correct ? 'is-correct' : 'is-retry'}" aria-live="polite" tabindex="-1" data-challenge-feedback>
      <strong>${correct ? (run.phase === 'main' && canRecover() ? '原题订正成功' : '作答正确') : timedOut ? '时间到，先找线索' : '再检查你的判断'}</strong>
      <p>${esc(timedOut ? exercise.hint : exercise.feedback[last])}</p>
      ${correct ? `<p>${esc(exercise.explanation)}</p>` : !timedOut ? `<p><b>线索</b> ${esc(exercise.hint)}</p>` : ''}
      ${correct && needsVariant() ? `<p>${canRecover() ? '换题首答正确可补 1 分。' : '原题已得分。用下一张图独立验证。'}</p>` : ''}
      ${correct && run.phase === 'variant' && !canRecover() ? '<p>原题已经得分。这次记录读图练习。</p>' : ''}
    </div>`;
  }

  function showQuestion() {
    const exercise = question();
    const diagram = exercise.diagram ? renderContourMap(exercise.diagram) : '';
    const correct = currentCorrect();
    const next = needsVariant() ? '换题试一次' : run.index + 1 === total ? '查看闯关结果' : '下一题';
    return `<section class="contour-challenge-screen">
      <header class="contour-challenge-head">
        <p class="eyebrow">等高线与路线选择 · 第 ${run.index + 1} / ${total} 题${run.phase === 'variant' ? ' · 换题' : ''}</p>
        <p data-challenge-clock ${isClocked() ? '' : 'hidden'} role="timer" aria-label="剩余时间"></p>
      </header>
      <h1 class="contour-challenge-question" tabindex="-1" data-challenge-focus>${esc(exercise.prompt)}</h1>
      <div class="contour-challenge-stage${diagram ? ' has-map' : ''}">
        ${diagram}
        <div class="contour-challenge-answer">
          <div class="contour-challenge-options" role="group" aria-label="作答选项">
            ${exercise.options.map((option, i) => `<button type="button" data-challenge-option="${i}" aria-pressed="${attempts().at(-1) === i}" ${correct ? 'disabled' : ''}>${esc(option)}</button>`).join('')}
          </div>
          ${feedback()}
          ${correct ? `<button type="button" class="button primary" data-challenge-action="next">${next}</button>` : ''}
        </div>
      </div>
    </section>`;
  }

  function result() {
    const earned = points(run);
    return `<section class="contour-challenge-screen">
      <p class="eyebrow">等高线与路线选择</p>
      <h1 tabindex="-1" data-challenge-focus>这一关做完了</h1>
      <p class="contour-challenge-hook">你拿到了 <strong>${earned} / 10 分</strong></p>
      ${run.collected ? `<section class="contour-challenge-reward" aria-label="已收藏">
        <h2>收藏卡 · 读图领队</h2><p>选路先读目的，再找证据。等高线越密坡越陡。算距离要看这张图的比例尺。</p>
      </section>` : '<p>再练一遍，试着在换图之后说明理由。单次拿到 10 分即可收藏。</p>'}
      <button type="button" class="button primary" data-challenge-action="replay">再做一轮</button>
    </section>`;
  }

  function draw(focus) {
    const content = showIntro ? intro() : run.index === total ? result() : showQuestion();
    root.innerHTML = `<article class="contour-challenge">
      ${paintRail()}<div class="contour-challenge-pane">
        <p class="contour-challenge-warning" role="status" ${storageFailed ? '' : 'hidden'}>这个浏览器暂时无法长期保存。刷新前，请留在本页继续。</p>
        ${content}
      </div>
    </article>`;
    if (focus) (root.querySelector(focus) || root.querySelector('[data-challenge-focus]'))?.focus({ preventScroll: true });
  }

  function expire(refresh) {
    stopClock();
    if (!isClocked()) return;
    record().timedOut = true;
    run.remainingMs = 0;
    persist();
    if (refresh) draw('[data-challenge-feedback]');
  }

  function tick() {
    if (deadline === null) return;
    const left = deadline - performance.now();
    if (left <= 0) {
      expire(true);
      return;
    }
    const display = root.querySelector('[data-challenge-clock]');
    if (display) display.textContent = `${Math.ceil(left / 1000)} 秒`;
  }

  function startClock() {
    if (deadline !== null || !isClocked() || resetting) return;
    if (document.hidden) return;
    if (run.remainingMs <= 0) {
      expire(true);
      return;
    }
    deadline = performance.now() + run.remainingMs;
    tick();
    timer = setInterval(tick, 250);
  }

  function onClick(event) {
    if (!live || resetting) return;
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.challengeOption !== undefined) {
      if (currentCorrect()) return;
      if (deadline !== null && performance.now() >= deadline) {
        expire(true);
        return;
      }
      stopClock();
      const selected = Number(button.dataset.challengeOption);
      attempts().push(selected);
      persist();
      draw('[data-challenge-feedback]');
      return;
    }
    const action = button.dataset.challengeAction;
    if (action === 'start') {
      run = makeRun(root.querySelector('[data-challenge-timed]').checked, run?.collected);
      showIntro = false;
      persist();
    } else if (action === 'replay') {
      showIntro = true;
    } else if (action === 'next' && currentCorrect()) {
      if (needsVariant()) {
        run.phase = 'variant';
      } else {
        run.phase = 'main';
        run.index++;
        if (run.index === total && points(run) >= total) run.collected = true;
      }
      run.remainingMs = shortTime;
      persist();
    } else {
      return;
    }
    draw('[data-challenge-focus]');
    root.querySelector('[data-challenge-focus]').scrollIntoView({ block: 'nearest' });
    startClock();
  }

  function onVisibility() {
    if (document.hidden) rememberClock();
    else startClock();
  }

  function onReset(event) {
    if (event.detail?.subject !== 'geography') return;
    resetting = event.detail.phase === 'start';
    if (resetting) stopClock();
    else startClock();
  }

  function onStorage(event) {
    if (!event.key?.endsWith(':activities:contours-challenge') || resetting) return;
    const stored = restore(read());
    if (!stored) return;
    stopClock();
    run = stored;
    showIntro = false;
    draw();
    startClock();
  }

  root.addEventListener('click', onClick);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', rememberClock);
  window.addEventListener('parent-learning-reset', onReset);
  window.addEventListener('storage', onStorage);
  draw();
  startClock();
  return () => {
    rememberClock();
    live = false;
    root.removeEventListener('click', onClick);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', rememberClock);
    window.removeEventListener('parent-learning-reset', onReset);
    window.removeEventListener('storage', onStorage);
  };
}
