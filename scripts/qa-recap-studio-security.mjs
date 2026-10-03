import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rules = JSON.parse(await readFile(new URL('../database.rules.json', import.meta.url), 'utf8')).rules;
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const includesAll = (value, fragments) =>
  typeof value === 'string' && fragments.every((fragment) => value.includes(fragment));

const access = rules.recapStudioAccess;
const assignments = rules.recapStudioAssignments;
const migrations = rules.recapStudioMigrations?.teamHistoryV3;
const publicStatus = rules.recapStudioPublicStatus?.teamHistoryV3;
const teams = rules.recapStudioTeams;
const viewer = access?.viewers?.$uid;
const interval = assignments?.byUid?.$uid?.intervals?.$assignmentId;
const byPay = assignments?.byPay?.$payDate?.$uid;
const byMonth = assignments?.byMonth?.$month?.$uid;
const roster = teams?.$teamKey?.roster?.$uid;
const rosterInterval = roster?.intervals?.$assignmentId;
const weekly = teams?.$teamKey?.weekly?.$payDate?.$uid;
const bep = teams?.$teamKey?.bep?.$month?.$uid;

check(Boolean(access && assignments && migrations && publicStatus && teams), 'v3 Recap Studio rule roots are missing');
check(
  includesAll(access?.['.read'], ["child('scope').val() == 'all'", "child('revokedAt')", '> now', "== 'admin'"]),
  'root ACL reads must require admin or a non-revoked all scope',
);
check(
  includesAll(viewer?.['.validate'], ["val() == 'all'", "val() == 'team'", "child('revokedAt').isNumber()", "child('updatedBy').val() == 'admin'"]),
  'ACL validation must support revokedAt without an active:false compatibility branch',
);
check(!String(viewer?.['.validate'] || '').includes("child('active')"), 'ACL validation must not use the obsolete active:false switch');

check(
  includesAll(assignments?.['.read'], ["== 'admin'", "child('status').val() == 'active'"]),
  'assignment root must be admin-only',
);
check(
  includesAll(assignments?.byUid?.$uid?.['.read'], ["== $uid", "== 'admin'", "child('status').val() == 'active'"]),
  'byUid assignment reads must be exact-self/admin',
);
check(
  includesAll(interval?.['.write'], ["== 'admin'", "child('status').val() == 'active'", "child('lock').child('ownerUid').val() == 'admin'", "child('lock').child('expiresAt').val() > now"]),
  'assignment interval writes must require an active admin lease',
);
check(
  includesAll(interval?.['.validate'], ["child('assignmentId').val() == $assignmentId", "child('teamKey')", "child('activeFrom')", "child('activeTo')", "child('configHash')", "child('reviewedBy').val() == 'admin'"]),
  'assignment intervals must validate identity, team, interval, hash and review provenance',
);
for (const [label, node, periodFragment] of [
  ['byPay', byPay, '$payDate'],
  ['byMonth', byMonth, '$month'],
]) {
  check(includesAll(node?.['.read'], ["== $uid", "== 'admin'", "child('status').val() == 'active'"]), `${label} index reads must be self/admin`);
  check(includesAll(node?.['.write'], ["== 'admin'", "child('status').val() == 'active'", "child('lock').child('ownerUid').val() == 'admin'", "child('lock').child('expiresAt').val() > now"]), `${label} index writes must require an active admin lease`);
  check(includesAll(node?.['.validate'], [periodFragment, "child('assignmentId')", "child('teamKey')", "child('configHash')", "child('byUid')"]), `${label} must bind to a reviewed byUid interval`);
}

