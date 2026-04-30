import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const failures = [];

function walk(dir, predicate = () => true) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === '.git') continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) entries.push(...walk(path, predicate));
    else if (predicate(path)) entries.push(path);
  }
  return entries;
}

function read(path) {
  return readFileSync(path, 'utf8');
}

function fail(message) {
  failures.push(message);
}

const migrationFiles = readdirSync(join(root, 'supabase'))
  .filter(name => /^\d+_.*\.sql$/.test(name))
  .sort();
const prefixes = new Map();
for (const file of migrationFiles) {
  const prefix = file.split('_')[0];
  prefixes.set(prefix, [...(prefixes.get(prefix) ?? []), file]);
}
for (const [prefix, files] of prefixes) {
  if (files.length > 1) fail(`Duplicate Supabase migration prefix ${prefix}: ${files.join(', ')}`);
}

const sourceFiles = walk(root, path => /\.(ts|tsx|js|jsx|md)$/.test(path));
const appSourceFiles = sourceFiles.filter(path => /\/(app|components|lib)\//.test(path));

for (const path of appSourceFiles) {
  const text = read(path);
  if (text.includes('is_public')) fail(`${path}: use is_global_search instead of is_public`);
  if (text.includes("from('profiles')") || text.includes('from("profiles")')) fail(`${path}: profiles table is not part of the schema; use users`);
}

const storePath = join(root, 'lib/store.ts');
const store = read(storePath);
if (store.includes('original_clip_id') && !store.includes('saved_from_clip_id')) {
  fail(`${storePath}: save count should use saved_from_clip_id`);
}

const commentsApi = read(join(root, 'app/api/comments/route.ts'));
if (!commentsApi.includes('Parent comment not found for this clip')) {
  fail('app/api/comments/route.ts: parent comment clip validation is missing');
}

if (failures.length > 0) {
  console.error('Schema consistency check failed:');
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}

console.log('Schema consistency check passed.');
