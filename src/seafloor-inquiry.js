const width = 560;
const height = 254;
const seaLevel = 59;

const shelf = [[82, 59], [111, 77], [159, 86], [203, 92]];
const slope = [[203, 92], [222, 117], [247, 160], [279, 193]];
const basin = [[279, 193], [309, 201], [348, 201], [373, 202]];
const floor = [
  [0, 40], [36, 31], [56, 44], ...shelf, ...slope.slice(1), ...basin.slice(1),
  [395, 235], [415, 195], [442, 194], [468, 174], [490, 142], [515, 169], [560, 197],
];

const stops = {
  shelf: {
    label: '近岸', number: '1', trace: shelf, mark: [143, 81],
    feedback: '靠岸的海底浅，往前走也只变深一点。这一段叫大陆架。',
  },
  slope: {
    label: '陡坡', number: '2', trace: slope, mark: [242, 151],
    feedback: '往外没走多远，海底却一下子深了许多。这一段叫大陆坡。',
  },
  basin: {
    label: '远海', number: '3', trace: basin, mark: [326, 201],
    feedback: '到了远海，海底已经很深，眼前这一段又变平了。这里是洋盆。',
  },
};

function trace(context, points) {
  context.beginPath();
  context.moveTo(...points[0]);
  for (const point of points.slice(1)) context.lineTo(...point);
}

function writeLabel(context, text, x, y, color = '#153d46', size = 24) {
  context.fillStyle = color;
  context.font = `650 ${size}px system-ui, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, x, y);
}

function nameLandform(context, text, x, y, endX, endY) {
  context.strokeStyle = '#416b72';
  context.lineWidth = 1.5;
  trace(context, [[x, y + 14], [endX, endY]]);
  context.stroke();
  writeLabel(context, text, x, y);
}

function drawProfile(context, selected) {
  context.fillStyle = '#eef4e9';
  context.fillRect(0, 0, width, height);
  const water = context.createLinearGradient(0, seaLevel, 0, height);
  water.addColorStop(0, '#c8e8ef');
  water.addColorStop(1, '#9dcedc');
  context.fillStyle = water;
  context.fillRect(0, seaLevel, width, height - seaLevel);

  const ground = context.createLinearGradient(0, 31, 0, height);
  ground.addColorStop(0, '#e2c68e');
  ground.addColorStop(1, '#b99060');
  trace(context, [...floor, [width, height], [0, height]]);
  context.closePath();
  context.fillStyle = ground;
  context.fill();

  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.strokeStyle = '#5e6044';
  context.lineWidth = 3;
  trace(context, floor);
  context.stroke();
  context.strokeStyle = '#398998';
  trace(context, [[82, seaLevel], [width, seaLevel]]);
  context.stroke();

  writeLabel(context, '海岸', 56, 17, '#536049');
  writeLabel(context, '海面', 500, 42);
  nameLandform(context, '海沟', 395, 156, 395, 224);
  nameLandform(context, '大洋中脊', 484, 105, 489, 135);

  if (selected) {
    trace(context, stops[selected].trace);
    context.strokeStyle = '#fffdf3';
    context.lineWidth = 13;
    context.stroke();
    context.strokeStyle = '#a14b21';
    context.lineWidth = 8;
    context.stroke();
  }

  for (const [id, { number, mark: [x, y] }] of Object.entries(stops)) {
    const active = id === selected;
    trace(context, [[x, y - 24], [x, y - 4]]);
    context.strokeStyle = active ? '#a14b21' : '#2a5760';
    context.lineWidth = 2.5;
    context.stroke();
    context.beginPath();
    context.arc(x, y - 31, 15, 0, Math.PI * 2);
    context.fillStyle = active ? '#8e3f1f' : '#f5fbfa';
    context.fill();
    context.stroke();
    writeLabel(context, number, x, y - 30, active ? '#fffdf3' : '#194952', 23);
  }
}

export function mountSeafloorInquiry(host, saved, onChange = () => {}) {
  let selected = Object.hasOwn(stops, saved?.selected) ? saved.selected : null;
  host.innerHTML = `
    <div class="seafloor-inquiry">
      <figure class="seafloor-figure inquiry-figure">
        <canvas width="${width}" height="${height}" role="img" aria-label="海底地形剖面示意。从左向右是海岸、浅缓的近岸、陡坡、深海洋底，深海有一处海沟和一条大洋中脊。"></canvas>
        <figcaption>海底剖面示意 · 深浅与距离未按比例</figcaption>
      </figure>
      <div class="seafloor-controls inquiry-controls" role="group" aria-label="选择剖面上的一段">
        ${Object.entries(stops).map(([id, stop]) => `<button class="chip" type="button" data-seafloor-stop="${id}" aria-pressed="false">${stop.number} ${stop.label}</button>`).join('')}
      </div>
      <p class="seafloor-feedback inquiry-feedback" role="status"></p>
    </div>`;
  const canvas = host.querySelector('canvas');
  const context = canvas.getContext('2d');
  const controls = host.querySelector('.seafloor-controls');
  const feedback = host.querySelector('.seafloor-feedback');

  function draw() {
    if (!context || !canvas.clientWidth) return;
    const pixelWidth = Math.round(canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 2));
    const pixelHeight = Math.round(pixelWidth * height / width);
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    context.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
    drawProfile(context, selected);
  }

  function render() {
    for (const button of controls.querySelectorAll('[data-seafloor-stop]')) {
      button.setAttribute('aria-pressed', String(button.dataset.seafloorStop === selected));
    }
    feedback.textContent = selected ? stops[selected].feedback : '点图上的数字或选一段海底，找找哪里一下变深。';
    draw();
  }

  function select(id) {
    if (id === selected) return;
    selected = id;
    render();
    onChange({ selected });
  }

  function onControl(event) {
    const button = event.target.closest('[data-seafloor-stop]');
    if (button) select(button.dataset.seafloorStop);
  }

  function onDiagram(event) {
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) * width / bounds.width;
    const y = (event.clientY - bounds.top) * height / bounds.height;
    const radius = 22 * width / bounds.width;
    const hit = Object.entries(stops).find(([, { mark: [cx, cy] }]) =>
      Math.hypot(cx - x, cy - 26 - y) <= radius);
    if (hit) select(hit[0]);
  }

  controls.addEventListener('click', onControl);
  canvas.addEventListener('click', onDiagram);
  const resize = new ResizeObserver(draw);
  resize.observe(canvas);
  render();

  return () => {
    resize.disconnect();
    controls.removeEventListener('click', onControl);
    canvas.removeEventListener('click', onDiagram);
  };
}
