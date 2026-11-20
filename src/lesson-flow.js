export function lessonFlow(steps) {
  return `<div data-geo-flow>${steps.map(({ id, label, content, next }, index) => `
    <section class="geo-step" data-geo-step="${id}" aria-labelledby="geo-step-${id}" hidden>
      <h2 class="geo-step-position" id="geo-step-${id}" tabindex="-1">第 ${index + 1} / ${steps.length} 步 · ${label}</h2>
      <div class="geo-step-body">${content}</div>
      <div class="geo-step-actions">
        ${next ? `<button class="button primary geo-step-next" type="button" data-geo-next>${next} <span aria-hidden="true">→</span></button>` : ''}
        ${index ? '<button class="geo-step-back" type="button" data-geo-back>← 上一步</button>' : ''}
      </div>
    </section>`).join('')}</div>`;
}

export function bindLessonFlow(root, initialStep, save) {
  const steps = [...root.querySelectorAll('[data-geo-step]')];
  function show(index, focus) {
    const step = steps[index];
    if (!step) return;
    steps.forEach(item => { item.hidden = item !== step; });
    if (focus) {
      const heading = step.querySelector('.geo-step-position');
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({ block: 'start', behavior: 'instant' });
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
