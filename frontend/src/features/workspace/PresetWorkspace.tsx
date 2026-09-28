import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { HorizontalPage } from '../shared/HorizontalNavigation';
import { PresetSwitch } from '../shared/PresetModal';
import { WorkspaceHeader } from '../shared/WorkspaceHeader';
import { WorkListView } from '../works/WorkListView';
import { TaskPresetListView } from '../tasks/TaskPresetListView';

export function PresetWorkspace({ kind, revision }: { kind: 'works' | 'tasks'; revision: number }) {
  useTranslation();
  return (
    <section className="preset-workspace">
      <WorkspaceHeader
        title={
          <h1>
            {tr(kind === 'works' ? 'WorkListView.workPresets' : 'TaskPresetListView.taskPresets')}
          </h1>
        }
        navigation={<PresetSwitch kind={kind} />}
      />
      <HorizontalPage index={kind === 'works' ? 0 : 1}>
        {kind === 'works' ? (
          <WorkListView revision={revision} heading={false} />
        ) : (
          <TaskPresetListView revision={revision} heading={false} />
        )}
      </HorizontalPage>
    </section>
  );
}
