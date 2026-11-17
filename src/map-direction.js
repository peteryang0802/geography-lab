const directions = [
  { name: '北', angle: -90 },
  { name: '东', angle: 0 },
  { name: '南', angle: 90 },
  { name: '西', angle: 180 },
];

const examples = [
  {
    id: 'north-up',
    label: '北向上',
    rotation: 0,
    labels: ['上', '右', '下', '左'],
    origin: '起点',
    guide: '这张图的北朝上。点一个方向，看看从起点往哪边走。',
  },
  {
    id: 'north-arrow',
    label: '有指向标',
    rotation: 45,
    labels: ['右上', '右下', '左下', '左上'],
    origin: '起点',
    guide: '先看金色箭头。它指的是北，其他三个方向也跟着转。',
  },
  {
    id: 'grid',
    label: '有经纬网',
    rotation: 0,
    labels: ['41°N', '117°E', '39°N', '115°E'],
    origin: '40°N · 116°E',
    guide: '从起点沿同一条经线找南北，沿同一条纬线找东西。',
  },
];

export function mountMapDirection(host, saved, onChange = () => {}) {
  host.classList.add('direction-panel');
  host.innerHTML = `
    ${host.hasAttribute('data-activity') ? '' : '<h2>看图找方向</h2>'}
    <div class="direction-modes" role="group" aria-label="地图示例">
      ${examples.map(example => `<button class="chip" type="button" data-example="${example.id}" aria-pressed="false">${example.label}</button>`).join('')}
    </div>
    <div class="direction-map" data-view="north-up">
      <div class="direction-plot" role="group" aria-label="图上的四个方向">
        <span class="direction-origin" data-origin></span>
        ${directions.map(({ name }, index) => `
          <span class="direction-ray" data-ray="${index}" aria-hidden="true"></span>
          <button class="direction-point" type="button" data-bearing="${index}" aria-pressed="false">
            <strong>${name}</strong><span data-position></span>
          </button>`).join('')}
      </div>
    </div>
    <p class="direction-guide" role="status" aria-live="polite" aria-atomic="true"></p>`;

  const plot = host.querySelector('.direction-map');
  const origin = host.querySelector('[data-origin]');
  const guide = host.querySelector('.direction-guide');
  const tabs = [...host.querySelectorAll('[data-example]')];
  const points = [...host.querySelectorAll('[data-bearing]')];
  const rays = [...host.querySelectorAll('[data-ray]')];
  let active = examples[0];

  function showExample(example) {
    active = example;
    plot.dataset.view = example.id;
    origin.textContent = example.origin;
    guide.textContent = example.guide;
    tabs.forEach(tab => tab.setAttribute('aria-pressed', String(tab.dataset.example === example.id)));
    directions.forEach(({ name, angle }, index) => {
      const bearing = angle + example.rotation;
      const radians = bearing * Math.PI / 180;
      const point = points[index];
      point.style.setProperty('--point-x', `${50 + 36 * Math.cos(radians)}%`);
      point.style.setProperty('--point-y', `${50 + 36 * Math.sin(radians)}%`);
      point.querySelector('[data-position]').textContent = example.labels[index];
      point.setAttribute('aria-label', `${name}，${example.labels[index]}`);
      point.setAttribute('aria-pressed', 'false');
      rays[index].style.setProperty('--bearing', `${bearing}deg`);
      rays[index].removeAttribute('data-picked');
    });
  }

  function pickDirection(index) {
    points.forEach((other, position) => {
      other.setAttribute('aria-pressed', String(position === index));
      rays[position].toggleAttribute('data-picked', position === index);
    });
    const name = directions[index].name;
    if (active.id === 'grid') {
      const line = index % 2 === 0 ? '沿着 116°E 这条经线' : '沿着 40°N 这条纬线';
      guide.textContent = `从起点向${name}，${line}走到 ${active.labels[index]}。`;
    } else {
      const marker = active.id === 'north-arrow' ? '按图上的指向标，' : '';
      guide.textContent = `${marker}从起点向${name}，往图上的${active.labels[index]}方走。`;
    }
  }
  tabs.forEach((tab, index) => tab.addEventListener('click', () => {
    showExample(examples[index]);
    onChange({ example: active.id });
  }));
  points.forEach((point, index) => point.addEventListener('click', () => {
    pickDirection(index);
    onChange({ example: active.id, direction: index });
  }));
  showExample(examples.find(example => example.id === saved?.example) ?? active);
  if (Number.isInteger(saved?.direction) && directions[saved.direction]) pickDirection(saved.direction);
}
