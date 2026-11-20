import { earlierRouteQuestion, questions, routeRecheck } from './contour-challenge-questions.js?v=2';
import { contourRouteEvidence, renderContourMap } from './contour-challenge-map.js?v=2';

const shortTime = 30_000;
const total = questions.length;
const validProof = values => Array.isArray(values) ? values.filter(side => side === 'west' || side === 'east') : [];

const makeRun = (timed, collected = false) => ({
  version: 1, timed, collected, index: 0, phase: 'main',
  remainingMs: shortTime,
  records: questions.map(() => ({ main: [], variant: [], timedOut: false, proof: {main: [], variant: []} })),
  recheck: null,
});

function restore(saved) {
  if (saved?.version !== 1 || !Array.isArray(saved.records)) return null;

  const run = makeRun(saved.timed === true, saved.collected === true);
  const clean = (values, task) => Array.isArray(values)
    ? values.filter(value => Number.isInteger(value) && value >= 0 && value < task.options.length)
    : [];
  run.records = questions.map((task, index) => {
    const record = saved.records[index];
    return { main: clean(record?.main, task), variant: clean(record?.variant, task.variant), timedOut: record?.timedOut === true,
      proof: { main: validProof(record?.proof?.main), variant: validProof(record?.proof?.variant) } };
  });
  if (Number.isInteger(saved.index)) run.index = Math.min(total, Math.max(0, saved.index));
  if (saved.phase === 'variant' && run.index < total && run.records[run.index].main.at(-1) === questions[run.index].answer) {
    run.phase = 'variant';
  }
  if (run.index === total && saved.recheck) {
    run.recheck = { attempts: clean(saved.recheck.attempts, routeRecheck), proof: validProof(saved.recheck.proof) };
    if (saved.phase === 'recheck') run.phase = 'recheck';
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
  const rechecking = () => run.phase === 'recheck';
  const attempts = () => rechecking() ? run.recheck.attempts : record()[run.phase];
  const proof = () => rechecking() ? run.recheck.proof : record().proof[run.phase];
  function question() {
    if (rechecking()) return routeRecheck;
    if (task().id === 'decision' && attempts().length && !proof().length) return earlierRouteQuestion[run.phase];
    return run.phase === 'variant' ? task().variant : task();
  }
  const evidence = () => contourRouteEvidence(question().diagram);
  const needsEvidence = () => evidence() && attempts().length === 0 && proof().at(-1) !== evidence().answer;
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
      <p>一关 10 题。选项首答正确得 1 分，答错订正后，换题首答正确也能补回这 1 分。最后换图，用图上的证据验证。练习得分和新图验证会分别记录。</p>
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
      ${correct && run.phase === 'variant' && !canRecover() ? '<p>原题已经得分。这次记录新图判读。</p>' : ''}
    </div>`;
  }

  function showQuestion() {
    const exercise = question();
    const marking = needsEvidence();
    const diagram = exercise.diagram ? renderContourMap(exercise.diagram, { interactive: Boolean(marking) }) : '';
    const correct = currentCorrect();
    const next = needsVariant() ? '换题试一次' : run.index + 1 === total ? '查看闯关结果' : '下一题';
    return `<section class="contour-challenge-screen">
      <header class="contour-challenge-head">
        <p class="eyebrow">等高线与路线选择 · ${rechecking() ? '换新图巩固' : `第 ${run.index + 1} / ${total} 题${run.phase === 'variant' ? ' · 换题' : ''}`}</p>
        <p data-challenge-clock ${isClocked() ? '' : 'hidden'} role="timer" aria-label="剩余时间"></p>
      </header>
      <h1 class="contour-challenge-question" tabindex="-1" data-challenge-focus>${esc(exercise.prompt)}</h1>
      <div class="contour-challenge-stage${diagram ? ' has-map' : ''}">
        ${diagram}
        <div class="contour-challenge-answer">
          ${evidence() ? evidenceMarkup(marking) : ''}
          <div class="contour-challenge-options" ${marking ? 'hidden' : ''} role="group" aria-label="作答选项">
            ${exercise.options.map((option, i) => `<button type="button" data-challenge-option="${i}" aria-pressed="${attempts().at(-1) === i}" ${correct ? 'disabled' : ''}>${esc(option)}</button>`).join('')}
          </div>
          ${feedback()}
          ${correct ? `<button type="button" class="button primary" data-challenge-action="next">${rechecking() ? '回看本关结果' : next}</button>` : ''}
        </div>
      </div>
    </section>`;
  }

  function evidenceMarkup(marking) {
    const route = evidence();
    if (!marking) return `<p class="contour-challenge-proof-summary">同升 ${route.last - route.first} 米，西线约 ${route.west} 米，东线约 ${route.east} 米。</p>`;
    const previous = proof().at(-1);
    return `<div class="contour-challenge-proof" ${previous ? 'role="status"' : ''}>
      <p tabindex="-1" data-challenge-proof-focus>从 ${route.first} 米到 ${route.last} 米，点图上横向更长的高亮路段。</p>
      ${previous ? '<p>两段升高相同。用同一张图的比例尺比较各段的水平长度。</p>' : ''}
    </div>`;
  }

  function migrationResult(attempts, marks, question) {
    if (!attempts.length) return '待完成';
    if (attempts[0] !== question.answer) return '订正后通过';
    if (!marks.length) return '曾答对，未记录图上取证';
    return marks[0] === contourRouteEvidence(question.diagram).answer ? '首次独立通过' : '订正证据后通过';
  }

  function result() {
    const earned = points(run);
    const last = run.records.at(-1);
    const transferResult = migrationResult(last.variant, last.proof.variant, questions.at(-1).variant);
    const recheckResult = run.recheck && migrationResult(run.recheck.attempts, run.recheck.proof, routeRecheck);
    return `<section class="contour-challenge-screen">
      <p class="eyebrow">等高线与路线选择</p>
      <h1 tabindex="-1" data-challenge-focus>这一关做完了</h1>
      <p class="contour-challenge-hook">你拿到了 <strong>${earned} / 10 分</strong></p>
      <p data-challenge-transfer-result>独立新图 · <strong>${transferResult}</strong></p>
      ${recheckResult ? `<p>枫台新图巩固 · <strong>${recheckResult}</strong></p>` : ''}
      ${run.collected ? `<section class="contour-challenge-reward" aria-label="已收藏">
        <h2>收藏卡 · 读图领队</h2><p>选路先读目的，再找证据。等高线越密坡越陡。算距离要看这张图的比例尺。</p>
      </section>` : '<p>再练一遍，试着在换图之后说明理由。单次拿到 10 分即可收藏。</p>'}
      ${!run.recheck ? '<button type="button" class="button primary" data-challenge-action="recheck">换张没见过的图巩固</button>' : ''}
      <button type="button" class="button${run.recheck ? ' primary' : ''}" data-challenge-action="replay">再做一轮</button>
    </section>`;
  }

  function draw(focus) {
    const content = showIntro ? intro() : run.index === total && !rechecking() ? result() : showQuestion();
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

  function markEvidence(side) {
    if (!live || resetting || !needsEvidence()) return;
    proof().push(side);
    persist();
    draw(needsEvidence() ? '[data-challenge-proof-focus]' : '[data-challenge-option]');
  }

  function onClick(event) {
    if (!live || resetting) return;
    const hit = event.target.closest('[data-challenge-probe]');
    if (hit) { markEvidence(hit.dataset.challengeProbe); return; }
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.challengeOption !== undefined) {
      if (currentCorrect() || needsEvidence()) return;
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
    } else if (action === 'recheck' && run.index === total) {
      run.recheck = { attempts: [], proof: [] };
      run.phase = 'recheck';
      persist();
    } else if (action === 'next' && currentCorrect()) {
      if (rechecking()) {
        run.phase = 'main';
      } else if (needsVariant()) {
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

  function onKeydown(event) {
    if (!['Enter', ' '].includes(event.key)) return;
    const hit = event.target.closest('[data-challenge-probe]');
    if (!hit) return;
    event.preventDefault();
    markEvidence(hit.dataset.challengeProbe);
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
  root.addEventListener('keydown', onKeydown);
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
    root.removeEventListener('keydown', onKeydown);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', rememberClock);
    window.removeEventListener('parent-learning-reset', onReset);
    window.removeEventListener('storage', onStorage);
  };
}