check(
  includesAll(teams?.['.read'], ["child('scope').val() == 'all'", "child('revokedAt')", '> now', "== 'admin'"]),
  'team root reads must require admin/all and reject revoked viewers',
);
check(
  includesAll(teams?.$teamKey?.['.read'], ["child('scope').val() == 'team'", "child('teamKey').val() == $teamKey", "child('revokedAt')", '> now']),
  'team parent reads must require a non-revoked exact-team ACL',
);
check(!String(teams?.$teamKey?.['.read'] || '').includes('managerAccess'), 'managerAccess must not bypass exact-team reads');
check(
  includesAll(roster?.['.validate'], ["hasChildren(['uid','name','role','intervals'])", "child('uid').val() == $uid", "child('intervals').hasChildren()"]),
  'team roster rows must be identity holders with one or more reviewed intervals',
);
check(
  includesAll(rosterInterval?.['.validate'], ["child('uid').val() == $uid", "child('assignmentId').val() == $assignmentId", "child('activeFrom')", "child('activeTo')", "child('source')", "child('configHash')", "child('reviewedBy').val() == 'admin'"]),
  'each roster-holder interval must validate identity, boundary, source, review provenance and config hash',
);
check(
  includesAll(weekly?.['.read'], ["== $uid", "child('byPay')", "child('assignmentId')", "child('assignmentConfigHash')"]),
  'weekly child reads must be exact-self and assignment-index bound',
);
check(
  includesAll(weekly?.['.write'], ["child('lock').child('expiresAt').val() > now", "child('status').child('leaseId').val() == root.child('recapStudioMigrations').child('teamHistoryV3').child('lock').child('leaseId').val()", "child('recapStudioPublicStatus').child('teamHistoryV3').child('status').val() == 'complete'", "child('recapStudioPublicStatus').child('teamHistoryV3').child('version').val() == '2026-10-03.team-history-v3'", "child('byPay')", "== $uid"]),
  'weekly writes must use either a matching live migration lease or verified public readiness plus the exact self index',
);
check(
  includesAll(weekly?.['.validate'], ["child('teamKey').val() == $teamKey", "child('assignmentId')", "child('assignmentConfigHash')", "child('configHash')"]),
  'weekly records must carry exact v3 assignment binding metadata',
);
check(
  includesAll(bep?.['.read'], ["== $uid", "child('byMonth')", "child('teamKey').val() == $teamKey"]),
  'BEP child reads must be exact-self and month-index bound',
);
check(
  includesAll(bep?.['.write'], ["child('lock').child('expiresAt').val() > now", "child('status').child('leaseId').val() == root.child('recapStudioMigrations').child('teamHistoryV3').child('lock').child('leaseId').val()", "child('recapStudioPublicStatus').child('teamHistoryV3').child('status').val() == 'complete'", "child('recapStudioPublicStatus').child('teamHistoryV3').child('version').val() == '2026-10-03.team-history-v3'", "child('byMonth')", "== $uid"]),
  'BEP writes must use the same lease-aware public-readiness cutover',
);

check(
  includesAll(publicStatus?.['.read'], ["auth != null", "child('status').val() == 'active'"]),
  'public readiness must expose only the narrow completion record to active authenticated users',
);
check(
  includesAll(publicStatus?.['.write'], ["== 'admin'", "child('lock').child('ownerUid').val() == 'admin'", "child('lock').child('expiresAt').val() > now"]),
  'public readiness mutation must require an active admin lease',
);
check(
  includesAll(publicStatus?.['.validate'], ["hasChildren(['status','version','configHash','verifiedHash','completedAt'])", "child('status').val() == 'complete'", "child('configHash')", "child('verifiedHash')"]),
  'public readiness must validate the verified completion tuple',
);
check(publicStatus?.$other?.['.validate'] === false, 'public readiness must reject undeclared fields');

for (const key of ['weeklyProfitRecaps', 'weeklyProfitRecapsPrivate', 'profitMonthlyBep', 'profitMonthlyBepPrivate']) {
  const node = rules[key];
  check(!String(node?.['.read'] || '').includes("child('scope').val() != 'team'"), `${key} read must not use a null-friendly != team bypass`);
}
for (const [label, write] of [
  ['weekly public', rules.weeklyProfitRecaps?.$payDate?.$uid?.['.write']],
  ['weekly private', rules.weeklyProfitRecapsPrivate?.$uid?.$payDate?.['.write']],
  ['BEP public', rules.profitMonthlyBep?.$month?.$uid?.['.write']],
  ['BEP private', rules.profitMonthlyBepPrivate?.$uid?.$month?.['.write']],
]) {
  check(
    includesAll(write, ["!root.child('recapStudioMigrations').child('teamHistoryV3').child('marker').exists()", "state').val() == 'blocked'", "state').val() == 'failed'", "state').val() == 'rolled-back'", "== $uid"]),
    `${label} must freeze at lock/complete and remain available only before cutover`,
  );
  check(!String(write || '').includes("child('scope').val() == 'team'"), `${label} must not grant TL cross-canonical writes`);
}

