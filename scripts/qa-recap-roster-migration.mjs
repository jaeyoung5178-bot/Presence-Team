import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const core = html.match(/const RECAP_STUDIO_SECURITY_VERSION=[\s\S]*?(?=function tlHomeConfig)/)?.[0];
const rosterActive = html.match(/function recapStudioRosterActive\(entry,pay\)\{[^\n]+\}/)?.[0];
const leaseMutation = html.match(/function recapStudioLeaseMutation\(current,candidate,now\)\{[^\n]+\}/)?.[0];
const migrationViewSource = html.match(/function recapStudioMigrationView\(periodCoverage\)\{[^\n]+\}/)?.[0];
assert.ok(core && rosterActive && leaseMutation && migrationViewSource, 'v3 migration source must be extractable');

const api = new Function(`${core}\n${rosterActive}\n${leaseMutation}\nreturn {
  RECAP_STUDIO_SECURITY_VERSION, RECAP_STUDIO_MIRROR_MONTHS, RECAP_STUDIO_LEGACY_PATHS, RECAP_STUDIO_REVIEWED_ROSTER,
  recapStudioPlanHistoryV3, recapStudioVerifyHistoryV3, recapStudioLeaseMutation,
  recapStudioReviewedTargetsAt, recapStudioReviewedTargetsInMonth,
  recapStudioRollbackLeafMap, recapStudioBuildRollbackPatch, recapStudioRosterActive
};`)();

const uids = {
  gyung: 'umqn54ujf', young: 'umqon3e0p', hajin: 'umqonn3id', chae: 'umqna7jpj',
  min: 'umrcsjqmm', son: 'umqp1ufdo', sumin: 'opc6wFbahNXpfyxP0AlJI4inKrd2',
  hyejin: 'iEaGdVqSAEbRVI6Yeus7ZG0Zf4t2', direct: 'presence-direct-park', blin: 'blin-reviewed-uid',
};
const names = {
  [uids.gyung]: '고윤경', [uids.young]: '권영웅', [uids.hajin]: '김하진', [uids.chae]: '윤채영',
  [uids.min]: '민병준', [uids.son]: '손예진', [uids.sumin]: '이수민', [uids.hyejin]: '황혜진',
  [uids.direct]: '박인선', [uids.blin]: 'Blin',
};
const payDates = ['2026-08-07','2026-08-14','2026-08-21','2026-08-28','2026-09-04','2026-09-11','2026-09-18','2026-09-25','2026-10-02','2026-10-09','2026-10-16','2026-10-23','2026-10-30'];
const months = ['2026-08','2026-09','2026-10'];
const baselineUids = Object.values(uids).filter((uid) => uid !== uids.blin);
const clone = (value) => JSON.parse(JSON.stringify(value));
const record = (uid, payDate, n) => ({
  uid, name: names[uid], role: [uids.gyung,uids.chae].includes(uid) ? 'TL' : 'LR', payType: 'performance',
  payDate, incomeDate: payDate, weekEnding: payDate, activityFrom: payDate, activityTo: payDate,
  netPayment: 100000 + n, hourlyPay: 0, rejectCLCount: n % 3, rejectSWCount: n % 2,
  resubmitCLCount: 0, resubmitSWCount: 0, bondBalance: 0, bep: 200000, updatedAt: 1790985600000 + n,
  updatedBy: uid, updatedByName: names[uid],
});
function assignmentId(a) { return ['a', a.activeFrom, a.activeTo || 'open', a.teamKey].join('_'); }
function applyPatch(root, patch) {
  Object.entries(patch).forEach(([path, value]) => {
    const parts = path.split('/'); let cursor = root;
    for (const part of parts.slice(0, -1)) { cursor[part] ||= {}; cursor = cursor[part]; }
    const key = parts.at(-1);
    if (value === null) delete cursor[key]; else cursor[key] = clone(value);
  });
}
function baseline() {
  const users = {}, weekly = {}, bep = {};
  baselineUids.forEach((uid) => { users[uid] = { uid, name: names[uid], role: [uids.gyung,uids.chae].includes(uid) ? 'TL' : 'LR', status: uid === uids.hajin ? 'departed' : 'active' }; });
  payDates.forEach((pay, pi) => { weekly[pay] = {}; baselineUids.forEach((uid, ui) => { weekly[pay][uid] = record(uid, pay, pi * 20 + ui); }); });
  months.forEach((month, mi) => { bep[month] = {}; baselineUids.forEach((uid, ui) => { bep[month][uid] = 200000 + mi * 10000 + ui; }); });
  const dossier = {
    고윤경: {}, 권영웅: { upline: '고윤경' }, 김하진: { upline: '고윤경' },
    윤채영: {}, 민병준: { upline: '윤채영' }, 손예진: { upline: '윤채영' },
    이수민: { upline: '민병준' }, 황혜진: { upline: '윤채영' }, 박인선: {},
  };
  const reviewed = (v) => ({ ...v, reviewedAt: 1790985600000, reviewedBy: 'admin' });
  const teams = {
    presence: { roster: {}, weekly: {}, bep: {} },
    fuse: { roster: { [uids.gyung]: reviewed({ uid: uids.gyung, name: '고윤경', role: 'TL', activeFrom: '2026-10-03' }) }, weekly: {}, bep: {} },
    youngwave: { roster: { [uids.chae]: reviewed({ uid: uids.chae, name: '윤채영', role: 'TL', activeFrom: '2026-10-03' }) }, weekly: {}, bep: {} },
  };
  return { teams, assignments: {}, weekly, bep, users, dossier, memberInfo: {}, removedMembers: ['김하진'], migration: {} };
}

