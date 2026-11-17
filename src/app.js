import { chapters, lessons, projects, legendItems, concepts, getRelations, labs, bookPageUrl } from './catalog.js';
import { mountLabUI } from './lab-ui.js';
import { mountWidget } from './widgets.js';
import { FLOW_SOURCES } from './flow-model.js';
import { topicViews } from './topic-views.js';
import { mountPhotoGallery } from './photo-gallery.js';

const main = document.querySelector('#content');
const notice = document.querySelector('#announcement');
const storageKey = 'geography-lab:learning:v1';
const work = [...lessons, ...projects];
const byLesson = new Map(work.map(lesson => [lesson.id, lesson]));
const byConcept = new Map(concepts.map(concept => [concept.id, concept]));
const byLab = new Map(labs.map(lab => [lab.id, lab]));
const scrollPositions = new Map();
const galleryPositions = new Map();
const exploreState = { query: '', showAll: false };
const allowedStates = ['answers', 'visits', 'labs', 'widgets', 'notes'];
let activeHash = '';
let cleanup;
let state = loadState();

function loadState() {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(storageKey)));
  } catch {
    return normalizeState(null);
  }
}

function normalizeState(value) {
  const result = {};
  for (const key of allowedStates) {
    result[key] = Object.create(null);
    if (!value?.[key] || typeof value[key] !== 'object') continue;
    for (const [id, entry] of Object.entries(value[key])) {
      if (/^[a-z\d-]+$/i.test(id)) result[key][id] = entry;
    }
  }
  result.saved = Array.isArray(value?.saved) ? [...new Set(value.saved.filter(id => byConcept.has(id)))] : [];
  result.lastLesson = typeof value?.lastLesson === 'string' && byLesson.has(value.lastLesson) ? value.lastLesson : null;
  return result;
}

function saveState() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    notice.textContent = '当前浏览器无法长期保存进度，请在复习页导出。';
  }
}

const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const lessonUrl = id => '#/lesson/' + encodeURIComponent(id);
const conceptUrl = (id, origin) => '#/concept/' + encodeURIComponent(id) + (origin ? '?from=' + encodeURIComponent(origin) : '');
const labUrl = (id, query = {}) => '#/lab/' + encodeURIComponent(id) + (Object.keys(query).length ? '?' + new URLSearchParams(query) : '');
if ("scrollRestoration" in history) history.scrollRestoration = "manual";

const arrow = '<span aria-hidden="true">→</span>';
const doneCount = lesson => lesson.tasks.filter(task => state.answers[task.id]?.solved === true).length;
const isDone = lesson => lesson.tasks.length > 0 && doneCount(lesson) === lesson.tasks.length;
const sectionHeading = (title, text = '', extra = '') => '<div class="section-title"><div><h2>' + title + '</h2>' + (text ? '<p>' + text + '</p>' : '') + '</div>' + extra + '</div>';

function breadcrumb(title, from = '#/', fromLabel = '课本') {
  return `<div class="breadcrumbs"><a href="${escape(from)}">${escape(fromLabel)}</a><span aria-hidden="true">/</span><span>${escape(title)}</span></div>`;
}

function pageIntro(title, description, eyebrow = '', extraClass = '') {
  return `<div class="page-intro ${extraClass}">${eyebrow ? `<p class="eyebrow">${escape(eyebrow)}</p>` : ''}<h1>${escape(title)}</h1>${description ? `<p>${escape(description)}</p>` : ''}</div>`;
}

