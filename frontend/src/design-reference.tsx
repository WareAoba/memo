import { useTranslation } from 'react-i18next';
import { tr } from './i18n';
import './tokens.css';
import './styles.css';
import './design-system.css';
import './design-reference.css';
import { Toast, ToastRegion } from './features/shared/Toast';
import { ReminderSettings } from './features/schedules/ReminderSettings';
import { ScheduleColorPicker } from './features/schedules/ScheduleColorPicker';
import type { ScheduleColor } from './api/schedules';
import type { ReminderFields } from './api/reminderFields';
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import {
  Button,
  ButtonLink,
  CardButton,
  Input,
  PageHeader,
  Surface,
  Textarea,
} from './features/shared/ui';
import { ActionIcon } from './features/shared/ActionIcon';
import { DropdownSelect } from './features/shared/DropdownSelect';
import { IconButton } from './features/shared/IconButton';
import { DetailKindInput } from './features/works/DetailKindInput';
import { PresetModal } from './features/shared/PresetModal';

export function DesignReference() {
  useTranslation();
  const [toast, setToast] = useState(false);
  const [scheduleColor, setScheduleColor] = useState<ScheduleColor>('none');
  const [reminder, setReminder] = useState<ReminderFields>({
    reminder_enabled: true,
    reminder_value: 15,
    reminder_unit: 'minutes',
  });
  const [kind, setKind] = useState(tr('design-reference.address'));
  const [modal, setModal] = useState(false);
  const [group, setGroup] = useState('work');
  return (
    <main className="design-reference">
      <PageHeader>
        <div>
          <p className="eyebrow">PRESET · UI REFERENCE</p>
          <h1>{tr('design-reference.consistentScreens')}</h1>
          <p>{tr('design-reference.theSharedComponentsAndStatesUsedInTheApp')}</p>
        </div>
        <ButtonLink href="/#/today">{tr('design-reference.backToApp')}</ButtonLink>
      </PageHeader>
      <Surface as="section">
        <h2>{tr('design-reference.colors')}</h2>
        <div className="reference-colors">
          {[
            ['canvas', tr('design-reference.canvas')],
            ['surface', tr('design-reference.surface')],
            ['surface-soft', tr('design-reference.secondarySurface')],
            ['accent', tr('design-reference.primaryAction')],
            ['accent-soft', tr('design-reference.selection')],
            ['success', tr('design-reference.completed')],
            ['warning', tr('design-reference.warning')],
            ['danger', tr('design-reference.error')],
          ].map(([token, label]) => (
            <div key={token}>
              <div className="reference-swatch" style={{ background: `var(--${token})` }} />
              <strong>{label}</strong>
              <p>--{token}</p>
            </div>
          ))}
        </div>
      </Surface>
      <Surface as="section">
        <h2>{tr('design-reference.buttonsAndIcons')}</h2>
        <div className="reference-row">
          <Button variant="primary">
            <ActionIcon name="save" />
            {tr('design-reference.save')}
          </Button>
          <Button>{tr('design-reference.secondaryAction')}</Button>
          <Button variant="ghost">{tr('design-reference.subtleAction')}</Button>
          <Button variant="danger">{tr('design-reference.delete')}</Button>
          <Button disabled>{tr('design-reference.unavailable')}</Button>
          <Button aria-pressed>{tr('design-reference.selected')}</Button>
        </div>
        <div className="reference-row">
          {(
            [
              'plus',
              'search',
              'edit',
              'trash',
              'close',
              'left',
              'right',
              'up',
              'down',
              'calendar',
              'menu',
              'settings',
            ] as const
          ).map((icon) => (
            <IconButton key={icon} icon={icon} aria-label={icon} />
          ))}
          <IconButton
            icon="save"
            variant="primary"
            aria-label={tr('design-reference.saving')}
            aria-busy
            disabled
          />
        </div>
        <p>{tr('design-reference.controls44PxIcons20PxCorners12Px')}</p>
      </Surface>
      <Surface as="section">
        <h2>{tr('design-reference.inputsAndDropdowns')}</h2>
        <ScheduleColorPicker value={scheduleColor} onChange={setScheduleColor} />
        <div className="form-grid">
          <label>
            {tr('design-reference.workName')}
            <Input placeholder={tr('design-reference.enterAName')} />
          </label>
          <DropdownSelect
            label={tr('design-reference.group')}
            value={group}
            onChange={setGroup}
            options={[
              { value: 'work', label: tr('design-reference.business') },
              { value: 'personal', label: tr('design-reference.personal') },
            ]}
          />
          <DetailKindInput
            value={kind}
            names={[
              tr('design-reference.address'),
              tr('design-reference.contactPerson'),
              tr('design-reference.contactDetails'),
            ]}
            onChange={setKind}
          />
          <label>
            {tr('design-reference.unavailable')}
            <Input disabled value={tr('design-reference.readOnlyExample')} />
          </label>
          <label className="wide">
            {tr('design-reference.memo')}
            <Textarea rows={3} placeholder={tr('design-reference.enterAMemo')} />
          </label>
        </div>
      </Surface>
      <Surface as="section">
        <h2>{tr('design-reference.boxesAndCards')}</h2>
        <div className="reference-grid">
          <Surface tone="soft">
            <h3>{tr('design-reference.secondaryArea')}</h3>
            <p>{tr('design-reference.usesSharedSurfacesAndSpacing')}</p>
          </Surface>
          <Surface tone="accent">
            <h3>{tr('design-reference.highlightedArea')}</h3>
            <p>{tr('design-reference.showsContentRelatedToTheSelection')}</p>
          </Surface>
          <CardButton onClick={() => setModal(true)}>
            <h3>{tr('design-reference.openDetails')}</h3>
            <p>{tr('design-reference.theEntireCardIsOneSelectionArea')}</p>
          </CardButton>
        </div>
      </Surface>
      <Surface as="section" tone="danger" role="status">
        <h2>{tr('design-reference.errorsAndRecovery')}</h2>
        <p>{tr('design-reference.checkTheEnteredInformation')}</p>
        <Button>{tr('design-reference.tryAgain')}</Button>
      </Surface>
      <Surface as="section">
        <h2>{tr('design-reference.remindersAndToasts')}</h2>
        <p>{tr('design-reference.shownAtTheBottomRightUntilTheScheduleStarts')}</p>
        <ReminderSettings value={reminder} onChange={setReminder} />
        <Toast
          title={tr('design-reference.studyEnglish')}
          href="/#/today"
          onClose={() => setToast(false)}
        >
          {tr('design-reference.scheduleStartsIn15Minutes0900')}
        </Toast>
        <Button onClick={() => setToast(true)}>
          {tr('design-reference.previewToastNotification')}
        </Button>
      </Surface>
      <ToastRegion>
        {toast && (
          <Toast
            title={tr('design-reference.studyEnglish')}
            href="/#/today"
            onClose={() => setToast(false)}
          >
            {tr('design-reference.scheduleStartsIn15Minutes0900')}
          </Toast>
        )}
      </ToastRegion>
      {modal && (
        <PresetModal label={tr('design-reference.sharedModal')} onClose={() => setModal(false)}>
          <Surface>
            <h2>{tr('design-reference.sameBoxesSameBehavior')}</h2>
            <p>{tr('design-reference.clickTheBackdropOrPressEscapeToCloseFocus')}</p>
            <Button variant="primary" onClick={() => setModal(false)}>
              {tr('design-reference.ok')}
            </Button>
          </Surface>
        </PresetModal>
      )}
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<DesignReference />);
