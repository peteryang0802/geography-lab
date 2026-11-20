import { lessons, projects, concepts, getRelations, labs } from './catalog.js';
import { FLOW_SOURCES } from './flow-model.js';
import { topicViews } from './topic-views.js?v=5';
import { mountPhotoGallery } from './photo-gallery.js?v=8';
import { mountMapDirection } from './map-direction.js?v=6';
import { getTextbookPosition, textbookChapters, textbookEntries } from './textbook.js';
import { renderTextbookLegend } from './textbook-legend.js';
import { createLearningStore } from './learning-state.js';
import { assessmentLabels, assessmentState, paintAssessment } from './assessment.js?v=3';
import { inquiryViews, renderInquiry, selectInquiryView, bindInquiryPrediction, renderComparison, escapeHtml as escape } from './inquiry-view.js?v=7';
import { inquiries } from './inquiries.js?v=6';
import { lessonActivities, activityIds, activityKey, mountLessonVisual } from './lesson-activities.js?v=6';
import { fitActivityStage } from './activity-stage.js';
import { LAB_UI_MODULE } from './lab-module.js';
import { volumeById, termEntryById, extendedEntries, entriesForVolume, termUrl, renderCourseHub, renderVolumeDirectory } from './term-catalog.js';
import { responsivePhoto, mountDeferredPhotos, landscapePhoto, evidencePhoto, galleryPhoto } from './responsive-photo.js?v=7';
import { lessonReadingPractice, renderReadingPractice, bindReadingPractice } from './reading-practice.js';
import { bindLessonFlow, lessonFlow } from './lesson-flow.js?v=4';
import { alignedPractice, alignedTransfer } from './lesson-practice-transfer.js?v=2';
import { mountParentSettings } from './parent-settings.js';
import { renderTransferMaterial, mountTransferMaps } from './transfer-material.js?v=1';