function home() {
  const completed = work.filter(isDone).length;
  const recent = byLesson.get(state.lastLesson);
  return `
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-copy">
        <p class="eyebrow">中图北京版 · 七年级上册</p>
        <h1 id="hero-title">七上地理实验台</h1>
        <p>转动地球仪、比较地形，沿着感兴趣的知识点继续探索。</p>
        <div class="hero-actions">
          <a class="button primary" href="${lessonUrl(recent?.id || 'intro')}">${recent ? '继续上次学习' : '从第一课开始'} ${arrow}</a>
          <a class="button ghost" href="#/lab/terrain">比较跨洲山脉</a>
        </div>
      </div>
      <a class="hero-credit" href="#/sources">塔拉河峡谷 · 摄影来源</a>
    </section>
    <section class="section" aria-label="动手实验">
      ${sectionHeading('动手实验', '转动、换图层、比一比，再用证据回答。')}
      <div class="grid lab-grid">${labs.map(lab => `
        <a href="${labUrl(lab.id)}" class="card lab-card">
          <span class="lab-icon" aria-hidden="true">${escape(lab.icon)}</span>
          <div><h3>${escape(lab.title)}</h3><p>${escape(lab.description)}</p><span class="card-action">开始实验 ${arrow}</span></div>
        </a>`).join('')}</div>
    </section>
    <section class="section" aria-label="七上课本目录">
      ${sectionHeading('七上课本目录', '', `<div class="progress-top"><progress max="${work.length}" value="${completed}" aria-label="七上学习进度"></progress><span>${completed} / ${work.length} 已完成</span></div>`)}
      <div class="grid chapter-grid">${chapters.map(chapter => `
        <article class="chapter">
          <header class="chapter-head"><p class="eyebrow">${escape(chapter.prefix)}</p><h3>${escape(chapter.title)}</h3></header>
          ${lessons.filter(lesson => lesson.chapter === chapter.id).map(lesson => chapterLink(lesson)).join('')}
          ${projects.filter(project => project.chapter === chapter.id).map(project => chapterLink(project, true)).join('')}
          ${chapter.id === 0 ? '<a class="chapter-row" href="#/legend"><span>常用地图图例</span><span>附录</span></a>' : ''}
        </article>`).join('')}</div>
    </section>`;
}

function chapterLink(lesson, project = false) {
  const status = isDone(lesson) ? '已完成' : project ? '探究' : '第 ' + lesson.page + ' 页';
  return `<a class="chapter-row" ${project ? 'data-project' : ''} href="${lessonUrl(lesson.id)}"><span>${escape(lesson.title)}</span><span>${status}</span></a>`;
}

function relationshipLinks(ids, origin, explanations) {
  return ids.filter(id => byConcept.has(id)).map(id => {
    const concept = byConcept.get(id);
    const edge = explanations?.get(id);
    return `<a class="link-row" href="${conceptUrl(id, origin)}"><strong>${escape(concept.title)} ${arrow}</strong>
      <small>${escape(edge ? edge.type + ' · ' + edge.reason : byLesson.get(concept.lessonId)?.title || concept.text)}</small></a>`;
  }).join('');
}

function taskHtml(task, index) {
  const selected = state.answers[task.id]?.option;
  const active = Number.isInteger(selected) && task.options[selected];
  const correct = selected === task.answer;
  return `<article class="task" data-task="${escape(task.id)}">
    <header><span aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><h3 id="task-${escape(task.id)}">${escape(task.prompt)}</h3></header>
    ${task.evidence ? `<p class="evidence">${escape(task.evidence)}</p>` : ''}
    <div class="options" role="group" aria-labelledby="task-${escape(task.id)}">
      ${task.options.map((option, i) => `<button type="button" class="option ${i === selected && !correct ? 'try-again' : ''}" aria-pressed="${i === selected}" data-option="${i}"><span class="option-letter" aria-hidden="true">${String.fromCharCode(65 + i)}</span>${escape(option.label)}</button>`).join('')}
    </div>
    <p class="feedback ${active && !correct ? 'try-again' : ''}" aria-live="polite" ${active ? '' : 'hidden'}>${active ? escape((correct ? '找对了。' : '再看看。') + task.options[selected].feedback) : ''}</p>
    ${task.hint ? `<details><summary>看看提示</summary><p>${escape(task.hint)}</p></details>` : ''}
  </article>`;
}

function bindTasks(tasks) {
  for (const task of tasks) {
    const element = document.querySelector('[data-task="' + task.id + '"]');
    const options = [...element.querySelectorAll('[data-option]')];
    const feedback = element.querySelector('.feedback');
    for (const button of options) {
      button.addEventListener('click', () => {
        const option = Number(button.dataset.option);
        const correct = option === task.answer;
        const solved = correct || state.answers[task.id]?.solved === true;
        state.answers[task.id] = { option, solved };
        saveState();
        for (const item of options) {
          const chosen = item === button;
          item.setAttribute('aria-pressed', String(chosen));
          item.classList.toggle('try-again', chosen && !correct);
        }
        feedback.textContent = (correct ? '找对了。' : '再看看。') + task.options[option].feedback;
        feedback.classList.toggle('try-again', !correct);
        feedback.hidden = false;
        const progress = main.querySelector('[data-task-count]');
        if (progress) {
          const completed = tasks.filter(item => state.answers[item.id]?.solved === true).length;
          progress.textContent = completed === tasks.length ? '本课已完成' : `已解开 ${completed} / ${tasks.length} 题`;
        }
      });
    }
  }
}

