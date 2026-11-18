import { COAST_RINGS } from './geo-model.js';

const geography = [
  ['亚洲', 48, 96, 'land'], ['欧洲', 49, 22, 'land'], ['非洲', 6, 21, 'land'],
  ['北美洲', 46, -110, 'land'], ['南美洲', -17, -61, 'land'], ['大洋洲', -24, 144, 'land'],
  ['南极洲', -78, 8, 'land'], ['太平洋', 6, -145, 'ocean'], ['大西洋', 19, -39, 'ocean'],
  ['印度洋', -35, 71, 'ocean'], ['北冰洋', 80, -149, 'ocean'],
];

// Shore markers use vertices of the simplified coastline drawn by paintWorld.
const routes = {
  pacific: {
    center: 180,
    start: [31.7, 121.9],
    end: [40.3, -124.4],
    ocean: '太平洋',
    startName: '亚洲东岸',
    endName: '北美洲西岸',
    question: '向东飞，哪片海在两岸中间？',
    answer: '从亚洲东岸向东飞，跨过太平洋，就到北美洲西岸。',
  },
  atlantic: {
    center: -28,
    start: [14.7, -17.6],
    end: [-7.3, -34.7],
    ocean: '大西洋',
    oceanLabel: [-28, -10],
    startName: '非洲西岸',
    endName: '南美洲东岸',
    question: '从非洲西岸往西，去南美洲要跨过哪片海？',
    answer: '从非洲西岸向西飞，跨过大西洋，就到南美洲东岸。',
  },
};

const oceanColor = '#c5e4ef';
const landColor = '#e7d5a7';
const oceanChoices = ['太平洋', '印度洋', '大西洋'];

function readSaved(saved) {
  if (Object.hasOwn(routes, saved?.route)) {
    return { route: saved.route, revealed: saved.revealed === true, labels: saved.labels === true };
  }

  const location = saved?.location;
  return {
    route: ['atlantic', 'africa', 'south-america'].includes(location) ? 'atlantic' : 'pacific',
    revealed: location === 'pacific' || location === 'atlantic',
    labels: ['asia', 'europe', 'africa', 'north-america', 'south-america', 'oceania', 'antarctica', 'indian', 'arctic'].includes(location),
  };
}

function paintWorld(context, width, height, center, span = 360, north = 90) {
  const x = (longitude, offset = 0) => (longitude - center + span / 2 + offset) * width / span;
  const y = latitude => (north - latitude) * height / (span / 2);

  context.fillStyle = oceanColor;
  context.fillRect(0, 0, width, height);
  context.fillStyle = landColor;
  context.strokeStyle = '#7c8c69';
  context.lineJoin = 'round';
  context.lineWidth = 0.72;

  // The coastlines use a fixed seam at 180°. Drawing adjacent copies also covers a shifted seam.
  for (const offset of [-360, 0, 360]) {
    context.beginPath();
    for (const ring of COAST_RINGS) {
      context.moveTo(x(ring[0], offset), y(ring[1]));
      for (let index = 2; index < ring.length; index += 2) {
        context.lineTo(x(ring[index], offset), y(ring[index + 1]));
      }
      context.closePath();
    }
    context.fill();
    context.stroke();
  }

  context.strokeStyle = '#7a9ba6';
  context.lineWidth = 0.7;
  context.setLineDash([3, 4]);
  context.beginPath();
  context.moveTo(0, y(0));
  context.lineTo(width, y(0));
  context.stroke();
  context.setLineDash([]);

  return (latitude, longitude) => {
    const nearest = (((longitude - center + 180) % 360 + 360) % 360) - 180 + center;
    return [x(nearest), y(latitude)];
  };
}

