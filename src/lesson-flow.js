export function lessonFlow(steps) {
  return `<div class="geo-flow-layout" data-geo-flow>
    <aside class="geo-flow-rail" aria-label="本课进度">
      <h2>本课进度</h2><p class="geo-flow-position" aria-hidden="true"></p>
      <ol>${steps.map(({ label }, index) => `<li><span class="geo-flow-number" aria-hidden="true">${index + 1}</span><span>${label}</span></li>`).join('')}</ol>
    </aside>
    <div class="geo-flow-content">${steps.map(({ id, label, content, next }, index) => `
    <section class="geo-step" data-geo-step="${id}" aria-labelledby="geo-step-${id}" hidden>
      <h2 class="geo-step-position" id="geo-step-${id}" tabindex="-1">第 ${index + 1} / ${steps.length} 步 · ${label}</h2>
      <div class="geo-step-body">${content}</div>
      <div class="geo-step-actions">
        ${next ? `<button class="button primary geo-step-next" type="button" data-geo-next>${next} <span aria-hidden="true">→</span></button>` : ''}
        ${index ? '<button class="geo-step-back" type="button" data-geo-back>← 上一步</button>' : ''}
      </div>
    </section>`).join('')}</div>
  </div>`;
}

export function bindLessonFlow(root, initialStep, save) {
  const steps = [...root.querySelectorAll('[data-geo-step]')];
  const marks = root.querySelectorAll('.geo-flow-rail li');
  const position = root.querySelector('.geo-flow-position');
  function show(index, focus) {
    const step = steps[index];
    if (!step) return;
    steps.forEach(item => { item.hidden = item !== step; });
    marks.forEach((mark, i) => {
      if (i === index) mark.setAttribute('aria-current', 'step');
      else mark.removeAttribute('aria-current');
    });
    position.textContent = `第 ${index + 1} / ${steps.length} 步`;
    if (focus) {
      const heading = step.querySelector('.geo-step-position');
      heading.focus({ preventScroll: true });
      step.scrollIntoView({ block: 'start', behavior: 'instant' });
      save(step.dataset.geoStep);
    }
  }

  steps.forEach((step, index) => {
    step.querySelector('[data-geo-next]')?.addEventListener('click', () => show(index + 1, true));
    step.querySelector('[data-geo-back]')?.addEventListener('click', () => show(index - 1, true));
  });
  const start = steps.findIndex(step => step.dataset.geoStep === initialStep ||
    [...step.querySelectorAll('[data-inquiry-section]')].some(section => section.dataset.inquirySection === initialStep));
  show(Math.max(0, start), false);
  return {
    show(id) { show(steps.findIndex(step => step.dataset.geoStep === id), true); },
  };
}
