import { COAST_RINGS } from './geo-model.js';

const locations = [
  { id: 'asia', name: '亚洲', point: [44, 88], hint: '从亚洲东岸往外看，隔着北太平洋可以到北美洲。' },
  { id: 'europe', name: '欧洲', point: [54, 19], hint: '欧洲西面临大西洋，和亚洲在同一片连成一体的陆地上。' },
  { id: 'africa', name: '非洲', point: [7, 19], hint: '从非洲向西跨过大西洋，可以到南美洲。' },
  { id: 'north-america', name: '北美洲', point: [46, -107], hint: '北美洲西面是太平洋，东面是大西洋。' },
  { id: 'south-america', name: '南美洲', point: [-18, -59], hint: '南美洲西岸背靠安第斯山脉，面向太平洋。' },
  { id: 'oceania', name: '大洋洲', point: [-25, 136], hint: '澳大利亚是大洋洲面积最大的国家。它西临印度洋，东临太平洋。' },
  { id: 'antarctica', name: '南极洲', point: [-77, 18], hint: '南极洲大部分陆地覆盖着冰。图两侧可以相接。' },
  { id: 'pacific', name: '太平洋', point: [4, -146], hint: '亚洲和美洲之间隔着太平洋。在这张图上，它还延伸到地图另一侧。' },
  { id: 'atlantic', name: '大西洋', point: [14, -37], hint: '大西洋隔开美洲与欧洲、非洲。' },
  { id: 'indian', name: '印度洋', point: [-24, 77], hint: '印度洋位于非洲、亚洲和大洋洲之间，并向南延伸。' },
  { id: 'arctic', name: '北冰洋', point: [76, -31], hint: '北冰洋在最北边，周围有北美洲、欧洲和亚洲的陆地。' },
];
const WIDTH = 620;
const HEIGHT = 310;
const point = (lat, lon) => [(lon + 180) * WIDTH / 360, (90 - lat) * HEIGHT / 180];

export function mountWorldInquiry(host, _, saved, onChange) {
  host.innerHTML = `<figure class="inquiry-world">
    <canvas role="img" aria-label="全球海陆轮廓和当前所选位置" width="${WIDTH * 2}" height="${HEIGHT * 2}"></canvas>
    <figcaption>教学示意 · 左右两边在地球上接在一起</figcaption>
  </figure><div class="inquiry-world-controls">
    <label>从图上找一处 <select><option value="">选择大洲或大洋</option>
      <optgroup label="七个大洲">${locations.slice(0, 7).map(item => `<option value="${item.id}">${item.name}</option>`).join('')}</optgroup>
      <optgroup label="本册四个大洋">${locations.slice(7).map(item => `<option value="${item.id}">${item.name}</option>`).join('')}</optgroup>
    </select></label>
    <p role="status"></p>
  </div>`;
  const canvas = host.querySelector('canvas');
  const context = canvas.getContext('2d');
  const select = host.querySelector('select');
  const feedback = host.querySelector('[role="status"]');
  select.value = locations.some(item => item.id === saved?.location) ? saved.location : '';
  function draw() {
    const location = locations.find(item => item.id === select.value);
    feedback.textContent = location?.hint ?? '想从亚洲往东到北美洲。中间隔着哪个大洋？';
    if (!context) return;
    context.setTransform(2, 0, 0, 2, 0, 0);
    context.fillStyle = '#c0e0ec';
    context.fillRect(0, 0, WIDTH, HEIGHT);
    context.fillStyle = '#e0d6ab';
    context.strokeStyle = '#536958';
    context.lineJoin = 'round';
    context.lineWidth = 1.4;
    for (const ring of COAST_RINGS) {
      context.beginPath();
      for (let index = 0; index < ring.length; index += 2) {
        const coordinates = point(ring[index + 1], ring[index]);
        if (index) context.lineTo(...coordinates);
        else context.moveTo(...coordinates);
      }
      context.closePath();
      context.fill();
      context.stroke();
    }
    context.setLineDash([5, 6]);
    context.strokeStyle = '#6b94a0';
    context.beginPath();
    context.moveTo(0, HEIGHT / 2);
    context.lineTo(WIDTH, HEIGHT / 2);
    context.stroke();
    context.setLineDash([]);
    if (!location) return;
    const [x, y] = point(...location.point);
    context.fillStyle = '#8a381d';
    context.beginPath();
    context.arc(x, y, 10, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#ffffff';
    context.lineWidth = 2.8;
    context.stroke();
    context.font = 'bold 25px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'bottom';
    context.lineWidth = 4;
    context.strokeText(location.name, Math.max(53, Math.min(WIDTH - 53, x)), Math.max(30, y - 12));
    context.fillStyle = '#1e3629';
    context.fillText(location.name, Math.max(53, Math.min(WIDTH - 53, x)), Math.max(30, y - 12));
  }
  select.addEventListener('change', () => {
    draw();
    onChange({ location: select.value });
  });
  draw();
}
