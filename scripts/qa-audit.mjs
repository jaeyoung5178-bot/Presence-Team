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
const quickslotSource = read(path.join(workbookRoot, 'assets/presence-home-quickslots.js'));
new vm.Script(quickslotSource, { filename: 'assets/presence-home-quickslots.js' });
if (!quickslotSource.includes('class="hqd-popover"') || !quickslotSource.includes('class="hqd-add"')) {
  failures.push('home quickslots: compact popover and add box must both be present');
}
if (quickslotSource.includes("className='quickslot-modal'") || quickslotSource.includes('class="quickslot-modal"')) {
  failures.push('home quickslots: full-screen picker modal must not return');
}

// Avatar catalogue quality gate: one visible name may not disguise a reused
// bitmap/filter combination as a different costume.
const avatarSource = read(path.join(workbookRoot, 'assets/presence-avatar-studio.js'));
const avatarWindow = {};
vm.runInNewContext(avatarSource, {
  window: avatarWindow,
  document: { readyState: 'loading', addEventListener() {} },
  localStorage: { getItem() { return null; }, setItem() {} },
  setTimeout() {},
  setInterval() {},
  console,
}, { filename: 'assets/presence-avatar-studio.js' });
const avatarItems = Object.values(avatarWindow.PRESENCE_SHOP_ITEMS || {});
const duplicateArt = avatarItems
  .map((item) => item.artKey)
  .filter((key, index, all) => key && all.indexOf(key) !== index);
if (duplicateArt.length) failures.push(`avatar: duplicate costume artwork: ${[...new Set(duplicateArt)].join(', ')}`);
if (avatarItems.some((item) => item.filter && item.filter !== 'none')) {
  failures.push('avatar: filtered copies must not be published as separate costume items');
}
avatarWindow.me = { uid: 'qa-avatar', name: 'QA' };
avatarWindow.state = { petProfiles: { 'qa-avatar': {
  equipped: { look: 'body_raincoat_5', head: 'head_shades_9' },
} } };
const migratedAvatar = avatarWindow.presenceAvatarProfile();
if (migratedAvatar.equipped.body !== 'body_raincoat_0') {
  failures.push('avatar: legacy filtered costume ids must migrate to the unique original artwork');
}
if (migratedAvatar.equipped.head) {
  failures.push('avatar: unreviewed body/head composites must not render together');
}
avatarWindow.state.petProfiles['qa-avatar'] = {
  color: 'sun', feather: 'legacy-spike', equipped: { prop: 'prop_tube_0' }, updatedAt: 2,
};
const repairedAvatar = avatarWindow.presenceAvatarProfile();
const repairedArt = avatarWindow.presencePetArt(repairedAvatar);
if (repairedAvatar.color !== 'honey' || repairedAvatar.feather !== 'classic') {
  failures.push('avatar: invalid legacy body/feather traits must canonicalize before rendering');
}
if (!repairedArt.includes('presence-pet-base.png')) {
  failures.push('avatar: every non-integrated render needs the audited canonical body');
}
if (repairedArt.includes('presence-base-') || repairedArt.includes('pgp-tone')) {
  failures.push('avatar: generated rectangular tone variants and tint overlays must not reach production');
}
if (repairedArt.includes('pgp-prop')) {
  failures.push('avatar: unreviewed props must not render over the face or torso');
}
if (!avatarSource.includes('__PRESENCE_AVATAR_STUDIO_SINGLE_OWNER=true')) {
  failures.push('avatar: external studio must explicitly own the inventory renderer');
}

// Workspace IA quality gate: four member workspaces plus a separate founder
// console. Admin tools must not be hidden inside Today or Profit.
const workbookSource = read(workbookFile);
for (const key of ["k:'today'", "k:'people'", "k:'progress'", "k:'profit'", "k:'admin'"]) {
  if (!workbookSource.includes(key)) failures.push(`navigation: missing workspace ${key}`);
}
if (!workbookSource.includes("l:'Admin',tabs:['admin'")) {
  failures.push('navigation: founder operations need a visible, dedicated Admin workspace');
}
if (!workbookSource.includes("matchMedia('(min-width:980px)')")) {
  failures.push('navigation: desktop must expose categorized second-level tools without an extra click');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`QA audit passed: ${inlineCount} workbook inline scripts, unique static ids, local assets present.`);
