import { lessons, projects, legendItems, concepts, getRelations, labs, bookPageUrl } from './catalog.js';
import { FLOW_SOURCES } from './flow-model.js';
import { topicViews } from './topic-views.js?v=5';
import { mountPhotoGallery } from './photo-gallery.js?v=7';
import { mountMapDirection } from './map-direction.js?v=6';
import { getTextbookPosition, textbookChapters, textbookEntries } from './textbook.js';
import { createLearningStore } from './learning-state.js';
import { inquiryViews, renderInquiry, selectInquiryView, escapeHtml as escape } from './inquiry-view.js?v=6';
import { inquiries } from './inquiries.js?v=6';
import { lessonActivities, activityIds, activityKey, mountLessonVisual } from './lesson-activities.js?v=6';
import { fitActivityStage } from './activity-stage.js';
import { LAB_UI_MODULE } from './lab-module.js';
import { responsivePhoto, mountDeferredPhotos, landscapePhoto, evidencePhoto, galleryPhoto } from './responsive-photo.js?v=7';

const main = document.querySelector('#content');
mountDeferredPhotos(main);
const viewId = selectInquiryView(location.search);
const inquiryView = inquiryViews[viewId];
document.documentElement.dataset.inquiryView = viewId;
const notice = document.querySelector('#announcement');
const work = [...lessons, ...projects];
const byLesson = new Map(work.map(lesson => [lesson.id, lesson]));
const byConcept = new Map(concepts.map(concept => [concept.id, concept]));
const byLab = new Map(labs.map(lab => [lab.id, lab]));
const exploreState = { query: '', showAll: false };
let activeHash = '';
let cleanup;
let storeTimer;
let renderVersion = 0;
const learning = createLearningStore({
  lessons: work, concepts, labs, activityIds, namespace: viewId === 'recall' ? '' : viewId,
  onStorageError: () => {
    notice.textContent = '当前浏览器无法长期保存进度，请在复习页导出。';
  },
});
const { state } = learning;

const lessonUrl = id => '#/lesson/' + encodeURIComponent(id);
const conceptUrl = (id, origin) => '#/concept/' + encodeURIComponent(id) + (origin ? '?from=' + encodeURIComponent(origin) : '');
const labUrl = (id, query = {}) => '#/lab/' + encodeURIComponent(id) + (Object.keys(query).length ? '?' + new URLSearchParams(query) : '');
if ("scrollRestoration" in history) history.scrollRestoration = "manual";

const arrow = '<span aria-hidden="true">→</span>';
const doneCount = lesson => lesson.tasks.filter(task => state.answers[task.id]?.solved === true).length;
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
  const entry = recent || getTextbookPosition(viewId === 'recall' ? 'intro' : 'contours').entry;
  const title = viewId === 'recall' ? entry.title : inquiries[entry.id].question;
  const caption = viewId === 'recall' ? (recent ? '继续回顾' : '从绪论开始')
    : viewId === 'nearby' ? '从一个现象开始' : (recent ? '继续调查' : '打开第一份调查');
  const usesRainPhoto = viewId !== 'recall' && entry.id === 'contours';
  const homePhoto = usesRainPhoto
    ? responsivePhoto(evidencePhoto('puddle'), { alt: '雨后路面上的积水', loading: 'eager', sizes: '(max-width: 700px) 92vw, 480px' }) + '<figcaption>雨后路面实景 · Paul The Writer / CC0</figcaption>'
    : responsivePhoto(landscapePhoto, { alt: '塔拉河峡谷，近处是树丛，远处两侧山坡夹着深谷', loading: 'eager', sizes: '(max-width: 700px) 92vw, 480px' }) + '<figcaption>塔拉河峡谷 · Alexkom000 / CC BY 4.0</figcaption>';
  return `
    <section class="inquiry-home" aria-labelledby="hero-title">
      <div class="inquiry-home-copy">
        <p class="eyebrow">中图版（北京版） · 七年级上册</p>
        <h1 id="hero-title">${inquiryView.homeTitle}</h1>
        <p>${inquiryView.homeDescription}</p>
        <a class="button primary home-entry" href="${lessonUrl(entry.id)}"><span><small>${caption}</small><strong>${escape(title)}</strong></span>${arrow}</a>
      </div>
      <figure class="inquiry-home-image">
        ${homePhoto}
      </figure>
    </section>
    ${textbookDirectory(entry)}`;
}