assert.equal(api.RECAP_STUDIO_SECURITY_VERSION, '2026-10-03.team-history-v3');
assert.deepEqual(api.RECAP_STUDIO_MIRROR_MONTHS, months);
assert.deepEqual(api.RECAP_STUDIO_LEGACY_PATHS, ['weeklyProfitRecaps','profitMonthlyBep','weeklyProfitRecapsPrivate','profitMonthlyBepPrivate']);

const migrationView = new Function('state', `${migrationViewSource}\nreturn recapStudioMigrationView;`)({
  recapStudioMigration: {
    status: { state: 'complete', configHash: 'cfg-flat' },
    marker: { state: 'complete', configHash: 'cfg-flat' },
  },
});
const partialView = migrationView({ expectedRecords: 4, actualRecords: 3, conflicts: 0 });
assert.equal(partialView.configHash, 'cfg-flat', 'adapter must expose a flat configHash alias');
assert.equal(partialView.periodStatus, 'partial', 'adapter must expose periodStatus');
assert.deepEqual(partialView.coverage, { expected: 4, actual: 3, conflicts: 0 }, 'adapter must expose normalized period coverage aliases');
assert.equal(migrationView({ expectedRecords: 0, actualRecords: 0, conflicts: 0 }).periodStatus, 'no-records');
assert.equal(migrationView({ expectedRecords: 4, actualRecords: 4, conflicts: 1 }).periodStatus, 'blocked');

const initial = baseline();
const first = api.recapStudioPlanHistoryV3(initial, 1790985601000);
assert.equal(first.blocked, false, JSON.stringify({ conflicts: first.conflicts, unresolved: first.unresolved }));
assert.equal(first.coverage.expectedWeekly, 104, 'reviewed intervals plus Presence-direct history must determine weekly coverage');
assert.equal(first.coverage.expectedBep, 25, 'month coverage must respect 김하진 and join boundaries');
assert.ok(first.written > 250, 'full desired diff must include canonical data and materialized indexes');

const root = { recapStudioTeams: clone(initial.teams), recapStudioAssignments: {} };
applyPatch(root, first.patch);
const migrated = { ...initial, teams: root.recapStudioTeams, assignments: root.recapStudioAssignments };
const verified = api.recapStudioVerifyHistoryV3(migrated, first);
assert.equal(verified.ok, true, JSON.stringify(verified));
assert.equal(verified.coverage.actualWeekly, first.coverage.expectedWeekly);
assert.equal(verified.coverage.actualBep, first.coverage.expectedBep);

