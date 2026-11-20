import { escapeHtml as escape } from './inquiry-view.js?v=6';

// Each set of indices refers to actual selectable marks in that lesson's figure.
const markPlans = {
  '7b-asia': [[1, 0], '先点高原，再选任意一侧的下游，顺着一路核对落差。', '高原约 4500 米，任一侧的下游约 100 米。只选两个下游时，没有从高原开始的一段。', 'ordered', [1, 2]],
  '7b-africa': [[1, 3], '点出赤道两侧各一处热带草原。', '一处在雨林北边，一处在南边。沙漠和雨林不能代替另一侧的草原。'],
  '7b-silk-road': [[1, 2], '点出图上能补水的两个停靠点。', '路线经过东、西两处绿洲。山口和河西走廊在图上有位置，没有标作补水点。'],
  '7b-se-asia': [[2], '小船要从图右通到左边的大洋，点连接它们的水道。', '马六甲海峡是两块陆地之间的水道。半岛和岛屿标记在陆地上。'],
  '7b-west-asia': [[0, 2], '点沿海甲和一个比它年降水量大的站点。', '图中要找超过 90 毫米的读数。内陆低地乙的 65 毫米比甲小。'],
  '7b-western-europe': [[0, 1], '对照两站，先点冬夏温差小的，再点温差大的。', '两站纬度、海拔相近。温差 11 的沿海站应在前，温差 23 的内陆站应在后。', 'ordered'],
  '7b-polar-regions': [[0], '按图例找出中央为海洋的极地，点中央的对应标记。', '北极中央以海域为主。南极中央主要是大陆，不能把两极中央都看成陆地。'],
  '7b-travel-plan': [[1, 2], '点出路线中负责过河、以及停下观察的两处。', '桥解决过河，潮间带是观察目的地。车站和公交站只标起终点。'],
  '7b-japan': [[2], '点一处同时靠近港口和市场的工业候选点。', '沿海丙附近有港口和市场。居中或地处高地无法证明运输条件合适。'],
  '7b-russia': [[1, 2, 3], '沿模拟南线找到它串起的三个城市。', '西部、南部和东部的三个城市落在南线沿途。北线标记只是另一条模拟走法。'],
  '7b-australia': [[2], '统计区一样大，点人口密度最高的地区。', '三地的统计面积相同，人口最多的一处平均每单位面积人数也最多。'],
  '7b-united-states': [[1], '为连片机械化农田，点图上的平坦候选区。', '中部平原符合两项初筛条件。相邻的山地仍需另查坡度和耕地范围。'],
  '7b-brazil': [[0, 1], '点同一片样区的前、后两次林地面积记录。', '用两次林地面积相减才能算出变化。样区总面积不等于任一次林地面积。'],
  '7b-country-study': [[1, 2], '点出与东岸港口的停泊条件、服务对象有关的两处。', '港湾是停泊的地形线索，附近市场是使用港口的需求线索。高山回答的是另一个问题。'],
  '7b-shared-planet': [[2, 1, 0], '先查最近十年的平均值，再逐段往过去追。', '顺着最近、中间、较早三个时段，读到 0.8、0.5、0.2。时间反向读，数值变小。', 'ordered'],
  '7b-climate-conference': [[0, 1], '先点需要查沿海淹水风险的地区，再点适合讨论节水的地区。', '沿海低地应先排查海水风险，内陆少雨区更需要节水。两地可共享资料，各自调整防灾做法。', 'ordered'],
  '8a-position': [[0, 2], '点出中国和从它东部海岸向外相连的大洋。', '这组标记支持从亚洲东部海岸通向太平洋。印度洋在亚洲南面。'],
  '8a-divisions': [[0, 1], '点出昌平的区名及它隶属的上一级行政区。', '昌平区隶属北京市。天津是同为直辖市的城市，河北是相邻省份。'],
  '8a-population': [[0, 1], '面积相同，先点住得较密的地区，再点较疏的地区。', '面积都是 100 平方千米，可以直接比人数。甲 2800 人比乙 1200 人多，应先点甲。', 'ordered'],
  '8a-introduce-china': [[0, 1], '点出适合先介绍中国在世界的位置、再介绍中国内部区划的两张图。', '一张定位全球范围，另一张显示国内区划。校园资料范围太小。'],
  '8a-climate': [[2, 0, 1, 3], '先点降水最多的一段，再按月份顺序把其余三段补进全年总量。', '先找 7—9 月的 376，再补其余 31、98、55。四段总计 560，376 超过全年一半。', 'ordered'],
  '8a-rivers': [[1, 2, 3], '点出湖水进入干流后顺水到海所经的三处。', '要把相通湖泊、汇流口、入海处串起来。源头在汇流口上游。'],
  '8a-hazards': [[0, 2], '按学校通知，点安全路线的出发处和到达处。', '开放高处路由教学楼通到集合点。封闭积水路和排水沟属于要避开的地点。'],
  '8a-beautiful-china': [[0, 1, 2], '点出低处、高处和能说明人怎样利用坡地的那一处。', '低处河谷与高处山脊能说明高差，山腰梯田则说明了坡地利用。'],
  '8a-water': [[1, 2], '要查乙地春季缺不缺水，点两个用同样单位记录的读数。', '乙地春季可用水为 10，需求是 28，少了 18 个单位。另一个地点的水量回答不了乙地的缺口。'],
  '8a-land': [[0], '点出同时有平坦地势和供水线索的农田候选地。', '甲同时符合两个条件。丙平坦但缺水，乙是陡坡林地。'],
  '8a-minerals': [[0, 1, 3], '点出原料起点、能走的连接线路和货运交接点。', '矿区提供原料，已有道路连接，铁路货运站用于接运。还应查路况和运力。'],
  '8a-marine': [[0, 1, 3], '点出保留的生境、可利用的养殖区和用来核对环境的观测点。', '保留湿地、在合格区养殖并持续监测，三处缺一项就少考虑一方面。'],
  '8a-resource-craft': [[0, 1], '还没动手做书签，点出能交代材料来源和材料特点的两项。', '拾叶交代材料的来源，观察叶形和纹理交代可利用的特点。制作和展示还在后面。'],
  '8a-agriculture': [[0, 1], '点两个平地样点，用相同地形条件对照热量和供水。', '甲和乙都是平地，可在这两处比较温暖程度和供水。丙的坡陡也会改变耕种条件。'],
  '8a-industry': [[0, 1, 2], '点出产品从原料、组装到发运的三个地点。', '甲供应原料、乙组装、丙发运。游览区不属于这一批产品的分工。'],
  '8a-transport': [[0, 2], '先读图注的用时，点出符合三小时限制的两个报价。', '图注写公路拼运 2 小时、专车 1 小时。铁路接公路虽便宜，却需要 4 小时。'],
  '8a-green-economy': [[0, 1], '先点改进前的取水记录，再点改进后的记录，观察是增还是减。', '都是每百件的总取水量，前后少了 26 升。废水水质等指标没有列在这组图里。', 'ordered'],
  '8a-industry-show': [[0, 1], '给展板按时间排列，先点原来的记录，再点现在的记录。', '同一口径下从 39 到 72，增加了 33 个。是否送得更快需要时间记录。', 'ordered'],
  '8b-regional-division': [[2, 3], '点秦岭—淮河一线两侧可直接比较 1 月均温的样点。', '北方 −3℃、南方 6℃ 同为 1 月平均气温。干旱和高海拔是其他区域的线索。'],
  '8b-cultural-landscapes': [[0, 1, 2], '顺坡点出从上游树林到梯田之间的三处。', '树林、村寨、梯田分别在不同高度，能顺坡找可能的来水路径。谷地更低。'],
  '8b-local-theatre': [[0, 1], '点两处都与河网密集的水乡有关的背景材料。', '码头和连接两岸的桥都和水路有关。别处的坡地麦田缺少这一线索。'],
  '8b-north': [[0, 1], '先点无霜期较短的一处，再点较长的一处。', '东北样点的 145 天比华北样点的 205 天短。要看品种能否在当地的无霜期内成熟。', 'ordered'],
  '8b-south': [[2, 3], '先看看两条路线。点出能体现河网平原走水路的两处。', '河网平原与水运码头能组成水运线索。高原山地和山谷公路说明的是另一条路。'],
  '8b-tibetan': [[1, 2], '点出河谷台地与坡顶，读这两处的海拔。', '河谷台地 3570 米，坡顶 4710 米，台地低 1140 米。耕作条件还要另查水、热和土地。'],
  '8b-northwest': [[0, 1, 2], '点出从较高山地来水，经河流到可能有绿洲的三处。', '沿山地、山麓河流、河旁平地能追踪来水。离河远的沙地在这条水路之外。'],
  '8b-song-journey': [[1, 2], '点出可核对海拔、选择游览月份的两份资料。', '分层设色图能核对地势，月度气象记录适合判断出行月份。歌词提出线索，还要核实。'],
  '8b-hometown': [[0, 1], '点能对照同一个路口前后变化的两份材料。', '同一路口的新旧照片能对照。别处的新照位置不同，访谈回忆可以补充。'],
  '8b-hometown-design': [[0, 1, 2], '从山上走到平原，按路线上由高到低点三个地形位置。', '山脊经过山前缓坡降到平原，缓坡连接两端。孤立的山峰说明不了交接地带。', 'ordered'],
  '8b-green-development': [[1, 0], '先点使用机动车少的方案，再点使用较多的，作一次对照。', '乙方案使用 1 辆、甲方案使用 10 辆机动车。油耗或排放得另查车型和里程。', 'ordered'],
  '8b-human-nature': [[0, 1], '先点用作对照的裸露坡面，再点有植被坡面的记录。', '甲是裸露坡面，乙有植被。要判断修复作用，还应对齐时间、坡度和降雨等条件。', 'ordered'],
  '8b-beautiful-survey': [[0, 1], '点能把甲、乙街段放在同一时段比较的两份记录。', '两份 14 时的记录让时段保持相同。加进 8 时的读数会同时变动时段。'],
};

