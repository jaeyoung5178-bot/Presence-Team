import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const block = html.match(/const RECAP_STUDIO_SECURITY_VERSION=[\s\S]*?(?=function tlHomeConfig)/)?.[0];
const rosterActive = html.match(/function recapStudioRosterActive\(entry,pay\)\{[^\n]+\}/)?.[0];
assert.ok(block && rosterActive, 'Recap Studio reviewed migration source must be extractable');

const api = new Function(
  `${block}\n${rosterActive}\nreturn {RECAP_STUDIO_SECURITY_VERSION,RECAP_STUDIO_MIRROR_MONTHS,RECAP_STUDIO_REVIEWED_ROSTER,recapStudioReviewedTargetsAt,recapStudioReviewedTargetsInMonth,recapStudioPlanReviewedHistoryMigration};`,
)();

const uids = {
  gyung: 'umqn54ujf',
  young: 'umqon3e0p',
  hajin: 'umqonn3id',
  chae: 'umqna7jpj',
  min: 'umrcsjqmm',
  son: 'umqp1ufdo',
  sumin: 'opc6wFbahNXpfyxP0AlJI4inKrd2',
  hyejin: 'iEaGdVqSAEbRVI6Yeus7ZG0Zf4t2',
  direct: 'presence-direct-park',
};
const names = {
  [uids.gyung]: '고윤경', [uids.young]: '권영웅', [uids.hajin]: '김하진',
  [uids.chae]: '윤채영', [uids.min]: '민병준', [uids.son]: '손예진',
  [uids.sumin]: '이수민', [uids.hyejin]: '황혜진', [uids.direct]: '박인선',
};
const payDates = [
  '2026-08-07', '2026-08-14', '2026-08-21', '2026-08-28',
  '2026-09-04', '2026-09-11', '2026-09-18', '2026-09-25',
  '2026-10-02', '2026-10-09', '2026-10-16', '2026-10-23', '2026-10-30',
];
const months = ['2026-08', '2026-09', '2026-10'];
const allUids = Object.values(uids);
const record = (uid, payDate, n) => ({
  uid, name: names[uid], role: uid === uids.gyung || uid === uids.chae ? 'TL' : 'LR',
  payDate, weekEnding: payDate, netPayment: 100000 + n,
  rejectCLCount: n % 3, rejectSWCount: n % 2, updatedAt: 1790985600000 + n,
});
const reviewed = (entry) => ({ ...entry, reviewedAt: 1790985600000, reviewedBy: 'admin' });

const weekly = {};
payDates.forEach((payDate, payIndex) => {
  weekly[payDate] = {};
  allUids.forEach((uid, uidIndex) => { weekly[payDate][uid] = record(uid, payDate, payIndex * 20 + uidIndex); });
});
const bep = {};
months.forEach((month, monthIndex) => {
  bep[month] = {};
  allUids.forEach((uid, uidIndex) => { bep[month][uid] = 200000 + monthIndex * 10000 + uidIndex; });
});
const teams = {
  presence: { roster: {} },
  fuse: { roster: { [uids.gyung]: reviewed({ uid: uids.gyung, name: '고윤경', role: 'TL', activeFrom: '2026-10-03' }) }, weekly: {}, bep: {} },
  youngwave: { roster: { [uids.chae]: reviewed({ uid: uids.chae, name: '윤채영', role: 'TL', activeFrom: '2026-10-03' }) }, weekly: {}, bep: {} },
};

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function applyPatch(root, patch) {
  Object.entries(patch).forEach(([path, value]) => {
    const parts = path.split('/'); let cursor = root;
    parts.slice(0, -1).forEach((part) => { cursor[part] ||= {}; cursor = cursor[part]; });
    cursor[parts.at(-1)] = clone(value);
  });
}

const first = api.recapStudioPlanReviewedHistoryMigration({ teams: clone(teams), weekly, bep }, 1790985601000);
assert.equal(api.RECAP_STUDIO_SECURITY_VERSION, '2026-10-03.team-history-v2');
assert.deepEqual(api.RECAP_STUDIO_MIRROR_MONTHS, months);
assert.equal(first.conflicts.length, 0, 'reviewed clean migration must not report conflicts');
assert.equal(first.rosterWrites, 8, 'two legacy leaders and six missing members are corrected/seeded');
assert.equal(first.weeklyWrites, 91, 'only pay dates inside reviewed membership intervals are mirrored');
assert.equal(first.bepWrites, 22, 'only months overlapping reviewed membership intervals are mirrored');
assert.equal(first.written, 121, 'deterministic migration write count changed unexpectedly');