const main = document.querySelector('#content');
mountDeferredPhotos(main);
const viewId = selectInquiryView(location.search);
const inquiryView = inquiryViews[viewId];
document.documentElement.dataset.inquiryView = viewId;
const notice = document.querySelector('#announcement');
const work = [...lessons, ...projects];
const allLessons = [...work, ...extendedEntries];
const byLesson = new Map(work.map(lesson => [lesson.id, lesson]));
function activeTasks(lesson) {
  const transfer = alignedTransfer(lesson.id);
  if (lesson.term) return lesson.checks.length ? lesson.checks : [transfer || lesson.tasks[0]];
  return [alignedPractice(lesson.id) || lesson.tasks[0], transfer || lesson.tasks[1]];
}
const tasksByLesson = new Map(allLessons.map(lesson => {
  const tasks = new Map([...activeTasks(lesson), ...lesson.tasks].map(task => [task.id, task]));
  return [lesson.id, [...tasks.values()]];
}));
const byConcept = new Map(concepts.map(concept => [concept.id, concept]));
const byLab = new Map(labs.map(lab => [lab.id, lab]));
const loadedVolumes = new Map();
const volumeRetries = new Map();
const globeTopics = new Map([['亚洲', 'terrain'], ['东南亚', 'circulation'], ['极地地区', 'daylight']]);
const photoTopics = new Map([
  ['亚洲', { gallery: 'himalayas' }], ['欧洲西部', {gallery: 'alps'}],
  ['美国', { gallery: 'cordillera', picks: [1] }], ['青藏地区', { gallery: 'himalayas', picks: [0, 2] }],
]);
const exploreState = { query: '', showAll: false };
let activeHash = '';
let cleanup;
let storeTimer;
let renderVersion = 0;
let resettingLearning = false;
const learning = createLearningStore({
  lessons: allLessons.map(lesson => ({ ...lesson, tasks: tasksByLesson.get(lesson.id) })), concepts, labs,
  activityIds: [...activityIds, ...work.flatMap(lesson => ['-reading-practice', '-opening-guess'].map(kind => lesson.id + kind))],
  namespace: viewId === 'recall' ? '' : viewId,
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

function pageIntro(title, description, eyebrow = '', extraClass = '') {
  return `<div class="page-intro ${extraClass}">${eyebrow ? `<p class="eyebrow">${escape(eyebrow)}</p>` : ''}<h1>${escape(title)}</h1>${description ? `<p>${escape(description)}</p>` : ''}</div>`;
}

function utilityFlow(intro, steps, railTitle) {
  main.innerHTML = `<article class="geo-lesson geo-extra-learning">${intro}${lessonFlow(steps, railTitle)}</article>`;
  const route = activeHash;
  return bindLessonFlow(main, learning.getView(route)?.flowStep,
    flowStep => learning.saveView(route, { flowStep }));
}

function textbookLabel(entry) {
  const { chapter } = getTextbookPosition(entry.id);
  const part = entry.kind === 'project' ? '主题探究' : entry.section ? `第 ${entry.section} 节` : '';
  return [chapter.prefix, chapter.id ? chapter.title : '', part].filter(Boolean).join(' · ');
}

function sevenUpperHome(current) {
  const historic = textbookEntries.filter(entry => state.visits[entry.id])
    .sort((a, b) => state.visits[b.id] - state.visits[a.id])[0];
  const recent = getTextbookPosition(state.lastLesson)?.entry || historic;
  const entry = current || recent || getTextbookPosition(viewId === 'recall' ? 'intro' : 'contours').entry;
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
        <a class="button primary home-entry" data-volume-entry="${entry.id}" aria-current="location" href="${lessonUrl(entry.id)}"><span><small>${caption}</small><strong>${escape(title)}</strong></span>${arrow}</a>
      </div>
      <figure class="inquiry-home-image">
        ${homePhoto}
      </figure>
    </section>
    ${textbookDirectory(entry, false, entry.id)}`;
}

function textbookDirectory(current = getTextbookPosition(state.lastLesson)?.entry ||
  textbookEntries.filter(entry => state.visits[entry.id]).sort((a, b) => state.visits[b.id] - state.visits[a.id])[0] || textbookEntries[0], standalone = false, featured) {
  return `
    <section class="section book-directory" aria-label="七上课本目录">
      ${standalone ? '<div class="section-title book-title"><h1>七上课本目录</h1></div>' : sectionHeading('七上课本目录')}
      <div class="book-chapters">${textbookChapters.filter(chapter => chapter.entries.some(entry => entry.id !== featured)).map(chapter => `
        <details class="chapter book-chapter" data-remember="chapter-${chapter.id}" ${current.chapter === chapter.id ? 'open' : ''}>
          <summary><span>${escape(chapter.prefix)}</span><strong>${escape(chapter.title)}</strong></summary>
          <div class="chapter-entries">${chapter.entries.filter(entry => entry.id !== featured).map(entry => chapterLink(entry, current.id)).join('')}</div>
        </details>`).join('')}
        <a class="chapter chapter-row book-appendix" href="#/legend"><span>附录 · 常用地图图例</span><span>第 125 页</span></a>
      </div>
    </section>`;
}

function chapterLink(entry, currentId) {
  const prefix = entry.kind === 'project' ? '探究 · ' : entry.section ? `第 ${entry.section} 节 · ` : '';
  const evidence = state.activities[entry.id + '-reading-practice']?.outcome;
  const progress = evidence === 'independent' ? '独立找过证据 · ' : evidence === 'guided' ? '核对后找到证据 · '
    : doneCount(byLesson.get(entry.id)) > 0 ? '练习曾答对 · ' : state.completed[entry.id] ? '做过观察 · '
      : state.visits[entry.id] ? '看过 · ' : '';
  return `<a class="chapter-row" data-volume-entry="${entry.id}" ${entry.kind === 'project' ? 'data-project' : ''} ${entry.id === currentId ? 'aria-current="location"' : ''} href="${lessonUrl(entry.id)}"><span>${prefix}${escape(entry.title)}</span><span>${progress}第 ${entry.page} 页</span></a>`;
}

function relationshipLinks(ids, origin, explanations) {
  return ids.filter(id => byConcept.has(id)).map(id => {
    const concept = byConcept.get(id);
    const edge = explanations?.get(id);
    return `<a class="link-row" href="${conceptUrl(id, origin)}"><strong>${escape(concept.title)} ${arrow}</strong>
      <small>${escape(edge ? edge.type + ' · ' + edge.reason : byLesson.get(concept.lessonId)?.title || concept.text)}</small></a>`;
  }).join('');
}

function taskHtml(task, index, inline = false, materialId) {
  const selected = state.answers[task.id]?.option;
  const active = Number.isInteger(selected) && task.options[selected];
  const correct = selected === task.answer;
  const visual = materialId ? renderTransferMaterial(materialId) : '';
  return `<article class="task" data-task="${escape(task.id)}"${active ? ` data-result="${correct ? 'correct' : 'retry'}"` : ''}>
    <header>${inline ? '' : `<span aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>`}<h3 id="task-${escape(task.id)}">${escape(task.prompt)}</h3></header>
    <div class="geo-transfer-layout${visual ? ' has-visual' : ''}">${visual}<div class="geo-transfer-controls">
    ${task.evidence ? (inline ? `<details class="geo-material-fold" data-remember="material-${escape(task.id)}" ${visual ? '' : 'open'}>
      <summary>${visual ? '对照文字记录' : '本题材料'}</summary>${renderComparison(task.evidence)}
      </details>` : renderComparison(task.evidence)) : ''}
    <div class="options" role="group" aria-labelledby="task-${escape(task.id)}">
      ${task.options.map((option, i) => `<button type="button" class="option ${i === selected && !correct ? 'try-again' : ''}" aria-pressed="${i === selected}" data-option="${i}"><span class="option-letter" aria-hidden="true">${String.fromCharCode(65 + i)}</span>${escape(option.label)}</button>`).join('')}
    </div>
    <p class="feedback ${active && !correct ? 'try-again' : ''}" aria-live="polite" ${active ? `data-result="${correct ? 'correct' : 'retry'}"` : 'hidden'}>${active ? escape((correct ? '找对了。' : '再看看。') + task.options[selected].feedback) : ''}</p>
    <p class="geo-assessment-label" data-assessment-label></p>
    ${task.hint ? `<details data-assessment-hint data-remember="hint-${escape(task.id)}"><summary>看看提示</summary><p>${escape(task.hint)}</p></details>` : ''}
    </div></div>
  </article>`;
}

function bindTasks(tasks) {
  for (const task of tasks) {
    const element = document.querySelector('[data-task="' + task.id + '"]');
    if (!element) continue;
    const options = [...element.querySelectorAll('[data-option]')];
    const feedback = element.querySelector('.feedback');
    const hint = element.querySelector('[data-assessment-hint]');
    hint?.addEventListener('toggle', () => {
      if (hint.open) learning.hintTask(task.id);
    });
    paintAssessment(element, assessmentState(state.answers[task.id], task.answer));
    for (const button of options) {
      button.addEventListener('click', () => {
        const option = Number(button.dataset.option);
        const correct = option === task.answer;
        if (hint?.open) learning.hintTask(task.id);
        const record = learning.answerTask(task.id, option, correct);
        for (const item of options) {
          const chosen = item === button;
          item.setAttribute('aria-pressed', String(chosen));
          item.classList.toggle('try-again', chosen && !correct);
        }
        feedback.textContent = (correct ? '找对了。' : '再看看。') + task.options[option].feedback;
        feedback.classList.toggle('try-again', !correct);
        feedback.hidden = false;
        element.dataset.result = feedback.dataset.result = correct ? 'correct' : 'retry';
        paintAssessment(element, assessmentState(record, task.answer));
        if (element.closest('.geo-step')) {
          const materials = element.querySelector('.geo-material-fold');
          if (!correct && materials && !element.querySelector('[data-transfer-material]')) materials.open = true;
          if (feedback.getBoundingClientRect().bottom > innerHeight - 8) feedback.scrollIntoView({ block: 'nearest' });
        }
        const progress = main.querySelector('[data-task-count]');
        if (progress) {
          const completed = tasks.filter(item => state.answers[item.id]?.solved === true).length;
          progress.textContent = `曾答对 ${completed} / ${tasks.length} 道练习题`;
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

function activityMarkup(lesson, activities, first = true) {
  return activities.map((activity, index) => {
    const id = activityKey(lesson.id, activity);
    const host = `<div class="inquiry-activity" data-activity="${id}"><p class="activity-wait" role="status">正在准备图和操作…</p></div>`;
    const gallery = activity.kind === 'lab' && activity.id === 'globe'
      ? '<section class="inline-mountain" data-inline-mountain hidden aria-label="山地照片"><h3 tabindex="-1" data-mountain-heading></h3><div class="photo-gallery" data-inline-photos></div></section>'
      : '';
    if (activity.placement) return `<section class="inquiry-outside" data-inquiry-section="${activity.placement}">
      <h2>${escape(activity.title)}</h2>${host}</section>`;
    if (first && index === 0) return host + gallery;
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
  const [openingActivity, ...furtherActivities] = activities.filter(activity => !activity.placement);
  const extraActivities = furtherActivities.filter(activity => !activity.collapsible);
  const optionalActivities = activityMarkup(lesson, furtherActivities.filter(activity => activity.collapsible), false);
  const activitySteps = extraActivities.map((activity, index) => ({
    id: 'activity-' + activity.kind,
    label: activity.title,
    content: activityMarkup(lesson, [activity], false) + (index === extraActivities.length - 1 ? optionalActivities : ''),
  }));
  const proofKey = lesson.id + '-reading-practice';
  const plan = lessonReadingPractice(lesson, data);
  const tasks = activeTasks(lesson);
  const route = activeHash;
  const practices = [renderReadingPractice(plan, state.activities[proofKey]), ...tasks.map((task, index) => taskHtml(task, index, true, index === 1 ? lesson.id : undefined))];
  main.innerHTML = renderInquiry({
    entry: position.entry, textbook: textbookLabel(position.entry), data, viewId,
    activityMarkup: activityMarkup(lesson, [openingActivity]) + (activitySteps.length ? '' : optionalActivities),
    activitySteps,
    practices,
    transferMarkup: activityMarkup(lesson, activities.filter(activity => activity.placement === 'transfer')),
    outsideMarkup: activityMarkup(lesson, activities.filter(activity => activity.placement === 'outside')),
    footer: lessonNavigation(position), note: lessonNote(lesson, data),
  });
  learning.recordVisit(lesson.id);
  const flow = bindLessonFlow(main, storedView?.flowStep ?? storedView?.section, flowStep => learning.saveView(route, { flowStep }));
  const guessKey = lesson.id + '-opening-guess';
  bindInquiryPrediction(main, position.entry, state.activities[guessKey]?.selected, selected =>
    learning.setRecord('activities', guessKey, { selected }));
  bindReadingPractice(main, plan, state.activities[proofKey], value => learning.setRecord('activities', proofKey, value));
  bindTasks(tasks);
  const unmountTransfer = mountTransferMaps(main);
  flow.verifyRestored();
  const note = main.querySelector('#project-note');
  note?.addEventListener('input', () => learning.setRecord('notes', lesson.id, note.value));

  const session = { active: true, restore: true, disposers: [] };
  const stopRestoring = () => { session.restore = false; };
  const inputEvents = ['pointerdown', 'wheel', 'keydown'];
  for (const event of inputEvents) window.addEventListener(event, stopRestoring, { once: true, passive: true });
  session.disposers.push(() => {
    for (const event of inputEvents) window.removeEventListener(event, stopRestoring);
  });
  activities.forEach(activity => {
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
    } else if (storedView?.section === panel?.dataset.inquirySection || !('IntersectionObserver' in window)) mount();
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
    unmountTransfer();
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
        settings => {
          learning.setRecord('activities', key, settings);
          if (activity.kind === 'transfer' && settings.compared) learning.markCompleted(lesson.id);
        }, viewId, isActive);
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

async function mountLearningLab(host, lab, params, saved, key, options, isActive, onSettings) {
  const route = activeHash;
  const { mountLabUI } = await import(LAB_UI_MODULE);
  if (!isActive()) return;
  let mounted = false;
  const dispose = mountLabUI(host, lab, params, saved, settings => {
    learning.saveView(route, { labState: settings });
    if (mounted) learning.setRecord('labs', key, settings);
    onSettings?.(settings);
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
  if (page === 'lesson' && (byLesson.has(id) || termEntryById.has(id)) || page === 'lab' && byLab.has(id) || page === 'concept' && byConcept.has(id)) return route;
  if (!id && ['review', 'explore', 'legend', 'textbook'].includes(page)) return route;
  return null;
}

function courseReturn(query, id) {
  const route = acceptedOrigin(query.get('from'));
  if (!route) return null;
  const origin = routeParts(route);
  return origin.page === 'lesson' && origin.id === id ? null : route;
}

function contextReturn(from) {
  let origin = acceptedOrigin(from);
  for (let depth = 0; depth < 7 && origin; depth++) {
    const { page, id, query } = routeParts(origin);
    if (page === 'lesson') return { href: origin, label: '返回《' + (byLesson.get(id) || termEntryById.get(id)).title + '》' };
    if (page === 'lab') return { href: origin, label: '返回' + byLab.get(id).title };
    if (page === 'concept') return { href: origin, label: '返回《' + byConcept.get(id).title + '》' };
    if (page === 'review') return { href: origin, label: '返回复习' };
    if (page === 'legend') return { href: origin, label: '返回图例' };
    if (page === 'textbook') return { href: origin, label: '返回课本目录' };
    if (page === 'explore') return { href: origin, label: '返回知识网' };
    origin = acceptedOrigin(query.get('from'));
  }
  return { href: '#/explore', label: '返回知识网' };
}

function labReturn(lab, query) {
  const direct = acceptedOrigin(query.get('returnTo'));
  if (direct) return contextReturn(direct);
  const originCard = byConcept.get(query.get('fromConcept') || '');
  if (originCard) {
    const cardUrl = conceptUrl(originCard.id);
    const suppliedCard = acceptedOrigin(query.get('fromCard'));
    return { href: suppliedCard?.startsWith(cardUrl + '?from=') ? suppliedCard : cardUrl, label: '返回' + originCard.title };
  }
  if (query.get('fromGlobe') === 'terrain') return { href: labUrl('globe', { mode: 'terrain' }), label: '返回地球仪' };
  const back = byLesson.get(query.get('from')) || byLesson.get(lab.lessonId);
  return back ? { href: lessonUrl(back.id), label: '返回《' + back.title + '》' }
    : { href: '#/textbook', label: '返回课本目录' };
}

function renderNavigation(page, id, query, lessonTerm) {
  let back;
  if (lessonTerm) {
    const origin = courseReturn(query, id);
    back = origin ? { href: origin, label: routeParts(origin).page === 'lesson' ? '回原课' : contextReturn(origin).label }
      : { href: termUrl(lessonTerm), label: '本册目录' };
  } else if (page === 'term' || page === 'textbook') back = { href: '#/', label: '四册目录' };
  else if (page === 'concept') back = contextReturn(query.get('from'));
  else if (page === 'practice') back = { href: '#/review', label: '返回复习' };
  else if (page === 'legend') {
    const term = volumeById.get(query.get('term'))?.id ?? '7a';
    back = { href: termUrl(term), label: '本册目录' };
  } else if (page === 'lab' && byLab.has(id)) back = labReturn(byLab.get(id), query);
  else if (page === 'sources') back = { href: '#/textbook', label: '返回课本目录' };

  document.documentElement.toggleAttribute('data-learning-context', Boolean(back));
  const active = page === 'explore' ? 'explore' : page === 'review' ? 'review' : 'home';
  for (const link of document.querySelectorAll('[data-nav]')) {
    const home = link.dataset.nav === 'home';
    if (home) {
      link.href = back?.href ?? '#/';
      link.textContent = back ? '← ' + back.label : '四册';
      link.toggleAttribute('data-context-return', Boolean(back) && page === 'concept');
    }
    if (!back && link.dataset.nav === active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
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

const conceptQuestions = {
  'map-direction': '面对不同方向时，地图上的北还在原来的位置吗？',
  legend: '校园图上的符号，分别代表什么？',
  'map-purpose': '想在校园里找路，地图上哪几项信息能帮你？',
  'terrain-profile': '从侧面看，哪一小段坡的升降更快？',
  'relative-height': '沿山坡往上走，两点之间的高差怎么找？',
  'geographic-observation': '图中哪一处线索值得你到实地看一看？',
  'solar-system': '在示意图上，地球与太阳怎么排列？',
  'remote-sensing': '从空中观察，能认出地面上的哪些地物？',
  continents: '转着看世界地图，大洲和大洋怎样相间分布？',
  'land-change-evidence': '哪条材料能帮助判断陆地和海洋的位置曾经改变？',
  'ocean-floor': '从大陆边缘走向大洋深处，海底地形怎么变？',
  'climate-chart': '一张气候图上，怎么分别读气温和降水？',
  precipitation: '哪个月的降水最多？你在图上看到了什么？',
  'air-temperature': '想找最高月平均气温，应该看哪一条线？',
  forecast: '天气资料里的哪些变化，能帮助你决定出门准备什么？',
  'population-density': '要比较哪里人住得更密，图上要看哪些数？',
  trade: '从材料中哪里能看出，不同地方在交换商品？',
  himalayas: '从山谷到山脊，冰雪主要分布在哪些位置？',
  alps: '冰川和岩壁附近，哪些线索说明山区起伏大？',
  cordillera: '在不同照片里，怎样分清谷底、岩壁和顶部？',
  andes: '在山峰、山脊和谷地之间，怎样判断哪里最高？',
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
  const currentCard = activeHash;
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

  const intro = pageIntro(concept.title, '', lesson ? '教材 · ' + lesson.title : '', 'concept-page-intro');
  const visual = `
      ${concept.id === 'map-direction' ? '<section class="panel direction-panel" data-map-direction aria-label="地图方向示意"></section>' : ''}
      ${topic?.photos?.length ? '<section class="panel photo-gallery" data-gallery aria-label="观察图片"></section>' : ''}
      ${example ? '<section class="panel inquiry-concept-example" data-concept-example aria-label="看图回顾"></section>' : ''}`;
  const explanation = `
      <section class="panel concept-summary">
        <p>${escape(concept.text)}</p>
      </section>
      ${links.size || compareWith || directlyRelatedLab ? `<details class="panel course-details" data-remember="more-concepts"><summary>想多看一点</summary>
        <div class="stack concept-links">${relationshipLinks(importantIds, currentCard, recommendations)}</div>
        ${compareWith ? `<a href="${labUrl('terrain', { site: concept.id, siteB: compareWith.id, fromConcept: concept.id, fromCard: currentCard })}" class="text-link concept-experiment">和${escape(compareWith.title)}比地形 ${arrow}</a>`
          : directlyRelatedLab ? `<a href="${labUrl(directlyRelatedLab.id, { ...conceptLabMode(concept.id), fromConcept: concept.id, fromCard: currentCard })}" class="text-link concept-experiment">打开相关实验 ${arrow}</a>` : ''}
        ${origin.href === '#/explore' && otherIds.length ? `<details class="other-relations" data-remember="all-relations"><summary>查看全部联系</summary><div class="stack">${relationshipLinks(otherIds, currentCard, links)}</div></details>` : ''}
      </details>` : ''}
      <details class="panel concept-tools course-details" data-remember="concept-tools"><summary>查课本或收藏</summary>
        <div class="actions">
          ${lesson ? `<a href="${lessonUrl(lesson.id)}?from=${encodeURIComponent(currentCard)}" class="button">打开《${escape(lesson.title)}》</a>` : ''}
          <button class="button" type="button" data-bookmark aria-pressed="${state.saved.includes(concept.id)}">${state.saved.includes(concept.id) ? '已收藏' : '收藏知识点'}</button>
        </div>
      </details>`;
  const question = conceptQuestions[concept.id] || topic?.photos?.[0]?.cue;
  if (question && visual.trim()) {
    utilityFlow(intro, [
      { id: 'observe', label: '观察线索', content: `<p class="geo-core-question">${escape(question)}</p>${visual}`, next: '核对这个知识点' },
      { id: 'explain', label: '说清知识点', content: explanation },
    ], '知识卡进度');
  } else {
    main.innerHTML = `<article class="geo-utility concept-view">${intro}${explanation}</article>`;
  }
  const cardState = conceptUrl(concept.id);
  const direction = main.querySelector('[data-map-direction]');
  if (direction) mountMapDirection(direction, learning.getView(cardState)?.direction,
    settings => learning.saveView(cardState, { direction: settings }));
  const gallery = main.querySelector('[data-gallery]');
  if (gallery) cleanup = mountPhotoGallery(gallery, topic.photos, learning.getView(cardState)?.galleryIndex,
    index => learning.saveView(cardState, { galleryIndex: index }), { embedded: true });
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
    <article class="geo-utility">
    ${pageIntro('知识网', '找一个地方，或者问一个读图问题。', '', 'concept-page-intro')}
    <div class="search-box">
      <label class="field-label" for="search">搜索地名、概念或课次</label>
      <input class="search-input" type="search" id="search" placeholder="试试 喜马拉雅、坡陡、冬季风">
    </div>
    <div class="mini-actions" aria-label="常用查找">${['山脉', '气候', '经纬', '地图'].map(term => '<button class="chip" type="button" data-term="' + term + '">' + term + '</button>').join('')}</div>
    <p class="results-label" id="results-count" aria-live="polite"></p><div id="results" class="grid"></div>
    <div class="actions"><button class="button" type="button" data-show-all>浏览全部知识点</button></div></article>`;
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
    work.map(lesson => ({ title: lesson.title, text: lesson.intro, titleOfLesson: '七上课本', href: lessonUrl(lesson.id) + '?from=%23%2Fexplore' })),
    extendedEntries.map(lesson => ({ title: lesson.title, text: lesson.chapter, titleOfLesson: volumeById.get(lesson.term).title, href: lessonUrl(lesson.id) + '?from=%23%2Fexplore' })),
    searchableScenes.map(scene => ({ ...scene, href: scene.href + '&returnTo=%23%2Fexplore', titleOfLesson: '转动地球仪' })),
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
  const resume = allLessons.find(lesson => lesson.id === state.resume?.lessonId);
  const resumeRoute = resume && state.resume.route;
  const needsReview = allLessons.flatMap(lesson => tasksByLesson.get(lesson.id)
    .filter(task => assessmentState(state.answers[task.id], task.answer) === 'retry')
    .map(task => ({ lesson, task })));
  const recent = allLessons.filter(lesson => lesson !== resume && state.visits[lesson.id])
    .sort((a, b) => Number(state.visits[b.id]) - Number(state.visits[a.id])).slice(0, 8);
  const retryList = needsReview.length ? `<div class="review-list">${needsReview.map(({ lesson, task }) => `<div class="review-item">
    <a href="#/practice/${lesson.id}?task=${encodeURIComponent(task.id)}">${escape(lesson.title)}${task.prompt ? ' · ' + escape(task.prompt) : ''}</a><small>${assessmentLabels.retry}</small></div>`).join('')}</div>`
    : '<p class="empty">答错后，可以在这里打开原题和材料再试。</p>';
  main.innerHTML = `
    <article class="geo-utility">${pageIntro('我的复习', '')}
    ${resume ? `<a class="button primary volume-resume" href="${escape(resumeRoute)}"><span><small>继续上次</small><strong>${escape(resume.title)}</strong></span>${arrow}</a>` : ''}
    <div class="lesson-shell geo-review-menu">
      <div class="lesson-content">
        <section class="panel"><h2>再试一次</h2>${retryList}</section>
        ${recent.length ? '<details class="panel course-details" data-remember="review-recent"><summary>最近看过</summary><div class="review-list">' + recent.map(lesson => `<div class="review-item"><a href="${lessonUrl(lesson.id)}?from=%23%2Freview">${escape(lesson.title)}</a></div>`).join('') + '</div></details>' : ''}
        <section class="panel"><h2>按课练习</h2><form class="review-practice">
          <label class="field-label" for="practice-lesson">选一课</label>
          <select id="practice-lesson" required><option value="">请选择</option>${['7a', '7b', '8a', '8b'].map(term => `<optgroup label="${volumeById.get(term).title}">${(term === '7a' ? textbookEntries : entriesForVolume(term)).map(entry => `<option value="${entry.id}">${escape(entry.title)}</option>`).join('')}</optgroup>`).join('')}</select>
          <button class="button ${resume ? '' : 'primary'}" type="submit">开始练习</button>
        </form></section>
      </div>
      <aside class="lesson-aside">
        <section class="panel"><h2>收藏知识点</h2>
          ${state.saved.length ? '<div class="stack">' + relationshipLinks(state.saved, '#/review') + '</div>' : '<p class="empty">在知识卡上点“收藏知识点”后，就能在这里找到它。</p>'}</section>
        <details class="panel course-details" data-remember="review-backup"><summary>备份学习进度</summary><p>进度保存在当前浏览器。</p>
          <div class="mini-actions"><button type="button" class="button" id="export">导出</button><button type="button" class="button" id="import">导入</button></div>
          <input type="file" id="import-file" accept=".json,application/json" hidden><p id="import-feedback" role="status"></p>
        </details>
      </aside>
    </div></article>`;
  main.querySelector('.review-practice').addEventListener('submit', event => {
    event.preventDefault();
    const selected = main.querySelector('#practice-lesson').value;
    if (byLesson.has(selected) || termEntryById.has(selected)) location.hash = '#/practice/' + selected;
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
      main.querySelector('[data-remember="review-backup"]').open = true;
      main.querySelector('#import-feedback').textContent = '学习进度已合并。';
    } catch {
      main.querySelector('#import-feedback').textContent = '无法读入。请选择从地理实验台导出的进度文件。';
      input.value = '';
    }
  });
}

function practice(lesson, taskId) {
  const intro = pageIntro(lesson.title, '', '按课练习');
  const available = tasksByLesson.get(lesson.id);
  const selected = available.find(task => task.id === taskId);
  const tasks = selected ? [selected] : available;
  const terminal = activeTasks(lesson)[1].id;
  if (tasks.length === 1) {
    main.innerHTML = `<article class="geo-lesson geo-extra-learning geo-single-practice">${intro}${taskHtml(tasks[0], 0, true,
      tasks[0].id === terminal ? lesson.id : undefined)}</article>`;
  } else {
    const flow = utilityFlow(intro, tasks.map((task, index) => ({
      id: 'practice-' + (index + 1), label: '练习 ' + (index + 1), content: taskHtml(task, index, true,
        task.id === terminal ? lesson.id : undefined),
      next: index < tasks.length - 1 ? '下一题' : '',
    })), '练习进度');
    bindTasks(tasks);
    flow.verifyRestored();
  }
  if (tasks.length === 1) bindTasks(tasks);
  cleanup = mountTransferMaps(main);
}

function legend(query) {
  const volume = volumeById.get(query.get('term')) ?? volumeById.get('7a');
  const intro = pageIntro('常用地图图例', '', volume.title + ' · 课本附录 · 第 ' + volume.legendPage + ' 页');
  utilityFlow(intro, [
    {id: 'symbols', label: '认课本符号', next: '去校园图上找',
      content: `<p class="geo-core-question">地图上的线和点，各代表什么地物？</p>
        <section class="panel" aria-label="课本图例示例">${renderTextbookLegend(volume.id, true)}</section>
        <details class="panel course-details" data-remember="legend-reference"><summary>查本册全部图例</summary>${renderTextbookLegend(volume.id)}</details>`},
    {id: 'campus', label: '在校园图核对',
      content: '<section class="panel" data-legend-example aria-label="校园地图练习"></section>'},
  ], '图例进度');
  mountConceptExample(main.querySelector('[data-legend-example]'), { kind: 'legend' }, activeHash);
}

const experimentPlans = {
  contour: ['哪条山路有一小段更陡？', '两段路走同样远时，高度变化越大，坡越陡。看剖面图时，先比较横向距离，再比较高度变化。'],
  terrain: ['并排放两处山地，怎样比高低才公平？', '先确认两张剖面图使用同一纵轴尺度和高程色阶，再比较起伏和海拔。这里的剖面是教学示意。'],
  coordinates: ['两个地点只知道纬度，能在地球仪上分清它们吗？', '纬度说明地点在赤道南北多远。经度说明地点在本初子午线东西多少度。用经纬线的交点定位。'],
  daylight: ['北京附近在一天里的什么时刻转进地球仪的亮面？', '先认出向着太阳的亮面，再看同一个地点随地球自转怎样从亮面进入暗面。'],
  terrainGlobe: ['转动地球仪，哪里出现连成一片的山地？', '先从地球仪找山地的大致位置和延伸方向。要读出海拔，拿同一处的位置去对照分层设色图及图例。'],
  currents: ['海水往哪边流？怎样区分暖流和寒流？', '用箭头读流向，再用图例认暖流、寒流。同一片海上的箭头可能指向不同方向。'],
  monsoon: ['把冬季和夏季对照，季风吹去的方向怎样变？', '先认海陆，再顺着箭头读风吹去的方向。把两季的方向并排比较。'],
};

function showLab(lab, query, route, view, version) {
  const intro = pageIntro(lab.title, '', '地理实验');
  const experimentKey = settings => {
    if (lab.id !== 'globe') return lab.id;
    if (settings.mode === 'terrain') return 'terrainGlobe';
    if (settings.mode === 'circulation') return settings.flow === 'monsoon' ? 'monsoon' : 'currents';
    return settings.mode === 'daylight' ? 'daylight' : 'coordinates';
  };
  const saved = view?.labState ?? state.labs[lab.id];
  const first = experimentPlans[experimentKey({
    mode: query.get('mode') || saved?.mode, flow: query.get('flow') || saved?.flow,
  })];
  utilityFlow(intro, [
    {id: 'try', label: '动手观察', next: '整理刚才的方法',
      content: `<p class="geo-core-question" data-lab-question>${escape(first[0])}</p><div data-lab></div>`},
    {id: 'method', label: '整理实验方法',
      content: `<div class="geo-method"><h3>下次用这个方法</h3><p data-lab-method>${escape(first[1])}</p></div>
        <details class="panel course-details" data-remember="lab-concepts"><summary>相关课本知识</summary><div class="stack">${relationshipLinks(lab.links, route)}</div></details>`},
  ], '实验进度');
  const host = main.querySelector('[data-lab]');
  const question = main.querySelector('[data-lab-question]');
  const method = main.querySelector('[data-lab-method]');
  const current = () => renderVersion === version;
  mountLearningLab(host, lab, query, saved, lab.id, { origin: route }, current, settings => {
    const [prompt, takeaway] = experimentPlans[experimentKey(settings)];
    if (question.textContent !== prompt) question.textContent = prompt;
    if (method.textContent !== takeaway) method.textContent = takeaway;
  }).then(dispose => {
    if (!dispose) return;
    if (!current()) { dispose(); return; }
    cleanup = dispose;
    if (view?.scrollY) scrollTo(0, view.scrollY);
    else if (!host.closest('[hidden]')) fitActivityStage(host);
  }).catch(error => {
    if (!current()) return;
    console.error(error);
    host.textContent = '实验暂时打不开，请刷新后再试。';
  });
}

function sources() {
  const textbooks = [
    ['七年级上册', '978-7-5204-4102-5', 'https://r1-ndr.ykt.cbern.com.cn/edu_product/esp/assets/7b63faa4-c6d8-4c9d-b18b-21394da1c56e.t/zh-CN/1787023052170/transcode/image/6.jpg'],
    ['七年级下册', '978-7-5204-4112-4', 'https://r2-ndr.ykt.cbern.com.cn/edu_product/esp/assets/67970690-c47b-49e2-9246-c137bacd82fe.t/zh-CN/1772437419795/transcode/image/6.jpg'],
    ['八年级上册', '978-7-5204-4111-7', 'https://r2-ndr.ykt.cbern.com.cn/edu_product/esp/assets/0f612d26-b797-4ac4-8de3-0f9eaf8ef27e.t/zh-CN/1787796759059/transcode/image/6.jpg'],
    ['八年级下册', '978-7-5204-4110-0', 'https://r3-ndr.ykt.cbern.com.cn/edu_product/esp/assets/96effd81-fc72-4521-888f-07ea6866a4c9.t/zh-CN/1772437420586/transcode/image/6.jpg'],
  ];
  main.innerHTML = `<article class="geo-utility">${pageIntro('教材与素材来源', '')}
    <section class="panel"><h2>教材</h2><p>《地理》中图版（北京版），北京教育科学研究院编著，中国地图出版社出版，钟作慈主编。</p>
      <p>四册课序与页码依据国家中小学智慧教育平台的电子教材。网页的模拟图和练习用于课前预习和课后复习。</p>
      <ul>${textbooks.map(([title, isbn, url]) => `<li><a href="${url}" target="_blank" rel="noopener">国家平台 · ${title}目录 ↗</a> <small>ISBN ${isbn}</small></li>`).join('')}</ul>
    </section>
    <section class="panel"><h2>图片与模型</h2><p>首页摄影为 Alexkom000 的塔拉河峡谷照片。本站缩放、压缩并在首页裁切显示。</p>
      <p><a href="https://commons.wikimedia.org/wiki/File:2025-07-13_Tara_River_Canyon_5.jpg" target="_blank" rel="noopener">Wikimedia Commons 原图</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a></p>
      <p>地球采用 <a href="https://www.naturalearthdata.com/downloads/110m-physical-vectors/110m-land/" target="_blank" rel="noopener">Natural Earth 公共领域陆地轮廓</a>的简化教学示意。场景不包含行政区划。地形和气象练习用示意数据，各实验标明口径。</p>
      <p>世界地球仪的地形纹理来自 <a href="https://www.naturalearthdata.com/downloads/50m-gray-earth/gray-earth-with-ocean-bottom/" target="_blank" rel="noopener">Natural Earth Gray Earth</a>，使用 SRTM Plus 和 CleanTOPO2 数据。本站对公有领域数据作了缩小与着色。</p>
    </section>
    <section class="panel"><h2>洋流与季风</h2><p>箭头根据资料重画，表示有代表性的方向和路径。</p>
      <div class="stack">${FLOW_SOURCES.map(source => `<a class="link-row" href="${escape(source.url)}" target="_blank" rel="noopener">${escape(source.title)} ↗</a>`).join('')}</div>
    </section></article>`;
}


function captureView() {
  if (!activeHash || resettingLearning) return;
  const { page, id } = routeParts(activeHash);
  const details = Array.from(main.querySelectorAll('details[data-remember]'), element => [element.dataset.remember, element.open]);
  const nearest = page === 'lesson' && Array.from(main.querySelectorAll('[data-inquiry-section]'))
    .find(element => !element.parentElement.closest('[hidden], details:not([open])') && element.getBoundingClientRect().bottom > 36);
  const position = { scrollY, details: Object.fromEntries(details) };
  const activeStep = main.querySelector('[data-geo-step]:not([hidden])');
  if (activeStep) position.flowStep = activeStep.dataset.geoStep;
  if (nearest) {
    position.section = nearest.dataset.inquirySection;
    position.offset = -nearest.getBoundingClientRect().top;
  }
  learning.saveView(activeHash, position);
  if (page === 'lesson' && (byLesson.has(id) || termEntryById.has(id))) {
    const previous = state.positions[id];
    if (previous?.scrollY !== position.scrollY || previous?.section !== position.section || previous?.flowStep !== position.flowStep || JSON.stringify(previous?.details) !== JSON.stringify(position.details)) {
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
    .find(element => element.dataset.inquirySection === view.section && !element.closest('[hidden], details:not([open])'));
  if (section) scrollBy(0, section.getBoundingClientRect().top + (view.offset ?? 0));
}

async function loadVolume(id) {
  if (!loadedVolumes.has(id)) {
    const suffix = volumeRetries.get(id) || 0;
    const dataVersion = id === '8a' ? 7 : id === '7b' ? 6 : 4;
    const url = new URL(`./term-${id}.js?v=${dataVersion}${suffix ? '&retry=' + suffix : ''}`, import.meta.url);
    const pending = import(url.href).then(({default: data}) => new Map(data.chapters.flatMap(chapter =>
      chapter.lessons.map(entry => [entry.id, entry])))).catch(error => {
      loadedVolumes.delete(id);
      volumeRetries.set(id, suffix + 1);
      throw error;
    });
    loadedVolumes.set(id, pending);
  }
  return loadedVolumes.get(id);
}

function showExpandedLesson(summary, route, previous, view, version, practiceOnly, taskId) {
  const volume = volumeById.get(summary.term);
  const valid = () => renderVersion === version;
  let drawing;
  const globeMode = globeTopics.get(summary.title);
  const photoTopic = photoTopics.get(summary.title);
  const workbook = entriesForVolume(summary.term);
  const following = workbook[workbook.findIndex(item => item.id === summary.id) + 1];
  let retries = 0;
  async function open() {
    main.innerHTML = `<section class="volume-heading">
      <h1>${escape(summary.title)}</h1><p role="status">正在准备这节课的地图和记录……</p></section>`;
    try {
      const renderer = new URL('./term-lesson.js?v=11', import.meta.url);
      if (retries) renderer.searchParams.set('retry', retries);
      const [lessons, {renderTermLesson, renderTermPractice}] = await Promise.all([
        loadVolume(summary.term), import(renderer.href),
      ]);
      if (!valid()) return;
      const entry = lessons.get(summary.id);
      if (!entry) throw new Error('volume entry unavailable');
      if (practiceOnly) {
        drawing = renderTermPractice(main, { entry, learning, taskId,
          initialStep: view?.flowStep, onStep: flowStep => learning.saveView(route, { flowStep }) });
        if (retries) main.focus({preventScroll: true});
        document.title = entry.title + ' · 地理实验台';
        return;
      }
      const related = (entry.related || []).map(id => {
        const direct = byLesson.get(id) || termEntryById.get(id);
        if (direct) return {title: direct.title, href: lessonUrl(id) + '?from=' + encodeURIComponent(route)};
        const concept = byConcept.get(id);
        return concept ? {title: concept.title, href: conceptUrl(id, route)} : null;
      }).find(Boolean);
      drawing = renderTermLesson(main, {
        entry, term: volume, next: following, related, learning,
        initialStep: view?.flowStep ?? view?.section,
        onStep: flowStep => learning.saveView(route, { flowStep }),
        onGlobe: globeMode ? host => {
          const globe = byLab.get('globe');
          const key = 'lesson-' + entry.id;
          const params = new URLSearchParams({mode: globeMode});
          return mountLearningLab(host, globe, params, state.labs[key], key,
            {inline: true, fixedMode: globeMode, origin: route}, () => valid() && host.isConnected);
        } : undefined,
        onPhotos: photoTopic ? host => {
          const topic = topicViews[photoTopic.gallery];
          const photos = photoTopic.picks ? photoTopic.picks.map(index => topic.photos[index]) : topic.photos;
          return mountPhotoGallery(host, photos, learning.getView(route)?.galleryIndex,
            index => learning.saveView(route, {galleryIndex: index}), {embedded: true});
        } : undefined,
      });
      learning.recordVisit(summary.id);
      const context = previous ? routeParts(previous) : null;
      if (!courseReturn(routeParts(route).query, summary.id) && context?.page !== 'concept' && context?.page !== 'lab') {
        learning.setResume(summary.id, {route, scrollY: view?.scrollY || 0});
      }
      if (retries) main.focus({preventScroll: true});
      restoreView(view);
      document.title = entry.title + ' · 地理实验台';
      if (view?.section) restoreInquiryPosition(view);
      else if (view?.scrollY) scrollTo(0, view.scrollY);
      const origin = previous && routeParts(previous);
      if (origin && courseReturn(origin.query, origin.id) === route) {
        main.querySelector('.geo-related a')?.focus({ preventScroll: true });
      }
    } catch (error) {
      if (!valid()) return;
      console.warn('Volume activity could not be loaded', summary.id, error);
      main.innerHTML = `<section class="panel">
        <h1>${escape(summary.title)}</h1><p role="status">这节课的材料没载入。${summary.page ? '可先翻课本第 ' + summary.page + ' 页。' : ''}</p>
        <button type="button" class="button primary" data-volume-retry>重新加载这一课</button></section>`;
      main.querySelector('[data-volume-retry]').addEventListener('click', () => {
        retries++;
        open();
      }, {once: true});
    }
  }
  open();
  cleanup = () => { drawing?.(); };
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
  const expanded = ['lesson', 'practice'].includes(page) ? termEntryById.get(id) : null;
  const volume = page === 'term' ? volumeById.get(id) : null;
  const prior = previous?.startsWith('#/lesson/') ? routeParts(previous).id : null;
  const priorEntry = termEntryById.get(prior);
  const priorInVolume = volume?.id === '7a' || page === 'textbook' ? getTextbookPosition(prior)?.entry
    : priorEntry?.term === volume?.id ? priorEntry : null;
  const view = learning.getView(next) ?? (lesson || expanded && page === 'lesson' ? state.positions[id] : null);
  document.documentElement.dataset.learningRoute = page;
  const lessonTerm = page === 'lesson' && (lesson ? '7a' : expanded?.term);
  renderNavigation(page, id, query, lessonTerm);
  if (!page) {
    const recent = termEntryById.get(state.lastLesson) || getTextbookPosition(state.lastLesson)?.entry;
    main.innerHTML = viewId === 'recall' ? renderCourseHub(recent) : sevenUpperHome();
  } else if (page === 'textbook') main.innerHTML = textbookDirectory(priorInVolume || undefined, true);
  else if (volume?.id === '7a') main.innerHTML = sevenUpperHome(priorInVolume);
  else if (volume) main.innerHTML = renderVolumeDirectory(volume, state, priorInVolume);
  else if (expanded) showExpandedLesson(expanded, next, previous, view, version, page === 'practice', query.get('task'));
  else if (lesson) {
    showLesson(lesson, view);
    const cameFrom = previous ? routeParts(previous) : null;
    const contextualBack = cameFrom?.page === 'concept' && contextReturn(cameFrom.query.get('from')).href === next
      || cameFrom?.page === 'lab' && (cameFrom.query.get('returnTo') === next || cameFrom.query.get('from') === id);
    if (!contextualBack && !courseReturn(query, id)) {
      learning.setResume(id, { route: next, scrollY: view?.scrollY || 0 });
    }
  } else if (page === 'concept' && byConcept.has(id)) showConcept(byConcept.get(id), query);
  else if (page === 'lab' && byLab.has(id)) showLab(byLab.get(id), query, next, view, version);
  else if (page === 'explore') {
    const storedQuery = view?.search;
    if (storedQuery) Object.assign(exploreState, storedQuery);
    explore();
  } else if (page === 'review') review();
  else if (page === 'practice' && byLesson.has(id)) practice(byLesson.get(id), query.get('task'));
  else if (page === 'legend') legend(query);
  else if (page === 'sources') sources();
  else main.innerHTML = `${pageIntro('这个页面没有找到', '可以从课本目录重新出发。')}<a class="button primary" href="#/">回四册目录</a>`;
  restoreView(view);
  const heading = main.querySelector('h1');
  document.title = heading ? heading.textContent + ' · 地理实验台' : '地理实验台 · 四册';
  scrollTo(0, view?.scrollY || 0);
  requestAnimationFrame(() => {
    if (activeHash !== next) return;
    if (lesson && view?.section) restoreInquiryPosition(view);
    else if (view?.scrollY) scrollTo(0, view.scrollY);
    if (priorInVolume) {
      const current = main.querySelector(`[data-volume-entry="${priorInVolume.id}"]`);
      current?.scrollIntoView({block: 'nearest'});
      current?.focus({preventScroll: true});
    }
  });
}
window.addEventListener('scroll', () => {
  clearTimeout(storeTimer);
  storeTimer = setTimeout(captureView, 200);
}, { passive: true });
window.addEventListener('pagehide', captureView);
window.addEventListener('parent-learning-reset', event => {
  if (event.detail?.subject !== 'geography') return;
  resettingLearning = event.detail.phase === 'start';
  if (resettingLearning) clearTimeout(storeTimer);
});
document.querySelector('.skip').addEventListener('click', event => {
  event.preventDefault();
  main.focus();
});
window.addEventListener('hashchange', () => {
  render();
  main.focus({ preventScroll: true });
});
mountParentSettings({
  subject: 'geography',
  label: '地理',
  entry: document.querySelector('[data-parent-settings-entry]'),
  visible() {
    const [route] = location.hash.split('?');
    return ['', '#/', '#/textbook'].includes(route) || /^#\/term\/(7a|7b|8a|8b)$/.test(route);
  },
  localKeys: ['geography-lab:learning:v1'],
  localPrefixes: ['geography-lab:learning:v2:'],
  sessionKeys: ['geography-lab:views:v1', 'geography-lab:views:v1:nearby', 'geography-lab:views:v1:fieldwork'],
  sessionPrefixes: [],
  onReload() {
    history.replaceState(history.state, '', location.pathname + location.search);
    location.reload();
  },
});
render();
