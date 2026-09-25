import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { Input } from '../shared/ui';
import type { PreviewSchedule } from './preview';
import { taskTone } from './preview';

export function ScheduleBlock({
  schedule,
  onToggle,
}: {
  schedule: PreviewSchedule;
  onToggle: (scheduleId: string, taskId: string) => void;
}) {
  useTranslation();
  const completed = schedule.tasks.filter((task) => task.completed).length;
  const done = schedule.tasks.length > 0 && completed === schedule.tasks.length;
  return (
    <article className={`work-block tone-${schedule.tone}`} aria-labelledby={`work-${schedule.id}`}>
      <header className="work-block-heading">
        <div>
          <div className="work-meta">
            <span>{schedule.category}</span>
            <span>
              {done
                ? tr('ScheduleBlock.allCompleted')
                : completed > 0
                  ? tr('progress.inProgress')
                  : tr('progress.scheduled')}
            </span>
          </div>
          <h2 id={`work-${schedule.id}`}>{schedule.name}</h2>
          <p className="work-time">
            <time dateTime={schedule.start}>{schedule.start}</time>
            <span aria-hidden="true">—</span>
            <time dateTime={schedule.end}>{schedule.end}</time>
          </p>
        </div>
        <span
          className="work-count"
          aria-label={tr('SavedScheduleCard.valueOfValueTasksCompleted', {
            v1: schedule.tasks.length,
            v2: completed,
          })}
        >
          {completed}
          <span> / {schedule.tasks.length}</span>
        </span>
      </header>
      <div
        className="task-blocks"
        role="group"
        aria-label={tr('ScheduleBlock.valueTasks', { v1: schedule.name })}
      >
        {schedule.tasks.map((task) => (
          <label
            className={`task-block task-${taskTone(task.id)}${task.completed ? ' is-complete' : ''}`}
            key={task.id}
          >
            <Input
              type="checkbox"
              checked={task.completed}
              onChange={() => onToggle(schedule.id, task.id)}
            />
            <span className="task-name">{task.name}</span>
            <span className="task-state" aria-hidden="true">
              {task.completed ? tr('design-reference.completed') : tr('ScheduleBlock.incomplete')}
            </span>
          </label>
        ))}
      </div>
    </article>
  );
}
