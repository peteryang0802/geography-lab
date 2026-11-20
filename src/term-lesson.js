import { escapeHtml as escape } from './inquiry-view.js?v=6';
import { mountTermDiagram } from './term-diagram.js?v=3';

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
    const end = Math.max(drawingBox?.bottom ?? resultBox.bottom, resultBox.bottom, controlBox.bottom);
    const inset = Math.min(8, Math.max(0, Math.floor((height - (end - begin)) / 2)));
    const lowerBound = end - height + inset;
    const upperBound = begin - inset;
    const shift = lowerBound <= upperBound
      ? Math.max(lowerBound, Math.min(upperBound, 0))
      : Math.max(0, Math.min(resultBox.bottom - height + 8, controlBox.top - 8));
    if (Math.abs(shift) > 1) scrollBy({top: shift, behavior: 'instant'});
  });
}

function bindReview(root, entry, learning) {
  const info = root.querySelector('[data-term-review]');
  if (!info) return;
  const options = [...info.querySelectorAll('[data-term-answer]')];
  const feedback = info.querySelector('[role=status]');
  const renew = info.querySelector('[data-term-retry]');
  const taskId = 'review-' + entry.id;
  let answered = false;
  let resetOnOpen = false;
  function reset() {
    for (const option of options) option.setAttribute('aria-pressed', 'false');
    feedback.textContent = '';
    renew.hidden = true;
    answered = false;
  }
  for (const button of options) {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.termAnswer);
      const correct = index === entry.review.answer;
      learning.setRecord('answers', taskId, {option: index, solved: correct});
      feedback.textContent = (correct ? '这条依据能说得通。' : '再用材料核对。') + entry.review.options[index][1];
      for (const candidate of options) candidate.setAttribute('aria-pressed', String(candidate === button));
      renew.hidden = false;
      answered = true;
      alignTermBoard(info, button, feedback);
    });
  }
  info.addEventListener('toggle', () => {
    if (!info.open && answered) resetOnOpen = true;
    if (info.open && resetOnOpen) {
      resetOnOpen = false;
      reset();
    }
  });
  renew.addEventListener('click', () => {
    reset();
    options[0]?.focus({preventScroll:true});
  });
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
  if (!practice) return '';
  return `<section class="term-fold term-profile-scope" data-profile-scope aria-labelledby="profile-scope-title" hidden>
    <h2 id="profile-scope-title" tabindex="-1">${escape(practice.scope.prompt)}</h2>
    <div class="term-choices" role="group" aria-labelledby="profile-scope-title">
      ${practice.scope.options.map(([label], index) => `<button type="button" class="button" data-scope-choice="${index}" aria-pressed="false">${escape(label)}</button>`).join('')}
    </div>
    <p class="term-feedback" data-scope-feedback role="status"></p>
    <button type="button" class="button" data-profile-source hidden>看看剖面两端 →</button>
    <button type="button" class="button primary" data-profile-next hidden>换个剖面找反例 →</button>
  </section>
  <details class="term-fold term-profile-transfer" data-profile-transfer data-inquiry-section="profile-transfer" data-remember="profile-transfer">
    <summary>换个剖面找反例</summary>
    <h2 tabindex="-1">${escape(practice.transfer.prompt)}</h2>
    <figure class="term-figure">
      ${plotMarkup(practice.transfer)}
      <figcaption>${escape(practice.transfer.caption)}</figcaption>
    </figure>
    <div class="term-profile-actions">
      <button type="button" class="button" data-transfer-hint>给一点提示</button>
      <button type="button" class="button" data-transfer-reset hidden>清空重选</button>
    </div>
    <p class="term-feedback" data-transfer-feedback role="status"></p>
  </details>`;
}