function mapLabel(context, width, height, word, x, y, type) {
  const fontSize = Math.max(12, Math.min(18, width * 0.043));
  const palette = {
    land: ['#fff9e6', '#34341d'],
    ocean: ['#e9f7fb', '#163d50'],
    focus: ['#fffbed', '#753817'],
    coast: ['#fff9e6', '#4d321c'],
  };
  context.font = `700 ${fontSize}px system-ui, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const half = context.measureText(word).width / 2 + 5;
  const centerX = Math.max(half, Math.min(width - half, x));
  const centerY = Math.max(fontSize, Math.min(height - fontSize, y));
  context.strokeStyle = palette[type][0];
  context.lineJoin = 'round';
  context.lineWidth = 3;
  context.strokeText(word, centerX, centerY);
  context.fillStyle = palette[type][1];
  context.fillText(word, centerX, centerY);
}

function coastPoint(context, x, y) {
  context.beginPath();
  context.arc(x, y, 4, 0, Math.PI * 2);
  context.fillStyle = '#823c22';
  context.fill();
  context.lineWidth = 1.5;
  context.strokeStyle = '#fff9e6';
  context.stroke();
}

function flightPath(context, start, end) {
  const [startX, startY] = start;
  const [endX, endY] = end;
  const middleX = (startX + endX) / 2;
  const middleY = Math.min(startY, endY) - 17;
  context.beginPath();
  context.moveTo(startX, startY);
  context.quadraticCurveTo(middleX, middleY, endX, endY);
  context.lineCap = 'round';
  context.lineWidth = 5;
  context.strokeStyle = '#fffbed';
  context.stroke();
  context.lineWidth = 2.5;
  context.strokeStyle = '#833e20';
  context.stroke();

  const t = 0.64;
  const arrowX = (1 - t) ** 2 * startX + 2 * t * (1 - t) * middleX + t ** 2 * endX;
  const arrowY = (1 - t) ** 2 * startY + 2 * t * (1 - t) * middleY + t ** 2 * endY;
  const direction = Math.sign(endX - startX);
  context.beginPath();
  context.moveTo(arrowX - direction * 4, arrowY - 4);
  context.lineTo(arrowX + direction * 4, arrowY);
  context.lineTo(arrowX - direction * 4, arrowY + 4);
  context.stroke();
  return [middleX, (startY + endY) / 2 + 17];
}

function drawMap(canvas, context, paint) {
  const width = canvas.clientWidth;
  if (!context || width === 0) return;
  const height = width / 2;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  paint(width, height);
}

export function mountWorldInquiry(host, _, saved, onChange) {
  const state = readSaved(saved);
  host.innerHTML = `<div class="inquiry-world-activity" data-world-activity>
    <p class="world-route-prompt" data-world-prompt></p>
    <figure class="inquiry-world">
      <canvas role="img" width="640" height="320"></canvas>
      <figcaption>世界地图示意</figcaption>
    </figure>
    <div class="world-route-controls">
      <div class="world-route-actions">
        <button type="button" class="button primary" data-world-reveal aria-pressed="false">画出路线</button>
        <button type="button" class="button" data-world-route="atlantic" hidden>换一条路线</button>
        <button type="button" class="button" data-world-labels aria-pressed="false">标出七洲四洋</button>
      </div>
      <p role="status" data-world-feedback></p>
    </div>
    <figure class="world-ratio" data-world-ratio>
      <figcaption>地球表面的海陆比例</figcaption>
      <div class="world-ratio-bar" aria-hidden="true"></div>
      <div class="world-ratio-labels">
        <span>海洋约 70%</span><span>陆地约 30%</span>
      </div>
    </figure>
  </div>`;

  const activity = host.querySelector('[data-world-activity]');
  const canvas = host.querySelector('canvas');
  const context = canvas.getContext('2d');
  const names = host.querySelector('[data-world-labels]');
  const reveal = host.querySelector('[data-world-reveal]');
  const changeRoute = host.querySelector('[data-world-route]');
  const prompt = host.querySelector('[data-world-prompt]');
  const feedback = host.querySelector('[data-world-feedback]');

  function draw() {
    drawMap(canvas, context, paint);
  }

  function paint(width, height) {
    const route = routes[state.route];
    const position = paintWorld(context, width, height, state.labels ? 0 : route.center);

    if (state.labels) {
      for (const [name, latitude, longitude, type] of geography) {
        mapLabel(context, width, height, name, ...position(latitude, longitude), type);
      }
      return;
    }

    const start = position(...route.start);
    const end = position(...route.end);
    if (state.revealed) {
      const belowFlight = flightPath(context, start, end);
      const label = route.oceanLabel ? position(...route.oceanLabel) : belowFlight;
      mapLabel(context, width, height, route.ocean, ...label, 'focus');
    }
    coastPoint(context, ...start);
    coastPoint(context, ...end);
    const direction = Math.sign(end[0] - start[0]);
    mapLabel(context, width, height, route.startName, start[0] - direction * 13, start[1] - 15, 'coast');
    const endLabel = state.route === 'atlantic'
      ? [end[0] - 43, end[1] + 16]
      : [end[0] + direction * 13, end[1] - 15];
    mapLabel(context, width, height, route.endName, ...endLabel, 'coast');
  }

  function update() {
    const route = routes[state.route];
    activity.dataset.worldActiveRoute = state.route;
    activity.dataset.worldRevealed = String(state.revealed);
    activity.dataset.worldAllLabels = String(state.labels);
    names.setAttribute('aria-pressed', String(state.labels));
    names.textContent = state.labels ? '返回航线图' : '标出七洲四洋';
    reveal.setAttribute('aria-pressed', String(state.revealed));
    reveal.textContent = state.revealed ? '收起路线' : '画出路线';
    reveal.classList.toggle('primary', !state.revealed);
    reveal.hidden = state.labels;
    changeRoute.hidden = state.labels || (!state.revealed && state.route === 'pacific');
    changeRoute.dataset.worldRoute = state.route === 'pacific' ? 'atlantic' : 'pacific';
    changeRoute.textContent = state.route === 'pacific' ? '换一条路线' : '回到第一条';
    changeRoute.classList.toggle('primary', state.revealed && state.route === 'pacific');
    prompt.textContent = state.labels ? '看看大洲和大洋在图上怎么分布。' : route.question;
    feedback.textContent = !state.labels && state.revealed ? route.answer : '';
    canvas.setAttribute('aria-label', state.labels
      ? '世界地图。七个大洲和本册四个大洋：' + geography.map(([name]) => name).join('、')
      : `世界地图示意。从${route.startName}到${route.endName}。${state.revealed ? route.answer : ''}`);
    draw();
  }

  function change(partial) {
    Object.assign(state, partial);
    update();
    onChange?.({ ...state });
  }

  names.addEventListener('click', () => change({ labels: !state.labels }));
  reveal.addEventListener('click', () => change({ revealed: !state.revealed }));
  changeRoute.addEventListener('click', () => {
    change({ route: changeRoute.dataset.worldRoute, revealed: false });
    reveal.focus({ preventScroll: true });
  });
  const observer = new ResizeObserver(draw);
  observer.observe(canvas);
  update();
  return () => observer.disconnect();
}

export function mountWorldCheck(host, question, saved, onChange) {
  let selected = oceanChoices.includes(saved?.selected) ? saved.selected : '';
  host.innerHTML = `<div class="world-check" data-world-check>
    <p id="world-check-question"></p>
    <figure class="inquiry-world">
      <canvas role="img" width="640" height="320" aria-label="区域地图，左边标出非洲东岸，右边标出澳大利亚西岸"></canvas>
    </figure>
    <div class="world-check-controls">
      <div class="world-check-choices" role="group" aria-labelledby="world-check-question">
        ${oceanChoices.map(ocean => `<button type="button" class="button" aria-pressed="false" data-world-choice="${ocean}">${ocean}</button>`).join('')}
      </div>
      <p class="world-check-feedback" role="status" data-world-check-feedback></p>
    </div>
  </div>`;

  const canvas = host.querySelector('canvas');
  const context = canvas.getContext('2d');
  const choices = [...host.querySelectorAll('[data-world-choice]')];
  const feedback = host.querySelector('[data-world-check-feedback]');
  host.querySelector('#world-check-question').textContent = question;

  function draw() {
    drawMap(canvas, context, (width, height) => {
      const position = paintWorld(context, width, height, 77, 164, 25);
      const start = position(-10.8, 40.5);
      const end = position(-21.8, 114.1);
      if (selected === '印度洋') {
        mapLabel(context, width, height, '印度洋', ...flightPath(context, start, end), 'focus');
      }
      coastPoint(context, ...start);
      coastPoint(context, ...end);
      mapLabel(context, width, height, '非洲东岸', start[0] - 14, start[1] - 17, 'coast');
      mapLabel(context, width, height, '澳大利亚西岸', end[0] + 17, end[1] - 17, 'coast');
    });
  }

  function update() {
    for (const button of choices) {
      button.setAttribute('aria-pressed', String(button.dataset.worldChoice === selected));
    }
    feedback.textContent = selected === '印度洋' ? '找到了。路线跨过印度洋。'
      : selected ? '再看看两个岸标之间的这片海。' : '';
    draw();
  }

  for (const button of choices) {
    button.addEventListener('click', () => {
      selected = button.dataset.worldChoice;
      update();
      onChange?.({ selected });
    });
  }
  const observer = new ResizeObserver(draw);
  observer.observe(canvas);
  update();
  return () => observer.disconnect();
}
