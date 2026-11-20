import { bindPrediction, escapeHtml as escape, methodSummary, renderComparison, renderPrediction } from './inquiry-view.js?v=7';
import { mountTermDiagram } from './term-diagram.js?v=3';
import { termMarkPlan, renderTermMarkPractice, bindTermMarkPractice } from './term-practice-evidence.js?v=3';
import { bindLessonFlow, lessonFlow } from './lesson-flow.js?v=4';
import { alignedMethod, alignedTransfer } from './lesson-practice-transfer.js?v=2';
import { assessmentState, paintAssessment } from './assessment.js?v=3';
import { profileCourseTasks } from './profile-assessment.js?v=1';
import { renderTransferMaterial, mountTransferMaps } from './transfer-material.js?v=2';

const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const marker = index => labels[index] || (index + 1);
const dataFor = activity => activity.kind === 'map' ? activity.points : activity.values;
const boardKind = {map: '地图', profile: '剖面', chart: '数据图'};

function chartMarkup(activity) {
  const [minimum, maximum] = [Math.min(0, ...activity.values.map(row => row.value)), Math.max(1, ...activity.values.map(row => row.value))];
  const percent = number => 100 * (number - minimum) / (maximum - minimum);
  return `<div class="term-bars" aria-label="可比较的数据" style="--zero:${percent(0)}%">
    ${activity.values.map((row, i) => `<button type="button" data-bar="${i}" class="term-bar">
      <span>${escape(row.label)}</span><span class="term-track" aria-hidden="true" style="--start:${Math.min(percent(row.value), percent(0))}%;--length:${Math.abs(percent(row.value) - percent(0))}%"><i></i></span>
      <strong>${escape(String(row.value) + (activity.unit ? ' ' + activity.unit : ''))}</strong>
    </button>`).join('')}
  </div>`;
}

function plotMarkup(activity) {
  const points = dataFor(activity);
  return `<div class="term-plot">
    <canvas width="360" height="180" role="img" aria-label="${escape((boardKind[activity.kind] || '') + '。' + (activity.caption || ''))}"></canvas>
    ${points.map((point, index) => `<button type="button" class="term-point" data-plot-point
      aria-label="${escape(marker(index) + ' ' + point.label)}" hidden><span aria-hidden="true">${marker(index)}</span></button>`).join('')}
  </div>
  <div class="term-keys" aria-label="读图标记">
    ${points.map(({label,value}, index) => `<button type="button" class="term-key" data-key="${index}">
      <b aria-hidden="true">${marker(index)}</b>${escape(label)}${value === undefined ? '' : ' ' + escape(String(value) + (activity.unit ? ' ' + activity.unit : ''))}
    </button>`).join('')}
  </div>`;
}

function alignTermBoard(host, control, feedback) {
  requestAnimationFrame(() => {
    if (!host.isConnected || innerWidth >= 820 && innerHeight >= 500) return;
    const height = Math.min(innerHeight, window.visualViewport?.height || Infinity);
    const controlBox = control.getBoundingClientRect();
    const resultBox = feedback.getBoundingClientRect();
    const drawingBox = host.querySelector('.term-plot, .term-bars')?.getBoundingClientRect();
    const begin = Math.min(drawingBox?.top ?? controlBox.top, controlBox.top);
    const end = Math.max(drawingBox?.bottom ?? resultBox.bottom, resultBox.bottom);
    const inset = Math.min(8, Math.max(0, Math.floor((height - (end - begin)) / 2)));
    const lowerBound = end - height + inset;
    const upperBound = begin - inset;
    const shift = lowerBound <= upperBound
      ? Math.max(lowerBound, Math.min(upperBound, 0))
      : Math.max(0, Math.min(resultBox.bottom - height + 8, controlBox.top - 8));
    if (Math.abs(shift) > 1) scrollTo({top: Math.max(0, scrollY + shift), behavior: 'instant'});
  });
}

