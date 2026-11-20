import { reliefTransects } from './china-relief-readings.js?v=1';
import { assessmentLabels, assessmentState } from './assessment.js?v=3';

const lines = {
  36: {
    points: [[90, '青藏高原'], [107, '黄土高原'], [116, '华北平原']],
    prompt: '沿 36°N 从青藏高原走向华北平原，三个样点能说明什么？',
    options: [
      ['西、中、东三个样点由高到低，支持整体西高东低', '从三个读数能比较出大范围的高低差。再换一条纬线，检查局部变化。'],
      ['只要朝东走，每一小段都更低', '把视线移到两个字母之间。剖面中的小峰和低谷还会使局部海拔升降。'],
      ['黄土高原的样点比青藏高原的样点高', '比较 A 与 B 在纵轴上的位置，读数越向上越高。'],
    ],
    answer: 0,
  },
  32: {
    points: [[95, '青藏高原'], [106, '四川盆地一带'], [118, '东部低地样点']],
    prompt: '换到 32°N，怎样用新图核对原判断？',
    options: [
      ['中间有回升，所以东西总体高低也反了', '中间的一次回升只说明局部有起伏。对照 A 与 C，可以检查整段趋势。'],
      ['先核对 A 和 C，再沿线找一处局部回升', 'A 高、C 低支持整体由西向东降低，沿线起伏说明这种趋势不等于每一小段都下降。'],
      ['只凭 B 一个样点，就能判断各级阶梯的精确边界', '一个读数不足以划阶梯。实际边界还要结合更大范围的地形图。'],
    ],
    answer: 1,
  },
};

const bands = [
  ['#badce6', '低于 0 米'], ['#d4e9d1', '0–200 米'], ['#aacd9a', '200–500 米'],
  ['#ebd9a4', '500–1000 米'], ['#d6a97c', '1000–2000 米'], ['#ae7958', '2000–4000 米'],
  ['#f6f0e1', '4000 米以上'],
];
const letters = ['A', 'B', 'C'];
const pickElevation = (latitude, longitude) => reliefTransects[latitude][(longitude - 79) * 4];
const xProfile = index => 50 + index / 176 * 380;
const yProfile = height => 162 - height / 6000 * 136;
const mapX = lon => (lon - 72) * 570 / 64;
const mapY = lat => (54 - lat) * 326 / 36;

function mapMarkup(latitude) {
  const data = lines[latitude];
  const y = mapY(latitude);
  return `<figure class="china-relief-figure">
    <svg viewBox="0 0 570 326" role="img" aria-label="真实区域高程设色底图。虚线为北纬 ${latitude} 度，标出剖面取样点 A、B、C。">
      <image href="./assets/china-relief-elevation.webp" width="570" height="326"/>
      <path d="M${mapX(79)} ${y}H${mapX(123)}" fill="none" stroke="#1d3444" stroke-width="3.5" stroke-dasharray="9 5"/>
      <text class="relief-map-label" x="${mapX(74)}" y="${y - 12}">${latitude}°N</text>
      <text class="relief-map-label" x="530" y="31">↑ 北</text>
      ${data.points.map(([lon], i) => `<circle cx="${mapX(lon)}" cy="${y}" r="6" fill="#173742" stroke="#fff" stroke-width="2"/><text class="relief-map-label" x="${mapX(lon) - 5}" y="${y + 23}">${letters[i]}</text>`).join('')}
    </svg>
    <figcaption>中国及邻区真实高程。虚线是 ${latitude}°N 取样线。<span class="china-relief-legend">${bands.map(([color,label]) => `<span><i style="background:${color}"></i>${label}</span>`).join('')}</span></figcaption>
  </figure>`;
}

