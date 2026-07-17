import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const workbookRoot = path.resolve(import.meta.dirname, '..');
const callbackRoot = path.resolve(workbookRoot, '../presence-hub-callback-sync/callback');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function checkInlineScripts(file) {
  const html = read(file);
  let count = 0;
  for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    const source = match[1].trim();
    if (!source) continue;
    new vm.Script(source, { filename: `${path.basename(file)}:inline-${++count}` });
  }
  return count;
}

function checkStaticIds(file) {
  const html = read(file)
    .replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style(?:\s[^>]*)?>[\s\S]*?<\/style>/gi, '');
  const ids = [...html.matchAll(/\sid=["']([^"']+)["']/gi)].map((match) => match[1]);
  return [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
}

function checkLocalAssets(file, root) {
  const html = read(file);
  const missing = [];
  for (const match of html.matchAll(/\s(?:src|href)=["']([^"']+)["']/gi)) {
    const raw = match[1].trim();
    if (!raw || /^(?:https?:|data:|blob:|mailto:|tel:|javascript:|#|\/)/i.test(raw)) continue;
    if (/[${}]/.test(raw)) continue;
    const clean = decodeURIComponent(raw.split(/[?#]/)[0]);
    if (!clean || !/\.[a-z0-9]{2,5}$/i.test(clean)) continue;
    if (!fs.existsSync(path.resolve(root, clean))) missing.push(raw);
  }
  return [...new Set(missing)];
}

const workbookFile = path.join(workbookRoot, 'index.html');
const callbackFile = path.join(callbackRoot, 'index.html');
const failures = [];

const inlineCount = checkInlineScripts(workbookFile);
for (const [label, file, root] of [
  ['workbook', workbookFile, workbookRoot],
  ['callback', callbackFile, callbackRoot],
]) {
  const duplicateIds = checkStaticIds(file);
  const missingAssets = checkLocalAssets(file, root);
  if (duplicateIds.length) failures.push(`${label}: duplicate static ids: ${duplicateIds.join(', ')}`);
  if (missingAssets.length) failures.push(`${label}: missing local assets: ${missingAssets.join(', ')}`);
}

new vm.Script(read(path.join(workbookRoot, 'ps-hub.js')), { filename: 'ps-hub.js' });
new vm.Script(read(path.join(workbookRoot, 'presence-studio.js')), { filename: 'presence-studio.js' });
new vm.Script(read(path.join(callbackRoot, 'script.js')), { filename: 'callback/script.js' });

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`QA audit passed: ${inlineCount} workbook inline scripts, unique static ids, local assets present.`);