const root = { recapStudioTeams: clone(teams) };
applyPatch(root, first.patch);
const migrated = root.recapStudioTeams;
assert.equal(migrated.fuse.roster[uids.gyung].activeFrom, '2025-12-22', 'legacy TL seed is safely corrected');
assert.equal(migrated.fuse.roster[uids.hajin].activeTo, '2026-08-31', '김하진 is retained only through August');
assert.ok(migrated.fuse.weekly['2026-08-28'][uids.hajin], '김하진 remains visible for August recap');
assert.equal(migrated.fuse.weekly['2026-09-04']?.[uids.hajin], undefined, '김하진 is excluded from September');
assert.equal(migrated.fuse.weekly['2026-10-02']?.[uids.hajin], undefined, '김하진 is excluded from October');
assert.equal(migrated.youngwave.weekly['2026-08-14']?.[uids.sumin], undefined, '8/16 joiner is excluded before the boundary');
assert.ok(migrated.youngwave.weekly['2026-08-21'][uids.sumin], '8/16 joiner is included on the next pay date');
assert.equal(migrated.youngwave.weekly['2026-08-14']?.[uids.hyejin], undefined, '황혜진 is excluded before 8/16');
assert.ok(migrated.youngwave.weekly['2026-08-21'][uids.hyejin], '황혜진 is included after 8/16');
assert.ok(!JSON.stringify(migrated).includes(uids.direct), 'Presence-direct 박인선 is never assigned to FUSE or Young Wave');

payDates.forEach((payDate) => {
  const seen = new Map();
  Object.entries(api.RECAP_STUDIO_REVIEWED_ROSTER).forEach(([teamKey, roster]) => {
    Object.keys(roster).forEach((uid) => {
      if (api.recapStudioReviewedTargetsAt(uid, payDate).includes(teamKey)) seen.set(uid, (seen.get(uid) || 0) + 1);
    });
  });
  for (const [uid, count] of seen) assert.equal(count, 1, `${uid}/${payDate} must belong to exactly one reviewed team`);
});

const second = api.recapStudioPlanReviewedHistoryMigration({ teams: migrated, weekly, bep }, 1790985602000);
assert.equal(second.written, 0, 'second migration run must be a zero-write no-op');
assert.equal(second.conflicts.length, 0, 'idempotent rerun must not invent conflicts');

const manual = clone(migrated);
manual.fuse.weekly['2026-08-07'][uids.gyung].netPayment = 99999999;
const conflict = api.recapStudioPlanReviewedHistoryMigration({ teams: manual, weekly, bep }, 1790985603000);
const conflictedPath = `recapStudioTeams/fuse/weekly/2026-08-07/${uids.gyung}`;
assert.equal(conflict.patch[conflictedPath], undefined, 'non-identical manual mirror must never be overwritten');
assert.ok(conflict.conflicts.some((item) => item.type === 'weekly-mismatch' && item.uid === uids.gyung), 'manual mismatch must be reported');

const overlap = clone(teams);
overlap.youngwave.roster[uids.gyung] = reviewed({ uid: uids.gyung, name: '고윤경', role: 'TL', activeFrom: '2026-01-01' });
const overlapPlan = api.recapStudioPlanReviewedHistoryMigration({ teams: overlap, weekly, bep }, 1790985604000);
assert.ok(overlapPlan.conflicts.some((item) => item.type === 'roster-overlap' && item.uid === uids.gyung), 'cross-team roster overlap must be reported');
assert.equal(overlapPlan.patch[`recapStudioTeams/fuse/roster/${uids.gyung}`], undefined, 'overlapped roster must not be auto-corrected destructively');

assert.match(html, /async function recapStudioRunReviewedHistoryMigration\(\)\{\s*if\(!LIVE\|\|!me\|\|!isFounder\(me\)\)throw new Error\('Recap Studio reviewed migration is admin only'\)/, 'automatic migration must be founder-only');
assert.match(html, /window\.recapStudioBackfillReviewed=async function\(\)\{\s*if\(!me\|\|!isFounder\(me\)\)throw new Error\('Recap Studio reviewed migration is admin only'\)/, 'manual migration entry must reject TL/member execution');

console.log(JSON.stringify({
  version: first.version,
  firstRun: { written: first.written, roster: first.rosterWrites, weekly: first.weeklyWrites, bep: first.bepWrites },
  secondRun: { written: second.written },
  boundaries: { augustHajin: true, septemberHajin: false, joinDate: '2026-08-16', directUnassigned: '박인선' },
  conflictTypes: [...new Set(conflict.conflicts.concat(overlapPlan.conflicts).map((item) => item.type))],
}, null, 2));