function profileMarkup(latitude) {
  const readings = reliefTransects[latitude];
  const points = readings.map((height, index) => [xProfile(index).toFixed(1), yProfile(height).toFixed(1)].join(',')).join(' ');
  const data = lines[latitude];
  return `<figure class="china-relief-figure china-relief-profile">
    <svg viewBox="0 0 456 196" role="img" aria-label="北纬 ${latitude} 度由西到东的高程曲线，${data.points.map(([lon,name], i) => letters[i] + name + pickElevation(latitude, lon) + '米').join('，')}。样点之间还有起伏。">
      <rect width="456" height="196" rx="9" fill="#f7f2e4"/>
      ${[0, 2000, 4000, 6000].map(value => `<path d="M50 ${yProfile(value)}H430" stroke="#a19983" stroke-dasharray="3 5"/><text x="45" y="${yProfile(value)+4}" text-anchor="end">${value}</text>`).join('')}
      <text x="8" y="17">海拔/米</text>
      <polyline points="50,162 ${points} 430,162" fill="#e2bc86" opacity=".72"/>
      <polyline points="${points}" fill="none" stroke="#754729" stroke-width="2"/>
      ${data.points.map(([lon], i) => {
        const x = xProfile((lon - 79) * 4);
        const y = yProfile(pickElevation(latitude, lon));
        return `<circle cx="${x}" cy="${y}" r="5" fill="#1f4651" stroke="white" stroke-width="1.1"/><text x="${x}" y="${y - 10}" class="relief-profile-letter">${letters[i]}</text>`;
      }).join('')}
      <text x="53" y="183">西 · 79°E</text><text x="431" y="183" text-anchor="end">东 · 123°E</text>
    </svg>
    <figcaption><strong>${latitude}°N 实际高程剖面</strong> · 按经度抽样，不能用画面倾角直接量坡度。
      <ul>${data.points.map(([lon,name], i) => `<li><b>${letters[i]}</b> ${name} · ${pickElevation(latitude, lon)} 米</li>`).join('')}</ul></figcaption>
  </figure>`;
}

export const chinaReliefMarkup = () => '<section class="china-relief" data-china-relief></section>';

export function chinaReliefTasks(entry) {
  return entry.id === '8a-relief' ? [36, 32].map(latitude => ({
    ...lines[latitude], latitude, id: 'course-map-profile-' + latitude + '-' + entry.id,
  })) : [];
}

export function mountChinaRelief(root, saved, change, { fixedLatitude, getAssessment } = {}) {
  const host = root.querySelector('[data-china-relief]');
  if (!host) return;
  let latitude = fixedLatitude || (saved?.latitude === 32 ? 32 : 36);
  const choices = { ...saved?.choices };
  function paint(focus) {
    host.dataset.reliefLatitude = latitude;
    const { prompt, options, answer } = lines[latitude];
    const selected = choices[latitude];
    const correct = selected === answer;
    const outcome = getAssessment ? assessmentState(getAssessment(latitude), answer) : '';
    host.innerHTML = `<p class="geo-observation-aim">同一条虚线在地图上是位置，在剖面上是海拔变化。</p>
      <div class="china-relief-pair">${mapMarkup(latitude)}${profileMarkup(latitude)}</div>
      <section class="china-relief-answers"><h3 tabindex="-1" data-relief-heading>${prompt}</h3>
        <div class="term-choices">${options.map(([label], i) => `<button type="button" class="button" data-relief-option="${i}" aria-pressed="${selected === i}">${label}</button>`).join('')}</div>
        <p class="term-feedback" role="status" data-result="${correct ? 'correct' : 'retry'}">${options[selected]?.[1] ?? ''}</p>
        ${outcome && outcome !== 'unchecked' ? `<p class="geo-assessment-label">${assessmentLabels[outcome]}</p>` : ''}
        ${!fixedLatitude && latitude === 36 && correct ? '<button type="button" class="button primary" data-relief-transfer>换到 32°N 再验证 →</button>' : ''}
      </section>`;
    if (focus) host.querySelector(focus)?.focus({preventScroll:true});
  }
  host.addEventListener('click', event => {
    const option = event.target.closest('[data-relief-option]');
    if (option) {
      choices[latitude] = Number(option.dataset.reliefOption);
      change({ latitude, choices }, latitude, choices[latitude]);
      paint(`[data-relief-option="${choices[latitude]}"]`);
    } else if (event.target.closest('[data-relief-transfer]')) {
      latitude = 32;
      change({ latitude, choices });
      paint('[data-relief-heading]');
    }
  });
  paint();
}
