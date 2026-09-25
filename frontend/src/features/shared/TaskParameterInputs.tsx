import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { useId } from 'react';
import { Input } from './ui';
import { renderTaskName, taskParameters, type ParameterValues } from './taskParameters';

export function TaskParameterInputs({
  template,
  values,
  onChange,
}: {
  template: string;
  values: ParameterValues;
  onChange: (values: ParameterValues) => void;
}) {
  useTranslation();
  const id = useId();
  const parameters = taskParameters(template);
  if (!parameters.length) return null;
  return (
    <div className="task-parameters">
      <p className="hint">{tr('TaskParameterInputs.valuesForThisTask')}</p>
      <div className="parameter-inputs">
        {parameters.map(({ key, defaultValue }) => (
          <label key={key} htmlFor={id + key}>
            {key}
            <Input
              id={id + key}
              required
              maxLength={80}
              value={values[key] ?? defaultValue}
              placeholder={
                key === 'n'
                  ? tr('TaskParameterInputs.eG10')
                  : tr('TaskParameterInputs.enterValue', { v1: key })
              }
              onChange={(e) => onChange({ ...values, [key]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <p className="parameter-preview" aria-live="polite">
        {renderTaskName(template, values)}
      </p>
    </div>
  );
}
