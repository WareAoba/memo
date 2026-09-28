import { pathToFileURL } from 'node:url';

const tag = 'demo-20260927';
const groups = ['학습', '운동', '업무', '생활', '독서', '창작', '건강', '정리'];
const activities = ['준비하기', '기본 연습', '기록 남기기', '점검하기', '자료 읽기', '정리하기', '복습하기', '계획 세우기', '실행하기', '결과 확인', '메모 작성', '다음 단계', '마무리', '[횟수=10]회 연습', '[분량]만큼 진행'];
export function demoPresets() {
  const tasks = groups.flatMap((group) => activities.map((activity, i) => ({
    name: `테스트 · ${group} ${String(i + 1).padStart(2, '0')} ${activity}`,
    group_name: `테스트 · ${group}`,
    default_notes: '화면 확인용 더미 데이터입니다. 실제 업무 정보가 아닙니다.',
    tags: [tag],
    items: i % 5 === 0 ? [{ position: 0, label: '확인', item_type: 'checkbox', required: false, default_value: false, unit: '' }] : [],
  })));
  const works = Array.from({ length: 30 }, (_, i) => ({
    name: `테스트 · ${String(i + 1).padStart(2, '0')} ${groups[i % groups.length]} 워크`,
    general_notes: '화면 확인용 더미 데이터입니다. 실제 업무 정보가 아닙니다.',
    tags: [tag],
    custom_fields: [{ name: '용도', value: '검색·스크롤 확인' }],
  }));
  return { tasks, works };
}

export async function seedDemo(base, trackId) {
  const url = new URL(base);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Only a local development server is allowed');
  if (!trackId) throw new Error('An explicit --track ID is required');
  async function request(path, method = 'GET', body) {
    const response = await fetch(new URL(path, url), {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Track-Id': trackId },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`${method} ${path}: ${response.status}`);
    return response.json();
  }
  const tracks = await request('/api/tracks');
  if (!tracks.items.some((track) => track.id === trackId)) throw new Error('Track not found');
  async function list(path) {
    const all = [];
    for (let offset = 0;;) {
      const page = await request(`${path}?limit=100&offset=${offset}`);
      all.push(...page.items);
      offset += page.items.length;
      if (offset >= page.total || !page.items.length) return all;
    }
  }
  const beforeTasks = await list('/api/task-presets');
  const beforeWorks = await list('/api/entities');
  const { tasks, works } = demoPresets();
  const created = { tasks: 0, works: 0 };
  for (const fields of tasks) {
    const existing = beforeTasks.find((item) => item.name === fields.name);
    if (existing && !existing.tags.includes(tag)) throw new Error(`Non-demo name collision: ${fields.name}`);
    if (!existing) await request('/api/task-presets', 'POST', fields);
    if (!existing) created.tasks++;
  }
  for (const fields of works) {
    const existing = beforeWorks.find((item) => item.name === fields.name);
    if (existing && !existing.tags.includes(tag)) throw new Error(`Non-demo name collision: ${fields.name}`);
    if (!existing) await request('/api/entities', 'POST', fields);
    if (!existing) created.works++;
  }
  return { trackId, created, totals: { tasks: tasks.length, works: works.length } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.includes('--dry-run')) console.log(JSON.stringify(demoPresets(), null, 2));
  else {
    const value = (key) => args[args.indexOf(key) + 1];
    if (!args.includes('--track')) throw new Error('Usage: node scripts/seed-demo-presets.mjs --track UUID [--base http://127.0.0.1:3000]');
    console.log(JSON.stringify(await seedDemo(args.includes('--base') ? value('--base') : 'http://127.0.0.1:3000', value('--track')), null, 2));
  }
}