const rollback = api.recapStudioBuildRollbackPatch(migrated, { teams: initial.teams, assignments: initial.assignments });
assert.deepEqual(rollback.unsupported, [], 'known canonical schema must produce a granular rollback');
assert.equal(Object.hasOwn(rollback.patch, 'recapStudioTeams'), false, 'rollback must never replace the broad team root');
assert.equal(Object.hasOwn(rollback.patch, 'recapStudioAssignments'), false, 'rollback must never replace the broad assignment root');
assert.ok(Object.keys(rollback.patch).length > 100, 'rollback must enumerate the exact changed leaves');
const rolledBack = { recapStudioTeams: clone(migrated.teams), recapStudioAssignments: clone(migrated.assignments) };
applyPatch(rolledBack, rollback.patch);
assert.deepEqual(api.recapStudioRollbackLeafMap(rolledBack.recapStudioTeams, rolledBack.recapStudioAssignments).leaves, api.recapStudioRollbackLeafMap(initial.teams, initial.assignments).leaves, 'granular rollback must exactly restore the backed-up leaves');
const unsupportedRollback = api.recapStudioBuildRollbackPatch({ teams: { rogue: { roster: { x: {} } } }, assignments: {} }, { teams: {}, assignments: {} });
assert.deepEqual(unsupportedRollback.patch, {}, 'unsupported branches must never generate guessed writes');
assert.ok(unsupportedRollback.unsupported.includes('recapStudioTeams/rogue'), 'unsupported branches must fail closed');

const canonical = migrated.teams.youngwave.weekly['2026-08-21'][uids.sumin];
assert.equal(canonical.teamKey, 'youngwave');
assert.ok(canonical.assignmentId && canonical.assignmentConfigHash === first.configHash, 'weekly canonical record must bind to exact assignment/config');
const suminRoster = migrated.teams.youngwave.roster[uids.sumin];
const suminInterval = suminRoster.intervals[canonical.assignmentId];
assert.deepEqual(
  Object.keys(suminRoster).sort(),
  ['intervals', 'name', 'role', 'uid'],
  'canonical roster rows must be interval holders, not a single flattened assignment',
);
assert.equal(suminInterval.uid, uids.sumin);
assert.equal(suminInterval.assignmentId, canonical.assignmentId);
assert.equal(suminInterval.configHash, first.configHash);
assert.equal(api.recapStudioRosterActive(suminRoster, '2026-08-14'), false, 'interval holder must respect the join boundary');
assert.equal(api.recapStudioRosterActive(suminRoster, '2026-08-21'), true, 'interval holder must activate on the first eligible pay date');
assert.equal(migrated.teams.fuse.weekly['2026-09-04']?.[uids.hajin], undefined, '김하진 must be excluded after August');
assert.ok(migrated.teams.fuse.weekly['2026-08-28'][uids.hajin], '김하진 August record must remain');
assert.equal(api.recapStudioRosterActive(migrated.teams.fuse.roster[uids.hajin], '2026-08-28'), true, 'departed history remains active inside its reviewed interval');
assert.equal(api.recapStudioRosterActive(migrated.teams.fuse.roster[uids.hajin], '2026-09-04'), false, 'departed history closes after its reviewed interval');
assert.equal(migrated.teams.youngwave.weekly['2026-08-14']?.[uids.sumin], undefined, '8/16 joiner must be excluded before boundary');
assert.ok(migrated.teams.youngwave.weekly['2026-08-21'][uids.sumin], 'recursive grandchild 이수민 must resolve under Young Wave');
assert.ok(migrated.teams.presence.weekly['2026-09-04'][uids.direct], 'non-root member must remain Presence-direct');
assert.equal(migrated.assignments.byPay['2026-10-30'][uids.young].teamKey, 'fuse');
assert.equal(migrated.assignments.byMonth['2026-09'][uids.sumin].teamKey, 'youngwave');

