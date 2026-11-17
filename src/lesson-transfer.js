import { escapeHtml as escape } from './inquiry-view.js?v=6';
import { paintTransfer } from './transfer-illustrations.js?v=6';

export function mountLessonTransfer(host, lessonId, transfer, saved, onChange) {
  let compared = saved?.compared === true;
  const { action, before, after, layout = 'compare', question } = transfer;
  const graphicId = host.dataset.activity + '-graphic';
  host.innerHTML = `<div class="lesson-transfer" data-lesson-transfer>
    <p class="transfer-question">${escape(question)}</p>
    <figure class="transfer-figure" id="${graphicId}" data-layout="${escape(layout)}">
      <canvas width="540" height="200" aria-hidden="true"></canvas>
      <ol class="transfer-diagram"></ol>
      <figcaption class="transfer-caption">教学示意</figcaption>
    </figure>
    <div class="transfer-dock">
      <button class="button primary" type="button" data-transfer-action aria-controls="${graphicId}"></button>
      <p class="transfer-feedback" data-transfer-feedback role="status"></p>
    </div>
  </div>`;
  const diagram = host.querySelector('.transfer-diagram');
  const canvas = host.querySelector('canvas');
  const context = canvas.getContext('2d');
  const button = host.querySelector('[data-transfer-action]');
  const feedback = host.querySelector('[data-transfer-feedback]');
  const activity = host.querySelector('[data-lesson-transfer]');

  function draw() {
    const width = canvas.clientWidth;
    if (!context || !width) return;
    const height = width * 10 / 27;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    paintTransfer(context, lessonId, compared, width, height);
  }

  function update() {
    const frame = compared ? after : before;
    activity.dataset.compared = String(compared);
    diagram.replaceChildren(...frame.labels.map(label => {
      const item = document.createElement('li');
      item.textContent = label;
      return item;
    }));
    button.textContent = compared ? '回到刚才的图' : action;
    button.classList.toggle('primary', !compared);
    feedback.textContent = frame.caption;
    draw();
  }

  button.addEventListener('click', () => {
    compared = !compared;
    update();
    onChange?.({ compared });
  });
  const observer = new ResizeObserver(draw);
  observer.observe(canvas);
  update();
  return () => observer.disconnect();
}
