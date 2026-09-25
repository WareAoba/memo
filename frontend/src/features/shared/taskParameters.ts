export type ParameterValues = Record<string, string>;
const tokenPattern = /\[([A-Za-z_가-힣][A-Za-z0-9_가-힣]{0,31})(?:=([^\]\r\n[]{0,80}))?\]/g;

export function taskParameters(template: string) {
  const entries = new Map<string, string>();
  for (const match of template.matchAll(tokenPattern)) {
    if (!entries.has(match[1]!)) entries.set(match[1]!, (match[2] ?? '').trim());
  }
  return [...entries].map(([key, defaultValue]) => ({ key, defaultValue }));
}
export function parameterDefaults(template: string): ParameterValues {
  return Object.fromEntries(taskParameters(template).map((p) => [p.key, p.defaultValue]));
}
export function renderTaskName(template: string, values: ParameterValues): string {
  const defaults = parameterDefaults(template);
  return template.replace(
    tokenPattern,
    (token: string, key: string) => (values[key] ?? defaults[key])?.trim() || token,
  );
}
export function parametersValid(template: string, values: ParameterValues): boolean {
  return (
    taskParameters(template).every(({ key, defaultValue }) => {
      const value = (values[key] ?? defaultValue).trim();
      return !!value && value.length <= 80 && !/[\r\n\0]/.test(value);
    }) && renderTaskName(template, values).length <= 200
  );
}
