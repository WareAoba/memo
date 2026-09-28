import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export function checkStructure(
  root,
  routes,
  entries = ['main.tsx', 'design-reference.tsx'],
  testOnly = new Map([['api/health.ts', 'API health response/transport contract tests']]),
) {
  const files = fs
    .readdirSync(root, { recursive: true })
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$|\.d\.ts$|^test[\\/]/.test(file))
    .map((file) => file.replaceAll('\\', '/'));
  const known = new Set(files);
  const graph = new Map();
  const runtimeGraph = new Map();
  const errors = [];
  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(path.join(root, file), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const dependencies = new Set();
    const runtimeDependencies = new Set();
    function visit(node) {
      const specifier =
        ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
          ? node.moduleSpecifier
          : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
            ? node.arguments[0]
            : undefined;
      if (specifier && ts.isStringLiteral(specifier) && specifier.text.startsWith('.')) {
        const base = path.posix.normalize(
          path.posix.join(path.posix.dirname(file), specifier.text),
        );
        const resolved = [
          base,
          `${base}.ts`,
          `${base}.tsx`,
          `${base}/index.ts`,
          `${base}/index.tsx`,
        ].find((candidate) => known.has(candidate));
        if (resolved) {
          dependencies.add(resolved);
          const typeOnly =
            (ts.isImportDeclaration(node) &&
              (node.importClause?.isTypeOnly ||
                (!node.importClause?.name &&
                  node.importClause?.namedBindings &&
                  ts.isNamedImports(node.importClause.namedBindings) &&
                  node.importClause.namedBindings.elements.length > 0 &&
                  node.importClause.namedBindings.elements.every((item) => item.isTypeOnly)))) ||
            (ts.isExportDeclaration(node) && node.isTypeOnly);
          if (!typeOnly) runtimeDependencies.add(resolved);
          if (file.startsWith('api/') && resolved.startsWith('features/'))
            errors.push(`${file}: API imports UI ${resolved}`);
          if (
            file.startsWith('features/') &&
            resolved === 'api/client.ts' &&
            ts.isImportDeclaration(node)
          ) {
            const bindings = node.importClause?.namedBindings;
            if (
              bindings &&
              ts.isNamedImports(bindings) &&
              bindings.elements.some((item) =>
                ['getJson', 'requestJson', 'getBlob'].includes(
                  (item.propertyName ?? item.name).text,
                ),
              )
            )
              errors.push(`${file}: HTTP transport belongs in api/`);
          }
        }
      }
      if (
        file.startsWith('features/') &&
        ts.isCallExpression(node) &&
        /^(fetch|window\.fetch|globalThis\.fetch)$/.test(node.expression.getText(source))
      ) {
        errors.push(`${file}: direct HTTP call belongs in api/`);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    graph.set(file, dependencies);
    runtimeGraph.set(file, runtimeDependencies);
  }

  const reached = new Set();
  function reach(file) {
    if (reached.has(file)) return;
    reached.add(file);
    for (const child of graph.get(file) ?? []) reach(child);
  }
  for (const entry of entries) reach(entry);
  // Kept deliberately as a test-only adapter for the operational health endpoint.

  for (const file of files)
    if (!reached.has(file) && !testOnly.has(file))
      errors.push(`${file}: unreachable from product/design entry points`);
  for (const file of testOnly.keys())
    if (!known.has(file) || reached.has(file)) errors.push(`${file}: stale test-only exception`);

  const visited = new Set();
  const active = new Set();
  function cycles(file, stack = []) {
    if (active.has(file)) {
      errors.push(`Module cycle: ${[...stack, file].join(' -> ')}`);
      return;
    }
    if (visited.has(file)) return;
    visited.add(file);
    active.add(file);
    for (const child of runtimeGraph.get(file) ?? []) cycles(child, [...stack, file]);
    active.delete(file);
  }
  for (const file of files) cycles(file);

  for (const file of fs
    .readdirSync(routes)
    .filter((file) => file.endsWith('.rs') && file !== 'health.rs')) {
    if (/\bsqlx\s*::/.test(fs.readFileSync(path.join(routes, file), 'utf8')))
      errors.push(`routes/${file}: SQL belongs in services`);
  }
  return { errors, count: files.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { errors, count } = checkStructure(
    fileURLToPath(new URL('../src/', import.meta.url)),
    fileURLToPath(new URL('../../backend/src/routes/', import.meta.url)),
  );
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else
    console.log(
      `Structure: ${count} modules; no cycles, unexpected unreachable modules, or checked boundary violations.`,
    );
}