function showLesson(lesson) {
  const chapter = chapters.find(chapter => chapter.id === lesson.chapter);
  const isProject = projects.includes(lesson);
  const ownConcepts = lesson.concepts || [];
  const relatedIds = [...new Set(lesson.links || [])];
  const lab = byLab.get(lesson.visual);
  const visualQuery = lesson.id === 'earth-motion' ? { mode: 'daylight', from: lesson.id } : { from: lesson.id };
  const sourceUrl = bookPageUrl(lesson.page);
  main.innerHTML = `
    ${breadcrumb(lesson.title)}
    ${pageIntro(lesson.title, lesson.intro, (isProject ? '主题探究 · ' : '') + chapter.prefix + ' · 教材第 ' + lesson.page + ' 页')}
    <div class="lesson-shell">
      <div class="lesson-content">
        <section class="panel">
          <h2>${isProject ? '想一想' : '先弄明白'}</h2>
          <p class="callout">${escape(lesson.takeaway)}</p>
          ${lab ? `<div class="actions"><a class="button primary" href="${labUrl(lab.id, visualQuery)}">打开${escape(lab.title)} ${arrow}</a></div>` : ''}
        </section>
        ${lesson.widget ? '<section class="panel"><h2>动手看证据</h2><div data-widget></div></section>' : ''}
        <section class="panel">
          ${sectionHeading(isProject ? '做个小决定' : '用证据回答', '', `<span class="pill" data-task-count>${isDone(lesson) ? '本课已完成' : `已解开 ${doneCount(lesson)} / ${lesson.tasks.length} 题`}</span>`)}
          ${lesson.tasks.map(taskHtml).join('')}
        </section>
        ${isProject ? `<section class="panel"><h2>写下你的方案</h2><label for="project-note" class="field-label">我做了什么选择？哪条证据支持它？</label>
          <textarea id="project-note" rows="4" maxlength="2000" placeholder="写一两句就可以">${escape(typeof state.notes[lesson.id] === 'string' ? state.notes[lesson.id] : '')}</textarea>
          <small>自动保存到当前浏览器。</small></section>` : ''}
      </div>
      <aside class="lesson-aside" aria-label="课本和关联知识">
        ${ownConcepts.length ? `<section class="panel"><h2>本课知识点</h2><div class="stack">${ownConcepts.map(concept => `<a class="link-row" href="${conceptUrl(concept.id, activeHash)}"><strong>${escape(concept.title)}</strong><small>${escape(concept.text)}</small></a>`).join('')}</div></section>` : ''}
        ${relatedIds.length ? `<section class="panel"><h2>接着看</h2><div class="stack">${relationshipLinks(relatedIds.slice(0, 7), activeHash)}</div></section>` : ''}
        <section class="panel"><h2>教材</h2><p>中图北京版七年级上册</p><a class="text-link" href="${sourceUrl}" target="_blank" rel="noopener">打开第 ${lesson.page} 页 ↗</a></section>
      </aside>
    </div>`;
  state.lastLesson = lesson.id;
  state.visits[lesson.id] = Date.now();
  saveState();
  bindTasks(lesson.tasks);
  if (lesson.widget) cleanup = mountWidget(main.querySelector('[data-widget]'), lesson.widget, state.widgets[lesson.id], settings => {
    state.widgets[lesson.id] = settings;
    saveState();
  });
  const note = main.querySelector('#project-note');
  note?.addEventListener('input', () => {
    state.notes[lesson.id] = note.value;
    saveState();
  });
}