const second = api.recapStudioPlanHistoryV3(migrated, 1790985602000);
assert.equal(second.blocked, false);
assert.equal(second.written, 0, 'second run must be a zero-write no-op');
assert.equal(second.desiredHash, first.desiredHash, 'stable reviewedAt must keep desired hash deterministic');

const exactDuplicate = clone(migrated);
exactDuplicate.teams.fuse.weekly['2026-08-21'] ||= {};
exactDuplicate.teams.fuse.weekly['2026-08-21'][uids.sumin] = clone(initial.weekly['2026-08-21'][uids.sumin]);
const cleanupPlan = api.recapStudioPlanHistoryV3(exactDuplicate, 1790985603000);
const wrongPath = `recapStudioTeams/fuse/weekly/2026-08-21/${uids.sumin}`;
assert.equal(cleanupPlan.blocked, false, JSON.stringify(cleanupPlan.conflicts));
assert.equal(cleanupPlan.patch[wrongPath], null, 'wrong-team exact legacy duplicate must be removed');

const nonIdentical = clone(exactDuplicate);
nonIdentical.teams.fuse.weekly['2026-08-21'][uids.sumin].netPayment += 1;
const conflictPlan = api.recapStudioPlanHistoryV3(nonIdentical, 1790985604000);
assert.equal(conflictPlan.blocked, true);
assert.deepEqual(conflictPlan.patch, {}, 'any non-identical conflict must fail closed without partial writes');
assert.ok(conflictPlan.conflicts.some((x) => x.type === 'stale-weekly-conflict'));

const extra = baseline();
extra.users[uids.blin] = { uid: uids.blin, name: names[uids.blin], role: 'LR', status: 'active' };
extra.dossier.Blin = { upline: '손예진' };
payDates.forEach((pay, i) => { extra.weekly[pay][uids.blin] = record(uids.blin, pay, 500 + i); });
months.forEach((month, i) => { extra.bep[month][uids.blin] = 300000 + i; });
const unapproved = api.recapStudioPlanHistoryV3(extra, 1790985605000);
assert.equal(unapproved.blocked, true);
assert.ok(unapproved.unresolved.some((x) => x.type === 'unapproved-descendant' && x.uid === uids.blin), 'new recursive descendant must be enumerated for explicit approval');