function bindProfilePractice(root, config, practice, save, recheck) {
  if (!config) return () => {};
  const scope = root.querySelector('[data-profile-scope]');
  const options = [...scope.querySelectorAll('[data-scope-choice]')];
  const feedback = scope.querySelector('[data-scope-feedback]');
  const source = scope.querySelector('[data-profile-source]');
  const next = scope.querySelector('[data-profile-next]');
  const transfer = root.querySelector('[data-profile-transfer]');
  const figure = transfer.querySelector('figure');
  const keys = [...figure.querySelectorAll('[data-key]')];
  const result = transfer.querySelector('[data-transfer-feedback]');
  const hint = transfer.querySelector('[data-transfer-hint]');
  const reset = transfer.querySelector('[data-transfer-reset]');
  let picks = Array.isArray(practice.transferPicks) ? [...new Set(practice.transferPicks)]
    .filter(index => Number.isInteger(index) && config.transfer.values[index]).slice(0, 2) : [];
  let diagram;

  function paintScope() {
    const selected = Number.isInteger(practice.scopeChoice) ? options[practice.scopeChoice] : null;
    const correct = selected && practice.scopeChoice === config.scope.answer;
    options.forEach(button => button.setAttribute('aria-pressed', String(button === selected)));
    feedback.textContent = selected ? config.scope.options[practice.scopeChoice][1] : '';
    source.hidden = !selected || correct;
    next.hidden = !correct;
  }
  for (const option of options) {
    option.addEventListener('click', () => {
      practice.scopeChoice = Number(option.dataset.scopeChoice);
      save();
      paintScope();
    });
  }
  source.addEventListener('click', recheck);
  next.addEventListener('click', () => {
    transfer.open = true;
    transfer.querySelector('h2').focus();
  });

  function paintTransfer() {
    diagram?.select(picks, false);
    keys.forEach((key, index) => {
      key.classList.toggle('mark-selected', picks.includes(index));
      key.setAttribute('aria-pressed', String(picks.includes(index)));
    });
    reset.hidden = picks.length === 0;
    hint.hidden = Boolean(practice.transferResult);
    if (picks.length < 2) {
      result.textContent = practice.transferHint ? '提示：找一段往右走、线却往上走的坡。' :
        picks.length ? '已选 ' + marker(picks[0]) + '，再选一处。' : '';
      return;
    }
    const {line, change} = compareProfilePoints(config.transfer, picks);
    result.textContent = line + (change > 0
      ? '这两个点找到了反例。' + (practice.transferResult === 'independent' ? '这一次独立找到了。' : '这一次通过提示或重试找到了。')
      : '这组点还找不到反例。看看哪一段往右走，海拔却升高。');
  }
  function pick(index) {
    picks = picks.includes(index) ? picks.filter(item => item !== index) : [...picks.slice(-1), index];
    if (picks.length === 2) {
      const {change} = compareProfilePoints(config.transfer, picks);
      if (change > 0) practice.transferResult ||= practice.transferHint ? 'guided' : 'independent';
      else practice.transferHint = true;
    }
    practice.transferPicks = picks;
    save();
    paintTransfer();
  }
  hint.addEventListener('click', () => {
    practice.transferHint = true;
    if (picks.length === 2 && !practice.transferResult) {
      picks = [];
      practice.transferPicks = picks;
    }
    save();
    paintTransfer();
  });
  reset.addEventListener('click', () => {
    picks = [];
    practice.transferPicks = picks;
    save();
    paintTransfer();
    keys[0]?.focus();
  });
  keys.forEach((key, index) => key.addEventListener('click', () => pick(index)));
  diagram = mountTermDiagram(figure, config.transfer, pick);
  paintScope();
  paintTransfer();
  return () => diagram?.dispose();
}