function showConcept(concept, query) {
  const origin = query.get('from');
  const safeOrigin = /^#\/(?:lab|lesson|concept)\/[a-z\d-]+(?:\?[^<>]*)?$/i.test(origin || '') && origin.length < 360 ? origin : '#/explore';
  const currentCard = activeHash.length < 220 ? activeHash : conceptUrl(concept.id);
  const edges = getRelations(concept.id);
  const links = new Map(edges.map(item => [item.id, item]));
  const lesson = byLesson.get(concept.lessonId);
  const topic = topicViews[concept.id];
  const compareWith = byConcept.get(topic?.compareWith);
  const directlyRelatedLab = labs.find(lab => lab.links.includes(concept.id));
  const importantIds = (topic ? [topic.compareWith, 'contour'] : [...links.keys()].slice(0, 2)).filter(id => links.has(id));
  const otherIds = [...links.keys()].filter(id => !importantIds.includes(id));
  const recommendations = new Map(links);
  if (topic) {
    recommendations.set(topic.compareWith, { type: '看照片', reason: '去另一处山地，找一找山峰和谷底。' });
    recommendations.set('contour', { type: '看坡陡不陡', reason: '想象走一段山路，看看哪里升降最快。' });
  }

  main.innerHTML = `
    ${breadcrumb(concept.title, safeOrigin, safeOrigin === '#/explore' ? '知识网' : '返回刚才的位置')}
    ${pageIntro(concept.title, '', '', 'concept-page-intro')}
    <div class="concept-view">
      ${topic?.photos?.length ? '<section class="panel photo-gallery" data-gallery aria-label="观察图片"></section>' : ''}
      <section class="panel concept-summary">
        <p>${escape(concept.text)}</p>
        ${compareWith ? `<div class="actions"><a href="${labUrl('terrain', { site: concept.id, siteB: compareWith.id, fromConcept: concept.id, fromCard: currentCard })}" class="button primary">和${escape(compareWith.title)}比地形 ${arrow}</a></div>`
          : directlyRelatedLab ? `<div class="actions"><a href="${labUrl(directlyRelatedLab.id, { fromConcept: concept.id, fromCard: currentCard })}" class="button primary">打开相关实验 ${arrow}</a></div>` : ''}
      </section>
      ${links.size ? `<section class="panel"><h2>接着看</h2>
        <div class="stack concept-links">${relationshipLinks(importantIds, currentCard, recommendations)}</div>
        ${otherIds.length ? `<details class="other-relations"><summary>更多联系（${otherIds.length}）</summary><div class="stack">${relationshipLinks(otherIds, currentCard, links)}</div></details>` : ''}
      </section>` : ''}
      <details class="panel concept-tools"><summary>查课本或收藏</summary>
        <div class="actions">
          ${lesson ? `<a href="${lessonUrl(lesson.id)}" class="button">打开相关课次</a>` : ''}
          <button class="button" type="button" data-bookmark aria-pressed="${state.saved.includes(concept.id)}">${state.saved.includes(concept.id) ? '已收藏' : '收藏知识点'}</button>
        </div>
      </details>
    </div>`;
  const gallery = main.querySelector('[data-gallery]');
  if (gallery) cleanup = mountPhotoGallery(gallery, topic.photos, galleryPositions.get(concept.id), index => galleryPositions.set(concept.id, index));
  const bookmark = main.querySelector('[data-bookmark]');
  bookmark.addEventListener('click', () => {
    const saved = state.saved.includes(concept.id);
    state.saved = saved ? state.saved.filter(id => id !== concept.id) : [...state.saved, concept.id];
    bookmark.setAttribute('aria-pressed', String(!saved));
    bookmark.textContent = saved ? '收藏知识点' : '已收藏';
    saveState();
  });
}

const searchableScenes = [
  { title: '世界地形', text: '转动地球，找山脉、高原、平原和海底地形。', href: labUrl('globe', { mode: 'terrain' }) },
  { title: '表层洋流', text: '看暖流、寒流和箭头。', href: labUrl('globe', { mode: 'circulation', flow: 'currents' }) },
  { title: '东亚冬季风', text: '对比冬季和夏季吹风的方向。', href: labUrl('globe', { mode: 'circulation', flow: 'monsoon', season: 'winter' }) },
  { title: '东亚夏季风', text: '观察夏季风怎样吹向陆地。', href: labUrl('globe', { mode: 'circulation', flow: 'monsoon', season: 'summer' }) },
];

