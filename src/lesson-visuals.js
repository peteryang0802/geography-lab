const width = 600;
const height = 310;

const activities = {
  intro: {
    caption: '同一场雨后的上学路。蓝色水面表示积水。',
    hint: '点图上的坡脚或坡顶，也可以用按钮。看过两处，再比路线。',
    groups: [
      { label: '先看哪里留水', choices: ['foot', 'top'] },
      { label: '再选上学路线', choices: ['a', 'b'] },
    ],
    choices: {
      foot: ['看坡脚', '坡脚这一处还看得到水洼。雨水顺坡往下流，低洼处更容易存水。'],
      top: ['看坡顶', '这处坡顶没有明显的积水。再点一次坡脚，对照同一场雨留下的痕迹。'],
      a: ['看路线 A', '路线 A 较短，会经过积水的坡脚。'],
      b: ['看路线 B', '路线 B 多走约两分钟，却能绕开水洼。换回路线 A，就能对比两条路。'],
    },
    hotspots: { foot: [287, 204], top: [332, 87] },
    draw: drawRoute,
  },
  'earth-space': {
    caption: '只画出了离太阳最近的三颗行星。大小和间距都经过了简化。',
    hint: '从太阳向右数。点一颗行星或它的序号按钮，查查它叫什么。',
    choices: {
      mercury: ['第 1 颗', '这是水星，离太阳最近。沿图再往右找。'],
      venus: ['第 2 颗', '这是金星。从太阳出发，再数一颗就到地球了。'],
      earth: ['第 3 颗', '这颗蓝绿相间的是地球。从太阳往外数，它排在第 3 位。'],
    },
    hotspots: { mercury: [221, 143], venus: [363, 143], earth: [507, 143] },
    draw: drawPlanets,
  },
  spaceflight: {
    caption: '教学示意图。前后两张图画的是同一处河湾。',
    hint: '找到桥和村子，再选「洪水后」。用同一座桥看水面变了多少。',
    initialChoice: 'before',
    choices: {
      before: ['洪水前', '洪水前，河水沿窄窄的河道流动，桥北面的平地还露在外面。'],
      after: ['洪水后', '同一座桥、同一个村子还在原处。看桥北面，河水现在盖住了大片平地。'],
      overlay: ['叠着看', '有斜纹的地方是后来被水盖住的陆地。把桥和村子对齐，就能比较同一个地方。'],
    },
    draw: drawFlood,
  },
};

export function hasOpeningVisual(id) {
  return Object.hasOwn(activities, id);
}

export function mountOpeningVisual(host, id, saved, onChange) {
  if (!host || !hasOpeningVisual(id)) return;

  const activity = activities[id];
  let choice = Object.hasOwn(activity.choices, saved?.choice) ? saved.choice : null;
  const option = key => `<button type="button" class="chip" data-opening-choice="${key}" aria-pressed="false">${activity.choices[key][0]}</button>`;
  host.innerHTML = `
    <div class="opening-activity">
      <figure class="opening-figure">
        <canvas role="img" aria-label="${activity.caption}" width="${width}" height="${height}" style="display:block;width:100%;height:auto;aspect-ratio:${width}/${height}"></canvas>
        <figcaption>${activity.caption}</figcaption>
      </figure>
      <div class="opening-dock">
        <div class="opening-controls">
          ${activity.groups
            ? activity.groups.map(({ label, choices }) => `<div class="opening-choice-group" role="group" aria-label="${label}">
                <p class="opening-choice-label">${label}</p><div class="opening-choice-buttons">${choices.map(option).join('')}</div>
              </div>`).join('')
            : Object.keys(activity.choices).map(option).join('')}
        </div>
        <p class="opening-feedback" role="status"></p>
      </div>
    </div>`;

  const canvas = host.querySelector('canvas');
  const context = canvas.getContext('2d');
  const controls = host.querySelector('.opening-controls');
  const buttons = controls.querySelectorAll('button');
  const feedback = host.querySelector('.opening-feedback');

  function draw() {
    if (!context) return;
    const renderedWidth = canvas.getBoundingClientRect().width;
    if (!renderedWidth) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(renderedWidth * dpr);
    const pixelHeight = Math.round(pixelWidth * height / width);
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    context.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
    activity.draw(context, choice);
  }

  function refresh() {
    for (const button of buttons) {
      const active = button.dataset.openingChoice === (choice ?? activity.initialChoice);
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('active', active);
    }
    feedback.textContent = activity.choices[choice]?.[1] || activity.hint;
    draw();
  }

  function select(next) {
    choice = next;
    refresh();
    onChange?.({ choice });
  }

  function onControlClick(event) {
    const button = event.target.closest('button[data-opening-choice]');
    if (button) select(button.dataset.openingChoice);
  }

  function onFigureClick(event) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * width / rect.width;
    const y = (event.clientY - rect.top) * height / rect.height;
    const radius = Math.max(48, 22 * width / rect.width);
    const target = Object.entries(activity.hotspots).find(([, [px, py]]) => Math.hypot(px - x, py - y) < radius);
    if (target) select(target[0]);
  }

  controls.addEventListener('click', onControlClick);
  if (activity.hotspots) {
    canvas.style.cursor = 'pointer';
    canvas.addEventListener('click', onFigureClick);
  }
  const resize = new ResizeObserver(draw);
  resize.observe(canvas);
  refresh();

  return () => {
    resize.disconnect();
    controls.removeEventListener('click', onControlClick);
    canvas.removeEventListener('click', onFigureClick);
  };
}

