import { escapeHtml as escape } from './inquiry-view.js?v=6';

// Each prompt asks for a particular piece of the existing lesson material.
const firstBookReading = {
  'intro': [0, '哪条材料提醒我们在同一场雨后同时观察两个高度？', '要比较地势和积水，记录的雨后时间也要一致。'],
  'earth-space': [0, '从太阳向外查找地球，应先用哪条记录？', '行星的轨道顺序能用来定位，形状和大小另有用途。'],
  'spaceflight': [0, '哪条材料告诉我们怎样确认两幅图看的是同一处？', '找出前后都认得出的桥或村子，再对照河岸。'],
  'earth-model': [1, '哪条材料告诉我们怎样同时用 40°N、116°E 定位？', '沿一条纬线仍可走到许多地方，两条线的交点才能定下位置。'],
  'earth-motion': [0, '哪条材料能解释同一天里一个地点走进亮面？', '模型只改变自转时刻，先考虑同一天昼夜的变化。'],
  'project-earth': [0, '有限时间内，要先按哪条材料筛选探测地点？', '先看有无固体地表，再用现有的温度和气压线索筛选。'],
  'maps': [1, '测得图上 3 厘米，哪条材料能把图上距离换成实地距离？', '换算距离要读比例尺，方向、符号和图名不能替代比例尺。'],
  'contours': [1, '哪条材料能帮你判断哪段斜坡更陡？', '比坡度要同时想高度变化和水平距离。相同等高距时，线更密的一段更陡。'],
  'project-orienteering': [0, '要按顺序过旗并安全过河，先看哪条材料？', '先落实 1 号旗、能走的桥和 2 号旗，再用距离或地标完善路线。'],
  'land-ocean': [0, '比较两座山脉的高地分布，要先检查哪类记录可比？', '同一套高程色阶让两地较高和较低的地段能用相同标准比较。'],
  'land-change': [0, '要判断高山沉积岩过去是否在海水里形成，先找哪条直接线索？', '嵌在原岩层里的海洋生物化石直接说明了岩层形成环境。岩层抬升可以解释它为什么后来到了高处。'],
  'project-seafloor': [0, '从海边往深处排三个观测站，哪条记录给出了各段坡面特点？', '近岸浅缓、坡段快速变深、深处宽广，正好对应这次要排的三个站。'],
  'weather': [2, '为了给活动选时段，哪条材料提醒你核对雷电预警？', '预报要按时段看，并且要排除有预警的时段。'],
  'temp-rain': [1, '要算一年中气温相差多少，哪条材料写出了计算办法？', '先找到最暖月和最冷月，做减法。蓝色柱子记录降水，单位是毫米。'],
  'climate': [0, '找出哪类热带气候符合全年暖且每月都多雨，先查哪条资料？', '常年暖还要常年湿。草原和季风区通常有明显的多雨期。'],
  'climate-life': [0, '只比较怎样更快把雨水排离屋顶，哪条材料最直接？', '既要让水沿坡流向低处，还要给它沿檐沟或排水口离开的去处。'],
  'project-nest': [0, '要先挑出安静又有遮蔽的点，点开哪条材料？', '位置先看有无风口、遮蔽和人流，再把选址理由写进草图。'],
  'people': [0, '两处人口数不同，哪条材料提醒你还要核对面积？', '人口密度比较的是平均每平方千米的人数，不能只比人口总数。'],
  'cooperation': [0, '这批货必须按时又便宜，哪条记录给出了比较顺序？', '先排除到不了的方案，再比较达标方案的费用。'],
  'project-made-in-china': [0, '哪条材料记下了可写进推广语的本次测温结果和条件？', '要把数字和本次测试条件一起写，其他品牌的成绩还没有测。'],
};

const oceanReadings = [
  {title: '两幅图的颜色怎样读', text: '两幅地形示意用相同高程色阶。现在可以用同一种颜色标准找出各自的较高地带。'},
  {title: '从港口走进日常', text: '渔船把鱼带回港口，货船沿航线运东西。'},
  {title: '从海上追踪水汽', text: '海水蒸发，水汽可随风上岸，在适合的条件下形成降雨。'},
];

export function lessonReadingPractice(lesson, inquiry) {
  const [answer, prompt, clue] = firstBookReading[lesson.id];
  return { answer, prompt, clue, sources: inquiry.read || oceanReadings };
}

export function renderReadingPractice(plan, saved) {
  return `<section class="lesson-reading-practice" data-reading-practice>
    <h3 id="lesson-reading-question">${escape(plan.prompt)}</h3>
    <div class="reading-evidence-buttons" role="group" aria-labelledby="lesson-reading-question">
      ${plan.sources.map(({title}, index) => `<button class="button" type="button" data-reading-evidence="${index}" aria-pressed="false">${escape(title)}</button>`).join('')}
    </div>
    <p class="evidence" data-reading-excerpt>${Number.isInteger(saved?.selected) ? escape(plan.sources[saved.selected]?.text || '') : '点一条材料，读出它能提供什么线索。'}</p>
    <p class="lesson-reading-feedback" data-reading-feedback role="status"></p>
  </section>`;
}

export function bindReadingPractice(root, plan, saved, save) {
  const scope = root.querySelector('[data-reading-practice]');
  const controls = [...scope.querySelectorAll('[data-reading-evidence]')];
  const excerpt = scope.querySelector('[data-reading-excerpt]');
  const feedback = scope.querySelector('[data-reading-feedback]');
  let selected = Number.isInteger(saved?.selected) && plan.sources[saved.selected] ? saved.selected : null;
  let tried = saved?.tried === true;
  let outcome = ['independent', 'guided'].includes(saved?.outcome) ? saved.outcome : null;

  function paint() {
    controls.forEach((button, index) => button.setAttribute('aria-pressed', String(index === selected)));
    if (outcome) scope.dataset.proofOutcome = outcome;
    if (selected === null) return;
    scope.dataset.result = selected === plan.answer ? 'correct' : 'retry';
    const source = plan.sources[selected];
    excerpt.textContent = source.text;
    feedback.textContent = selected === plan.answer
      ? (outcome === 'guided' ? '换材料后找到依据。' : '找到了依据。') + plan.clue
      : '这条材料讲的是「' + source.title + '」。本题要找另一条线索。' + plan.clue;
  }

  controls.forEach((button, index) => button.addEventListener('click', () => {
    selected = index;
    if (index === plan.answer) outcome ||= tried ? 'guided' : 'independent';
    else tried = true;
    save({ selected, tried, outcome });
    paint();
    if (feedback.getBoundingClientRect().bottom > innerHeight - 8) feedback.scrollIntoView({ block: 'nearest' });
  }));
  paint();
}