export function termMarkPlan(id) {
  const record = markPlans[id];
  if (!record) return null;
  const [indices, prompt, reasoning, order, alternate] = record;
  return { indices, prompt, reasoning, ordered: order === 'ordered', alternate };
}

export function renderTermMarkPractice(plan) {
  if (!plan) return '';
  return `<div class="term-controls term-proof" data-term-proof hidden>
    <h2 id="term-proof-question" tabindex="-1">${escape(plan.prompt)}</h2>
    <p class="term-proof-guide">在上方的图或读数列表中${plan.ordered ? '按题目顺序' : ''}点选 ${plan.indices.length} 处，再核对。</p>
    <div class="term-proof-actions">
      <button class="button primary" type="button" data-term-proof-check>核对我选的证据</button>
      <button class="button" type="button" data-term-proof-reset hidden>清空证据</button>
      <button class="button" type="button" data-term-proof-back>回到刚才的判断</button>
    </div>
    <p class="term-feedback" role="status" data-term-proof-feedback></p>
    <button class="button primary" type="button" data-term-proof-transfer hidden>换份材料试一次 →</button>
  </div>`;
}

export function bindTermMarkPractice(host, plan, stored, records, effects) {
  if (!plan) return null;
  const section = host.querySelector('[data-term-proof]');
  const title = section.querySelector('h2');
  const feedback = section.querySelector('[data-term-proof-feedback]');
  const check = section.querySelector('[data-term-proof-check]');
  const reset = section.querySelector('[data-term-proof-reset]');
  const transfer = section.querySelector('[data-term-proof-transfer]');
  let open = stored?.open === true;
  let selected = stored?.selected?.length && Array.isArray(stored.selected)
    ? [...new Set(stored.selected.filter(index => Number.isInteger(index) && records[index]))].slice(-plan.indices.length) : [];
  let checked = stored?.checked === true;
  let assisted = stored?.assisted === true;
  let result = ['independent', 'guided'].includes(stored?.result) ? stored.result : null;
  let enabled = false;
  const valid = () => selected.length === plan.indices.length && [plan.indices, plan.alternate].filter(Boolean)
    .some(marks => plan.ordered ? marks.every((point, i) => point === selected[i]) : marks.every(point => selected.includes(point)));

  function save() {
    effects.save({ open, selected, checked, assisted, result });
  }

  function paint() {
    section.hidden = !open || !enabled;
    if (section.hidden) return;
    if (result) section.dataset.proofOutcome = result;
    effects.highlight(selected);
    reset.hidden = selected.length === 0;
    const success = checked && valid();
    check.hidden = success;
    transfer.hidden = !success;
    section.dataset.result = checked ? success ? 'correct' : 'retry' : '';
    const names = selected.map(index => records[index].label).join('、');
    if (success) {
      feedback.textContent = (result === 'guided' ? '核对后找到了证据。' : '独立找到了证据。') + plan.reasoning;
    } else if (checked) {
      feedback.textContent = '当前点了「' + names + '」。' + plan.reasoning + '请回到图里再试。';
    } else {
      feedback.textContent = selected.length ? '已点「' + names + '」。' : '';
    }
  }

  function focusNear(target) {
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'center', behavior: 'instant' });
  }

  const begin = host.querySelector('[data-term-proof-start]');
  begin.addEventListener('click', () => {
    open = true;
    if (effects.isGuided()) assisted = true;
    save();
    effects.onOpen();
    focusNear(title);
  });
  section.querySelector('[data-term-proof-back]').addEventListener('click', () => {
    open = false;
    save();
    effects.onOpen();
    focusNear(begin);
  });
  check.addEventListener('click', () => {
    if (selected.length < plan.indices.length) {
      feedback.textContent = '再选 ' + (plan.indices.length - selected.length) + ' 处材料。';
      return;
    }
    checked = true;
    if (valid()) {
      result ||= assisted ? 'guided' : 'independent';
      effects.complete();
    } else {
      assisted = true;
    }
    save();
    paint();
    if (check.hidden) focusNear(transfer);
  });
  reset.addEventListener('click', () => {
    selected = [];
    checked = false;
    save();
    paint();
    focusNear(host.querySelector('[data-bar], [data-key]'));
  });
  transfer.addEventListener('click', effects.transfer);
  return {
    get active() { return open && enabled; },
    select(index) {
      selected = selected.includes(index) ? selected.filter(item => item !== index)
        : [...selected, index].slice(-plan.indices.length);
      checked = false;
      save();
      paint();
    },
    sync(value) { enabled = value; paint(); },
  };
}
