import { chapters, lessons, projects } from './catalog.js';

const openings = {
  intro: {
    prompt: '雨停了，上学路上哪里还会积水？',
    action: '看看路上的高处和低处，再想想该记下哪些线索。',
  },
  'earth-space': {
    prompt: '从太阳往外数，地球排第几？',
    action: '顺着轨道找一找，再看看太阳系在银河系的什么地方。',
  },
  spaceflight: {
    prompt: '想知道洪水漫到了哪儿，带哪组资料？',
    action: '比一比同一片地方前后的画面，找出水面变大的地方。',
  },
  'earth-model': {
    prompt: '40°N 和 116°E 在地球上哪儿碰头？',
    action: '拨动经纬度找到交点，再转一转地球。',
    help: { conceptId: 'geo-latitude', label: '看看纬线怎么找' },
  },
  'earth-motion': {
    prompt: '北京附近的标记什么时候走进亮的一面？',
    action: '拨动时刻，观察标记是怎样从暗面走进亮面的。',
    help: { conceptId: 'earth-axis', label: '认一认地轴' },
  },
  'project-earth': {
    prompt: '哪颗想象中的行星值得先去看一眼？',
    action: '点一颗行星看记录，再写一条你想继续查证的事。',
  },
  maps: {
    prompt: '图书馆在操场右边。它一定在东边吗？',
    action: '换一张有指向标的图，先看看北箭头指向哪儿。',
    help: { conceptId: 'legend', label: '有符号看不懂？看看图例' },
  },
  contours: {
    prompt: '这两条山路，哪条有一小段更陡？',
    action: '换一条路线，再拖动滑块走一走，看看脚下高度怎么变。',
    help: { conceptId: 'relative-height', label: '看看什么是高差' },
  },
  'project-orienteering': {
    prompt: '先找 1 号旗，再过河。你会怎么走？',
    action: '找到桥和两面旗，把它们按走路的顺序排好。',
    help: { conceptId: 'scale', label: '查一查地图距离怎么算' },
  },
  'land-ocean': {
    prompt: '你能在地球仪上找到喜马拉雅山脉吗？',
    action: '选一处山地，看看它的位置和周围的高低。',
  },
  'land-change': {
    prompt: '海里的化石怎么会出现在高山上？',
    action: '先找化石，再看看岩层怎样升到高处。',
  },
  'project-seafloor': {
    prompt: '从岸边出发，海底会一直慢慢变深吗？',
    action: '依次点近岸、中段和远海，再写一句你想怎么走。',
  },
  weather: {
    prompt: '如果今天想出去玩，选哪个时段？',
    action: '翻看一天的模拟预报，找一个适合这次活动的时段。',
  },
  'temp-rain': {
    prompt: '最热和雨最多，是同一个月吗？',
    action: '先读气温线，再读降水柱，找出各自最高的地方。',
    help: { conceptId: 'climate-chart', label: '看线和柱分别表示什么' },
  },
  climate: {
    prompt: '换一个地方，雨还会集中在那几个月吗？',
    action: '切换图上的地点，看看降水柱在哪几个月变高。',
  },
  'climate-life': {
    prompt: '这里经常下雨，哪种屋顶排水更快？',
    action: '给几个屋顶同样的雨，看水往哪里走。',
  },
  'project-nest': {
    prompt: '要躲风又要安静，纸上的鸟巢放哪儿？',
    action: '看过风口、树旁和步道，再给模拟鸟种选一个位置。',
  },
  people: {
    prompt: '哪个地方每平方千米住的人更多？',
    action: '选两个地方，比一比平均每平方千米各住多少人。',
    help: { conceptId: 'population-density', label: '看人口密度怎么算' },
  },
  cooperation: {
    prompt: '货物要 18 天内送到，怎样走既准时又省钱？',
    action: '先从图里找出能准时到的方式，再比较价钱。',
  },
  'project-made-in-china': {
    prompt: '给保温杯写一句介绍，哪句话有材料支持？',
    action: '先读一次模拟测温记录，再选一句说得有根据的话。',
  },
};

export const textbookChapters = chapters.map(chapter => {
  const chapterLessons = lessons.filter(lesson => lesson.chapter === chapter.id)
    .map((lesson, index) => ({ lesson, kind: 'lesson', section: chapter.id === 0 ? null : index + 1 }));
  const chapterProjects = projects.filter(lesson => lesson.chapter === chapter.id)
    .map(lesson => ({ lesson, kind: 'project', section: null }));
  const entries = [...chapterLessons, ...chapterProjects]
    .sort((a, b) => a.lesson.page - b.lesson.page)
    .map(({ lesson, kind, section }) => {
      const { id, title, page } = lesson;
      return {
        id, chapter: chapter.id, title, page, kind, section,
        ...(openings[id] ?? { prompt: lesson.tasks[0]?.prompt ?? title, action: '先试试这一课的第一个小问题。' }),
      };
    });
  return { ...chapter, entries };
});

export const textbookEntries = textbookChapters.flatMap(chapter => chapter.entries);

const indexById = new Map(textbookEntries.map((entry, index) => [entry.id, index]));
const chapterById = new Map(textbookChapters.map(chapter => [chapter.id, chapter]));

export function getTextbookPosition(id) {
  const index = indexById.get(id);
  if (index === undefined) return null;
  const entry = textbookEntries[index];
  return {
    chapter: chapterById.get(entry.chapter),
    entry,
    previous: textbookEntries[index - 1] ?? null,
    next: textbookEntries[index + 1] ?? null,
    index,
    total: textbookEntries.length,
  };
}
