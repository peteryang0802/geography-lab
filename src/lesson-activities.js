import { inquiries } from './inquiries.js?v=6';

const visual = kind => ({ kind });
const lab = (id, mode) => ({ kind: 'lab', id, mode });
const chart = id => ({ kind: 'chart', id });

export const lessonActivities = {
  intro: [visual('opening')],
  'earth-space': [visual('opening')],
  spaceflight: [visual('opening')],
  'earth-model': [lab('globe', 'coordinates')],
  'earth-motion': [lab('globe', 'daylight')],
  'project-earth': [visual('evidence')],
  maps: [visual('legend'), { kind: 'direction', title: '换张地图，方向还一样吗？' }],
  contours: [visual('rain'), { ...lab('contour'), title: '沿另一条山路看看高低' }],
  'project-orienteering': [visual('evidence')],
  'land-ocean': [
    visual('world'),
    { kind: 'landform', title: '山脉和高原怎么区分？', photo: { topic: 'himalayas', index: 2 } },
    { kind: 'seafloor', title: '从海岸潜下去，海底怎么变？' },
    { ...lab('globe', 'terrain'), title: '转转地球仪，找别处的山脉', collapsible: true },
    { kind: 'world-check', title: '换张地图试一试', placement: 'outside' },
  ],
  'land-change': [visual('evidence')],
  'project-seafloor': [visual('evidence')],
  weather: [chart('weather')],
  'temp-rain': [chart('climate')],
  climate: [chart('climate')],
  'climate-life': [visual('evidence')],
  'project-nest': [visual('evidence')],
  people: [chart('population')],
  cooperation: [visual('evidence')],
  'project-made-in-china': [visual('evidence')],
};

for (const [id, list] of Object.entries(lessonActivities)) {
  const transfer = inquiries[id].transfer;
  if (transfer) list.push({ kind: 'transfer', title: transfer.title, placement: 'transfer' });
}

export const activityKey = (lessonId, activity) => [lessonId, activity.kind, activity.id].filter(Boolean).join('-');
export const activityIds = Object.entries(lessonActivities).flatMap(([lessonId, list]) =>
  list.map(activity => activityKey(lessonId, activity)));

const visualLoaders = {
  opening: async () => (await import('./lesson-visuals.js?v=6')).mountOpeningVisual,
  evidence: async () => (await import('./evidence-activities.js?v=6')).mountEvidenceActivity,
  legend: async () => {
    const { mountLegendInquiry } = await import('./inquiry-visuals.js?v=6');
    return (host, _, saved, onChange) => mountLegendInquiry(host, saved, onChange);
  },
  rain: async () => {
    const { mountRainInquiry } = await import('./inquiry-visuals.js?v=6');
    return (host, _, saved, onChange, view) => mountRainInquiry(host, saved, onChange, { view: ({ recall: 'a', nearby: 'b', fieldwork: 'c' })[view] });
  },
  world: async () => (await import('./world-inquiry.js?v=6')).mountWorldInquiry,
  'world-check': async () => {
    const { mountWorldCheck } = await import('./world-inquiry.js?v=6');
    return (host, lessonId, saved, onChange) => mountWorldCheck(host, inquiries[lessonId].outside, saved, onChange);
  },
  landform: async () => {
    const { mountLandformInquiry } = await import('./landform-inquiry.js?v=6');
    return (host, _, saved, onChange) => mountLandformInquiry(host, saved, onChange);
  },
  seafloor: async () => {
    const { mountSeafloorInquiry } = await import('./seafloor-inquiry.js?v=6');
    return (host, _, saved, onChange) => mountSeafloorInquiry(host, saved, onChange);
  },
  direction: async () => {
    const { mountMapDirection } = await import('./map-direction.js?v=6');
    return (host, _, saved, onChange) => mountMapDirection(host, saved, onChange);
  },
  chart: async () => {
    const { mountWidget } = await import('./widgets.js?v=6');
    return (host, kind, saved, onChange, _view, lessonId) => mountWidget(host, kind, saved, onChange, lessonId);
  },
  transfer: async () => {
    const { mountLessonTransfer } = await import('./lesson-transfer.js?v=6');
    return (host, lessonId, saved, onChange) => mountLessonTransfer(host, lessonId, inquiries[lessonId].transfer, saved, onChange);
  },
};

export async function mountLessonVisual(host, activity, lessonId, saved, onChange, view, isActive) {
  const mount = await visualLoaders[activity.kind]();
  if (isActive()) return mount(host, activity.id ?? lessonId, saved, onChange, view, lessonId);
}
