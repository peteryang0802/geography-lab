import { evidencePhoto, responsivePhoto } from './responsive-photo.js?v=7';
import { lessonFlow } from './lesson-flow.js?v=1';

export const inquiryViews = {
  recall: {
    name: '按课回顾',
    homeTitle: '把地理用在身边',
    homeDescription: '从课上学过的一件事出发，解释一个身边的现象。',
    look: '动手找线索',
    reading: '读懂刚才看到的',
  },
  nearby: {
    name: '身边的地理',
    homeTitle: '身边的地理',
    homeDescription: '留意每天经过的地方，看看地图能告诉我们什么。',
    look: '看看这里有什么线索',
    reading: '地图告诉了我们什么',
  },
  fieldwork: {
    name: '地理调查簿',
    homeTitle: '地理调查簿',
    homeDescription: '先猜一猜，再用证据看看自己的想法站不站得住。',
    look: '先找一条证据',
    reading: '把线索放在一起',
  },
};

export function selectInquiryView(search) {
  const choice = new URLSearchParams(search).get('view');
  return Object.hasOwn(inquiryViews, choice) ? choice : 'recall';
}

export const escapeHtml = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

const evidencePhotos = {
  intro: {
    file: 'puddle', alt: '雨后路面上有几处水洼',
    text: '看水停在哪里，再看旁边有没有同一场雨后已经变干的路面。',
    credit: '实景 · Paul The Writer / CC0',
  },
  contours: {
    file: 'puddle', alt: '雨后的一条路，部分路面还有积水',
    text: '这是一张雨后道路照片。看水停在哪里，再找找水可能从哪里流过来。',
    credit: '实景 · Paul The Writer / CC0',
  },
  'earth-space': {
    file: 'earth', alt: '阿波罗17号拍摄的地球，非洲、海洋、白云与南极可见',
    text: '从太空看，地球的外缘像圆。再找一找照片里的陆地、海洋和云。',
    credit: '实景 · NASA / Apollo 17',
  },
  'earth-model': {
    file: 'earth', alt: '阿波罗17号拍摄的地球，表面可以看见陆地和云',
    text: '实拍的地球上没有画着经纬线。想象把经纬线套到地球上，我们就能报出地点。',
    credit: '实景 · NASA / Apollo 17',
  },
  'land-change': {
    file: 'fossil', alt: '菊石化石保留螺旋状的外壳和分室',
    text: '找找这块菊石化石上还看得见哪些壳的结构。菊石是一类曾生活在海洋中的动物。',
    credit: '实景 · Annie Scott / USGS',
  },
  weather: {
    file: 'cloud', alt: '空间站俯瞰发展旺盛的高大积雨云',
    text: '从太空看，一些云团向上长得很高。在地面安排活动时，还要查看预报和预警。',
    credit: '实景 · NASA / 国际空间站',
  },
};

function photoFigure(photo) {
  return `<figure class="inquiry-photo">
    ${responsivePhoto(evidencePhoto(photo.file), { alt: photo.alt, sizes: '(max-width: 700px) 90vw, 760px' })}
    <figcaption>${escapeHtml(photo.text)} <small>${escapeHtml(photo.credit)}</small></figcaption>
  </figure>`;
}

function evidenceReading(entry, data, view, extra) {
  return `<section class="inquiry-reading" data-inquiry-section="reading" aria-labelledby="reading-title">
    <h2 id="reading-title">${view.reading}</h2>
    <div class="inquiry-reading-body"><div class="inquiry-copy">${data.read.map(({ title, text }, index) =>
      `<section><h3>${escapeHtml(title)}</h3>
      ${entry.id === 'contours' && index === 0 ? '<p class="height-example">山顶比山脚高 <strong>460 − 120 = 340 米</strong></p>' : ''}
      <p>${escapeHtml(text)}</p></section>`).join('')}</div>
    ${extra}</div>
  </section>`;
}

function oceanLifeFigure() {
  return `<figure class="inquiry-picture-note ocean-life" data-inquiry-section="ocean-life">
    ${responsivePhoto(evidencePhoto('fishing-vessel'), {
      alt: '傍晚的阿拉斯加港湾，渔船停在岸边', sizes: '(max-width: 700px) 90vw, 350px',
    })}
    <figcaption><strong>海怎么走进我们的日常？</strong>
      <p>渔船把鱼带回港口，货船沿航线运东西。</p>
      <p class="ocean-water-path" aria-label="海水蒸发，水汽被风带上岸，可能形成降雨">
        <span>海水蒸发</span><span aria-hidden="true">→</span><span>水汽上岸</span><span aria-hidden="true">→</span><span>可能成雨</span>
      </p>
      <small>阿拉斯加港湾 · NOAA Fisheries / Kalei Shotwell</small>
    </figcaption>
  </figure>`;
}

export function renderInquiry({ entry, textbook, data, activityMarkup, activitySteps, practices, transferMarkup, outsideMarkup, footer, note, viewId }) {
  const view = inquiryViews[viewId];
  const visualReading = data.visualReading;
  const photo = evidencePhotos[entry.id];
  const illustration = photo ? photoFigure(photo) : '';
  const evidence = `<section class="inquiry-evidence" data-inquiry-section="evidence" aria-labelledby="evidence-title">
      <header class="inquiry-section-head"><h2 id="evidence-title">${view.look}</h2></header>
      ${activityMarkup}
    </section>`;
  const opening = `<div class="geo-opening" data-inquiry-section="opening">
      <h3>${escapeHtml(data.question)}</h3>
      <p>${escapeHtml(data.guess)}</p>
    </div>`;
  const recap = `<p class="geo-recap">${escapeHtml(data.closing)}</p>
    <details class="inquiry-note" data-remember="lesson-extras">
      <summary>课后再看</summary>
      ${transferMarkup}
      ${note}
      ${data.paper ? `<p data-inquiry-section="paper"><strong>翻课本再找一条线索</strong>　${escapeHtml(data.paper)}</p>` : ''}
      ${outsideMarkup || `<section class="inquiry-outside" data-inquiry-section="outside">
        <h3>课外观察</h3><p>${escapeHtml(data.outside)}</p>
      </section>`}
    </details>
    ${footer}`;
  return `<article class="course-lesson inquiry-lesson geo-lesson" data-inquiry-lesson="${escapeHtml(entry.id)}">
    <header class="inquiry-intro">
      <p class="inquiry-location">${escapeHtml(textbook)} <span>教材第 ${entry.page} 页起</span></p>
      <h1>${escapeHtml(entry.title)}</h1>
    </header>
    ${lessonFlow([
      { id: 'opening', label: '带着问题', content: opening, next: '看图找线索' },
      { id: 'evidence', label: '看图找线索', content: evidence + (viewId === 'nearby' && photo ? illustration : ''), next: activitySteps[0]?.label || '读懂材料' },
      ...activitySteps.map((step, index) => ({ ...step, next: activitySteps[index + 1]?.label || '读懂材料' })),
      { id: 'reading', label: '读懂材料', content: visualReading ? oceanLifeFigure() : evidenceReading(entry, data, view, viewId !== 'nearby' ? illustration : ''), next: '找一条依据' },
      { id: 'proof', label: '找一条依据', content: practices[0], next: '做一题' },
      { id: 'lesson-practice', label: '做一题', content: practices[1], next: '换份材料再试' },
      { id: 'lesson-practice-transfer', label: '换份材料再试', content: practices[2], next: '回顾这节课' },
      { id: 'recap', label: '回顾这节课', content: recap },
    ])}
  </article>`;
}