const yw = { uid: uids.blin, name: 'Blin', role: 'LR', teamKey: 'youngwave', activeFrom: '2026-08-01', activeTo: '2026-09-15', source: 'reviewed-v3' };
const fuse = { uid: uids.blin, name: 'Blin', role: 'LR', teamKey: 'fuse', activeFrom: '2026-09-16', activeTo: '2026-10-15', source: 'reviewed-v3' };
const ywReturn = { uid: uids.blin, name: 'Blin', role: 'LR', teamKey: 'youngwave', activeFrom: '2026-10-16', activeTo: '2026-10-31', source: 'reviewed-v3' };
yw.assignmentId = assignmentId(yw); fuse.assignmentId = assignmentId(fuse); ywReturn.assignmentId = assignmentId(ywReturn);
extra.assignments = { byUid: { [uids.blin]: { intervals: {
  [yw.assignmentId]: { ...yw, reviewedAt: 1790985600000, reviewedBy: 'admin' },
  [fuse.assignmentId]: { ...fuse, reviewedAt: 1790985600001, reviewedBy: 'admin' },
  [ywReturn.assignmentId]: { ...ywReturn, reviewedAt: 1790985600002, reviewedBy: 'admin' },
} } } };
const ambiguousMonth = api.recapStudioPlanHistoryV3(extra, 1790985606000);
assert.equal(ambiguousMonth.blocked, true, 'two non-overlapping assignments in one month require an explicit monthly selection');
assert.ok(ambiguousMonth.conflicts.some((x) => x.type === 'monthly-assignment-ambiguous' && x.month === '2026-09' && x.uid === uids.blin));
assert.ok(ambiguousMonth.conflicts.some((x) => x.type === 'monthly-assignment-ambiguous' && x.month === '2026-10' && x.uid === uids.blin));
const reviewedTransfer = clone(extra);
reviewedTransfer.assignments.byMonth = {
  '2026-09': { [uids.blin]: { uid: uids.blin, teamKey: 'fuse', assignmentId: fuse.assignmentId, activeFrom: fuse.activeFrom, activeTo: fuse.activeTo, configHash: 'prior', selection: 'reviewed', reviewedBy: 'admin', reviewedAt: 1790985600003 } },
  '2026-10': { [uids.blin]: { uid: uids.blin, teamKey: 'youngwave', assignmentId: ywReturn.assignmentId, activeFrom: ywReturn.activeFrom, activeTo: ywReturn.activeTo, configHash: 'prior', selection: 'reviewed', reviewedBy: 'admin', reviewedAt: 1790985600004 } },
};
const transfer = api.recapStudioPlanHistoryV3(reviewedTransfer, 1790985606001);
assert.equal(transfer.blocked, false, JSON.stringify({ conflicts: transfer.conflicts, unresolved: transfer.unresolved }));
assert.equal(Object.keys(transfer.desired.assignments.byUid[uids.blin].intervals).length, 3, 'YW→FUSE→YW rejoin must preserve all three reviewed intervals');
assert.ok(transfer.desired.teams.youngwave.weekly['2026-09-11'][uids.blin]);
assert.ok(transfer.desired.teams.fuse.weekly['2026-09-18'][uids.blin]);
assert.ok(transfer.desired.teams.fuse.weekly['2026-10-09'][uids.blin]);
assert.ok(transfer.desired.teams.youngwave.weekly['2026-10-16'][uids.blin]);
assert.ok(transfer.desired.teams.youngwave.roster[uids.blin].intervals[yw.assignmentId], 'source team must retain its reviewed interval in the roster holder');
assert.ok(transfer.desired.teams.youngwave.roster[uids.blin].intervals[ywReturn.assignmentId], 'rejoined team holder must retain the later reviewed interval');
assert.ok(transfer.desired.teams.fuse.roster[uids.blin].intervals[fuse.assignmentId], 'destination team must materialize its reviewed interval in the roster holder');
assert.equal(Object.keys(transfer.desired.teams.youngwave.roster[uids.blin].intervals).length, 2);
assert.equal(Object.keys(transfer.desired.teams.fuse.roster[uids.blin].intervals).length, 1);
assert.equal(transfer.desired.assignments.byPay['2026-09-11'][uids.blin].teamKey, 'youngwave');
assert.equal(transfer.desired.assignments.byPay['2026-09-18'][uids.blin].teamKey, 'fuse');
assert.equal(transfer.desired.assignments.byPay['2026-10-09'][uids.blin].teamKey, 'fuse');
assert.equal(transfer.desired.assignments.byPay['2026-10-16'][uids.blin].teamKey, 'youngwave');
assert.equal(transfer.desired.assignments.byMonth['2026-09'][uids.blin].selection, 'reviewed');
assert.equal(transfer.desired.assignments.byMonth['2026-09'][uids.blin].assignmentId, fuse.assignmentId);
assert.equal(transfer.desired.assignments.byMonth['2026-10'][uids.blin].selection, 'reviewed');
assert.equal(transfer.desired.assignments.byMonth['2026-10'][uids.blin].assignmentId, ywReturn.assignmentId);

const overlap = clone(reviewedTransfer);
const bad = { ...fuse, activeFrom: '2026-09-15' }; bad.assignmentId = assignmentId(bad);
overlap.assignments.byUid[uids.blin].intervals[bad.assignmentId] = { ...bad, reviewedAt: 1790985600005, reviewedBy: 'admin' };
const overlapPlan = api.recapStudioPlanHistoryV3(overlap, 1790985607000);
assert.equal(overlapPlan.blocked, true);
assert.ok(overlapPlan.conflicts.some((x) => x.type === 'assignment-overlap'));

