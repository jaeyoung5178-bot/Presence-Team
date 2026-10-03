import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rules = JSON.parse(
  await readFile(new URL('../database.rules.json', import.meta.url), 'utf8'),
).rules;

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};
const includesAll = (value, fragments) =>
  typeof value === 'string' && fragments.every((fragment) => value.includes(fragment));

const access = rules.recapStudioAccess;
const teams = rules.recapStudioTeams;
const viewer = access?.viewers?.$uid;
const team = teams?.$teamKey;
const roster = team?.roster?.$uid;
const mirrorWeekly = team?.weekly?.$payDate?.$uid;
const mirrorBep = team?.bep?.$month?.$uid;

check(Boolean(access), 'recapStudioAccess rules are missing');
check(Boolean(teams), 'recapStudioTeams rules are missing');
check(
  includesAll(access?.['.read'], ["child('status').val() == 'active'", "child('scope').val() == 'all'", "== 'admin'"]),
  'Recap access root must be readable only by active admin/all viewers',
);
check(
  includesAll(viewer?.['.read'], ["== $uid", "child('scope').val() == 'all'", "== 'admin'"]),
  'A viewer must be able to read only its ACL, while admin/all may read the ACL root',
);
check(
  includesAll(viewer?.['.write'], ["== 'admin'", "child('status').val() == 'active'"]),
  'Only the active admin owner may write Recap Studio ACL entries',
);
check(
  includesAll(viewer?.['.validate'], ["val() == 'all'", "val() == 'team'", "child('teamKey')", "child('updatedBy').val() == 'admin'"]),
  'ACL entries must validate scope, optional exact team, and admin provenance',
);
check(
  includesAll(teams?.['.read'], ["child('status').val() == 'active'", "child('scope').val() == 'all'", "== 'admin'"]),
  'Recap team root must be readable only by active admin/all viewers',
);
check(
  includesAll(team?.['.read'], ["child('scope').val() == 'team'", "child('teamKey').val() == $teamKey", "child('scope').val() == 'all'", "== 'admin'"]),
  'A team child must require admin/all or an exact matching scoped-team ACL',
);
check(!String(teams?.['.read'] || '').includes('managerAccess'), 'managerAccess must never grant Recap Studio root reads');
check(!String(team?.['.read'] || '').includes('managerAccess'), 'managerAccess must never grant Recap Studio team reads');
check(
  includesAll(team?.['.validate'], ["$teamKey == 'presence'", "$teamKey == 'fuse'", "$teamKey == 'youngwave'"]),
  'Only reviewed Presence/FUSE/Young Wave team keys may exist',
);
check(
  includesAll(team?.roster?.['.write'], ["== 'admin'", "child('status').val() == 'active'"]),
  'Only the active admin owner may write secure rosters',
);
check(
  includesAll(roster?.['.validate'], ["child('uid').val() == $uid", "child('activeFrom')", "child('activeTo')", "child('reviewedBy').val() == 'admin'"]),
  'Roster records must validate identity, reviewed provenance, and an effective interval',
);
check(
  includesAll(mirrorWeekly?.['.write'], ["== $uid", "managerAccess", "val() != 'team'", "child('teamKey').val() == $teamKey", "child('roster').child($uid)", "child('activeFrom')", "child('activeTo')"]),
  'Mirrored weekly writes must preserve rostered self/global manager/admin and exact scoped-team interval checks',
);
check(
  includesAll(mirrorWeekly?.['.validate'], ["child('uid').val() == $uid", "child('payDate').val() == $payDate", "child('netPayment').isNumber()", "child('updatedAt').isNumber()"]),
  'Mirrored weekly records must validate path identity and numeric recap shape',
);
check(
  includesAll(mirrorBep?.['.write'], ["== $uid", "managerAccess", "val() != 'team'", "child('teamKey').val() == $teamKey", "child('roster').child($uid)", "'-31'", "'-01'"]),
  'Mirrored BEP writes must use the same authority boundary and roster-month overlap',
);
check(
  includesAll(mirrorBep?.['.validate'], ['newData.isNumber()', 'newData.val() >= 0']),
  'Mirrored BEP values must be non-negative numbers',
);

for (const key of ['weeklyProfitRecaps', 'weeklyProfitRecapsPrivate', 'profitMonthlyBep', 'profitMonthlyBepPrivate']) {
  const read = rules[key]?.['.read'];
  check(
    includesAll(read, ['managerAccess', "child('scope').val() != 'team'", "child('status').val() == 'active'", "== 'admin'"]),
    `${key} root reads must deny team-scoped managers while retaining active admin/global-manager access`,
  );
}

for (const [label, write] of [
  ['weekly public', rules.weeklyProfitRecaps?.$payDate?.$uid?.['.write']],
  ['weekly private', rules.weeklyProfitRecapsPrivate?.$uid?.$payDate?.['.write']],
  ['BEP public', rules.profitMonthlyBep?.$month?.$uid?.['.write']],
  ['BEP private', rules.profitMonthlyBepPrivate?.$uid?.$month?.['.write']],
]) {
  check(
    includesAll(write, ["== $uid", "== 'admin'", 'managerAccess', "val() != 'team'", "child('scope').val() == 'team'", "child('roster').child($uid)", "child('activeFrom')", "child('activeTo')"]),
    `${label} writes must preserve self/admin/global-manager access and require a reviewed interval for scoped-team writes`,
  );
}

