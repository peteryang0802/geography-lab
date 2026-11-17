import { evidencePhoto, responsivePhoto } from './responsive-photo.js?v=5';

export const inquiryViews = {
  recall: {
    name: '按课回顾',
    homeTitle: '把地理用在身边',
    homeDescription: '从课上学过的一件事出发，解释一个身边的现象。',
    look: '动手找线索',
    reading: '读懂刚才看到的',
    compare: '换个角度想一想',
  },
  nearby: {
    name: '身边的地理',
    homeTitle: '身边的地理',
    homeDescription: '留意每天经过的地方，看看地图能告诉我们什么。',
    look: '看看这里有什么线索',
    reading: '地图告诉了我们什么',
    compare: '换个地方，还能这样解释吗？',
  },
  fieldwork: {
    name: '地理调查簿',
    homeTitle: '地理调查簿',
    homeDescription: '先猜一猜，再用证据看看自己的想法站不站得住。',
    look: '先找一条证据',
    reading: '把线索放在一起',
    compare: '再核对一条线索',
  },
};

export function selectInquiryView(search) {
  const choice = new URLSearchParams(search).get('view');
  return Object.hasOwn(inquiryViews, choice) ? choice : 'recall';
}

export const escapeHtml = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

const evidencePhotos = {
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

function pointOfRecall(text) {
  return `<details class="inquiry-hint" data-remember="recall-hint"><summary>想起课堂上的方法</summary><p>${escapeHtml(text)}</p></details>`;
}

function evidenceReading(entry, data, view, extra) {
  return `<section class="inquiry-reading" data-inquiry-section="reading" aria-labelledby="reading-title">
    <h2 id="reading-title">${view.reading}</h2>
    <div class="inquiry-copy">${data.read.map(({ title, text }, index) =>
      `<section><h3>${escapeHtml(title)}</h3>
      ${entry.id === 'contours' && index === 0 ? '<div class="height-example"><span>山顶 <strong>460 米</strong></span><span>山脚 <strong>120 米</strong></span><span>两处相差 <strong>340 米</strong></span></div>' : ''}
      <p>${escapeHtml(text)}</p></section>`).join('')}</div>
    ${extra}
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

export function renderInquiry({ entry, textbook, data, activityMarkup, outsideMarkup, footer, note, viewId }) {
  const view = inquiryViews[viewId];
  const visualReading = data.visualReading;
  const photo = evidencePhotos[entry.id];
  const illustration = photo ? photoFigure(photo) : '';
  const recall = visualReading ? '' : pointOfRecall(data.recall);
  const evidence = `<section class="inquiry-evidence" data-inquiry-section="evidence" aria-labelledby="evidence-title">
      <header class="inquiry-section-head"><h2 id="evidence-title">${view.look}</h2></header>
      ${activityMarkup}
      ${viewId === 'fieldwork' && !visualReading ? `<p class="inquiry-first-observation">${escapeHtml(data.compare)}</p>` : ''}
    </section>`;
  const compare = viewId === 'fieldwork' || visualReading ? '' : `<section class="inquiry-transfer" data-inquiry-section="transfer">
    <h2>${view.compare}</h2><p>${escapeHtml(data.compare)}</p></section>`;
  return `<article class="course-lesson inquiry-lesson" data-inquiry-lesson="${escapeHtml(entry.id)}">
    <header class="inquiry-intro" data-inquiry-section="opening">
      <p class="inquiry-location">${escapeHtml(textbook)} <span>教材第 ${entry.page} 页起</span></p>
      <h1>${escapeHtml(entry.title)}</h1>
      <h2>${escapeHtml(data.question)}</h2>
      <p>${escapeHtml(data.guess)}</p>
      ${viewId === 'recall' ? recall : ''}
    </header>
    ${evidence}
    ${viewId === 'nearby' && photo ? illustration : ''}
    ${viewId !== 'recall' ? recall : ''}
    ${visualReading ? oceanLifeFigure() : evidenceReading(entry, data, view, viewId !== 'nearby' ? illustration : '')}
    ${compare}
    ${note}
    ${outsideMarkup || `<section class="inquiry-outside" data-inquiry-section="outside">
      <h2>课外观察</h2><p>${escapeHtml(data.closing)}</p>
      <p>${escapeHtml(data.outside)}</p>
    </section>`}
    ${footer}
  </article>`;
}
