import { escapeHtml as escape } from './inquiry-view.js?v=6';
import { mountTermDiagram } from './term-diagram.js?v=1';

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
    const drawingBox = host.querySelector('.term-figure')?.getBoundingClientRect();
    const begin = Math.min(drawingBox?.top ?? controlBox.top, controlBox.top);
    const end = Math.max(drawingBox?.bottom ?? resultBox.bottom, resultBox.bottom, controlBox.bottom);
    const lowerBound = end - height + 8;
    const upperBound = begin - 8;
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
    <label for="term-project-note">我会去看什么？哪条证据能支持我的想法？</label>
    <textarea id="term-project-note" maxlength="2000" rows="3" placeholder="写一条计划或观察……">${escape(saved || '')}</textarea>
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

export function renderTermLesson(root, { entry, term, next, related, learning, reviewOnly, onGlobe, onPhotos }) {
  const activity = entry.activity;
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
    <section class="term-station" data-activity-kind="${activity.kind}" data-inquiry-section="term-observation">
      <figure class="term-figure">
        ${activity.kind === 'chart' ? chartMarkup(activity) : plotMarkup(activity)}
        <figcaption>${escape(activity.caption || '教学示意')}${activity.kind === 'profile' ? ' · 横向位置为示意' : ''}</figcaption>
      </figure>
      <div class="term-controls">
        <h2>${escape(activity.prompt)}</h2>
        <div class="term-choices" role="group" aria-label="先猜一猜">
          ${activity.choices.map((choice, index) => `<button type="button" class="button" data-term-choice="${index}" aria-pressed="false">${escape(choice.label)}</button>`).join('')}
          <button type="button" class="button" data-term-choice="?" aria-pressed="false">还不确定</button>
        </div>
        <p class="term-feedback" role="status" data-term-feedback></p>
        <button type="button" class="button primary" data-term-see>看图核对</button>
      </div>
    </section>
    ${canGlobe ? '<details class="term-fold" data-term-globe><summary>用地球仪看位置和地形</summary><div data-term-globe-stage></div></details>' : ''}
    ${onPhotos ? '<details class="term-fold" data-term-photos data-remember="term-photos"><summary>看这一带的实景照片</summary><div class="photo-gallery" data-term-gallery></div></details>' : ''}
    ${projectMarkup(entry, learning.state.notes[entry.id])}
    <details class="term-fold term-takeaway"><summary>用一句话连回课本</summary><p>${escape(entry.takeaway)}</p></details>
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
  const records = dataFor(activity);
  const figure = host.querySelector('figure');
  const panel = host.querySelector('[data-term-feedback]');
  const show = host.querySelector('[data-term-see]');
  const buttons = [...host.querySelectorAll('[data-term-choice]')];
  const saved = learning.state.widgets[entry.id];
  let choice = saved?.choice === '?' || Number.isInteger(saved?.choice) && activity.choices[saved.choice] ? saved.choice : null;
  let revealed = saved?.revealed === true;
  const chartButtons = [...figure.querySelectorAll('[data-bar], [data-key]')];
  let diagram;
  function highlight(indices) {
    diagram?.select(indices, revealed);
    chartButtons.forEach((button, index) => button.classList.toggle('mark-selected', indices.includes(index)));
  }
  function inspect(index, control) {
    const point = records[index];
    highlight([index]);
    panel.textContent = point.value === undefined ? '你找到的是「' + point.label + '」。再看看它与其他标记的位置关系。' :
      '你读到「' + point.label + '」为 ' + point.value + (activity.unit ? ' ' + activity.unit : '') + '。';
    alignTermBoard(host, control, panel);
  }
  function paint() {
    show.classList.toggle('primary', !revealed);
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(String(choice) === button.dataset.termChoice));
    }
    if (!revealed) {
      highlight([]);
      panel.textContent = choice === null ? '' : '记下了。现在可以用图核对。';
      return;
    }
    const selected = activity.choices[choice];
    highlight(selected?.focus || []);
    panel.textContent = selected?.feedback || '先在图上点一个标记。读出位置或数值，再试一种解释。';
    show.textContent = '重新猜一次';
  }
  function save() {
    learning.setRecord('widgets', entry.id, {choice, revealed});
  }
  for (const button of buttons) {
    button.addEventListener('click', () => {
      choice = button.dataset.termChoice === '?' ? '?' : Number(button.dataset.termChoice);
      if (revealed) learning.markCompleted(entry.id);
      save();
      paint();
      if (revealed) alignTermBoard(host, button, panel);
    });
  }
  show.addEventListener('click', () => {
    if (revealed) {
      choice = null;
      revealed = false;
      show.textContent = '看图核对';
    } else {
      revealed = true;
      learning.markCompleted(entry.id);
    }
    save();
    paint();
    if (revealed) alignTermBoard(host, show, panel);
  });
  chartButtons.forEach((button, index) => button.addEventListener('click', () => inspect(index, button)));
  if (activity.kind !== 'chart') diagram = mountTermDiagram(figure, activity, inspect);
  paint();
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
  return () => { diagram?.dispose(); globeRunner?.(); photoRunner?.(); };
}
