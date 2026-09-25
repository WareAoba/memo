import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../src', import.meta.url));
const errors = [];
for (const name of readdirSync(root, { recursive: true }).filter(
  (name) => name.endsWith('.css') && name !== 'tokens.css',
)) {
  const css = readFileSync(join(root, name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  if (/#(?:[\da-f]{3,8})\b|\b(?:rgb|hsl)a?\(/i.test(css))
    errors.push(`${name}: literal color; use tokens.css`);
  if (!css.trimStart().startsWith('@layer '))
    errors.push(`${name}: CSS must declare its cascade layer`);
  if (/:has\(\s*>\s*(?:svg|\.action-icon)/.test(css))
    errors.push(`${name}: use iconOnly instead of inferring button style from children`);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else console.log('Design reference: all styles use shared colors and explicit layers.');
