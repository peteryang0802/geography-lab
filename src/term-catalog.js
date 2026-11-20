import { escapeHtml as escape } from './inquiry-view.js?v=6';
import { alignedTransfer } from './lesson-practice-transfer.js?v=1';

export const volumes = [
  { id: '7a', title: '七年级上册', subtitle: '从地球仪出发，读懂地图、地形和气候', theme: 'forest', legendPage: 125 },
  { id: '7b', title: '七年级下册', subtitle: '带着问题走进大洲、地区和国家', theme: 'ocean', legendPage: 132 },
  { id: '8a', title: '八年级上册', subtitle: '看懂中国的自然环境、资源和生产', theme: 'sand', legendPage: 133 },
  { id: '8b', title: '八年级下册', subtitle: '从中国各地读到自己的家乡', theme: 'lake', legendPage: 125 },
];
const index = typeof GEOLAB_VOLUME_INDEX === 'undefined' ? {} : GEOLAB_VOLUME_INDEX;
export const volumeById = new Map(volumes.map(volume => [volume.id, volume]));
export const extendedEntries = volumes.flatMap(volume => (index[volume.id] || []).flatMap(chapter =>
  chapter.lessons.map(entry => ({ ...entry, term: volume.id, chapter: chapter.title,
    tasks: [{ id: 'review-' + entry.id, options: Array.from({ length: entry.optionCount }), answer: entry.answer }],
    checks: entry.checks.map(task => ({ ...task, options: Array.from({ length: task.optionCount }) })),
  }))));
export const termEntryById = new Map(extendedEntries.map(entry => [entry.id, entry]));
export const termUrl = id => '#/term/' + id;
export const entryUrl = id => '#/lesson/' + id;
const nextArrow = '<span aria-hidden="true">→</span>';

export function renderVolumeCards() {
  return `<section class="volume-cards" aria-label="四册地理课本">${volumes.map(volume =>
    `<a href="${termUrl(volume.id)}" class="volume-card volume-${volume.theme}" data-volume="${volume.id}">
      <span><strong>${volume.title}</strong><small>${volume.subtitle}</small></span>${nextArrow}
    </a>`).join('')}</section>`;
}

export function renderCourseHub(recent) {
  return `<section class="volume-home" data-course-hub>
    <div class="volume-heading"><p class="eyebrow">中图版（北京版）</p>
      <h1>今天想弄明白什么？</h1>
      <p>课前带一个问题去读图。课后换份材料，再用一次学过的方法。</p>
    </div>
    ${recent ? `<a class="button primary volume-resume" href="${entryUrl(recent.id)}"><span><small>继续上次 · ${volumeById.get(recent.term || '7a').title}</small><strong>${escape(recent.title)}</strong></span>${nextArrow}</a>`
      : `<a class="button primary volume-resume" href="${entryUrl('intro')}"><span><small>从上学路开始</small><strong>雨停了，为什么只有这儿留着水洼？</strong></span>${nextArrow}</a>`}
    ${renderVolumeCards()}
  </section>`;
}

export function entriesForVolume(id) {
  return extendedEntries.filter(entry => entry.term === id);
}

export function renderVolumeDirectory(volume, state, returning) {
  const entries = entriesForVolume(volume.id);
  const recent = entries.filter(entry => state.visits[entry.id])
    .sort((a, b) => state.visits[b.id] - state.visits[a.id])[0];
  const first = returning || recent || entries[0];
  return `<section class="volume-directory" data-volume-directory="${volume.id}">
    <div class="volume-heading"><h1>${volume.title}</h1><p>${volume.subtitle}</p></div>
    ${first ? `<a class="button primary volume-resume" data-volume-entry="${first.id}" aria-current="location" href="${entryUrl(first.id)}"><span><small>${returning || recent ? '继续读本册' : '从本册第一课开始'}</small><strong>${escape(first.title)}</strong></span>${nextArrow}</a>` : ''}
    <div class="volume-chapters">${(index[volume.id] || []).filter(chapter => chapter.lessons.some(entry => entry.id !== first?.id)).map(chapter => `<section class="volume-chapter"><h2>${escape(chapter.title)}</h2>
      <ul>${chapter.lessons.filter(entry => entry.id !== first?.id).map(entry => {
        const widget = state.widgets[entry.id];
        const evidence = widget?.proof?.result || widget?.profilePractice?.mainEvidence;
        const transfer = alignedTransfer(entry.id);
        const reviewed = state.answers['review-' + entry.id]?.solved || (transfer && state.answers[transfer.id]?.solved);
        const progress = evidence === 'independent' ? '独立找过证据 · ' : evidence === 'guided' ? '核对后找到证据 · '
          : reviewed ? '换材料曾答对 · ' : state.visits[entry.id] ? '看过 · ' : '';
        return `<li><a href="${entryUrl(entry.id)}" data-volume-entry="${entry.id}" ${entry.id === (returning || recent)?.id ? 'aria-current="location"' : ''}>
          <span>${escape(entry.title)}${entry.project ? '<small> · 主题探究</small>' : ''}</span>
          <small>${progress}${entry.page ? '第 ' + entry.page + ' 页' : ''}</small></a></li>`;
      }).join('')}</ul></section>`).join('')}</div>
    <a class="volume-back" href="#/legend?term=${volume.id}">附录 · 常用地图图例（第 ${volume.legendPage} 页）</a>
  </section>`;
}