const cycle = baseline(); cycle.dossier.순환A = { upline: '순환B' }; cycle.dossier.순환B = { upline: '순환A' };
const cyclePlan = api.recapStudioPlanHistoryV3(cycle, 1790985608000);
assert.equal(cyclePlan.blocked, true); assert.ok(cyclePlan.conflicts.some((x) => x.type === 'ancestry-cycle'));
const orphan = baseline(); orphan.dossier.손예진 = { upline: '없는상위' };
const orphanPlan = api.recapStudioPlanHistoryV3(orphan, 1790985609000);
assert.equal(orphanPlan.blocked, true); assert.ok(orphanPlan.conflicts.some((x) => x.type === 'unresolved-upline'));
const duplicate = baseline(); duplicate.users['duplicate-uid'] = { uid: 'duplicate-uid', name: '손예진', role: 'LR', status: 'active' };
const duplicatePlan = api.recapStudioPlanHistoryV3(duplicate, 1790985610000);
assert.equal(duplicatePlan.blocked, true); assert.ok(duplicatePlan.conflicts.some((x) => x.type === 'duplicate-name-uid'));

const afterSave = clone(migrated);
afterSave.migration = { marker: { state: 'complete', version: api.RECAP_STUDIO_SECURITY_VERSION, configHash: first.configHash } };
afterSave.teams.youngwave.weekly['2026-09-04'][uids.son].netPayment += 777;
delete afterSave.weekly['2026-09-04'][uids.son];
const preserved = api.recapStudioPlanHistoryV3(afterSave, 1790985611000);
assert.equal(preserved.blocked, false, JSON.stringify(preserved.conflicts));
assert.equal(preserved.desired.teams.youngwave.weekly['2026-09-04'][uids.son].netPayment, afterSave.teams.youngwave.weekly['2026-09-04'][uids.son].netPayment, 'post-cutover canonical-only save must remain authoritative');

const leaseA = { leaseId: 'A', expiresAt: 2000 }, leaseB = { leaseId: 'B', expiresAt: 3000 };
assert.deepEqual(api.recapStudioLeaseMutation(null, leaseA, 1000), leaseA);
assert.equal(api.recapStudioLeaseMutation(leaseA, leaseB, 1500), undefined, 'active two-tab lease must reject the racer');
assert.deepEqual(api.recapStudioLeaseMutation(leaseA, leaseB, 2001), leaseB, 'expired lease must be recoverable');
assert.deepEqual(api.recapStudioLeaseMutation(leaseA, { ...leaseA, expiresAt: 4000 }, 1500).expiresAt, 4000, 'same owner may renew its lease');

