import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { useState } from 'react';
import type { TaskCustomization } from '../../api/schedules';
import { Picker } from './Picker';
import { TaskParameterInputs } from '../shared/TaskParameterInputs';
import { parameterDefaults, parametersValid, taskParameters } from '../shared/taskParameters';
import { Button } from '../shared/ui';

export function AddTaskPicker({
  disabled,
  onPick,
}: {
  disabled: boolean;
  onPick: (id: string, customization?: TaskCustomization) => void;
}) {
  useTranslation();
  const [selected, setSelected] = useState<{ id: string; name: string }>();
  const [parameters, setParameters] = useState<Record<string, string>>({});
  return selected ? (
    <fieldset disabled={disabled} className="work-task-editor">
      <legend>{selected.name}</legend>
      <TaskParameterInputs template={selected.name} values={parameters} onChange={setParameters} />
      <div className="actions">
        <Button
          variant="primary"
          disabled={!parametersValid(selected.name, parameters)}
          onClick={() => onPick(selected.id, { parameters })}
        >
          {tr('AddTaskPicker.addWithTheseValues')}
        </Button>
        <Button onClick={() => setSelected(undefined)}>
          {tr('AddTaskPicker.chooseAnotherTask')}
        </Button>
      </div>
    </fieldset>
  ) : (
    <Picker
      allowCreate
      kind="task"
      disabled={disabled}
      onPick={(choice) => {
        if (!taskParameters(choice.name).length) onPick(choice.id);
        else {
          setParameters(parameterDefaults(choice.name));
          setSelected(choice);
        }
      }}
    />
  );
}
