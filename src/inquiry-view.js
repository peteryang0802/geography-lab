import { evidencePhoto, responsivePhoto } from './responsive-photo.js?v=7';
import { lessonFlow } from './lesson-flow.js?v=2';
import { alignedMethod } from './lesson-practice-transfer.js?v=1';

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

const openingChoices = {
  intro: ['坡脚还留着水', '坡顶还留着水'],
  'earth-space': ['第 1 颗', '第 2 颗', '第 3 颗'],
  spaceflight: ['先对齐桥和村子', '直接比两张图的水面'],
  'earth-model': ['只报大概方位', '报两条线的交点'],
  'earth-motion': ['两地同时看到日出', '两地先后看到日出'],
  'project-earth': ['先找有固体地表的行星', '先找最靠近太阳的行星'],
  maps: ['先认图例里的步道', '先找图上的入口'],
  contours: ['低洼处更容易积水', '较高处更容易积水'],
  'project-orienteering': ['先找能走的桥', '直接沿最短的线过河'],
  'land-ocean': ['太平洋', '大西洋', '印度洋'],
  'land-change': ['先看贝壳嵌在岩层哪里', '先看今天的山有多高'],
  'project-seafloor': ['刚离开岸时', '从近岸到深海的中间一段', '到了深海平底时'],
  weather: ['先查雷电预警', '先比气温'],
  'temp-rain': ['最热月和雨最多的月是同一个月', '两个最高值可能出现在不同月份'],
  climate: ['先比两地多雨的月份', '先比两地一年的总雨量'],
  'climate-life': ['先对照屋顶高低', '先找排水口'],
  'project-nest': ['敞开的风口', '有树遮挡处', '步道边'],
  people: ['人多的地方一定更挤', '面积不同，只比人数还不够'],
  cooperation: ['先找能按时到的方案', '先选运费最低的方案'],
  'project-made-in-china': ['先找测量结果和条件', '先比较它是不是最保温'],
};

export function renderPrediction(choices, prompt = '先选一个想法，到图上核对。') {
  return `<div class="geo-prediction" data-geo-prediction>
    <p id="geo-prediction-prompt">${escapeHtml(prompt)}</p>
    <div class="term-choices" role="group" aria-labelledby="geo-prediction-prompt">
      ${choices.map((choice, index) => `<button type="button" class="button" data-geo-pick="${index}" aria-pressed="false">${escapeHtml(choice)}</button>`).join('')}
    </div>
    <p class="geo-prediction-status" role="status"></p>
  </div>`;
}

export function bindPrediction(root, selected, save) {
  const prediction = root.querySelector('[data-geo-prediction]');
  const buttons = [...prediction.querySelectorAll('[data-geo-pick]')];
  const status = prediction.querySelector('[role=status]');
  function paint(index) {
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    status.textContent = buttons[index] ? '想法记下了。把它带到图上核对。' : '';
  }
  buttons.forEach((button, index) => {
    button.addEventListener('click', () => {
      paint(index);
      save(index, button.textContent);
    });
  });
  paint(selected);
  return paint;
}

export function bindInquiryPrediction(root, entry, selected, save) {
  const observation = root.querySelector('[data-opening-observation]');
  function remember(choice) {
    observation.textContent = choice ? '带着「' + choice + '」这个想法去看图。' : '';
  }
  bindPrediction(root, selected, (index, choice) => {
    remember(choice);
    save(index);
  });
  remember(openingChoices[entry.id][selected]);
}

export function methodSummary(text) {
  return `<section class="geo-recap geo-method"><h3>把方法带走</h3><p>${escapeHtml(text)}</p></section>`;
}

export function renderComparison(material) {
  if (!Array.isArray(material)) return '<p class="evidence">' + escapeHtml(material) + '</p>';
  return '<ul class="geo-comparison" aria-label="可对照的记录">' + material.map(([first, record]) =>
    '<li><strong>' + escapeHtml(first) + '</strong><p>' + escapeHtml(record) + '</p></li>').join('') + '</ul>';
}

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
      <p class="geo-observation-aim" data-opening-observation></p>
      <p class="geo-observation-aim">${escapeHtml(data.guess)}</p>
      ${activityMarkup}
    </section>`;
  const opening = `<div class="geo-opening" data-inquiry-section="opening">
      <h3>${escapeHtml(data.question)}</h3>
      ${renderPrediction(openingChoices[entry.id])}
    </div>`;
  const recap = `
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
      { id: 'lesson-practice', label: '做一题', content: practices[1], next: '记住读图方法' },
      { id: 'method', label: '记住读图方法', content: methodSummary(alignedMethod(entry.id, data.closing)), next: '换份材料再试' },
      { id: 'lesson-practice-transfer', label: '换份材料再试', content: practices[2], next: '回顾这节课' },
      { id: 'recap', label: '回顾这节课', content: recap },
    ])}
  </article>`;
}
