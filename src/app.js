import { lessons, projects, legendItems, concepts, getRelations, labs, bookPageUrl } from './catalog.js';
import { mountLabUI } from './lab-ui.js?v=2';
import { mountWidget } from './widgets.js?v=2';
import { FLOW_SOURCES } from './flow-model.js';
import { topicViews } from './topic-views.js';
import { mountPhotoGallery } from './photo-gallery.js';
import { mountMapDirection } from './map-direction.js?v=2';
import { getTextbookPosition, textbookChapters, textbookEntries } from './textbook.js';
import { createLearningStore } from './learning-state.js';
import { hasOpeningVisual, mountOpeningVisual } from './lesson-visuals.js';
import { hasEvidenceActivity, mountEvidenceActivity } from './evidence-activities.js';

const main = document.querySelector('#content');
const notice = document.querySelector('#announcement');
const work = [...lessons, ...projects];
const byLesson = new Map(work.map(lesson => [lesson.id, lesson]));
const byConcept = new Map(concepts.map(concept => [concept.id, concept]));
const byLab = new Map(labs.map(lab => [lab.id, lab]));
const exploreState = { query: '', showAll: false };
let activeHash = '';
let cleanup;
let storeTimer;
const learning = createLearningStore({
  lessons: work, concepts, labs,
  onStorageError: () => {
    notice.textContent = '当前浏览器无法长期保存进度，请在复习页导出。';
  },
});
const { state } = learning;

const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const lessonUrl = id => '#/lesson/' + encodeURIComponent(id);
const conceptUrl = (id, origin) => '#/concept/' + encodeURIComponent(id) + (origin ? '?from=' + encodeURIComponent(origin) : '');
const labUrl = (id, query = {}) => '#/lab/' + encodeURIComponent(id) + (Object.keys(query).length ? '?' + new URLSearchParams(query) : '');
if ("scrollRestoration" in history) history.scrollRestoration = "manual";

const arrow = '<span aria-hidden="true">→</span>';
const doneCount = lesson => lesson.tasks.filter(task => state.answers[task.id]?.solved === true).length;
const isDone = lesson => lesson.tasks.length > 0 && doneCount(lesson) === lesson.tasks.length;
const hasCompleted = lesson => Boolean(state.completed[lesson.id]) || isDone(lesson);
const sectionHeading = (title, text = '', extra = '') => '<div class="section-title"><div><h2>' + title + '</h2>' + (text ? '<p>' + text + '</p>' : '') + '</div>' + extra + '</div>';

function breadcrumb(title, from = '#/textbook', fromLabel = '课本目录') {
  return `<div class="breadcrumbs"><a href="${escape(from)}">${escape(fromLabel)}</a><span aria-hidden="true">/</span><span>${escape(title)}</span></div>`;
}

function pageIntro(title, description, eyebrow = '', extraClass = '') {
  return `<div class="page-intro ${extraClass}">${eyebrow ? `<p class="eyebrow">${escape(eyebrow)}</p>` : ''}<h1>${escape(title)}</h1>${description ? `<p>${escape(description)}</p>` : ''}</div>`;
}


function textbookLabel(entry) {
  const { chapter } = getTextbookPosition(entry.id);
  const part = entry.kind === 'project' ? '主题探究' : entry.section ? `第 ${entry.section} 节` : '';
  return [chapter.prefix, chapter.id ? chapter.title : '', part].filter(Boolean).join(' · ');
}

function home() {
  const recent = getTextbookPosition(state.lastLesson)?.entry;
  const entry = recent || textbookEntries[0];
  return `
    <section class="hero course-hero" aria-labelledby="hero-title">
      <div class="hero-copy">
        <p class="eyebrow">中图版（北京版） · 七年级上册</p>
        <h1 id="hero-title">七上地理实验台</h1>
        <p class="current-lesson">${escape(textbookLabel(entry))}</p>
        <div class="hero-actions">
          <a class="button primary" href="${lessonUrl(entry.id)}"><span><small>${recent ? '继续学习' : '从绪论开始'}</small><strong>${escape(entry.title)}</strong></span>${arrow}</a>
        </div>
      </div>
      <a class="hero-credit" href="#/sources">塔拉河峡谷 · 摄影来源</a>
    </section>
    ${textbookDirectory(entry)}
    <details class="panel course-tools" data-remember="lab-directory"><summary>单独打开实验</summary>
      <div class="stack">${labs.map(lab => `<a class="link-row" href="${labUrl(lab.id)}"><strong>${escape(lab.title)} ${arrow}</strong></a>`).join('')}</div>
    </details>`;
}