function textbookDirectory(current = getTextbookPosition(state.lastLesson)?.entry || textbookEntries[0], standalone = false) {
  return `
    <section class="section book-directory" aria-label="七上课本目录">
      ${standalone ? '<div class="section-title book-title"><h1>七上课本目录</h1></div>' : sectionHeading('七上课本目录')}
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
  return `<a class="chapter-row" ${entry.kind === 'project' ? 'data-project' : ''} ${entry.id === currentId ? 'aria-current="location"' : ''} href="${lessonUrl(entry.id)}"><span>${prefix}${escape(entry.title)}</span><span>第 ${entry.page} 页</span></a>`;
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
    if (!element) continue;
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


function lessonNavigation({ entry, next }) {
  const label = !next ? '读到本册最后一项' : next.kind === 'project' ? '本章探究'
    : next.chapter !== entry.chapter && entry.chapter !== 0 ? '下一章' : '下一课';
  const href = next ? lessonUrl(next.id) : '#/textbook';
  return `<nav class="course-next" aria-label="继续按课本回顾" data-inquiry-section="next">
    <a class="button primary next-lesson" href="${href}"><span><small>${label}</small><strong>${escape(next?.title || '回看七上目录')}</strong></span>${arrow}</a>
  </nav>`;
}

function activityMarkup(lesson, activities) {
  return activities.map((activity, index) => {
    const id = activityKey(lesson.id, activity);
    const host = `<div class="inquiry-activity" data-activity="${id}"><p class="activity-wait" role="status">正在准备图和操作…</p></div>`;
    const gallery = activity.kind === 'lab' && activity.id === 'globe'
      ? '<section class="inline-mountain" data-inline-mountain hidden aria-label="山地照片"><h3 tabindex="-1" data-mountain-heading></h3><div class="photo-gallery" data-inline-photos></div></section>'
      : '';
    if (activity.placement) return `<section class="inquiry-outside" data-inquiry-section="${activity.placement}">
      <h2>${escape(activity.title)}</h2>${host}</section>`;
    if (index === 0) return host + gallery;
    if (activity.collapsible) return `<details class="inquiry-extra-activity inquiry-optional-experiment"
      data-inquiry-section="activity-${activity.kind}" data-remember="${id}">
      <summary>${escape(activity.title)}</summary>${host}${gallery}</details>`;
    const photo = activity.photo ? activityPhoto(topicViews[activity.photo.topic].photos[activity.photo.index]) : '';
    return `<section class="inquiry-extra-activity" data-inquiry-section="activity-${activity.kind}">
      <h3>${escape(activity.title)}</h3>${photo ? `<div class="inquiry-picture-pair">${host}${photo}</div>` : host}${gallery}</section>`;
  }).join('');
}

function activityPhoto(photo) {
  return `<figure class="inquiry-picture-note">
    ${responsivePhoto(galleryPhoto(photo), { alt: photo.alt, sizes: '(max-height: 500px) and (orientation: landscape) 39vw, (max-width: 700px) 92vw, 350px' })}
    <figcaption>剖面里的 A 是成排的白色雪峰，B 是雪峰以北、照片远处的青藏高原。哪一处更平缓？
      <small>国际空间站实拍 · NASA / ISS031-E-67020</small></figcaption>
  </figure>`;
}

function lessonNote(lesson, data) {
  if (viewId !== 'fieldwork' && !projects.includes(lesson)) return '';
  return `<details class="inquiry-note" data-remember="inquiry-note" data-inquiry-section="note">
    <summary>留一句我的判断</summary>
    <label for="project-note">${escape(data.compare)}</label>
    <textarea id="project-note" rows="2" maxlength="2000" placeholder="我现在觉得……我在图上看到……">${escape(typeof state.notes[lesson.id] === 'string' ? state.notes[lesson.id] : '')}</textarea>
  </details>`;
}

function showLesson(lesson, storedView) {
  const position = getTextbookPosition(lesson.id);
  const data = inquiries[lesson.id];
  const activities = lessonActivities[lesson.id];
  main.innerHTML = renderInquiry({
    entry: position.entry, textbook: textbookLabel(position.entry), data, viewId,
    activityMarkup: activityMarkup(lesson, activities.filter(activity => !activity.placement)),
    transferMarkup: activityMarkup(lesson, activities.filter(activity => activity.placement === 'transfer')),
    outsideMarkup: activityMarkup(lesson, activities.filter(activity => activity.placement === 'outside')),
    footer: lessonNavigation(position), note: lessonNote(lesson, data),
  });
  learning.recordVisit(lesson.id);
  const note = main.querySelector('#project-note');
  note?.addEventListener('input', () => learning.setRecord('notes', lesson.id, note.value));

  const session = { active: true, restore: true, disposers: [] };
  const stopRestoring = () => { session.restore = false; };
  const inputEvents = ['pointerdown', 'wheel', 'keydown'];
  for (const event of inputEvents) window.addEventListener(event, stopRestoring, { once: true, passive: true });
  session.disposers.push(() => {
    for (const event of inputEvents) window.removeEventListener(event, stopRestoring);
  });
  activities.forEach((activity, index) => {
    const key = activityKey(lesson.id, activity);
    const host = main.querySelector('[data-activity="' + key + '"]');
    const mount = () => mountInquiryActivity(host, lesson, activity, key, session, storedView);
    const panel = host.closest('[data-inquiry-section]');
    if (activity.collapsible) {
      panel.open = storedView?.details?.[key] ?? (activity.kind === 'lab' && Boolean(storedView?.mountain));
      if (panel.open) mount();
      else {
        const start = () => {
          if (!panel.open) return;
          panel.removeEventListener('toggle', start);
          mount();
        };
        panel.addEventListener('toggle', start);
      }
    } else if (index === 0 || storedView?.section === panel?.dataset.inquirySection || !('IntersectionObserver' in window)) mount();
    else {
      const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          observer.disconnect();
          mount();
        }
      }, { rootMargin: '180px 0px' });
      observer.observe(host);
      session.disposers.push(() => observer.disconnect());
    }
  });
  cleanup = () => {
    session.active = false;
    session.disposers.forEach(dispose => dispose());
  };
}

function inlineMountainGallery(section, route) {
  const heading = section.querySelector('[data-mountain-heading]');
  const gallery = section.querySelector('[data-inline-photos]');
  let dispose;
  return {
    open(id, focus) {
      const topic = topicViews[id];
      if (!topic?.photos?.length) return;
      section.hidden = false;
      heading.textContent = byConcept.get(id).title;
      dispose?.();
      const stored = learning.getView(route);
      const previous = stored?.mountain;
      dispose = mountPhotoGallery(gallery, topic.photos, previous?.id === id ? previous.index : 0,
        index => learning.saveView(route, { mountain: { id, index } }), { embedded: true });
      if (previous?.id !== id) learning.saveView(route, { mountain: { id, index: 0 } });
      if (focus) {
        section.scrollIntoView({ block: 'start' });
        heading.focus({ preventScroll: true });
      }
    },
    dispose() { dispose?.(); },
  };
}

async function mountInquiryActivity(host, lesson, activity, key, session, storedView) {
  const route = activeHash;
  const isActive = () => session.active && host.isConnected;
  try {
    if (activity.kind === 'lab') {
      const stateKey = 'lesson-' + lesson.id;
      const legacy = state.labs[activity.id];
      const params = new URLSearchParams(activity.mode ? { mode: activity.mode } : {});
      const legacyEntry = legacy && new URLSearchParams(legacy.entryKey).get('from') === lesson.id
        ? { ...legacy, entryKey: params.toString() } : undefined;
      const saved = learning.getView(route)?.labState ?? state.labs[stateKey] ?? legacyEntry;
      const section = host.nextElementSibling;
      const mountain = section?.matches('[data-inline-mountain]') ? inlineMountainGallery(section, route) : null;
      const fixedMode = ['earth-model', 'earth-motion'].includes(lesson.id) ? activity.mode : undefined;
      const runner = await mountLearningLab(host, byLab.get(activity.id), params, saved, stateKey,
        { inline: true, fixedMode, origin: route, onTopic: id => mountain?.open(id, true) }, isActive);
      if (!runner) return;
      if (mountain) {
        const alreadyOpen = learning.getView(route)?.mountain;
        if (alreadyOpen) mountain.open(alreadyOpen.id, false);
        session.disposers.push(() => mountain.dispose());
      }
      session.disposers.push(runner);
      if (storedView?.section && session.restore) restoreInquiryPosition(storedView);
      else if (activity === lessonActivities[lesson.id][0]) fitActivityStage(host);
    } else {
      const legacyWidget = ['chart', 'direction', 'evidence', 'opening'].includes(activity.kind) ? state.widgets[lesson.id] : undefined;
      const saved = state.activities[key] ?? legacyWidget;
      const dispose = await mountLessonVisual(host, activity, lesson.id, saved,
        settings => learning.setRecord('activities', key, settings), viewId, isActive);
      if (typeof dispose === 'function') session.disposers.push(dispose);
      if (isActive() && storedView?.section && session.restore) restoreInquiryPosition(storedView);
    }
  } catch (error) {
    if (!isActive()) return;
    console.error('Learning activity failed to mount', key, error);
    host.innerHTML = '<p class="activity-wait" role="status">这张图暂时没能打开。<button class="chip" type="button">重新加载</button></p>';
    host.querySelector('button').addEventListener('click', () => mountInquiryActivity(host, lesson, activity, key, session, storedView), { once: true });
  }
}

async function mountLearningLab(host, lab, params, saved, key, options, isActive) {
  const route = activeHash;
  const { mountLabUI } = await import(LAB_UI_MODULE);
  if (!isActive()) return;
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


function conceptLabMode(id) {
  return ['day-night', 'seasons', 'earth-axis'].includes(id) ? { mode: 'daylight' }
    : ['geo-latitude', 'geo-longitude'].includes(id) ? { mode: 'coordinates' } : {};
}

const conceptExamples = {
  legend: { kind: 'legend' },
  'map-purpose': { kind: 'legend' },
  'terrain-profile': { kind: 'rain' },
  'relative-height': { kind: 'rain' },
  'geographic-observation': { kind: 'opening', id: 'intro' },
  'solar-system': { kind: 'opening', id: 'earth-space' },
  'remote-sensing': { kind: 'opening', id: 'spaceflight' },
  continents: { kind: 'world' },
  'land-change-evidence': { kind: 'evidence', id: 'land-change' },
  'ocean-floor': { kind: 'evidence', id: 'project-seafloor' },
  'climate-chart': { kind: 'chart', id: 'climate' },
  precipitation: { kind: 'chart', id: 'climate' },
  'air-temperature': { kind: 'chart', id: 'climate' },
  forecast: { kind: 'chart', id: 'weather' },
  'population-density': { kind: 'chart', id: 'population' },
  trade: { kind: 'evidence', id: 'cooperation' },
};

function conceptExample(id) {
  return conceptExamples[id];
}

async function mountConceptExample(host, example, route) {
  const previous = cleanup;
  let dispose;
  cleanup = () => { previous?.(); dispose?.(); };
  try {
    dispose = await mountLessonVisual(host, example, '', learning.getView(route)?.example,
      settings => learning.saveView(route, { example: settings }), viewId, () => host.isConnected);
  } catch (error) {
    if (!host.isConnected) return;
    console.error('Concept example failed to open', error);
    host.textContent = '示意图暂时没能打开。';
  }
}

function showConcept(concept, query) {
  const origin = contextReturn(query.get('from'));
  const currentCard = conceptUrl(concept.id, origin.href);
  const edges = getRelations(concept.id);
  const links = new Map(edges.map(item => [item.id, item]));
  const lesson = byLesson.get(concept.lessonId);
  const topic = topicViews[concept.id];
  const example = conceptExample(concept.id);
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
      ${example ? '<section class="panel inquiry-concept-example" data-concept-example aria-label="看图回顾"></section>' : ''}
      <section class="panel concept-summary">
        <p>${escape(concept.text)}</p>
      </section>
      ${links.size || compareWith || directlyRelatedLab ? `<details class="panel course-details" data-remember="more-concepts"><summary>想多看一点</summary>
        <div class="stack concept-links">${relationshipLinks(importantIds, origin.href, recommendations)}</div>
        ${compareWith ? `<a href="${labUrl('terrain', { site: concept.id, siteB: compareWith.id, fromConcept: concept.id, fromCard: currentCard })}" class="text-link concept-experiment">和${escape(compareWith.title)}比地形 ${arrow}</a>`
          : directlyRelatedLab ? `<a href="${labUrl(directlyRelatedLab.id, { ...conceptLabMode(concept.id), fromConcept: concept.id, fromCard: currentCard })}" class="text-link concept-experiment">打开相关实验 ${arrow}</a>` : ''}
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
  const exampleHost = main.querySelector('[data-concept-example]');
  if (exampleHost) mountConceptExample(exampleHost, example, cardState);
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
        ${photo ? responsivePhoto(galleryPhoto(photo, { thumbnail: true }), { alt: '' }) : ''}
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
    <a href="#/practice/${lesson.id}">${escape(lesson.title)}</a><small>${doneCount(lesson)} / ${lesson.tasks.length} 题</small></div>`).join('')}</div>` : `<p class="empty">${empty}</p>`;
  main.innerHTML = `
    ${pageIntro('我的复习', '找回做过的课、再看没想通的题，也可以把进度带到另一台设备。')}
    <div class="lesson-shell">
      <div class="lesson-content">
        <section class="panel"><h2>再试一次</h2>${list(needsReview, '如果一道题想再查证，它所在的课会显示在这里。')}</section>
        <section class="panel"><h2>最近回顾</h2>${recent.length ? '<div class="review-list">' + recent.map(lesson => `<div class="review-item"><a href="${lessonUrl(lesson.id)}">${escape(lesson.title)}</a></div>`).join('') + '</div>' : '<p class="empty">打开过的课会出现在这里。</p>'}</section>
        <section class="panel"><h2>按课练习</h2><form class="review-practice">
          <label class="field-label" for="practice-lesson">选一课</label>
          <select id="practice-lesson" required><option value="">请选择</option>${textbookEntries.map(entry => `<option value="${entry.id}">${escape(entry.title)}</option>`).join('')}</select>
          <button class="button" type="submit">开始练习</button>
        </form></section>
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
  main.querySelector('.review-practice').addEventListener('submit', event => {
    event.preventDefault();
    const selected = main.querySelector('#practice-lesson').value;
    if (byLesson.has(selected)) location.hash = '#/practice/' + selected;
  });
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

function practice(lesson) {
  main.innerHTML = `${breadcrumb(lesson.title, '#/review', '复习')}
    ${pageIntro(lesson.title, '用刚才学过的方法想一想。', '按课练习')}
    <section class="panel">${lesson.tasks.map(taskHtml).join('')}</section>`;
  bindTasks(lesson.tasks);
}

function legend() {
  main.innerHTML = `${breadcrumb('常用地图图例')}${pageIntro('常用地图图例', '先点地图上的线、符号和文字，再看看它们各在告诉你什么。', '课本附录 · 第 125 页')}
    <section class="panel" data-legend-example></section>
    <div class="grid">${legendItems.map(item => `<article class="card"><div class="legend-item"><span aria-hidden="true" class="legend-symbol">${escape(item.symbol)}</span><h3>${escape(item.title)}</h3></div><p>${escape(item.text)}</p></article>`).join('')}</div>`;
  mountConceptExample(main.querySelector('[data-legend-example]'), { kind: 'legend' }, '#/legend');
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
  const nearest = page === 'lesson' && Array.from(main.querySelectorAll('[data-inquiry-section]'))
    .find(element => element.getBoundingClientRect().bottom > 36);
  const position = { scrollY, details: Object.fromEntries(details) };
  if (nearest) {
    position.section = nearest.dataset.inquirySection;
    position.offset = -nearest.getBoundingClientRect().top;
  }
  learning.saveView(activeHash, position);
  if (page === 'lesson' && byLesson.has(id)) {
    const previous = state.positions[id];
    if (previous?.scrollY !== position.scrollY || previous?.section !== position.section || JSON.stringify(previous?.details) !== JSON.stringify(position.details)) {
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

function restoreInquiryPosition(view) {
  if (!view?.section) return;
  const section = Array.from(main.querySelectorAll('[data-inquiry-section]'))
    .find(element => element.dataset.inquirySection === view.section);
  if (section) scrollBy(0, section.getBoundingClientRect().top + (view.offset ?? 0));
}

function render() {
  const next = location.hash.startsWith('#/') ? location.hash : '#/';
  const previous = activeHash;
  const version = ++renderVersion;
  clearTimeout(storeTimer);
  captureView();
  cleanup?.();
  cleanup = null;
  activeHash = next;
  learning.refresh();
  const { page, id, query } = routeParts(next);
  const lesson = page === 'lesson' ? byLesson.get(id) : null;
  const view = learning.getView(next) ?? (lesson ? state.positions[id] : null);
  document.documentElement.dataset.learningRoute = page;
  const activeTab = page === 'explore' || page === 'concept' ? 'explore' : page === 'review' || page === 'practice' ? 'review' : 'home';
  for (const link of document.querySelectorAll('[data-nav]')) {
    if (link.dataset.nav === 'home') link.textContent = page === 'lesson' ? '‹ 课本目录' : '课本';
    if (link.dataset.nav === activeTab) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  if (!page) main.innerHTML = home();
  else if (page === 'textbook') main.innerHTML = textbookDirectory(undefined, true);
  else if (lesson) {
    showLesson(lesson, view);
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
    const host = main.querySelector('[data-lab]');
    mountLearningLab(host, lab, query, view?.labState ?? state.labs[id], id, { origin: next },
      () => renderVersion === version).then(dispose => {
        if (!dispose) return;
        if (renderVersion !== version) { dispose(); return; }
        cleanup = dispose;
        if (view?.scrollY) scrollTo(0, view.scrollY);
        else fitActivityStage(host);
      }).catch(error => {
        if (renderVersion !== version) return;
        console.error(error);
        host.textContent = '实验暂时打不开，请刷新后再试。';
      });
  } else if (page === 'explore') {
    const storedQuery = view?.search;
    if (storedQuery) Object.assign(exploreState, storedQuery);
    explore();
  } else if (page === 'review') review();
  else if (page === 'practice' && byLesson.has(id)) practice(byLesson.get(id));
  else if (page === 'legend') legend();
  else if (page === 'sources') sources();
  else main.innerHTML = `${pageIntro('这个页面没有找到', '可以从课本目录重新出发。')}<a class="button primary" href="#/textbook">打开课本</a>`;
  restoreView(view);
  const heading = main.querySelector('h1');
  document.title = heading ? heading.textContent + ' · 地理实验台' : '地理实验台 · 七年级上册';
  scrollTo(0, view?.scrollY || 0);
  requestAnimationFrame(() => {
    if (activeHash !== next) return;
    if (lesson && view?.section) restoreInquiryPosition(view);
    else if (view?.scrollY) scrollTo(0, view.scrollY);
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