function explore() {
  main.innerHTML = `
    ${pageIntro('知识网', '找一个地方，或者问一个读图问题。', '', 'concept-page-intro')}
    <div class="search-box">
      <label class="field-label" for="search">搜索地名、概念或课次</label>
      <input class="search-input" type="search" id="search" placeholder="试试 喜马拉雅、坡陡、冬季风">
    </div>
    <div class="mini-actions" aria-label="常用查找">${['山脉', '气候', '经纬', '地图'].map(term => '<button class="chip" type="button" data-term="' + term + '">' + term + '</button>').join('')}</div>
    <p class="results-label" id="results-count" aria-live="polite"></p><div id="results" class="grid"></div>
    <div class="actions"><button class="button" type="button" data-show-all>浏览全部知识点</button></div>`;
  const input = main.querySelector('#search');
  const result = main.querySelector('#results');
  const count = main.querySelector('#results-count');
  const allButton = main.querySelector('[data-show-all]');
  input.value = exploreState.query;
  const catalog = concepts.map(concept => ({
    id: concept.id, title: concept.title, text: concept.text, titleOfLesson: byLesson.get(concept.lessonId)?.title || '', href: conceptUrl(concept.id),
    aliases: concept.id === 'contour' ? '坡陡 坡缓 山坡有多陡 等高线怎么看坡度' : '',
  }));
  const combined = catalog.concat(
    work.map(lesson => ({ title: lesson.title, text: lesson.intro, titleOfLesson: '课本', href: lessonUrl(lesson.id) })),
    searchableScenes.map(scene => ({ ...scene, titleOfLesson: '转动地球仪' })),
  );

  function search() {
    exploreState.query = input.value;
    const term = input.value.trim().toLowerCase();
    const parts = term.replaceAll(/(?:怎么看|怎么|如何|怎样)|[，、。？！；：,?!;:]+/g, ' ').split(/\s+/).filter(Boolean);
    const featured = !term && !exploreState.showAll;
    const hits = featured ? ['himalayas', 'alps', 'andes'].map(id => catalog.find(item => item.id === id))
      : term ? combined.filter(item => {
          const fields = [item.title, item.text, item.titleOfLesson, item.aliases || ''].join(' ').toLowerCase();
          return parts.length && parts.every(part => fields.includes(part));
        }).sort((a, b) => Number(b.title.includes(term)) - Number(a.title.includes(term))
          || Number(b.title.startsWith(term)) - Number(a.title.startsWith(term)))
      : catalog;
    count.textContent = featured ? '先从一张照片开始' : hits.length ? `${hits.length} 个${term ? '结果' : '知识点'}` : '没找到。试试少写几个字，例如“坡度”。';
    allButton.hidden = Boolean(term);
    allButton.textContent = exploreState.showAll ? '收起目录' : '浏览全部知识点';
    result.innerHTML = hits.map(item => {
      const photo = topicViews[item.id]?.photos?.[0];
      return `<a class="card ${photo ? 'topic-card' : ''}" href="${item.href}">
        ${photo ? `<img src="./assets/gallery/${escape(photo.file)}" alt="" loading="lazy" decoding="async">` : ''}
        <h3>${escape(item.title)}</h3>
        <p>${escape(featured && photo ? photo.cue : item.text)}</p>
        <span class="card-action">${escape(featured ? '看照片' : item.titleOfLesson)} ${arrow}</span></a>`;
    }).join('');
  }
  input.addEventListener('input', search);
  allButton.addEventListener('click', () => {
    exploreState.showAll = !exploreState.showAll;
    search();
    count.scrollIntoView({ block: 'nearest' });
  });
  for (const button of main.querySelectorAll('[data-term]')) button.addEventListener('click', () => {
    input.value = button.dataset.term;
    search();
    input.focus();
  });
  search();
}

