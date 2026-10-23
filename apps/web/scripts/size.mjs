// Enforces the bundle budgets in docs/architecture/performance.md (gzip sizes).
// Initial JS = the entry chunk plus everything it imports statically.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = { initial: 250, lazyChunk: 90, editor: 180 };

const dist = (file) => fileURLToPath(new URL(`../dist/${file}`, import.meta.url));
const manifest = JSON.parse(readFileSync(dist('.vite/manifest.json'), 'utf8'));
const gzipKb = (file) => gzipSync(readFileSync(dist(file))).length / 1024;

const entryKey = Object.keys(manifest).find((key) => manifest[key].isEntry);
const initial = new Set();
const visit = (key) => {
  if (initial.has(key)) return;
  initial.add(key);
  for (const next of manifest[key].imports ?? []) visit(next);
};
visit(entryKey);

const initialKb = [...initial].reduce((sum, key) => sum + gzipKb(manifest[key].file), 0);
// Who imports each chunk: code shared only by the editor package (its React
// editor and its Markdown conversion) is editor code, wherever Vite puts it.
const importers = new Map();
for (const [key, chunk] of Object.entries(manifest)) {
  for (const target of [...(chunk.imports ?? []), ...(chunk.dynamicImports ?? [])]) {
    importers.set(target, [...(importers.get(target) ?? []), key]);
  }
}
const isEditor = (key) =>
  key.includes('editor') ||
  ((importers.get(key) ?? []).length > 0 &&
    (importers.get(key) ?? []).every((k) => k.includes('packages/editor/')));
const lazy = Object.entries(manifest)
  .filter(([key, chunk]) => !initial.has(key) && chunk.file.endsWith('.js'))
  .map(([key, chunk]) => ({
    key,
    file: chunk.file,
    kb: gzipKb(chunk.file),
    editor: isEditor(key),
  }));

const failures = [];
console.log(`initial JS: ${initialKb.toFixed(1)} kB gzip (budget ${BUDGET_KB.initial})`);
if (initialKb > BUDGET_KB.initial) failures.push('initial');
for (const chunk of lazy.sort((a, b) => b.kb - a.kb).slice(0, 8)) {
  const budget = chunk.editor ? BUDGET_KB.editor : BUDGET_KB.lazyChunk;
  const over = chunk.kb > budget;
  console.log(
    `${over ? 'OVER' : '    '} ${chunk.kb.toFixed(1).padStart(6)} kB  ${chunk.file} (budget ${budget})`,
  );
  if (over) failures.push(chunk.file);
}
if (failures.length) {
  console.error(`Bundle budget exceeded: ${failures.join(', ')}`);
  process.exit(1);
}
