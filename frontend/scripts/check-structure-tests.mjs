import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkStructure } from './check-structure.mjs';

function fixture(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-structure-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [file, source] of Object.entries(files)) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, source);
  }
  fs.mkdirSync(path.join(root, 'routes'), { recursive: true });
  return checkStructure(root, path.join(root, 'routes'), ['main.ts'], new Map()).errors;
}

test('accepts dynamic imports and type-only back references', (t) => {
  assert.deepEqual(
    fixture(t, {
      'main.ts': "export type Value = string; import('./feature');",
      'feature.ts': "import type { Value } from './main'; export const value: Value = '';",
    }),
    [],
  );
});

test('rejects unreachable modules and runtime cycles', (t) => {
  const errors = fixture(t, {
    'main.ts': "import './feature';",
    'feature.ts': "import './main';",
    'abandoned.ts': 'export const unused = 1;',
  });
  assert.ok(errors.some((error) => error.includes('abandoned.ts: unreachable')));
  assert.ok(errors.some((error) => error.includes('Module cycle:')));
});

test('rejects UI transport, API-to-UI dependencies and route SQL', (t) => {
  const errors = fixture(t, {
    'main.ts': "import './features/view'; import './api/data';",
    'features/view.ts': "import { requestJson } from '../api/client'; fetch('/api/data');",
    'api/client.ts': 'export const requestJson = () => {};',
    'api/data.ts': "import '../features/view';",
    'routes/data.rs': 'sqlx::query("SELECT * FROM data");',
    'routes/health.rs': 'sqlx::query_scalar("SELECT 1");',
  });
  assert.equal(errors.filter((error) => error.includes('belongs in')).length, 3);
  assert.ok(errors.some((error) => error.includes('API imports UI')));
  assert.ok(!errors.some((error) => error.includes('health.rs')));
});