function review() {
  const needsReview = work.filter(lesson => lesson.tasks.some(task => {
    const selection = state.answers[task.id]?.option;
    return Number.isInteger(selection) && selection !== task.answer;
  }));
  const recent = work.filter(lesson => state.visits[lesson.id])
    .sort((a, b) => Number(state.visits[b.id]) - Number(state.visits[a.id])).slice(0, 8);
  const list = (items, empty) => items.length ? `<div class="review-list">${items.map(lesson => `<div class="review-item">
    <a href="${lessonUrl(lesson.id)}">${escape(lesson.title)}</a><small>${doneCount(lesson)} / ${lesson.tasks.length} 题</small></div>`).join('')}</div>` : `<p class="empty">${empty}</p>`;
  main.innerHTML = `
    ${pageIntro('我的复习', '找回做过的课、再看没想通的题，也可以把进度带到另一台设备。')}
    <div class="lesson-shell">
      <div class="lesson-content">
        <section class="panel"><h2>再试一次</h2>${list(needsReview, '如果一道题想再查证，它所在的课会显示在这里。')}</section>
        <section class="panel"><h2>最近学过</h2>${list(recent, '做过第一课后，可以在这里快速返回。')}</section>
      </div>
      <aside class="lesson-aside">
        <section class="panel"><h2>收藏知识点</h2>
          ${state.saved.length ? '<div class="stack">' + relationshipLinks(state.saved) + '</div>' : '<p class="empty">在知识卡上点“收藏知识点”后，就能在这里找到它。</p>'}</section>
        <section class="panel"><h2>学习进度</h2><p>进度保存在现在使用的浏览器中。</p>
          <div class="mini-actions"><button type="button" class="button" id="export">导出</button><button type="button" class="button" id="import">导入</button></div>
          <input type="file" id="import-file" accept=".json,application/json" hidden><p id="import-feedback" role="status"></p>
        </section>
      </aside>
    </div>`;
  main.querySelector('#export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ ...state, kind: storageKey }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.download = '地理实验台学习进度.json';
    anchor.href = url;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const input = main.querySelector('#import-file');
  main.querySelector('#import').addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 400000) throw new Error('large');
      const imported = JSON.parse(await file.text());
      if (imported?.kind !== storageKey) throw new Error('format');
      const valid = normalizeState(imported);
      for (const [id, incoming] of Object.entries(valid.answers)) {
        if (!incoming || !Number.isInteger(incoming.option) || typeof incoming.solved !== 'boolean') continue;
        const previous = state.answers[id];
        if (!previous?.solved || incoming.solved) state.answers[id] = incoming;
      }
      for (const [id, incoming] of Object.entries(valid.visits)) {
        if (Number.isFinite(incoming)) state.visits[id] = Math.max(state.visits[id] || 0, incoming);
      }
      for (const key of ['labs', 'widgets', 'notes']) {
        for (const [id, incoming] of Object.entries(valid[key])) {
          if (!Object.hasOwn(state[key], id)) state[key][id] = incoming;
        }
      }
      state.saved = [...new Set([...state.saved, ...valid.saved])];
      if (valid.lastLesson && (!state.lastLesson || state.visits[valid.lastLesson] > state.visits[state.lastLesson])) state.lastLesson = valid.lastLesson;
      saveState();
      review();
      main.querySelector('#import-feedback').textContent = '学习进度已合并。';
    } catch {
      main.querySelector('#import-feedback').textContent = '无法读入。请选择从地理实验台导出的进度文件。';
      input.value = '';
    }
  });
}

function legend() {
  main.innerHTML = `${breadcrumb('常用地图图例')}${pageIntro('常用地图图例', '这些符号用来练习辨认。读具体地图时，先看该图自己的图例。', '课本附录 · 第 125 页')}
    <div class="grid">${legendItems.map(item => `<article class="card"><div class="legend-item"><span aria-hidden="true" class="legend-symbol">${escape(item.symbol)}</span><h3>${escape(item.title)}</h3></div><p>${escape(item.text)}</p></article>`).join('')}</div>
    <div class="actions"><a class="button" href="${lessonUrl('maps')}">回到认识地图</a><a class="button" href="${bookPageUrl(125)}" target="_blank" rel="noopener">查看教材图例 ↗</a></div>`;
}

function sources() {
  main.innerHTML = `${breadcrumb('教材与素材来源')}${pageIntro('教材与素材来源', '')}
    <section class="panel"><h2>教材</h2><p>《地理》七年级上册，中图版（北京版）。北京教育科学研究院编著，中国地图出版社出版，钟作慈主编。ISBN 978-7-5204-4102-5。</p>
      <p>课次、页码和概念依据国家中小学智慧教育平台 2026 年 8 月 18 日更新的电子教材。网页中的问题、实验和反馈为自学设计。</p>
      <div class="actions"><a class="button" href="https://www.ditu.cn/pub/html/dtjxw/book/dili/978-7-5204-4102-5/41025.html" target="_blank" rel="noopener">出版社电子课本 ↗</a><a class="button" href="${bookPageUrl(2)}" target="_blank" rel="noopener">国家平台目录 ↗</a></div>
    </section>
    <section class="panel"><h2>图片与模型</h2><p>首页摄影为 Alexkom000 的塔拉河峡谷照片。本站缩放、压缩并在首页裁切显示。</p>
      <p><a href="https://commons.wikimedia.org/wiki/File:2025-07-13_Tara_River_Canyon_5.jpg" target="_blank" rel="noopener">Wikimedia Commons 原图</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a></p>
      <p>地球采用 <a href="https://www.naturalearthdata.com/downloads/110m-physical-vectors/110m-land/" target="_blank" rel="noopener">Natural Earth 公共领域陆地轮廓</a>的简化教学示意。场景不包含行政区划。地形和气象练习用示意数据，各实验标明口径。</p>
      <p>世界地球仪的地形纹理来自 <a href="https://www.naturalearthdata.com/downloads/50m-gray-earth/gray-earth-with-ocean-bottom/" target="_blank" rel="noopener">Natural Earth Gray Earth</a>，使用 SRTM Plus 和 CleanTOPO2 数据。本站对公有领域数据作了缩小与着色。</p>
    </section>
    <section class="panel"><h2>洋流与季风</h2><p>箭头根据资料重画，表示有代表性的方向和路径。</p>
      <div class="stack">${FLOW_SOURCES.map(source => `<a class="link-row" href="${escape(source.url)}" target="_blank" rel="noopener">${escape(source.title)} ↗</a>`).join('')}</div>
    </section>`;
}