function bindReview(root, review, taskId, learning, restored, remember) {
  const info = root.querySelector(`[data-term-review][data-task-id="${taskId}"]`);
  const options = [...info.querySelectorAll('[data-term-answer]')];
  const feedback = info.querySelector('[data-review-feedback]');
  let record = learning.state.answers[taskId];
  if (!record && Number.isInteger(restored) && review.options[restored]) {
    learning.setRecord('answers', taskId, { option: restored, solved: restored === review.answer });
    record = learning.state.answers[taskId];
  }
  const figure = review.figure ? info.querySelector('figure') : null;
  const submit = info.querySelector('[data-profile-pair-submit]');
  const reset = info.querySelector('[data-profile-pair-reset]');
  const hint = info.querySelector('[data-profile-pair-hint]');
  const guidance = info.querySelector('[data-profile-pair-selection]');
  const keys = [...(figure?.querySelectorAll('[data-key]') || [])];
  let picks = review.pairs?.[record?.option]?.slice() || [];
  let diagram;
  function paintPicks() {
    diagram?.select(picks, false);
    keys.forEach((key, index) => {
      key.classList.toggle('mark-selected', picks.includes(index));
      key.setAttribute('aria-pressed', String(picks.includes(index)));
    });
    if (submit) {
      const accepted = record?.option === review.answer && review.pairs[review.answer].every(point => picks.includes(point));
      submit.disabled = picks.length < 2;
      submit.classList.toggle('primary', !accepted);
      reset.hidden = !picks.length;
    }
    if (guidance) guidance.textContent = picks.length ? '已选 ' + picks.map(marker).join('、') : '';
  }
  function check(index, button) {
    record = learning.answerTask(taskId, index, index === review.answer);
    remember?.(index);
    paint();
    alignTermBoard(info, button, feedback);
  }
  function paint() {
    const selected = record?.option ?? null;
    const correct = selected === review.answer;
    for (const [index, candidate] of options.entries()) {
      candidate.setAttribute('aria-pressed', String(selected === index));
    }
    feedback.textContent = selected === null ? '' :
      (correct ? '这条依据能说得通。' : '再用材料核对。') + review.options[selected][1];
    info.dataset.result = selected === null ? '' : correct ? 'correct' : 'retry';
    feedback.dataset.result = info.dataset.result;
    paintAssessment(info, assessmentState(record, review.answer));
  }
  for (const button of options) {
    button.addEventListener('click', () => check(Number(button.dataset.termAnswer), button));
  }
  function choose(index) {
    picks = picks.includes(index) ? picks.filter(item => item !== index) : submit ? [...picks.slice(-1), index] : [index];
    paintPicks();
  }
  if (figure) {
    diagram = mountTermDiagram(figure, review.figure, choose);
    keys.forEach((key, index) => key.addEventListener('click', () => choose(index)));
  }
  submit?.addEventListener('click', () => {
    const ordered = [...picks].sort((a, b) => a - b);
    const candidate = review.pairs.findIndex(pair => pair.every((point, i) => ordered[i] === point));
    if (candidate >= 0) {
      if (hint?.open) learning.hintTask(taskId);
      check(candidate, submit);
      paintPicks();
    }
  });
  reset?.addEventListener('click', () => {
    picks = [];
    paintPicks();
    keys[0]?.focus({preventScroll:true});
  });
  hint?.addEventListener('toggle', () => {
    if (hint.open) learning.hintTask(taskId);
  });
  paint();
  paintPicks();
  return () => diagram?.dispose();
}

function projectMarkup(entry, saved) {
  if (!entry.project) return '';
  return `<details class="term-fold" data-remember="project-brief">
    <summary>写下我的探究方案</summary>
    <label for="term-project-note">${escape(entry.projectGuide)}</label>
    <textarea id="term-project-note" maxlength="2000" rows="3" placeholder="先记一条，随时回来接着写。">${escape(saved || '')}</textarea>
    <p class="term-note-status" role="status">草稿留在当前浏览器。</p>
    <button type="button" class="button term-note-download" data-term-download>下载我的记录</button>
  </details>`;
}

