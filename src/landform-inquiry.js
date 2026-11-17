const WIDTH = 620;
const HEIGHT = 216;
const profile = [
  [0, 185], [76, 184], [102, 177], [127, 165], [149, 145], [167, 121],
  [182, 125], [205, 91], [222, 100], [246, 50], [272, 83], [285, 68], [312, 108],
  [339, 113], [364, 108], [391, 111], [422, 105], [461, 109], [493, 104],
  [535, 108], [564, 102], [590, 106], [620, 103],
];

const spots = {
  range: {
    marker: 'A',
    name: '喜马拉雅山脉',
    description: '顺着山坡走一段，脚下的高度变得很快。',
    trace: profile.slice(4, 13),
    bounds: [134, 176],
  },
  plateau: {
    marker: 'B',
    name: '青藏高原内部',
    description: '这里也很高，往前走一段，脚下的起伏小得多。',
    trace: profile.slice(14),
    bounds: [352, 268],
  },
};
const markers = [['range', 246, 50], ['plateau', 461, 109]];

const styles = `<style>
  .landform-plot { margin: 0; }
  .landform-plot canvas { display: block; width: 100%; height: auto; aspect-ratio: 620 / 216; border-radius: 11px; }
  .landform-directions { display: flex; justify-content: space-between; font-size: .84rem; font-weight: 650; padding: 4px 7px 1px; }
  .landform-swatch { display: inline-block; width: 34px; height: 10px; margin-inline: 3px; border: 1px solid #827e60; border-radius: 3px; background: linear-gradient(90deg, #91a875 0 33%, #c8ae84 33% 67%, #fcf0d8 67%); }
  .landform-spots { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin-block-end: 8px; }
  .landform-spots button { width: 100%; min-height: 44px; padding: 5px 5px; border-radius: 9px; font-size: .9rem; white-space: nowrap; }
  .landform-spots [aria-pressed="true"] { color: #fff; background: #28604b; border-color: #28604b; }
  .landform-cue { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 4px 10px; color: var(--muted, #486053); font-size: .78rem; line-height: 1.35; margin-top: 5px; }
  .landform-cue > span:first-child { display: inline-flex; align-items: center; white-space: nowrap; }
  .landform-inquiry [data-landform-feedback] { margin-top: 7px; font-size: .92rem; color: #204e3d; }
  @media (max-height: 500px) and (orientation: landscape) {
    .landform-inquiry { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr); gap: 7px 12px; align-items: start; }
    .landform-plot { grid-row: 1 / span 3; }
    .landform-spots { grid-column: 2; margin-block: 0; }
    .landform-inquiry [data-landform-feedback] { grid-column: 2; margin-top: 0; }
  }
</style>`;

function trace(context, points) {
  context.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
}

function drawProfile(context, selected) {
  const sky = context.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, '#e3f2f3');
  sky.addColorStop(1, '#f5f6ea');
  context.fillStyle = sky;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.fillStyle = '#46675b14';
  for (const y of [58, 106, 156]) {
    context.fillRect(0, y, WIDTH, 2);
  }
  const spot = spots[selected];
  if (spot) {
    const [start, width] = spot.bounds;
    context.fillStyle = '#28604b20';
    context.fillRect(start, 0, width, HEIGHT);
  }

  context.save();
  trace(context, profile);
  context.lineTo(WIDTH, HEIGHT);
  context.lineTo(0, HEIGHT);
  context.closePath();
  context.clip();
  const bands = [
    [0, 124, '#fcf0d8'],
    [124, 36, '#c8ae84'],
    [160, HEIGHT - 160, '#91a875'],
  ];
  for (const [y, depth, color] of bands) {
    context.fillStyle = color;
    context.fillRect(0, y, WIDTH, depth);
  }
  context.strokeStyle = '#415f4860';
  context.lineWidth = 2;
  for (const y of [124, 160]) {
    trace(context, [[0, y], [WIDTH, y]]);
    context.stroke();
  }
  context.restore();
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.strokeStyle = '#54684f';
  context.lineWidth = 4;
  trace(context, profile);
  context.stroke();

  if (spot) {
    trace(context, spot.trace);
    context.strokeStyle = '#fffdf1';
    context.lineWidth = 12;
    context.stroke();
    context.strokeStyle = '#28604b';
    context.lineWidth = 7;
    context.stroke();
  }

  for (const [key, x, y] of markers) {
    context.beginPath();
    context.arc(x, y, selected === key ? 16 : 14, 0, Math.PI * 2);
    context.fillStyle = '#fffdf1';
    context.fill();
    context.lineWidth = 3;
    context.strokeStyle = '#28604b';
    context.stroke();
    context.fillStyle = '#204e3d';
    context.font = '700 20px system-ui';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(spots[key].marker, x, y + 1);
  }
}

export function mountLandformInquiry(host, saved = {}, onChange = () => {}) {
  let selected = Object.hasOwn(spots, saved?.selected) ? saved.selected : null;
  host.innerHTML = `${styles}
    <div class="landform-inquiry">
      <div class="landform-spots" role="group" aria-label="对比山脉和高原">
        ${Object.entries(spots).map(([key, spot]) => `<button type="button" class="chip" data-landform-spot="${key}" aria-pressed="false">${spot.marker} ${spot.name}</button>`).join('')}
      </div>
      <figure class="landform-plot">
        <canvas role="img" aria-label="自南向北的教学示意剖面，山脉轮廓尖而陡，北侧高原处在高处且起伏相对较小" width="${WIDTH}" height="${HEIGHT}"></canvas>
        <div class="landform-directions"><span>南</span><span>北</span></div>
        <figcaption class="landform-cue"><span>低<span class="landform-swatch" aria-hidden="true"></span>高</span><span>南北向剖面 · 教学示意</span></figcaption>
      </figure>
      <p data-landform-feedback role="status"></p>
    </div>`;
  const group = host.querySelector('.landform-spots');
  const controls = [...group.querySelectorAll('button')];
  const canvas = host.querySelector('canvas');
  const context = canvas.getContext('2d');
  const feedback = host.querySelector('[data-landform-feedback]');

  function paint() {
    const width = canvas.clientWidth;
    if (!context || !width) return;
    const pixels = Math.round(width * Math.min(devicePixelRatio || 1, 2));
    const height = Math.round(pixels * HEIGHT / WIDTH);
    if (canvas.width !== pixels) canvas.width = pixels;
    if (canvas.height !== height) canvas.height = height;
    context.setTransform(pixels / WIDTH, 0, 0, height / HEIGHT, 0, 0);
    drawProfile(context, selected);
  }

  function update() {
    for (const control of controls) {
      control.setAttribute('aria-pressed', String(control.dataset.landformSpot === selected));
    }
    feedback.textContent = spots[selected]?.description ?? '两处都很高。点 A 或 B，看看哪一处起伏更大。';
    paint();
  }

  function select(choice) {
    if (!choice || choice === selected) return;
    selected = choice;
    update();
    onChange({ selected });
  }

  const observer = new ResizeObserver(paint);
  observer.observe(canvas);
  group.addEventListener('click', event => select(event.target.closest('[data-landform-spot]')?.dataset.landformSpot));
  canvas.addEventListener('click', event => {
    const bounds = canvas.getBoundingClientRect();
    const hit = markers.find(([, x, y]) => Math.hypot(
      bounds.left + x * bounds.width / WIDTH - event.clientX,
      bounds.top + y * bounds.height / HEIGHT - event.clientY,
    ) <= 22);
    select(hit?.[0]);
  });
  update();
  return () => observer.disconnect();
}
