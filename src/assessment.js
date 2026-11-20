export function assessmentState(record, answer) {
  if (!Number.isInteger(record?.option)) return 'unchecked';
  if (record.option !== answer) return 'retry';
  if (record.firstCorrect === true) return 'independent';
  if (record.firstCorrect === false) return 'guided';
  return 'previous';
}

export const assessmentLabels = {
  unchecked: '未核对',
  retry: '待重试',
  guided: '提示或重试后完成',
  independent: '首次独立完成',
  previous: '曾答对（方式未记录）',
};

export function paintAssessment(element, status) {
  element.dataset.assessment = status;
  const label = element.querySelector('[data-assessment-label]');
  if (label) label.textContent = assessmentLabels[status];
  const step = element.closest('[data-geo-step]');
  if (step?.nextElementSibling?.dataset.geoStep === 'recap') {
    const summary = step.closest('[data-geo-flow]')?.querySelector('[data-assessment-summary]');
    if (summary) summary.textContent = '课末核对 · ' + assessmentLabels[status];
  }
  const next = step?.querySelector('[data-geo-next]');
  if (next) next.hidden = status === 'unchecked' || status === 'retry';
}