assert.match(html, /patch\['recapStudioTeams\/'\+teamKey\+'\/weekly\/'\+info\.pay\+'\/'\+target\.uid\]=rec/);
assert.doesNotMatch(html.match(/async function saveProfitRecap\(\)\{[\s\S]*?(?=function prcPptLoad)/)?.[0] || '', /weeklyProfitRecaps\//, 'ordinary saves must freeze legacy weekly writes');
assert.doesNotMatch(html.match(/async function saveProfitRecap\(\)\{[\s\S]*?(?=function prcPptLoad)/)?.[0] || '', /profitMonthlyBep\//, 'ordinary saves must freeze legacy BEP writes');
assert.match(html, /function recapStudioPresenceAgg\(/, 'Presence historical view must be a distinct union of canonical teams');
assert.doesNotMatch(html.match(/function recapStudioAdminPeople\(\)\{[^\n]+/)?.[0] || '', /status==='active'/, 'historical person selector must not drop departed people');
assert.match(html, /DB\.set\(RECAP_STUDIO_MIGRATION_PATH\+'\/lock',lease\)/, 'migration lock must use an exact-path server-enforced write');
assert.match(html, /DB\.set\(RECAP_STUDIO_MIGRATION_PATH\+'\/lock',next\)/, 'migration lease renewal must preserve the same lease id');
assert.doesNotMatch(html, /DB\.tx\((?:null|''|""|'')/, 'root transaction is forbidden');
assert.match(html, /backup=\{schemaVersion:RECAP_STUDIO_SECURITY_VERSION,leaseId:lease\.leaseId,createdAt:applyAt,configHash:plan\.configHash,legacyFrozenAt:applyAt,teamsExisted:/, 'backup metadata must bind schema, freeze time and prior root existence to the active lease');
assert.match(html, /assignmentsExisted:!!\(snapshot\.assignments/, 'backup metadata must preserve whether the prior assignment root existed');
assert.match(html, /config'\]=\{version:RECAP_STUDIO_SECURITY_VERSION,leaseId:lease\.leaseId,configHash:plan\.configHash,[^\n]+legacyFrozen:true,legacyFrozenAt:applyAt,legacyPaths:RECAP_STUDIO_LEGACY_PATHS/, 'migration config must bind the active lease and explicitly freeze every legacy path');
assert.match(html, /marker'\]=\{state:'complete',version:RECAP_STUDIO_SECURITY_VERSION,runId:runId,leaseId:lease\.leaseId,[^\n]+verifiedHash:verified\.verifiedHash,legacyFrozen:true,legacyFrozenAt:applyAt/, 'complete marker must bind the active lease and attest the legacy freeze');
assert.match(html, /config'\]=Object\.assign\(\{\},oldConfig,\{leaseId:lease\.leaseId,legacyFrozen:false,rolledBackAt:/, 'rollback must explicitly release the legacy freeze metadata under its lease');
const rollbackSource = html.match(/async function recapStudioRollbackHistoryV3\(\)\{[\s\S]*?(?=async function recapStudioApproveAssignment)/)?.[0] || '';
assert.ok(rollbackSource, 'rollback runtime must be extractable');
assert.doesNotMatch(rollbackSource, /patch\.recapStudioTeams|patch\.recapStudioAssignments/, 'runtime rollback must use granular leaves, never broad roots');
assert.match(rollbackSource, /recapStudioBuildRollbackPatch\(snapshot,backup\)/, 'runtime rollback must derive an exact leaf diff from the backup');
assert.match(html, /stored=Object\.assign\(\{\},entry,\{reviewedAt:reviewedAt,reviewedBy:'admin',configHash:draftPlan\.configHash\}\)/, 'approved intervals must carry the planned config hash required by rules');
assert.match(html, /action:'approve-assignment'[^\n]+desiredHash:draftPlan\.desiredHash[^\n]+counts:\{writes:1,cleanup:0\}[^\n]+conflictCount:/, 'assignment approval audit must use the standard required shape');
assert.match(html, /DB\.get\(RECAP_STUDIO_PUBLIC_STATUS_PATH\)[^\n]+publicStatus=values\[2\]/, 'ordinary canonical saves must read the narrow public readiness record');
assert.match(html, /publicStatus\.status!=='complete'\|\|publicStatus\.version!==RECAP_STUDIO_SECURITY_VERSION\|\|!publicStatus\.configHash\|\|!publicStatus\.verifiedHash/, 'ordinary canonical saves must fail closed unless public readiness is verified');
assert.match(html, /weekly\.configHash!==publicStatus\.configHash/, 'ordinary canonical saves must bind the materialized assignment to public readiness');
assert.match(html, /lockedPatch\[RECAP_STUDIO_PUBLIC_STATUS_PATH\]=null/, 'migration must revoke public readiness before canonical mutation');
assert.match(html, /freeze\[RECAP_STUDIO_PUBLIC_STATUS_PATH\]=null/, 'rollback must revoke public readiness before canonical mutation');
assert.match(html, /finalPatch\[RECAP_STUDIO_PUBLIC_STATUS_PATH\]=recapStudioPublicComplete\(plan,verified\.verifiedHash,completedAt\)/, 'public readiness may be restored only after verification');

console.log(JSON.stringify({
  version: first.version,
  coverage: verified.coverage,
  idempotentWrites: second.written,
  boundaries: { kimAugustOnly: true, joinDate: '2026-08-16', recursiveGrandchild: '이수민', presenceDirect: '박인선' },
  safety: { exactDuplicateCleanup: true, nonIdenticalBlocked: true, intervalHolders: true, transferIntervals: true, cycleBlocked: true, orphanBlocked: true, duplicateBlocked: true, canonicalSavePreserved: true, granularRollback: true, twoTabLease: true, publicReadiness: true },
}, null, 2));