function line(ctx, points, color, lineWidth, dash = []) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.setLineDash(dash);
  ctx.stroke();
  ctx.setLineDash([]);
}

function circle(ctx, x, y, radius, fill, outline) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function oval(ctx, x, y, radiusX, radiusY, fill) {
  ctx.beginPath();
  ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function label(ctx, value, x, y, color = '#163632', size = 24) {
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

function building(ctx, x, y, scale, roof = '#b75937') {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#fff7df';
  ctx.fillRect(-18, -16, 36, 28);
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(-23, -15);
  ctx.lineTo(0, -36);
  ctx.lineTo(23, -15);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#6e7265';
  ctx.fillRect(-5, -4, 10, 16);
  ctx.restore();
}

function mark(ctx, x, y, selected, color = '#204c42') {
  if (selected) circle(ctx, x, y, 15, '#fff7df', '#f3ae45');
  circle(ctx, x, y, 8, color, '#fffbed');
}

function drawRoute(ctx, choice) {
  ctx.fillStyle = '#dcead5';
  ctx.fillRect(0, 0, width, height);
  oval(ctx, 331, 102, 147, 77, '#c8dfbd');
  oval(ctx, 331, 92, 110, 58, '#b5d4aa');
  oval(ctx, 331, 85, 66, 35, '#a4c899');
  oval(ctx, 289, 212, 75, 32, '#b1ccad');

  const routeA = [[57, 172], [179, 187], [286, 207], [403, 181], [529, 146]];
  const routeB = [[57, 172], [158, 112], [251, 72], [332, 87], [426, 96], [529, 146]];
  line(ctx, routeA, '#fff9e6', choice === 'a' ? 18 : 12);
  line(ctx, routeB, '#fff9e6', choice === 'b' ? 18 : 12);
  line(ctx, routeA, '#aa4c32', choice === 'a' ? 10 : 5);
  line(ctx, routeB, '#225e57', choice === 'b' ? 10 : 5, [13, 8]);

  oval(ctx, 287, 207, 37, 13, '#387d9a');
  oval(ctx, 279, 204, 14, 3, '#c4edf2');
  mark(ctx, 287, 207, choice === 'foot', '#286987');
  mark(ctx, 332, 87, choice === 'top');
  building(ctx, 58, 163, 1);
  building(ctx, 533, 141, 1.15, '#33675d');

  label(ctx, '家', 59, 216);
  label(ctx, '学校', 533, 189);
  label(ctx, '坡顶', 332, 50);
  label(ctx, '坡脚', 287, 244);
  label(ctx, '路线 A', 427, 226, '#833621');
  label(ctx, '路线 B', 146, 75, '#1a524a');
}

function drawPlanets(ctx, choice) {
  ctx.fillStyle = '#162c44';
  ctx.fillRect(0, 0, width, height);
  for (const [x, y] of [[32, 49], [162, 59], [271, 38], [392, 69], [501, 39], [563, 76], [109, 254], [282, 215], [409, 248], [549, 204]]) {
    circle(ctx, x, y, 2, '#90a6ba');
  }
  line(ctx, [[92, 143], [550, 143]], '#8faabe', 2, [6, 8]);
  line(ctx, [[539, 134], [551, 143], [539, 152]], '#8faabe', 2);
  circle(ctx, 77, 143, 49, '#fdc05c');
  circle(ctx, 68, 132, 30, '#ffd479');
  label(ctx, '太阳', 77, 218, '#ffe2a2');

  const planets = [
    { id: 'mercury', name: '水星', radius: 16, color: '#bba997' },
    { id: 'venus', name: '金星', radius: 29, color: '#e5ad70' },
    { id: 'earth', name: '地球', radius: 33, color: '#6fa9d6' },
  ];

  planets.forEach(({ id, name, radius, color }, index) => {
    const [x, y] = activities['earth-space'].hotspots[id];
    if (choice === id) circle(ctx, x, y, 46, '#253c58', '#fbd482');
    circle(ctx, x, y, radius, color);
    if (id === 'mercury') {
      circle(ctx, x - 6, y - 4, 4, '#8e7d6d');
      circle(ctx, x + 6, y + 8, 3, '#948678');
    }
    if (id === 'venus') {
      oval(ctx, x - 3, y - 7, 21, 5, '#f3c391');
      oval(ctx, x + 1, y + 7, 22, 5, '#cf8e5d');
    }
    if (id === 'earth') {
      oval(ctx, x - 9, y - 12, 15, 8, '#a4c887');
      oval(ctx, x - 2, y - 1, 8, 15, '#a4c887');
      oval(ctx, x + 18, y + 12, 9, 6, '#a4c887');
    }
    label(ctx, `第 ${index + 1} 颗`, x, 217, '#e2edf3', 22);
    if (choice === id) label(ctx, name, x, 256, '#ffe2a2');
  });
}

const riverPath = [[237, -20], [249, 34], [271, 77], [348, 122], [365, 162], [338, 214], [293, 260], [283, 333]];

function floodplain(ctx) {
  ctx.beginPath();
  ctx.moveTo(235, 9);
  ctx.bezierCurveTo(281, 25, 247, 48, 319, 39);
  ctx.bezierCurveTo(392, 41, 416, 80, 415, 105);
  ctx.bezierCurveTo(412, 135, 391, 147, 376, 165);
  ctx.bezierCurveTo(365, 210, 338, 207, 347, 172);
  ctx.bezierCurveTo(336, 126, 273, 121, 255, 94);
  ctx.bezierCurveTo(242, 73, 201, 34, 235, 9);
  ctx.closePath();
}

function drawFlood(ctx, choice) {
  ctx.fillStyle = '#dce8cb';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#c6d9b1';
  ctx.fillRect(29, 27, 160, 92);
  ctx.fillRect(28, 211, 202, 77);
  ctx.fillRect(428, 28, 131, 95);
  for (const y of [46, 67, 88, 109]) {
    line(ctx, [[43, y], [173, y]], '#aabf97', 3);
    line(ctx, [[444, y], [543, y]], '#aabf97', 3);
  }
  for (const y of [228, 249, 270]) line(ctx, [[44, y], [212, y]], '#aabf97', 3);

  if (choice === 'after' || choice === 'overlay') {
    floodplain(ctx);
    ctx.fillStyle = '#91c4da';
    ctx.fill();
  }
  if (choice === 'overlay') {
    ctx.save();
    ctx.clip();
    for (let x = 158; x < 465; x += 17) {
      line(ctx, [[x, 200], [x + 123, 0]], '#25566b', 3);
    }
    ctx.restore();
  }

  line(ctx, riverPath, '#3f7fa5', 40);
  line(ctx, riverPath, '#579abb', 27);
  line(ctx, [[-6, 168], [184, 153], [302, 164], [403, 164], [606, 191]], '#7f7965', 16);
  line(ctx, [[-6, 168], [184, 153], [302, 164], [403, 164], [606, 191]], '#f7e9c8', 11);
  line(ctx, [[326, 153], [397, 153]], '#5d594b', 3);
  line(ctx, [[326, 176], [397, 176]], '#5d594b', 3);
  building(ctx, 479, 210, 0.86);
  building(ctx, 518, 226, 0.65);
  building(ctx, 547, 215, 0.73);
  label(ctx, '村子', 517, 266);
  label(ctx, '桥', 392, 199);
  label(ctx, '北', 567, 40, '#294a3b', 22);
  line(ctx, [[567, 91], [567, 56]], '#294a3b', 3);
  line(ctx, [[558, 66], [567, 56], [576, 66]], '#294a3b', 3);
  if (choice === 'overlay') {
    label(ctx, '新增淹没区', 340, 76, '#163f54', 22);
    ctx.beginPath();
    ctx.arc(363, 162, 22, 0, Math.PI * 2);
    ctx.strokeStyle = '#8d4e24';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}
