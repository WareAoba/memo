import { useTranslation } from 'react-i18next';
import { tr } from './i18n';
import './tokens.css';
import './styles.css';
import './design-system.css';
import './design-reference.css';
import { ContextMenuSlot } from './features/shared/ContextMenuSlot';
import { ContentContextMenu } from './features/shared/ContentContextMenu';
import { StickyDemo } from './features/sticky/StickyDemo';
import { Toast, ToastRegion } from './features/shared/Toast';
import { NotificationDemo } from './features/schedules/NotificationDemo';
import { ReminderSettings } from './features/schedules/ReminderSettings';
import { ScheduleColorPicker } from './features/schedules/ScheduleColorPicker';
import type { ScheduleColor, ScheduleDetail } from './api/schedules';
import { emptyFields } from './api/works';
import { DeleteButton } from './features/shared/SwipeDelete';
import { MemoButton } from './features/shared/MemoButton';
import { TodayOverview } from './features/workspace/TodayOverview';
import { TodayDial } from './features/workspace/TodayDial';
import type { ReminderFields } from './api/reminderFields';
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import type { UserSettings } from './api/settings';
import { useTheme } from './features/settings/useTheme';
import {
  ToggleSwitch,
  DisclosureSummary,
  Button,
  ButtonLink,
  CardButton,
  Input,
  PageHeader,
  Surface,
  Textarea,
  AutoTextarea,
} from './features/shared/ui';
import { ActionIcon } from './features/shared/ActionIcon';
import { DropdownSelect } from './features/shared/DropdownSelect';
import { VerticalTabs } from './features/shared/VerticalTabs';
import { HorizontalNavigation, HorizontalPage } from './features/shared/HorizontalNavigation';
import { IconButton } from './features/shared/IconButton';
import { DetailKindInput } from './features/works/DetailKindInput';
import { PresetModal } from './features/shared/PresetModal';
import { TimeDial } from './features/schedules/TimeDial';
import { dateSpan, nextDate } from './features/schedules/timeRange';
import { ScheduleDateRange } from './features/schedules/ScheduleDateRange';
import { TaskDirectory } from './features/schedules/TaskDirectory';

const dialReferenceItems: ScheduleDetail[] = [
  { name: '미완료', start: '02:00', end: '05:00', status: 'planned' },
  { name: '진행 중', start: '10:00', end: '14:00', status: 'planned' },
  { name: '완료', start: '16:00', end: '19:00', status: 'completed' },
  { name: '예정', start: '20:00', end: '23:00', status: 'planned' },
  { name: '2열 겹침', start: '11:00', end: '13:00', status: 'completed' },
  { name: '3열 겹침', start: '12:00', end: '14:00', status: 'planned' },
  { name: '자정 연속', start: '23:00', end: '02:00', status: 'planned' },
  { name: '단발 미완료', start: '06:00', end: '', status: 'planned' },
  { name: '단발 완료', start: '07:00', end: '', status: 'completed' },
  { name: '단발 예정', start: '15:00', end: '', status: 'planned' },
  { name: '호와 교차하는 막대', start: '04:00', end: '', status: 'completed' },
  { name: '끝이 맞닿는 일정', start: '05:00', end: '06:00', status: 'planned' },
  { name: '짧은 간격의 일정', start: '06:05', end: '06:30', status: 'completed' },
].map((item, index) => ({
  id: `reference-${index}`,
  entity_id: '',
  title: item.name,
  scheduled_date: '2026-09-28',
  end_date: item.name === '자정 연속' ? '2026-09-29' : '2026-09-28',
  start_time: item.start,
  end_time: item.end,
  time_zone: 'Asia/Seoul',
  status: item.status,
  notes: '',
  created_at: '',
  updated_at: '',
  entity_snapshot: { ...emptyFields, name: item.name },
  tasks: [],
}));