function projectBinding(root, entry, learning) {
  const input = root.querySelector('#term-project-note');
  if (!input) return;
  const info = root.querySelector('.term-note-status');
  input.addEventListener('input', () => {
    const saved = learning.setRecord('notes', entry.id, input.value);
    info.textContent = saved ? '当前记录已更新。' : '可以下载保存这一页的草稿。';
  });
  root.querySelector('[data-term-download]').addEventListener('click', () => {
    if (!input.value.trim()) {
      info.textContent = '先留下一条自己的观察或计划。';
      input.focus();
      return;
    }
    const url = URL.createObjectURL(new Blob([entry.title, '\n\n', input.value], {type:'text/plain;charset=utf-8'}));
    Object.assign(document.createElement('a'), {href:url, download:entry.title + ' · 我的记录.txt'}).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

function compareProfilePoints(activity, picks) {
  const [west, east] = [...picks].sort((left, right) => left - right);
  const first = activity.values[west];
  const second = activity.values[east];
  const change = second.value - first.value;
  return {
    change,
    line: marker(west) + ' ' + first.label + '（' + first.value + ' 米）往东到 ' +
      marker(east) + ' ' + second.label + '（' + second.value + ' 米）' +
      (change === 0 ? '，海拔相同。' : '，海拔' + (change > 0 ? '升高 ' : '降低 ') + Math.abs(change) + ' 米。'),
  };
}

function profilePracticeMarkup(practice) {
  return `<section class="term-fold term-profile-scope" data-profile-scope aria-labelledby="profile-scope-title">
    <h2 id="profile-scope-title" tabindex="-1">${escape(practice.scope.prompt)}</h2>
    <div class="term-choices" role="group" aria-labelledby="profile-scope-title">
      ${practice.scope.options.map(([label], index) => `<button type="button" class="button" data-scope-choice="${index}" aria-pressed="false">${escape(label)}</button>`).join('')}
    </div>
    <p class="term-feedback" data-scope-feedback role="status"></p>
    <button type="button" class="button" data-profile-source hidden>看看剖面两端 →</button>
  </section>`;
}

function bindProfilePractice(root, config, practice, save, recheck) {
  if (!config) return;
  const scope = root.querySelector('[data-profile-scope]');
  const options = [...scope.querySelectorAll('[data-scope-choice]')];
  const feedback = scope.querySelector('[data-scope-feedback]');
  const source = scope.querySelector('[data-profile-source]');
  function paint() {
    const selected = Number.isInteger(practice.scopeChoice) ? options[practice.scopeChoice] : null;
    const correct = selected && practice.scopeChoice === config.scope.answer;
    options.forEach(button => button.setAttribute('aria-pressed', String(button === selected)));
    feedback.textContent = selected ? (correct ? '找对了。' : '再看看。') + config.scope.options[practice.scopeChoice][1] : '';
    scope.dataset.result = selected ? (correct ? 'correct' : 'retry') : '';
    source.hidden = !selected || correct;
    paintAssessment(scope, !selected ? 'unchecked' : correct ? 'guided' : 'retry');
  }
  for (const option of options) {
    option.addEventListener('click', () => {
      practice.scopeChoice = Number(option.dataset.scopeChoice);
      save();
      paint();
    });
  }
  source.addEventListener('click', recheck);
  paint();
}

function reviewMarkup(review) {
  const figure = review.figure ? `<figure class="term-figure">
    ${plotMarkup(review.figure)}<figcaption>${escape(review.figure.caption)}</figcaption></figure>` :
    renderTransferMaterial(review.materialId);
  const selection = review.pairs ? `<div class="term-profile-actions">
      <button type="button" class="button primary" data-profile-pair-submit disabled>核对我选的两处</button>
      <button type="button" class="button" data-profile-pair-reset hidden>清空重选</button>
    </div><details class="geo-material-fold" data-profile-pair-hint>
      <summary>给一点读图提示</summary><p>${escape(review.hint)}</p></details>` :
    `<div class="term-choices" role="group" aria-label="选择材料支持的解释">
      ${review.options.map(([label], i) => `<button type="button" class="button" data-term-answer="${i}" aria-pressed="false">${escape(label)}</button>`).join('')}
    </div>`;
  return `<section class="term-review${figure ? ' term-review-visual' : ''}" data-term-review data-task-id="${escape(review.id)}">
    <h3 class="geo-review-prompt" tabindex="-1">${escape(review.prompt)}</h3>
    ${review.evidence ? renderComparison(review.evidence) : ''}
    <div class="term-review-body">${figure}<div class="term-review-controls">${selection}
      ${figure ? '<p class="term-review-selection" aria-live="polite" data-profile-pair-selection></p>' : ''}
      <p class="term-feedback" role="status" data-review-feedback></p>
      <p class="geo-assessment-label" data-assessment-label></p></div>
    </div>
  </section>`;
}

function termReviewTask(entry, taskId) {
  const legacy = { ...entry.review, id: 'review-' + entry.id };
  const transfer = alignedTransfer(entry.id);
  if (!transfer) return { ...legacy, materialId: entry.id };
  if (taskId === legacy.id) return legacy;
  return { ...transfer, materialId: entry.id, options: transfer.options.map(({label, feedback}) => [label, feedback]) };
}

export function renderTermPractice(root, { entry, learning, taskId, initialStep, onStep }) {
  const profile = profileCourseTasks(entry);
  const match = profile.find(task => task.id === taskId);
  const tasks = match ? [match] : profile.length && !taskId ? profile : [termReviewTask(entry, taskId)];
  const flow = tasks.length > 1 ? lessonFlow(tasks.map((task, index) => ({
    id: 'practice-' + index, label: ['找局部反例', '判断趋势和局部'][index], content: reviewMarkup(task),
    next: index === 0 ? '换个剖面判断' : '',
  })), '练习进度') : reviewMarkup(tasks[0]);
  root.innerHTML = `<article class="geo-lesson geo-extra-learning${tasks.length === 1 ? ' geo-single-practice' : ''}">
    <header class="term-intro"><p class="term-bookname">按课练习</p><h1>${escape(entry.title)}</h1></header>${flow}</article>`;
  const lessonSteps = tasks.length > 1 ? bindLessonFlow(root, initialStep, onStep) : null;
  const cleanups = tasks.map(review => {
    const legacy = review.id === 'review-' + entry.id;
    const restored = legacy ? learning.state.widgets[entry.id]?.reviewPick : undefined;
    return bindReview(root, review, review.id, learning, restored, legacy ? reviewPick =>
      learning.setRecord('widgets', entry.id, {...learning.state.widgets[entry.id], reviewPick}) : undefined);
  });
  lessonSteps?.verifyRestored();
  const unmountTransfer = mountTransferMaps(root);
  return () => { unmountTransfer(); cleanups.forEach(cleanup => cleanup()); };
}

export function renderTermLesson(root, { entry, term, next, related, learning, initialStep, onStep, onGlobe, onPhotos }) {
  const activity = entry.activity;
  const records = dataFor(activity);
  const hasReadings = records.length >= 2 && records.every(point => Number.isFinite(point.value));
  const comparison = entry.comparison;
  const profilePractice = entry.profilePractice;
  const markPractice = !profilePractice && termMarkPlan(entry.id);
  const previous = learning.state.widgets[entry.id];
  const saved = !profilePractice || previous?.profilePractice ? previous : null;
  const canCompare = hasReadings || Boolean(comparison);
  const compareLabel = hasReadings ? '对照两个读数' : '在图上选两处';
  const lessonPage = entry.page ? '课本第 ' + entry.page + ' 页起' : '纸书里的位置';
  const follow = next ? '#/lesson/' + next.id : '#/term/' + term.id;
  const canGlobe = typeof onGlobe === 'function';
  const profileReviews = profileCourseTasks(entry);
  const practiceReview = profileReviews[0] || termReviewTask(entry);
  const legacyReview = practiceReview.id === 'review-' + entry.id;
  const choices = activity.choices.map(item => item.label);
  const opening = `<div class="geo-opening"><h3>${escape(entry.question)}</h3>
    ${profilePractice ? `<figure class="term-figure term-opening-profile" data-profile-opening>
      <div class="term-plot"><canvas width="360" height="140" role="img" aria-label="从西向东的剖面左半段，已测的三处地势依次降低。"></canvas></div>
      <figcaption>这里只露出了剖面左半段。被挡住的右半段，也会一直向下吗？</figcaption>
    </figure>` : ''}
    ${renderPrediction(choices, profilePractice ? '先猜一猜，接下来会怎样？' : activity.prompt)}</div>`;
  const observation = `<section class="term-station" data-activity-kind="${activity.kind}" data-inquiry-section="term-observation"${profilePractice ? ' data-profile-practice' : ''}>
      <p class="geo-observation-aim" data-opening-observation></p>
      <div class="term-board-tools">
        <p>${activity.kind === 'chart' ? '点条形，看读数。' : '点图上的字母读图。'}</p>
        ${canCompare ? `<button type="button" class="button" data-term-compare aria-expanded="false" aria-controls="term-compare-panel">${compareLabel}</button>` : ''}
      </div>
      <figure class="term-figure">
        ${activity.kind === 'chart' ? chartMarkup(activity) : plotMarkup(activity)}
        <figcaption>${escape(activity.caption || '教学示意')}${activity.kind === 'profile' ? ' · 横向位置为示意' : ''}</figcaption>
      </figure>
      <div class="term-controls" data-term-prediction>
        <h2>${escape(activity.prompt)}</h2>
        <div class="term-choices" role="group" aria-label="先猜一猜">
          ${activity.choices.map((choice, index) => `<button type="button" class="button" data-term-choice="${index}" aria-pressed="false">${escape(choice.label)}</button>`).join('')}
          <button type="button" class="button" data-term-choice="?" aria-pressed="false">还不确定</button>
        </div>
        <p class="term-feedback" role="status" data-term-feedback></p>
        ${profilePractice || markPractice ? '<div class="term-profile-actions">' : ''}
          <button type="button" class="button primary" data-term-see>看图核对</button>
          ${profilePractice ? '<button type="button" class="button primary" data-profile-find hidden>到剖面上找反例 →</button>' : ''}
          ${markPractice ? '<button type="button" class="button" data-term-proof-start>到图上找证据 →</button>' : ''}
        ${profilePractice || markPractice ? '</div>' : ''}
      </div>
      ${canCompare ? `<div class="term-controls" id="term-compare-panel" data-term-comparison hidden>
        <h2 tabindex="-1">${escape(comparison?.prompt || '点图上的两个标记，看看相差多少。')}</h2>
        <p class="term-feedback" role="status" data-term-compare-result></p>
        ${profilePractice ? '<p class="term-feedback" role="status" data-profile-hint-text></p><button type="button" class="button" data-profile-hint>给一点提示</button><button type="button" class="button primary" data-profile-conclude hidden>用刚才的反例作判断 →</button>' : ''}
        <button type="button" class="button" data-term-compare-reset hidden>清空重选</button>
      </div>` : ''}
      ${renderTermMarkPractice(markPractice)}
    </section>`;
  const review = reviewMarkup(practiceReview);
  const recap = `
    <p class="geo-assessment-label" data-assessment-summary></p>
    ${projectMarkup(entry, learning.state.notes[entry.id])}
    ${canGlobe || onPhotos || related ? `<details class="term-fold" data-remember="term-extras">
      <summary>课后再看</summary>
      ${canGlobe ? '<details class="term-fold" data-term-globe><summary>用地球仪看位置和地形</summary><div data-term-globe-stage></div></details>' : ''}
      ${onPhotos ? '<details class="term-fold" data-term-photos data-remember="term-photos"><summary>看这一带的实景照片</summary><div class="photo-gallery" data-term-gallery></div></details>' : ''}
      ${related ? `<p class="geo-related"><a href="${related.href}">对照《${escape(related.title)}》</a></p>` : ''}
    </details>` : ''}
    <details class="term-anchor" data-remember="term-paper"><summary>课本里看哪里</summary><p>${escape(entry.anchor || entry.title)}</p></details>
    <nav class="course-next term-next" aria-label="按课本顺序继续">
      <a class="button primary next-lesson" href="${follow}"><span><small>${next ? '按课本顺序继续' : '读到本册最后一项'}</small><strong>${escape(next?.title || '回本册目录')}</strong></span><span aria-hidden="true">→</span></a>
    </nav>`;
  root.innerHTML = `<article class="term-lesson geo-lesson" data-extended-lesson="${escape(entry.id)}">
    <header class="term-intro">
      <p class="term-bookname">${escape(term.title)} · ${entry.project ? '主题探究 · ' : ''}${lessonPage}</p>
      <h1>${escape(entry.title)}</h1>
    </header>
    ${lessonFlow([
      { id: 'opening', label: '带着问题', content: opening, next: '看图找线索' },
      { id: 'term-observation', label: '看图找线索', content: observation, next: profilePractice ? '用剖面作判断' : '记住读图方法' },
      ...(profilePractice ? [{ id: 'profile', label: '用剖面作判断', content: profilePracticeMarkup(profilePractice), next: '记住读图方法' }] : []),
      { id: 'method', label: '记住读图方法', content: methodSummary(alignedMethod(entry.id, entry.takeaway)), next: '换份材料复习' },
      { id: 'term-review', label: profilePractice ? '换个剖面找反例' : '换份材料复习', content: review,
        next: profilePractice ? '再判一次整体与局部' : '回顾这节课' },
      ...profileReviews.slice(1).map(task => ({ id: 'term-apply', label: '独立判读新图', content: reviewMarkup(task), next: '回顾这节课' })),
      { id: 'recap', label: '回顾这节课', content: recap },
    ])}
  </article>`;

  const flow = bindLessonFlow(root, initialStep === 'profile-transfer' ? 'term-review' : initialStep, onStep);
  const openingProfile = root.querySelector('[data-profile-opening]');
  const openingDiagram = openingProfile ? mountTermDiagram(openingProfile,
    { ...activity, values: activity.values.slice(0, 3), flows: [] }, () => {}) : null;
  const host = root.querySelector('.term-station');
  const figure = host.querySelector('figure');
  const panel = host.querySelector('[data-term-feedback]');
  const show = host.querySelector('[data-term-see]');
  const observationNext = host.closest('.geo-step').querySelector('[data-geo-next]');
  const forwardLabel = host.closest('.geo-step').querySelector('[data-geo-next-label]');
  const buttons = [...host.querySelectorAll('[data-term-choice]')];
  const practice = { ...saved?.profilePractice };
  const compareToggle = host.querySelector('[data-term-compare]');
  const comparePanel = host.querySelector('[data-term-comparison]');
  const compareResult = host.querySelector('[data-term-compare-result]');
  const compareReset = host.querySelector('[data-term-compare-reset]');
  const find = host.querySelector('[data-profile-find]');
  const conclude = host.querySelector('[data-profile-conclude]');
  const hint = host.querySelector('[data-profile-hint]');
  const hintText = host.querySelector('[data-profile-hint-text]');
  const prediction = host.querySelector('[data-term-prediction]');
  let proofWidget = saved?.proof;
  let reviewPick = saved?.reviewPick;
  let proof;
  let comparing = canCompare && saved?.comparing === true;
  let picks = Array.isArray(saved?.picks) ? [...new Set(saved.picks)]
    .filter(index => Number.isInteger(index) && records[index]).slice(0, 2) : [];
  let choice = saved?.choice === '?' || Number.isInteger(saved?.choice) && activity.choices[saved.choice] ? saved.choice : null;
  let revealed = saved?.revealed === true;
  const startingPoint = host.querySelector('[data-opening-observation]');
  const paintOpening = bindPrediction(root, choice, index => {
    choice = index;
    revealed = false;
    setComparing(false);
  });
  const chartButtons = [...figure.querySelectorAll('[data-bar], [data-key]')];
  let diagram;
  function highlight(indices, showFlows = revealed) {
    diagram?.select(indices, showFlows);
    chartButtons.forEach((button, index) => {
      const selected = indices.includes(index);
      button.classList.toggle('mark-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }
  function paintComparison() {
    if (profilePractice) observationNext.hidden = !practice.mainEvidence;
    proof?.sync(!comparing);
    if (compareToggle) {
      compareToggle.setAttribute('aria-expanded', String(comparing));
      compareToggle.textContent = comparing
        ? (profilePractice ? '回到判断' : proofWidget?.open ? '回到取证小题' : '回到猜想') : compareLabel;
      comparePanel.hidden = !comparing;
    }
    prediction.hidden = comparing || Boolean(proof?.active);
    if (!comparing) {
      if (!proof?.active) paint();
      return;
    }
    if (profilePractice) {
      conclude.hidden = !practice.mainEvidence;
      hint.hidden = Boolean(practice.mainHint || practice.mainEvidence);
      hintText.textContent = practice.mainHint && !practice.mainEvidence ? profilePractice.hint : '';
    }
    highlight(picks, false);
    compareResult.dataset.result = '';
    compareReset.hidden = picks.length === 0;
    if (picks.length === 0) {
      compareResult.textContent = '先选一处。';
      return;
    }
    const [first, second] = picks.map(index => records[index]);
    if (!second) {
      compareResult.textContent = '已选「' + first.label + '」，再选一处。';
      return;
    }
    if (profilePractice) {
      const {line, change} = compareProfilePoints(activity, picks);
      if (!practice.viewingEnds) compareResult.dataset.result = change > 0 ? 'correct' : 'retry';
      compareResult.textContent = line + (practice.viewingEnds ? '剖面两端一西一东，西边明显更高。' :
        change > 0 ? comparison.feedback + (practice.mainEvidence === 'independent' ? '已独立找到证据。' : '已根据提示或重试找到证据。') :
          comparison.again);
      return;
    }
    let evidence = '';
    if (comparison) {
      const matches = comparison.pairs.some(pair => pair.every(index => picks.includes(index)));
      compareResult.dataset.result = matches ? 'correct' : 'retry';
      evidence = matches ? comparison.feedback : comparison.again;
    }
    if (hasReadings) {
      const difference = Number(Math.abs(first.value - second.value).toFixed(2));
      const unit = activity.unit ? ' ' + activity.unit : '';
      compareResult.textContent = first.label + ' ' + first.value + unit + ' · ' + second.label + ' ' + second.value + unit +
        '。相差 ' + difference + unit + '。' + evidence;
      return;
    }
    compareResult.textContent = evidence;
  }
  function inspect(index, control) {
    if (proof?.active) {
      proof.select(index);
      return;
    }
    if (comparing) {
      if (profilePractice) practice.viewingEnds = false;
      picks = picks.includes(index) ? picks.filter(pick => pick !== index) : [...picks.slice(-1), index];
      if (picks.length === 2) {
        if (profilePractice && comparison.pairs.some(pair => pair.every(index => picks.includes(index)))) {
          practice.mainEvidence ||= practice.mainHint ? 'guided' : 'independent';
          learning.markCompleted(entry.id);
        } else if (profilePractice) practice.mainHint = true;
      }
      save();
      paintComparison();
      alignTermBoard(host, control, compareResult);
      return;
    }
    const point = records[index];
    highlight([index]);
    panel.textContent = point.value === undefined ? '你找到的是「' + point.label + '」。再看看它与其他标记的位置关系。' :
      '你读到「' + point.label + '」为 ' + point.value + (activity.unit ? ' ' + activity.unit : '') + '。';
    alignTermBoard(host, control, panel);
  }
  function paint() {
    paintOpening(choice);
    startingPoint.textContent = !revealed && choices[choice] ? '带着「' + choices[choice] + '」这个想法去看图。' : '';
    show.classList.toggle('primary', !revealed);
    forwardLabel.textContent = profilePractice
      ? (revealed ? '用剖面作判断' : '先用剖面试试')
      : (revealed ? '记住读图方法' : '先看读图方法');
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(String(choice) === button.dataset.termChoice));
    }
    if (!revealed) {
      if (find) find.hidden = true;
      show.textContent = '看图核对';
      highlight([]);
      panel.textContent = choice === null ? '' : '记下了。现在可以用图核对。';
      return;
    }
    const selected = activity.choices[choice];
    highlight(selected?.focus || []);
    panel.textContent = selected?.feedback || '先在图上点一个标记。读出位置或数值，再试一种解释。';
    if (find) find.hidden = false;
    show.textContent = '重新猜一次';
  }
  function save() {
    const widget = {choice, revealed, comparing, picks};
    if (profilePractice) widget.profilePractice = practice;
    if (proofWidget !== undefined) widget.proof = proofWidget;
    if (reviewPick !== undefined) widget.reviewPick = reviewPick;
    learning.setRecord('widgets', entry.id, widget);
  }
  function setComparing(value) {
    comparing = value;
    save();
    paintComparison();
  }
  compareToggle?.addEventListener('click', () => {
    setComparing(!comparing);
    alignTermBoard(host, compareToggle, comparing ? compareResult : show);
  });
  find?.addEventListener('click', () => {
    if (practice.viewingEnds) {
      practice.viewingEnds = false;
      picks = [];
    }
    setComparing(true);
    comparePanel.querySelector('h2').focus({preventScroll:true});
    alignTermBoard(host, compareToggle, compareResult);
  });
  conclude?.addEventListener('click', () => flow.show('profile'));
  hint?.addEventListener('click', () => {
    practice.mainHint = true;
    save();
    paintComparison();
    comparePanel.querySelector('h2').focus({preventScroll:true});
  });
  compareReset?.addEventListener('click', () => {
    if (profilePractice) practice.viewingEnds = false;
    picks = [];
    save();
    paintComparison();
    chartButtons[0]?.focus({preventScroll:true});
  });
  for (const button of buttons) {
    button.addEventListener('click', () => {
      choice = button.dataset.termChoice === '?' ? '?' : Number(button.dataset.termChoice);
      save();
      paint();
      if (revealed) alignTermBoard(host, button, panel);
    });
  }
  show.addEventListener('click', () => {
    if (choice === null && !revealed) {
      panel.textContent = '先选一个想法。没想好也可以点「还不确定」。';
      alignTermBoard(host, show, panel);
      return;
    }
    if (revealed) {
      choice = null;
      revealed = false;
      show.textContent = '看图核对';
    } else {
      revealed = true;
    }
    save();
    paint();
    if (revealed) alignTermBoard(host, show, panel);
  });
  chartButtons.forEach((button, index) => button.addEventListener('click', () => inspect(index, button)));
  if (activity.kind !== 'chart') diagram = mountTermDiagram(figure, activity, inspect);
  proof = bindTermMarkPractice(host, markPractice, proofWidget, records, {
    save(value) { proofWidget = value; save(); },
    status(success) { observationNext.hidden = !success; },
    highlight(indices) { highlight(indices, false); },
    onOpen: paintComparison,
    isGuided() { return revealed; },
    complete() { learning.markCompleted(entry.id); },
    transfer() {
      flow.show('method');
    },
  });
  paintComparison();
  bindProfilePractice(root, profilePractice, practice, save, () => {
    practice.viewingEnds = true;
    picks = [0, records.length - 1];
    setComparing(true);
    flow.show('term-observation');
    const title = comparePanel.querySelector('h2');
    title.focus();
    alignTermBoard(host, title, compareResult);
  });
  const disposeReview = bindReview(root, practiceReview, practiceReview.id, learning, legacyReview ? reviewPick : undefined, legacyReview ? value => {
    reviewPick = value;
    save();
  } : undefined);
  const disposeApplication = profileReviews[1] ? bindReview(root, profileReviews[1], profileReviews[1].id, learning) : null;
  const unmountTransfer = mountTransferMaps(root);
  flow.verifyRestored();
  projectBinding(root, entry, learning);

  const globe = root.querySelector('[data-term-globe]');
  let globeRunner;
  let started = false;
  if (globe) globe.addEventListener('toggle', async () => {
    if (!globe.open || started) return;
    started = true;
    const target = globe.querySelector('[data-term-globe-stage]');
    target.textContent = '正在准备平面图……';
    try { globeRunner = await onGlobe(target); }
    catch {
      if (!target.isConnected) return;
      target.innerHTML = '<p role="status">地球仪没有载入。可以继续使用上方的图。</p>';
      started = false;
    }
  });
  const photoPanel = root.querySelector('[data-term-photos]');
  let photoRunner;
  if (photoPanel) photoPanel.addEventListener('toggle', () => {
    if (photoPanel.open && !photoRunner) photoRunner = onPhotos(photoPanel.querySelector('[data-term-gallery]'));
  });
  return () => { diagram?.dispose(); openingDiagram?.dispose(); disposeReview(); disposeApplication?.();
    unmountTransfer(); globeRunner?.(); photoRunner?.(); };
}