// Executable policy model: this makes the expected deny/allow matrix reviewable
// even when the Firebase Rules emulator is not installed in the workspace.
const users = {
  admin: { active: true, manager: true },
  fuseTl: { active: true, manager: true },
  waveTl: { active: true, manager: true },
  globalManager: { active: true, manager: true },
  fuseMember: { active: true, manager: false },
  waveMember: { active: true, manager: false },
  unassignedMember: { active: true, manager: false },
  inactiveAdmin: { active: false, manager: true },
};
const acl = {
  fuseTl: { scope: 'team', teamKey: 'fuse' },
  waveTl: { scope: 'team', teamKey: 'youngwave' },
  globalManager: { scope: 'all' },
  inactiveAdmin: { scope: 'all' },
};
const rosters = {
  fuse: {
    fuseMember: { activeFrom: '2026-01-01' },
    transfer: { activeFrom: '2026-01-01', activeTo: '2026-09-11' },
  },
  youngwave: {
    waveMember: { activeFrom: '2026-01-01' },
    transfer: { activeFrom: '2026-09-18' },
  },
};
const active = (uid) => users[uid]?.active === true;
const inRoster = (teamKey, uid, date) => {
  const interval = rosters[teamKey]?.[uid];
  return Boolean(interval && interval.activeFrom <= date && (!interval.activeTo || interval.activeTo >= date));
};
const canReadTeam = (uid, teamKey, root = false) => {
  if (!active(uid)) return false;
  if (uid === 'admin' || acl[uid]?.scope === 'all') return true;
  return !root && acl[uid]?.scope === 'team' && acl[uid]?.teamKey === teamKey;
};
const canReadCanonicalRoot = (uid) =>
  active(uid) && (uid === 'admin' || (users[uid]?.manager === true && acl[uid]?.scope !== 'team'));
const canWriteAclOrRoster = (uid) => active(uid) && uid === 'admin';
const canWriteCanonical = (uid, targetUid, date) => {
  if (!active(uid)) return false;
  if (uid === targetUid || uid === 'admin') return true;
  if (users[uid]?.manager === true && acl[uid]?.scope !== 'team') return true;
  const teamKey = acl[uid]?.scope === 'team' ? acl[uid]?.teamKey : '';
  return Boolean(teamKey && inRoster(teamKey, targetUid, date));
};
const canWriteMirror = (uid, teamKey, targetUid, date) => {
  if (!active(uid)) return false;
  if (uid === 'admin' || (users[uid]?.manager === true && acl[uid]?.scope !== 'team')) return true;
  if (uid === targetUid) return inRoster(teamKey, targetUid, date);
  return acl[uid]?.scope === 'team' && acl[uid]?.teamKey === teamKey && inRoster(teamKey, targetUid, date);
};

assert.equal(canReadTeam('admin', 'fuse', true), true, 'admin reads the Recap team root');
assert.equal(canReadTeam('globalManager', 'youngwave', true), true, 'scope=all reads every team and the root');
assert.equal(canReadTeam('fuseTl', 'fuse'), true, 'FUSE TL reads FUSE');
assert.equal(canReadTeam('fuseTl', 'youngwave'), false, 'FUSE TL is cross-team denied');
assert.equal(canReadTeam('waveTl', 'youngwave'), true, 'Young Wave TL reads Young Wave');
assert.equal(canReadTeam('waveTl', 'fuse'), false, 'Young Wave TL is cross-team denied');
assert.equal(canReadTeam('fuseTl', 'fuse', true), false, 'team-scoped TL cannot read the teams root');
assert.equal(canReadTeam('unassignedMember', 'fuse'), false, 'member without ACL is denied');
assert.equal(canReadCanonicalRoot('fuseTl'), false, 'team-scoped manager cannot bypass via canonical root');
assert.equal(canReadCanonicalRoot('globalManager'), true, 'global manager retains canonical root access');
assert.equal(canWriteAclOrRoster('fuseTl'), false, 'TL cannot write ACL/roster');
assert.equal(canWriteAclOrRoster('admin'), true, 'active owner admin can write ACL/roster');
assert.equal(canWriteCanonical('fuseMember', 'fuseMember', '2026-09-11'), true, 'existing self canonical write remains available');
assert.equal(canWriteCanonical('fuseTl', 'waveMember', '2026-09-11'), false, 'scoped TL cannot write a cross-team canonical record');
assert.equal(canWriteMirror('fuseMember', 'fuse', 'fuseMember', '2026-09-11'), true, 'rostered self can write its mirror');
assert.equal(canWriteMirror('unassignedMember', 'fuse', 'unassignedMember', '2026-09-11'), false, 'unrostered member cannot write a mirror');
assert.equal(canWriteMirror('fuseTl', 'fuse', 'transfer', '2026-09-11'), true, 'transfer remains in FUSE through its inclusive activeTo');
assert.equal(canWriteMirror('fuseTl', 'fuse', 'transfer', '2026-09-18'), false, 'FUSE loses transfer access after activeTo');
assert.equal(canWriteMirror('waveTl', 'youngwave', 'transfer', '2026-09-11'), false, 'Young Wave cannot read/write transfer before activeFrom');
assert.equal(canWriteMirror('waveTl', 'youngwave', 'transfer', '2026-09-18'), true, 'Young Wave gains transfer on activeFrom');
assert.equal(canReadTeam('inactiveAdmin', 'fuse'), false, 'inactive sessions are denied even with scope=all');

if (failures.length) {
  console.error(`FAIL ${failures.length} Recap Studio security contract checks`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('PASS Recap Studio security contract: static rules + deny/allow policy matrix');
}
