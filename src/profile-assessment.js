const markers = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function profileCourseTasks(lesson) {
  const config = lesson.profilePractice;
  if (!config) return [];
  const figure = config.transfer;
  const pairs = figure.values.flatMap((_, west) => figure.values.slice(west + 1)
    .map((__, offset) => [west, west + 1 + offset]));
  const options = pairs.map(([west, east]) => {
    const change = figure.values[east].value - figure.values[west].value;
    const difference = change > 0 ? `升高 ${change} 米` : change < 0 ? `降低 ${-change} 米` : '高度不变';
    const isAdjacent = east - west === 1;
    return [markers[west] + ' → ' + markers[east], `从 ${markers[west]} 到 ${markers[east]} ${difference}。` +
      (!isAdjacent ? '两处中间还有标点。试试沿线比较相邻的两点。' : change > 0
        ? '这一小段向东升高，足以反驳「每段都下降」。' : '这一段不能举出反例。再看看哪一段沿横轴向右、线却往上走。')];
  });
  const answer = pairs.findIndex(([west, east]) => east - west === 1 && figure.values[east].value > figure.values[west].value);
  return [
    {
      id: 'course-profile-pair-' + lesson.id,
      prompt: figure.prompt,
      figure,
      pairs,
      answer,
      options,
      hint: '顺着横轴从左往右看。先比较相邻两点的高低，再读海拔刻度。',
    },
    { ...config.application, id: 'course-profile-judgment-' + lesson.id },
  ];
}