function render() {
  const next = location.hash.startsWith('#/') ? location.hash : '#/';
  if (activeHash) scrollPositions.set(activeHash, scrollY);
  cleanup?.();
  cleanup = null;
  activeHash = next;
  const [path, search] = next.slice(2).split('?');
  const [page = '', id = ''] = path.split('/');
  const query = new URLSearchParams(search || '');
  const activeTab = page === 'explore' || page === 'concept' ? 'explore' : page === 'review' ? 'review' : 'home';
  for (const link of document.querySelectorAll('[data-nav]')) {
    if (link.dataset.nav === activeTab) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  if (!page) main.innerHTML = home();
  else if (page === 'lesson' && byLesson.has(id)) showLesson(byLesson.get(id));
  else if (page === 'concept' && byConcept.has(id)) showConcept(byConcept.get(id), query);
  else if (page === 'lab' && byLab.has(id)) {
    const lab = byLab.get(id);
    const from = query.get('from');
    const originCard = byConcept.get(query.get('fromConcept'));
    const back = byLesson.get(from) || byLesson.get(lab.lessonId);
    const fromCard = query.get('fromCard');
    const cardUrl = originCard ? conceptUrl(originCard.id) : null;
    const cardReturn = fromCard && fromCard.length < 220 && fromCard.startsWith(cardUrl + '?from=') ? fromCard : cardUrl;
    const backUrl = originCard ? cardReturn : query.get('fromGlobe') === 'terrain' ? labUrl('globe', { mode: 'terrain' }) : back ? lessonUrl(back.id) : '#/';
    const backLabel = originCard ? '返回' + originCard.title : query.get('fromGlobe') === 'terrain' ? '返回地球仪' : back?.title || '课本';
    main.innerHTML = `${breadcrumb(lab.title, backUrl, backLabel)}
      ${pageIntro(lab.title, lab.description, '', 'lab-page-intro')}<div data-lab></div>
      <section class="panel"><h2>连到课本知识</h2><div class="grid">${relationshipLinks(lab.links, activeHash)}</div></section>`;
    cleanup = mountLabUI(main.querySelector('[data-lab]'), lab, query, state.labs[id], settings => {
      state.labs[id] = settings;
      saveState();
    });
  } else if (page === 'explore') explore();
  else if (page === 'review') review();
  else if (page === 'legend') legend();
  else if (page === 'sources') sources();
  else main.innerHTML = `${pageIntro('这个页面没有找到', '可以从课本目录重新出发。')}<a class="button primary" href="#/">打开课本</a>`;
  const heading = main.querySelector('h1');
  document.title = heading ? heading.textContent + ' · 地理实验台' : '地理实验台 · 七年级上册';
  scrollTo(0, scrollPositions.get(next) || 0);
  if (page === 'lab' && !scrollPositions.has(next)) requestAnimationFrame(() => {
    if (activeHash !== next) return;
    const layout = main.querySelector('.lab-layout');
    const dock = main.querySelector('.lab-dock');
    if (!layout || !dock) return;
    const clipped = dock.getBoundingClientRect().bottom - innerHeight + 8;
    const stageStart = layout.getBoundingClientRect().top;
    if (clipped > 0 && stageStart > 0) scrollBy(0, Math.min(clipped, stageStart));
  });
}
document.querySelector('.skip').addEventListener('click', event => {
  event.preventDefault();
  main.focus();
});
window.addEventListener('hashchange', () => {
  render();
  main.focus({ preventScroll: true });
});
render();