export function DesignReference() {
  useTranslation();
  const [theme, setTheme] = useState<UserSettings['theme']>('system');
  useTheme(theme);
  const [enabled, setEnabled] = useState(false);
  const [horizontal, setHorizontal] = useState(0);
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
  const [referenceTrack, setReferenceTrack] = useState('work');
  const [referenceMultiDay, setReferenceMultiDay] = useState(true);
  const [referenceDates, setReferenceDates] = useState({
    scheduled_date: '2026-09-27',
    end_date: '2026-09-29',
    start_time: '',
    end_time: '',
  });
  const [directory, setDirectory] = useState(false);
  const [referenceMemo, setReferenceMemo] = useState('');
  const [referenceTaskDeleted, setReferenceTaskDeleted] = useState(false);
  return (
    <main className="design-reference">
      <div className="reference-row" role="group" aria-label={tr('Settings.theme')}>
        {(['light', 'dark', 'system'] as const).map((mode) => (
          <Button key={mode} aria-pressed={theme === mode} onClick={() => setTheme(mode)}>
            <ActionIcon name={mode === 'light' ? 'sun' : mode === 'dark' ? 'moon' : 'monitor'} />
            {tr(`Settings.${mode}`)}
          </Button>
        ))}
      </div>
      <Surface as="section" id="horizontal-navigation-reference">
        <h2>가로 탭·페이지 전환</h2>
        <HorizontalNavigation label={tr('Sidebar.calendarViews')}>
          {(['day', 'month', 'year'] as const).map((value, index) => (
            <Button
              key={value}
              variant="plain"
              aria-pressed={horizontal === index}
              onClick={() => setHorizontal(index)}
            >
              {tr(`Calendar.${value}Tab`)}
            </Button>
          ))}
          <Button variant="plain" disabled>
            {tr('design-reference.unavailable')}
          </Button>
        </HorizontalNavigation>
        <HorizontalPage index={horizontal}>
          <h3>{tr(`Calendar.${(['day', 'month', 'year'] as const)[horizontal] ?? 'day'}Tab`)}</h3>
        </HorizontalPage>
      </Surface>
      <Surface as="section" id="settings-controls-reference">
        <h2>설정 탐색·토글 스위치</h2>
        <VerticalTabs
          label={tr('Settings.tabs')}
          items={(['general', 'appearance', 'notifications'] as const).map((value) => ({
            value,
            label: tr(`Settings.${value}`),
          }))}
        >
          {(value) => (
            <>
              <h3>{tr(`Settings.${value}`)}</h3>
              <label className="reference-row">
                <ToggleSwitch
                  checked={enabled}
                  onChange={(event) => setEnabled(event.target.checked)}
                />
                {tr('Settings.pushEnabled')}
              </label>
              <label className="reference-row">
                <ToggleSwitch disabled />
                {tr('design-reference.unavailable')}
              </label>
              <label className="reference-row">
                <ToggleSwitch disabled defaultChecked />
                {tr('design-reference.selected')}
              </label>
            </>
          )}
        </VerticalTabs>
      </Surface>
      <ContentContextMenu />
      <Surface as="section" id="task-directory-reference">
        <IconButton icon="presets" onClick={() => setDirectory(true)}>
          {tr('TaskDirectory.title')}
        </IconButton>
        {directory && (
          <TaskDirectory
            existing={[]}
            capacity={100}
            onAdd={() => {}}
            onClose={() => setDirectory(false)}
            preview={[
              {
                id: 'read',
                name: '독서',
                group_name: '공부',
                default_notes: '',
                tags: [],
                archived: false,
                version: 1,
                created_at: '',
                updated_at: '',
                item_count: 0,
              },
              {
                id: 'review',
                name: '복습',
                group_name: '공부',
                default_notes: '',
                tags: [],
                archived: false,
                version: 1,
                created_at: '',
                updated_at: '',
                item_count: 0,
              },
              {
                id: 'walk',
                name: '걷기',
                group_name: '운동',
                default_notes: '',
                tags: [],
                archived: false,
                version: 1,
                created_at: '',
                updated_at: '',
                item_count: 0,
              },
            ]}
          />
        )}
      </Surface>
      <Surface as="section" id="date-time-reference">
        <h2>{tr('ScheduleEditor.scheduleSpanningMultipleDays')}</h2>
        <label className="multi-day-toggle">
          <Input
            type="checkbox"
            checked={referenceMultiDay}
            onChange={(event) => {
              const checked = event.target.checked;
              setReferenceMultiDay(checked);
              setReferenceDates((value) => ({
                ...value,
                end_date:
                  checked ||
                  (value.start_time && value.end_time && value.end_time <= value.start_time)
                    ? nextDate(value.scheduled_date)
                    : value.scheduled_date,
              }));
            }}
          />
          {tr('ScheduleEditor.scheduleSpanningMultipleDays')}
        </label>
        {referenceMultiDay ? (
          <ScheduleDateRange value={referenceDates} onChange={setReferenceDates} />
        ) : (
          <TimeDial
            start={referenceDates.start_time}
            end={referenceDates.end_time}
            daySpan={dateSpan(referenceDates.scheduled_date, referenceDates.end_date)}
            onChange={(range) =>
              setReferenceDates({
                ...referenceDates,
                start_time: range.start,
                end_time: range.end,
                end_date: range.daySpan
                  ? nextDate(referenceDates.scheduled_date)
                  : referenceDates.scheduled_date,
              })
            }
          />
        )}
        <label>
          {tr('design-reference.memo')}
          <AutoTextarea
            rows={3}
            value={referenceMemo}
            onChange={(event) => setReferenceMemo(event.target.value)}
          />
        </label>
      </Surface>
      <Surface as="section" id="today-dial-reference">
        <h2>당일 시계판 상태색</h2>
        <TodayDial
          today="2026-09-28"
          timeZone="Asia/Seoul"
          now={new Date('2026-09-28T03:00:00Z')}
          items={dialReferenceItems}
        />
      </Surface>
      <Surface as="section" id="today-overview-reference">
        <h2>당일 요약 너비와 긴 제목</h2>
        <TodayOverview
          today="2026-09-28"
          timeZone="Asia/Seoul"
          items={dialReferenceItems.slice(0, 3).map((item) => ({
            ...item,
            entity_snapshot: {
              ...item.entity_snapshot,
              name: `${item.entity_snapshot.name} · 긴 스케줄 제목이 여러 줄로 끝없이 늘어나지 않는 요약 예시`,
            },
          }))}
          error=""
          locked={true}
          onFinish={async () => {}}
          onEditing={() => {}}
          mutate={async () => {}}
        />
      </Surface>
      <Surface as="section" id="task-actions-reference">
        <h2>태스크 행 동작</h2>
        <p>행에 마우스를 올리거나 Tab으로 이동하세요. 터치 화면은 44px, 데스크톱은 32px입니다.</p>
        {referenceTaskDeleted ? (
          <Button onClick={() => setReferenceTaskDeleted(false)}>예시 복원</Button>
        ) : (
          <div className="today-task-card memo-preview">
            <div className="today-task-heading">
              <label>
                <Input type="checkbox" className="task-check" />
                태스크 예시
              </label>
              <div className="preview-actions task-hover-actions">
                <DeleteButton
                  label="태스크 예시"
                  onDelete={async () => setReferenceTaskDeleted(true)}
                />
                <MemoButton
                  label="태스크 예시"
                  value={referenceMemo}
                  onSave={async (value) => setReferenceMemo(value)}
                />
                <Button variant="ghost" onClick={() => setModal(true)}>
                  수정
                </Button>
              </div>
            </div>
          </div>
        )}
        <div className="today-task-card memo-preview">
          <div className="today-task-heading">
            <label>
              <Input type="checkbox" className="task-check" disabled />
              사용 불가 예시
            </label>
            <div className="preview-actions task-hover-actions">
              <DeleteButton label="사용 불가 예시" disabled onDelete={async () => {}} />
              <MemoButton label="사용 불가 예시" value="" disabled onSave={async () => {}} />
              <Button variant="ghost" disabled>
                수정
              </Button>
            </div>
          </div>
        </div>
      </Surface>
      <Surface as="section" id="completion-reference">
        <h2>완료 체크</h2>
        <div className="reference-row">
          <label>
            <Input type="checkbox" defaultChecked />
            스케줄 완료
          </label>
          <label>
            <Input type="checkbox" className="task-check" />
            태스크 미완료
          </label>
          <label>
            <Input type="checkbox" className="task-check" defaultChecked />
            태스크 완료
          </label>
          <label>
            <Input type="checkbox" className="task-check" disabled />
            사용 불가
          </label>
          <label>
            <Input type="checkbox" className="task-check" disabled defaultChecked />
            완료·사용 불가
          </label>
        </div>
      </Surface>
      <Surface as="section" id="disclosure-reference">
        <h2>펼치기·접기 기준 — 트랙 변경</h2>
        <DropdownSelect
          label={tr('Tracks.switch')}
          value={referenceTrack}
          options={[
            { value: 'work', label: '업무' },
            { value: 'study', label: '공부' },
          ]}
          onChange={setReferenceTrack}
        />
        <details>
          <DisclosureSummary>공통 펼치기·접기</DisclosureSummary>
          <p>트랙 변경과 같은 아래 화살표가 열릴 때 180° 회전합니다.</p>
        </details>
      </Surface>
      <section
        className="reference-section"
        data-context-content
        data-schedule-color={scheduleColor}
      >
        <ContextMenuSlot>
          <ScheduleColorPicker value={scheduleColor} onChange={setScheduleColor} />
        </ContextMenuSlot>
        <h2>{tr('ContextMenu.title')}</h2>
        <p>{tr('ContextMenu.demo')}</p>
        <Button data-context-action="edit" onClick={() => setModal(true)}>
          <ActionIcon name="edit" />
          {tr('App.edit')}
        </Button>
        <Button data-context-action="memo" onClick={() => setToast(true)}>
          <ActionIcon name="memo" />
          {tr('ContextMenu.memo')}
        </Button>
      </section>
      <PageHeader>
        <div>
          <p className="eyebrow">{tr('design-reference.eyebrow')}</p>
          <h1>{tr('design-reference.consistentScreens')}</h1>
          <p>{tr('design-reference.theSharedComponentsAndStatesUsedInTheApp')}</p>
        </div>
        <ButtonLink href="/#/today">{tr('design-reference.backToApp')}</ButtonLink>
      </PageHeader>
      <Surface as="section" id="sticky-demo">
        <h2>{tr('Sticky.name')}</h2>
        <StickyDemo />
      </Surface>
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
              'presets',
            ] as const
          ).map((icon) => (
            <IconButton key={icon} icon={icon} aria-label={tr(`design-reference.icon.${icon}`)} />
          ))}
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
        <Button onClick={() => setToast(true)}>
          {tr('design-reference.previewToastNotification')}
        </Button>
      </Surface>
      <NotificationDemo />
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
