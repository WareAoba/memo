import { expect, it } from 'vitest';
import {
  parameterDefaults,
  parametersValid,
  renderTaskName,
  taskParameters,
} from './taskParameters';

it('uses named fields, first defaults and shared values without recursively interpreting input', () => {
  const template = '[과목=영어] 단어 [n=5]개 / [n]개 복습';
  expect(parameterDefaults(template)).toEqual({ 과목: '영어', n: '5' });
  expect(renderTaskName(template, { n: '10' })).toBe('영어 단어 10개 / 10개 복습');
  expect(renderTaskName('[내용]', { 내용: '<script>[n]</script>' })).toBe('<script>[n]</script>');
  expect(taskParameters('평범한 이름 [1] [띄어 쓰기]')).toEqual([]);
});
it('requires missing values and limits values and the resolved name', () => {
  expect(parametersValid('단어 [n]개', {})).toBe(false);
  expect(parametersValid('단어 [n=5]개', {})).toBe(true);
  expect(parametersValid('[n]', { n: '  ' })).toBe(false);
  expect(parametersValid('[n]', { n: 'a\nb' })).toBe(false);
  expect(parametersValid('[n]', { n: 'x'.repeat(81) })).toBe(false);
  expect(parametersValid('[n][n][n]', { n: 'x'.repeat(80) })).toBe(false);
});