function textbookDirectory(current = getTextbookPosition(state.lastLesson)?.entry || textbookEntries[0], standalone = false) {
  const completed = work.filter(hasCompleted).length;
  const progress = `<div class="progress-top"><progress max="${work.length}" value="${completed}" aria-label="七上学习进度"></progress><span>${completed} / ${work.length} 已学习</span></div>`;
  return `
    <section class="section book-directory" aria-label="七上课本目录">
      ${standalone ? `<div class="section-title book-title"><h1>七上课本目录</h1>${progress}</div>` : sectionHeading('七上课本目录', '', progress)}
      <div class="book-chapters">${textbookChapters.map(chapter => `
        <details class="chapter book-chapter" data-remember="chapter-${chapter.id}" ${current.chapter === chapter.id ? 'open' : ''}>
          <summary><span>${escape(chapter.prefix)}</span><strong>${escape(chapter.title)}</strong></summary>
          <div class="chapter-entries">${chapter.entries.map(entry => chapterLink(entry, current.id)).join('')}</div>
        </details>`).join('')}
        <a class="chapter chapter-row book-appendix" href="#/legend"><span>附录 · 常用地图图例</span><span>第 125 页</span></a>
      </div>
    </section>`;
}

function chapterLink(entry, currentId) {
  const prefix = entry.kind === 'project' ? '探究 · ' : entry.section ? `第 ${entry.section} 节 · ` : '';
  const status = hasCompleted(byLesson.get(entry.id)) ? '已学习' : `第 ${entry.page} 页`;
  return `<a class="chapter-row" ${entry.kind === 'project' ? 'data-project' : ''} ${entry.id === currentId ? 'aria-current="location"' : ''} href="${lessonUrl(entry.id)}"><span>${prefix}${escape(entry.title)}</span><span>${status}</span></a>`;
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
    ${task.hint ? `<details data-remember="hint-${escape(task.id)}"><summary>看看提示</summary><p>${escape(task.hint)}</p></details>` : ''}
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
        learning.setRecord('answers', task.id, { option, solved });
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


function lessonNavigation(position, lesson) {
  const { entry, previous, next } = position;
  const label = !next ? '学到本册最后一项' : next.kind === 'project' ? '本章探究'
    : next.chapter !== entry.chapter && entry.chapter !== 0 ? '下一章' : '下一课';
  return `<nav class="course-next" aria-label="继续按课本学习">
    <a class="button primary next-lesson" href="${next ? lessonUrl(next.id) : '#/textbook'}"><span><small>${label}</small><strong>${escape(next?.title || '回看七上目录')}</strong></span>${arrow}</a>
    <div class="course-nav-secondary">
      ${previous ? `<a class="text-link" href="${lessonUrl(previous.id)}" aria-label="上一项：${escape(previous.title)}">← 上一项</a>` : ''}
      <a class="text-link" href="#/textbook">课本目录</a>
      <button type="button" class="text-link" data-complete aria-pressed="${hasCompleted(lesson)}">${hasCompleted(lesson) ? '✓ 已学习' : '记为已学习'}</button>
    </div>
  </nav>`;
}

const introLabModes = { 'earth-model': 'coordinates', 'earth-motion': 'daylight', 'land-ocean': 'terrain' };

function showLesson(lesson) {
  const position = getTextbookPosition(lesson.id);
  const { entry, index, total } = position;
  const isProject = entry.kind === 'project';
  const ownConcepts = lesson.concepts || [];
  const lab = byLab.get(lesson.id === 'land-ocean' ? 'globe' : lesson.visual);
  const mapActivity = lesson.id === 'maps';
  const openingVisual = hasOpeningVisual(lesson.id);
  const addedActivity = hasEvidenceActivity(lesson.id);
  const origin = activeHash;
  const help = entry.help;
  const related = [...new Set(lesson.links || [])].filter(id => {
    const relatedLesson = getTextbookPosition(byConcept.get(id)?.lessonId);
    return id !== help?.conceptId && relatedLesson && relatedLesson.index <= index;
  }).slice(0, 2);
  const hasOpening = Boolean(lab || lesson.widget || mapActivity || openingVisual || addedActivity);
  const stateKey = 'lesson-' + lesson.id;
  const completion = hasCompleted(lesson);
  main.innerHTML = `
    <div class="course-lesson">
      <header class="course-lesson-head">
        <div class="course-position"><a href="#/textbook">${escape(textbookLabel(entry))}</a><span>教材第 ${entry.page} 页</span><span class="course-index" aria-label="全册第 ${index + 1} 项，共 ${total} 项">${index + 1} / ${total}</span></div>
        <h1>${escape(lesson.title)}</h1>
      </header>
      <section class="course-opening ${lab ? 'course-opening-lab' : 'panel'}">
        <div class="opening-heading"><h2>${escape(entry.prompt)}</h2>${lab || mapActivity || lesson.widget ? `<p>${escape(entry.action)}</p>` : ''}</div>
        ${lab ? '<div data-lesson-lab></div>' : ''}
        ${mapActivity ? '<div data-map-direction class="direction-panel course-direction"></div>' : ''}
        ${lesson.widget ? '<div data-widget></div>' : ''}
        ${openingVisual || addedActivity ? '<div data-opening-visual></div>' : ''}
        ${!hasOpening && lesson.tasks[0] ? taskHtml(lesson.tasks[0], 0) : ''}
        ${help ? `<a class="course-help text-link" href="${conceptUrl(help.conceptId, origin)}">${escape(help.label)} <span aria-hidden="true">↗</span></a>` : ''}
      </section>
      ${isProject ? `<section class="panel course-note"><label for="project-note" class="field-label">留下一句理由</label>
        <textarea id="project-note" rows="2" maxlength="2000" placeholder="我这样选，因为我看到……">${escape(typeof state.notes[lesson.id] === 'string' ? state.notes[lesson.id] : '')}</textarea>
        <small>写下的内容会保存在这个浏览器中。</small></section>` : ''}
      ${lessonNavigation(position, lesson)}
      <div class="course-extras">
        <details class="panel course-details" data-remember="takeaway"><summary>这一课学到了什么</summary>
          <p>${escape(lesson.takeaway)}</p>
          ${ownConcepts.length ? `<ul class="course-glossary">${ownConcepts.map(concept => `<li><a class="text-link" href="${conceptUrl(concept.id, origin)}">${escape(concept.title)}</a></li>`).join('')}</ul>` : ''}
        </details>
        <details class="panel course-details" data-remember="practice"><summary>再练一练 <small data-task-count>${isDone(lesson) ? '全部答对' : `${doneCount(lesson)} / ${lesson.tasks.length} 题`}</small></summary>
          ${lesson.tasks.slice(hasOpening ? 0 : 1).map((task, i) => taskHtml(task, i + (hasOpening ? 0 : 1))).join('')}
        </details>
        ${related.length ? `<details class="panel course-details" data-remember="connections"><summary>想多看一点</summary><div class="stack">${relationshipLinks(related, origin)}</div></details>` : ''}
        <a class="course-book-source text-link" href="${bookPageUrl(lesson.page)}" target="_blank" rel="noopener">查看教材第 ${lesson.page} 页 ↗</a>
      </div>
    </div>`;
  learning.recordVisit(lesson.id);
  bindTasks(lesson.tasks);
  const complete = main.querySelector('[data-complete]');
  if (completion) complete.disabled = true;
  complete.addEventListener('click', () => {
    learning.markCompleted(lesson.id);
    complete.textContent = '✓ 已学习';
    complete.setAttribute('aria-pressed', 'true');
    complete.disabled = true;
  });
  const disposers = [];
  if (lab) {
    const params = new URLSearchParams();
    if (introLabModes[lesson.id]) params.set('mode', introLabModes[lesson.id]);
    const legacy = state.labs[lab.id];
    const legacyEntry = legacy && new URLSearchParams(legacy.entryKey).get('from') === lesson.id
      ? { ...legacy, entryKey: params.toString() } : undefined;
    const saved = learning.getView(origin)?.labState ?? state.labs[stateKey] ?? legacyEntry;
    disposers.push(mountLearningLab(main.querySelector('[data-lesson-lab]'), lab, params, saved, stateKey, { inline: true, origin }));
  }
  if (mapActivity) mountMapDirection(main.querySelector('[data-map-direction]'), state.widgets[lesson.id],
    settings => learning.setRecord('widgets', lesson.id, settings));
  if (lesson.widget) disposers.push(mountWidget(main.querySelector('[data-widget]'), lesson.widget, state.widgets[lesson.id],
    settings => learning.setRecord('widgets', lesson.id, settings)));
  if (openingVisual || addedActivity) {
    const mount = openingVisual ? mountOpeningVisual : mountEvidenceActivity;
    disposers.push(mount(main.querySelector('[data-opening-visual]'), lesson.id, state.widgets[lesson.id],
      settings => learning.setRecord('widgets', lesson.id, settings)));
  }
  cleanup = () => disposers.forEach(dispose => dispose?.());
  const note = main.querySelector('#project-note');
  note?.addEventListener('input', () => learning.setRecord('notes', lesson.id, note.value));
}

function mountLearningLab(host, lab, params, saved, key, options = {}) {
  const route = activeHash;
  let mounted = false;
  const dispose = mountLabUI(host, lab, params, saved, settings => {
    learning.saveView(route, { labState: settings });
    if (mounted) learning.setRecord('labs', key, settings);
  }, options);
  mounted = true;
  return dispose;
}

function routeParts(route) {
  const [path, search] = route.slice(2).split('?');
  const [page = '', id = ''] = path.split('/');
  return { page, id, query: new URLSearchParams(search || '') };
}

function acceptedOrigin(route) {
  if (typeof route !== 'string' || route.length > 1200 || !/^#\/[a-z\d/-]+(?:\?[^<>#]*)?$/i.test(route)) return null;
  const { page, id } = routeParts(route);
  if (page === 'lesson' && byLesson.has(id) || page === 'lab' && byLab.has(id) || page === 'concept' && byConcept.has(id)) return route;
  if (!id && ['review', 'explore', 'legend', 'textbook'].includes(page)) return route;
  return null;
}

function contextReturn(from) {
  let origin = acceptedOrigin(from);
  for (let depth = 0; depth < 7 && origin; depth++) {
    const { page, id, query } = routeParts(origin);
    if (page === 'lesson') return { href: origin, label: '返回《' + byLesson.get(id).title + '》' };
    if (page === 'lab') return { href: origin, label: '返回' + byLab.get(id).title };
    if (page === 'review') return { href: origin, label: '返回复习' };
    if (page === 'legend') return { href: origin, label: '返回图例' };
    if (page === 'textbook') return { href: origin, label: '返回课本目录' };
    if (page === 'explore') return { href: origin, label: '返回知识网' };
    origin = acceptedOrigin(query.get('from'));
  }
  return { href: '#/explore', label: '返回知识网' };
}


function showConcept(concept, query) {
  const origin = contextReturn(query.get('from'));
  const currentCard = conceptUrl(concept.id, origin.href);
  const edges = getRelations(concept.id);
  const links = new Map(edges.map(item => [item.id, item]));
  const lesson = byLesson.get(concept.lessonId);
  const topic = topicViews[concept.id];
  const compareWith = byConcept.get(topic?.compareWith);
  const directlyRelatedLab = labs.find(lab => lab.links.includes(concept.id));
  const available = topic ? [topic.compareWith, 'contour'] : [...links.keys()];
  const suggested = available.slice(0, compareWith || directlyRelatedLab ? 1 : 2);
  const importantIds = suggested.filter(id => links.has(id));
  const otherIds = [...links.keys()].filter(id => !importantIds.includes(id));
  const recommendations = new Map(links);
  if (topic) {
    recommendations.set(topic.compareWith, { type: '看照片', reason: '去另一处山地，找一找山峰和谷底。' });
    recommendations.set('contour', { type: '看坡陡不陡', reason: '看看山路上哪里升降最快。' });
  }

  main.innerHTML = `
    <div class="concept-view">
      <a class="concept-return" data-context-return href="${escape(origin.href)}">← ${escape(origin.label)}</a>
      ${pageIntro(concept.title, '', lesson ? '教材 · ' + lesson.title : '', 'concept-page-intro')}
      ${concept.id === 'map-direction' ? '<section class="panel direction-panel" data-map-direction aria-label="地图方向示意"></section>' : ''}
      ${topic?.photos?.length ? '<section class="panel photo-gallery" data-gallery aria-label="观察图片"></section>' : ''}
      <section class="panel concept-summary">
        <p>${escape(concept.text)}</p>
      </section>
      ${links.size || compareWith || directlyRelatedLab ? `<details class="panel course-details" data-remember="more-concepts"><summary>想多看一点</summary>
        <div class="stack concept-links">${relationshipLinks(importantIds, origin.href, recommendations)}</div>
        ${compareWith ? `<a href="${labUrl('terrain', { site: concept.id, siteB: compareWith.id, fromConcept: concept.id, fromCard: currentCard })}" class="text-link concept-experiment">和${escape(compareWith.title)}比地形 ${arrow}</a>`
          : directlyRelatedLab ? `<a href="${labUrl(directlyRelatedLab.id, { fromConcept: concept.id, fromCard: currentCard })}" class="text-link concept-experiment">打开相关实验 ${arrow}</a>` : ''}
        ${origin.href === '#/explore' && otherIds.length ? `<details class="other-relations" data-remember="all-relations"><summary>查看全部联系</summary><div class="stack">${relationshipLinks(otherIds, origin.href, links)}</div></details>` : ''}
      </details>` : ''}
      <details class="panel concept-tools course-details" data-remember="concept-tools"><summary>查课本或收藏</summary>
        <div class="actions">
          ${lesson ? `<a href="${lessonUrl(lesson.id)}" class="button">打开《${escape(lesson.title)}》</a>` : ''}
          <button class="button" type="button" data-bookmark aria-pressed="${state.saved.includes(concept.id)}">${state.saved.includes(concept.id) ? '已收藏' : '收藏知识点'}</button>
        </div>
      </details>
    </div>`;
  const cardState = conceptUrl(concept.id);
  const direction = main.querySelector('[data-map-direction]');
  if (direction) mountMapDirection(direction, learning.getView(cardState)?.direction,
    settings => learning.saveView(cardState, { direction: settings }));
  const gallery = main.querySelector('[data-gallery]');
  if (gallery) cleanup = mountPhotoGallery(gallery, topic.photos, learning.getView(cardState)?.galleryIndex,
    index => learning.saveView(cardState, { galleryIndex: index }));
  const bookmark = main.querySelector('[data-bookmark]');
  bookmark.addEventListener('click', () => {
    const selected = !state.saved.includes(concept.id);
    learning.setBookmark(concept.id, selected);
    bookmark.setAttribute('aria-pressed', String(selected));
    bookmark.textContent = selected ? '已收藏' : '收藏知识点';
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
    id: concept.id, title: concept.title, text: concept.text, titleOfLesson: byLesson.get(concept.lessonId)?.title || '', href: conceptUrl(concept.id, '#/explore'),
    aliases: concept.id === 'contour' ? '坡陡 坡缓 山坡有多陡 等高线怎么看坡度' : '',
  }));
  const combined = catalog.concat(
    work.map(lesson => ({ title: lesson.title, text: lesson.intro, titleOfLesson: '课本', href: lessonUrl(lesson.id) })),
    searchableScenes.map(scene => ({ ...scene, titleOfLesson: '转动地球仪' })),
  );

  function search() {
    exploreState.query = input.value;
    learning.saveView('#/explore', { search: { ...exploreState } });
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
          ${state.saved.length ? '<div class="stack">' + relationshipLinks(state.saved, '#/review') + '</div>' : '<p class="empty">在知识卡上点“收藏知识点”后，就能在这里找到它。</p>'}</section>
        <section class="panel"><h2>学习进度</h2><p>进度保存在现在使用的浏览器中。</p>
          <div class="mini-actions"><button type="button" class="button" id="export">导出</button><button type="button" class="button" id="import">导入</button></div>
          <input type="file" id="import-file" accept=".json,application/json" hidden><p id="import-feedback" role="status"></p>
        </section>
      </aside>
    </div>`;
  main.querySelector('#export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(learning.exportProgress(), null, 2)], { type: 'application/json' });
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
      learning.importProgress(imported);
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


function captureView() {
  if (!activeHash) return;
  const { page, id } = routeParts(activeHash);
  const details = Array.from(main.querySelectorAll('details[data-remember]'), element => [element.dataset.remember, element.open]);
  const position = { scrollY, details: Object.fromEntries(details) };
  learning.saveView(activeHash, position);
  if (page === 'lesson' && byLesson.has(id)) {
    const previous = state.positions[id];
    if (previous?.scrollY !== position.scrollY || JSON.stringify(previous?.details) !== JSON.stringify(position.details)) {
      learning.setRecord('positions', id, position);
    }
  }
}

function restoreView(view) {
  if (!view?.details) return;
  for (const element of main.querySelectorAll('details[data-remember]')) {
    const open = view.details[element.dataset.remember];
    if (typeof open === 'boolean' && !element.closest('.book-directory')) element.open = open;
  }
}

function fitWorkspace() {
  const layout = main.querySelector('.lab-layout');
  const dock = main.querySelector('.lab-dock');
  if (!layout || !dock) return;
  const clipped = dock.getBoundingClientRect().bottom - innerHeight + 8;
  const stageStart = layout.getBoundingClientRect().top;
  if (clipped > 0 && stageStart > 0) scrollBy(0, Math.min(clipped, stageStart));
}

function render() {
  const next = location.hash.startsWith('#/') ? location.hash : '#/';
  const previous = activeHash;
  clearTimeout(storeTimer);
  captureView();
  cleanup?.();
  cleanup = null;
  activeHash = next;
  learning.refresh();
  const { page, id, query } = routeParts(next);
  const lesson = page === 'lesson' ? byLesson.get(id) : null;
  const view = learning.getView(next) ?? (lesson ? state.positions[id] : null);
  const activeTab = page === 'explore' || page === 'concept' ? 'explore' : page === 'review' ? 'review' : 'home';
  for (const link of document.querySelectorAll('[data-nav]')) {
    if (link.dataset.nav === activeTab) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  if (!page) main.innerHTML = home();
  else if (page === 'textbook') main.innerHTML = textbookDirectory(undefined, true);
  else if (lesson) {
    showLesson(lesson);
    const cameFrom = previous ? routeParts(previous) : null;
    const contextualBack = cameFrom?.page === 'concept' && contextReturn(cameFrom.query.get('from')).href === next
      || cameFrom?.page === 'lab' && (cameFrom.query.get('returnTo') === next || cameFrom.query.get('from') === id);
    if (!contextualBack) learning.setResume(id, { route: next, scrollY: view?.scrollY || 0 });
  } else if (page === 'concept' && byConcept.has(id)) showConcept(byConcept.get(id), query);
  else if (page === 'lab' && byLab.has(id)) {
    const lab = byLab.get(id);
    const from = query.get('from');
    const originCard = byConcept.get(query.get('fromConcept'));
    const back = byLesson.get(from) || byLesson.get(lab.lessonId);
    const directReturn = acceptedOrigin(query.get('returnTo'));
    const fromCard = acceptedOrigin(query.get('fromCard'));
    const cardUrl = originCard ? conceptUrl(originCard.id) : null;
    const cardReturn = fromCard?.startsWith(cardUrl + '?from=') ? fromCard : cardUrl;
    const backUrl = directReturn || (originCard ? cardReturn : query.get('fromGlobe') === 'terrain'
      ? labUrl('globe', { mode: 'terrain' }) : back ? lessonUrl(back.id) : '#/textbook');
    const backLabel = directReturn ? contextReturn(directReturn).label : originCard ? '返回' + originCard.title
      : query.get('fromGlobe') === 'terrain' ? '返回地球仪' : back ? '返回《' + back.title + '》' : '课本目录';
    main.innerHTML = `${breadcrumb(lab.title, backUrl, backLabel)}
      ${pageIntro(lab.title, lab.description, '', 'lab-page-intro')}<div data-lab></div>
      <details class="panel course-details" data-remember="lab-concepts"><summary>相关课本知识</summary><div class="stack">${relationshipLinks(lab.links, activeHash)}</div></details>`;
    cleanup = mountLearningLab(main.querySelector('[data-lab]'), lab, query, view?.labState ?? state.labs[id], id, { origin: next });
  } else if (page === 'explore') {
    const storedQuery = view?.search;
    if (storedQuery) Object.assign(exploreState, storedQuery);
    explore();
  } else if (page === 'review') review();
  else if (page === 'legend') legend();
  else if (page === 'sources') sources();
  else main.innerHTML = `${pageIntro('这个页面没有找到', '可以从课本目录重新出发。')}<a class="button primary" href="#/textbook">打开课本</a>`;
  restoreView(view);
  const heading = main.querySelector('h1');
  document.title = heading ? heading.textContent + ' · 地理实验台' : '地理实验台 · 七年级上册';
  scrollTo(0, view?.scrollY || 0);
  requestAnimationFrame(() => {
    if (activeHash !== next) return;
    if (view?.scrollY) scrollTo(0, view.scrollY);
    else if (page === 'lab' || lesson) fitWorkspace();
  });
}
window.addEventListener('scroll', () => {
  clearTimeout(storeTimer);
  storeTimer = setTimeout(captureView, 200);
}, { passive: true });
window.addEventListener('pagehide', captureView);
document.querySelector('.skip').addEventListener('click', event => {
  event.preventDefault();
  main.focus();
});
window.addEventListener('hashchange', () => {
  render();
  main.focus({ preventScroll: true });
});
render();