for (const name of ['status', 'marker', 'config']) {
  check(includesAll(migrations?.[name]?.['.write'], ["== 'admin'", "child('status').val() == 'active'", "child('lock').child('expiresAt').val() > now", "child('leaseId')"]), `${name} migration writes must bind to an active admin lease`);
}
check(includesAll(migrations?.lock?.['.write'], ["== 'admin'", "child('expiresAt').val() <= now", "child('leaseId')"]), 'lease rule must support owner/stale cleanup and collision safety');
for (const name of ['status', 'marker']) {
  check(
    includesAll(migrations?.[name]?.['.read'], ["child('scope').val() == 'team'", "child('scope').val() == 'all'", "child('revokedAt')", '> now']),
    `${name} readiness reads must allow only active, non-revoked Recap Studio viewers`,
  );
}
check(!migrations?.lock?.['.read'] && !migrations?.audit?.['.read'] && !migrations?.backup?.['.read'], 'lock, audit and backup must not expose viewer read overrides');
check(includesAll(migrations?.audit?.$runId?.['.write'], ["== 'admin'", "child('status').val() == 'active'"]), 'audit writes must be admin-only');
check(includesAll(migrations?.backup?.$runId?.['.write'], ["== 'admin'", "child('status').val() == 'active'"]), 'backup writes must be admin-only');
check(
  includesAll(teams?.$teamKey?.roster?.['.write'], ["lock').child('expiresAt').val() > now", "status').child('leaseId').val() == root.child('recapStudioMigrations').child('teamHistoryV3').child('lock').child('leaseId').val()"])
    && includesAll(roster?.['.validate'], ["state').val() == 'rolling-back'", "status').child('leaseId').val() == root.child('recapStudioMigrations').child('teamHistoryV3').child('lock').child('leaseId').val()", "child('activeFrom')"]),
  'v2 roster restoration must be narrowly gated to a live admin rollback lease',
);
check(
  includesAll(weekly?.['.write'], ["lock').child('expiresAt').val() > now", "state').val() == 'rolling-back'", "status').child('leaseId').val() == root.child('recapStudioMigrations').child('teamHistoryV3').child('lock').child('leaseId').val()"])
    && includesAll(weekly?.['.validate'], ["state').val() == 'rolling-back'", "!newData.child('assignmentConfigHash').exists()"]),
  'v2 weekly restoration must be narrowly gated to a live admin rollback lease',
);
check(
  includesAll(rules.dossier?.['.write'], ["== 'admin'", "child('role').val() == 'Founder'", "child('status').val() == 'active'"]),
  'security-sensitive dossier ancestry must be admin/founder-only',
);

// Executable policy model for the v3 state transition and exact materialized indices.
const complete = { marker: true, status: 'complete', publicReady: true };
const rolledBack = { marker: false, status: 'rolled-back', publicReady: false };
const locked = { marker: false, status: 'locked', publicReady: false, lease: true };
const rollbackReady = { marker: true, status: 'rolling-back', publicReady: false, lease: true };
const canLegacyWrite = (state) => !state.marker && [undefined, 'blocked', 'failed', 'rolled-back'].includes(state.status);
const canNewSelfWrite = (state, exact) => state.publicReady && exact;
const canMigrationWrite = (state, admin) => admin && state.lease && ['locked', 'verifying', 'rolling-back'].includes(state.status);

assert.equal(canLegacyWrite(rolledBack), true, 'legacy remains available before lock');
assert.equal(canLegacyWrite(locked), false, 'legacy freezes at lock');
assert.equal(canLegacyWrite(complete), false, 'legacy remains frozen after complete');
assert.equal(canNewSelfWrite(rolledBack, true), false, 'new self path is denied before complete');
assert.equal(canNewSelfWrite(complete, false), false, 'new self path requires an exact materialized index');
assert.equal(canNewSelfWrite(complete, true), true, 'new self path opens after verified complete');
assert.equal(canNewSelfWrite({ ...complete, publicReady: false }, true), false, 'new self path closes as soon as public readiness is revoked');
assert.equal(canMigrationWrite(locked, true), true, 'admin may apply under a live migration lease');
assert.equal(canMigrationWrite(locked, false), false, 'ordinary users cannot use the migration bypass');
assert.equal(canMigrationWrite(rollbackReady, true), true, 'admin may restore canonical leaves under a live rollback lease');
assert.equal(canMigrationWrite({ ...rollbackReady, lease: false }, true), false, 'rollback bypass fails closed without a live lease');

if (failures.length) {
  console.error(`FAIL ${failures.length} Recap Studio v3 security contract checks`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('PASS Recap Studio v3 security contract: static rules + cutover policy model');
}
