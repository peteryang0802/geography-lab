export function fitActivityStage(host) {
  const stage = host?.querySelector('.lab-stage');
  const dock = host?.querySelector('.lab-dock');
  if (!stage || !dock) return;
  const stageStart = stage.getBoundingClientRect().top;
  const clipped = dock.getBoundingClientRect().bottom - innerHeight + 8;
  if (clipped > 0 && stageStart > 0) scrollBy(0, Math.min(clipped, stageStart));
}