export function renderTermLesson(root, { entry, term, next, related, learning, reviewOnly, onGlobe, onPhotos }) {
  const activity = entry.activity;
  const records = dataFor(activity);
  const hasReadings = records.length >= 2 && records.every(point => Number.isFinite(point.value));
  const comparison = entry.comparison;
  const profilePractice = entry.profilePractice;
  const canCompare = hasReadings || Boolean(comparison);
  const compareLabel = hasReadings ? '对照两个读数' : '在图上选两处';
  const lessonPage = entry.page ? '课本第 ' + entry.page + ' 页起' : '纸书里的位置';
  const follow = next ? '#/lesson/' + next.id : '#/term/' + term.id;
  const canGlobe = typeof onGlobe === 'function';
  root.innerHTML = `<article class="term-lesson" data-extended-lesson="${escape(entry.id)}">
    <a class="volume-back" href="#/term/${term.id}">← ${term.title}目录</a>
    <header class="term-intro">
      <p class="term-bookname">${escape(entry.title)}${entry.project ? ' · 主题探究' : ''}</p>
      <h1>${escape(entry.question)}</h1>
      <details class="term-anchor" data-remember="term-paper"><summary>${lessonPage}</summary><p>${escape(entry.anchor || entry.title)}</p></details>
    </header>
    <section class="term-station" data-activity-kind="${activity.kind}" data-inquiry-section="term-observation"${profilePractice ? ' data-profile-practice' : ''}>
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
        ${profilePractice ? '<div class="term-profile-actions">' : ''}
          <button type="button" class="button primary" data-term-see>看图核对</button>
          ${profilePractice ? '<button type="button" class="button primary" data-profile-find hidden>到剖面上找反例 →</button>' : ''}
        ${profilePractice ? '</div>' : ''}
      </div>
      ${canCompare ? `<div class="term-controls" id="term-compare-panel" data-term-comparison hidden>
        <h2 tabindex="-1">${escape(comparison?.prompt || '点图上的两个标记，看看相差多少。')}</h2>
        <p class="term-feedback" role="status" data-term-compare-result></p>
        ${profilePractice ? '<p class="term-feedback" role="status" data-profile-hint-text></p><button type="button" class="button" data-profile-hint>给一点提示</button><button type="button" class="button primary" data-profile-conclude hidden>用刚才的反例作判断 →</button>' : ''}
        <button type="button" class="button" data-term-compare-reset hidden>清空重选</button>
      </div>` : ''}
    </section>
    ${profilePracticeMarkup(profilePractice)}
    ${canGlobe ? '<details class="term-fold" data-term-globe><summary>用地球仪看位置和地形</summary><div data-term-globe-stage></div></details>' : ''}
    ${onPhotos ? '<details class="term-fold" data-term-photos data-remember="term-photos"><summary>看这一带的实景照片</summary><div class="photo-gallery" data-term-gallery></div></details>' : ''}
    ${projectMarkup(entry, learning.state.notes[entry.id])}
    <p class="term-takeaway"><strong>用一句话记住</strong> ${escape(entry.takeaway)}</p>
    <details class="term-fold term-review" data-term-review data-inquiry-section="term-review" ${reviewOnly ? 'open' : ''}>
      <summary>换份材料复习</summary>
      <h2>${escape(entry.review.prompt)}</h2>
      <div class="term-choices" role="group" aria-label="选择材料支持的解释">
        ${entry.review.options.map(([label], i) => `<button type="button" class="button" data-term-answer="${i}" aria-pressed="false">${escape(label)}</button>`).join('')}
      </div>
      <p class="term-feedback" role="status"></p>
      <button type="button" class="button" data-term-retry hidden>清空再试</button>
    </details>
    ${related ? `<details class="term-fold term-relation"><summary>还有一课可以对照</summary><p><a href="${related.href}">${escape(related.title)}</a></p></details>` : ''}
    <nav class="course-next term-next" aria-label="按课本顺序继续">
      <a class="button primary next-lesson" href="${follow}"><span><small>${next ? '按课本顺序继续' : '读到本册最后一项'}</small><strong>${escape(next?.title || '回本册目录')}</strong></span><span aria-hidden="true">→</span></a>
    </nav>
  </article>`;

  const host = root.querySelector('.term-station');
  const figure = host.querySelector('figure');
  const panel = host.querySelector('[data-term-feedback]');
  const show = host.querySelector('[data-term-see]');
  const buttons = [...host.querySelectorAll('[data-term-choice]')];
  const previous = learning.state.widgets[entry.id];
  const saved = !profilePractice || previous?.profilePractice ? previous : null;
  const practice = { ...saved?.profilePractice };
  const compareToggle = host.querySelector('[data-term-compare]');
  const comparePanel = host.querySelector('[data-term-comparison]');
  const compareResult = host.querySelector('[data-term-compare-result]');
  const compareReset = host.querySelector('[data-term-compare-reset]');
  const find = host.querySelector('[data-profile-find]');
  const conclude = host.querySelector('[data-profile-conclude]');
  const hint = host.querySelector('[data-profile-hint]');
  const hintText = host.querySelector('[data-profile-hint-text]');
  const scope = root.querySelector('[data-profile-scope]');
  let comparing = canCompare && saved?.comparing === true;
  let picks = Array.isArray(saved?.picks) ? [...new Set(saved.picks)]
    .filter(index => Number.isInteger(index) && records[index]).slice(0, 2) : [];
  let choice = saved?.choice === '?' || Number.isInteger(saved?.choice) && activity.choices[saved.choice] ? saved.choice : null;
  let revealed = saved?.revealed === true;
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
    if (!compareToggle) return;
    compareToggle.setAttribute('aria-expanded', String(comparing));
    compareToggle.textContent = comparing ? (profilePractice ? '回到判断' : '回到猜想') : compareLabel;
    comparePanel.hidden = !comparing;
    host.querySelector('[data-term-prediction]').hidden = comparing;
    if (scope) scope.hidden = !practice.mainEvidence;
    if (!comparing) return;
    if (profilePractice) {
      conclude.hidden = !practice.mainEvidence;
      hint.hidden = Boolean(practice.mainHint || practice.mainEvidence);
      hintText.textContent = practice.mainHint && !practice.mainEvidence ? profilePractice.hint : '';
    }
    highlight(picks, false);
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
      compareResult.textContent = line + (practice.viewingEnds ? '剖面两端一西一东，西边明显更高。' :
        change > 0 ? comparison.feedback + (practice.mainEvidence === 'independent' ? '已独立找到证据。' : '已根据提示或重试找到证据。') :
          comparison.again);
      return;
    }
    const evidence = comparison
      ? (comparison.pairs.some(pair => pair.every(index => picks.includes(index))) ? comparison.feedback : comparison.again)
      : '';
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
    if (comparing) {
      if (profilePractice) practice.viewingEnds = false;
      picks = picks.includes(index) ? picks.filter(pick => pick !== index) : [...picks.slice(-1), index];
      if (picks.length === 2) {
        if (!profilePractice) learning.markCompleted(entry.id);
        else if (comparison.pairs.some(pair => pair.every(index => picks.includes(index)))) {
          practice.mainEvidence ||= practice.mainHint ? 'guided' : 'independent';
          learning.markCompleted(entry.id);
        } else practice.mainHint = true;
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
    if (revealed && !profilePractice) learning.markCompleted(entry.id);
    alignTermBoard(host, control, panel);
  }
  function paint() {
    show.classList.toggle('primary', !revealed);
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
    learning.setRecord('widgets', entry.id, widget);
  }
  function setComparing(value) {
    comparing = value;
    save();
    if (!comparing) paint();
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
  conclude?.addEventListener('click', () => scope.querySelector('h2').focus());
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
      if (revealed && choice !== '?' && !profilePractice) learning.markCompleted(entry.id);
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
      if (choice !== '?' && !profilePractice) learning.markCompleted(entry.id);
    }
    save();
    paint();
    if (revealed) alignTermBoard(host, show, panel);
  });
  chartButtons.forEach((button, index) => button.addEventListener('click', () => inspect(index, button)));
  if (activity.kind !== 'chart') diagram = mountTermDiagram(figure, activity, inspect);
  paint();
  paintComparison();
  const disposeProfilePractice = bindProfilePractice(root, profilePractice, practice, save, () => {
    practice.viewingEnds = true;
    picks = [0, records.length - 1];
    setComparing(true);
    const title = comparePanel.querySelector('h2');
    title.focus();
    alignTermBoard(host, title, compareResult);
  });
  bindReview(root, entry, learning);
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
  return () => { diagram?.dispose(); disposeProfilePractice(); globeRunner?.(); photoRunner?.(); };
}
