import { tr } from '../../i18n';
export type PreviewTask = { id: string; name: string; completed: boolean };
// Stable task colors also carry across the calendar and preset views.
export function taskTone(id: string) {
  const tones: Record<string, string> = {
    vocabulary: 'mint',
    reading: 'blue',
    speaking: 'violet',
    planning: 'peach',
    draft: 'violet',
    warmup: 'yellow',
    strength: 'rose',
    stretch: 'mint',
  };
  return tones[id] ?? 'blue';
}
export type PreviewSchedule = {
  id: string;
  name: string;
  date: string;
  start: string;
  end: string;
  category: string;
  tone: 'sage' | 'blue' | 'sand';
  tasks: PreviewTask[];
};

// Layout examples only. Never sent to an API or written to persistent storage.
export function dateKey(date: Date) {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function fromDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year!, month! - 1, day!);
  date.setHours(0, 0, 0, 0);
  return date;
}
export function monthDays(month: Date) {
  const first = new Date(month);
  first.setDate(1);
  const last = new Date(first);
  last.setMonth(last.getMonth() + 1, 0);
  const count = last.getDate();
  const cells = Math.ceil((first.getDay() + count) / 7) * 7;
  return Array.from({ length: cells }, (_, index) => {
    const day = index - first.getDay() + 1;
    if (day <= 0 || day > count) return null;
    const date = new Date(first);
    date.setDate(day);
    return dateKey(date);
  });
}
export function makePreviewSchedules(today: string): PreviewSchedule[] {
  const tomorrow = fromDateKey(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return [
    {
      id: 'english-today',
      name: tr('preview.english'),
      date: today,
      start: '09:00',
      end: '10:00',
      category: tr('preview.learning'),
      tone: 'sage',
      tasks: [
        { id: 'vocabulary', name: tr('preview.reviewVocabulary'), completed: true },
        { id: 'reading', name: tr('preview.readAShortText'), completed: false },
        { id: 'speaking', name: tr('preview.speakAloud'), completed: false },
      ],
    },
    {
      id: 'project-today',
      name: tr('preview.personalProject'),
      date: today,
      start: '14:00',
      end: '15:30',
      category: tr('preview.creating'),
      tone: 'blue',
      tasks: [
        { id: 'planning', name: tr('preview.organizeTasks'), completed: false },
        { id: 'draft', name: tr('preview.createADraft'), completed: false },
      ],
    },
    {
      id: 'fitness-today',
      name: tr('preview.fitness'),
      date: today,
      start: '18:30',
      end: '19:30',
      category: tr('preview.exercise'),
      tone: 'sand',
      tasks: [
        { id: 'warmup', name: tr('preview.warmUp'), completed: false },
        { id: 'strength', name: tr('preview.strengthTraining'), completed: false },
        { id: 'stretch', name: tr('preview.stretching'), completed: false },
      ],
    },
    {
      id: 'english-tomorrow',
      name: tr('preview.english'),
      date: dateKey(tomorrow),
      start: '09:00',
      end: '10:00',
      category: tr('preview.learning'),
      tone: 'sage',
      tasks: [
        { id: 'vocabulary', name: tr('preview.reviewVocabulary'), completed: false },
        { id: 'reading', name: tr('preview.readAShortText'), completed: false },
      ],
    },
  ];
}
