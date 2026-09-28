const assert = require('node:assert/strict');
const C = require('../assets/presence-promotion-core.js');
const guide = { ...C.DEFAULT_GUIDE };
const plan = {
  version: 1, targetRole: 'AOP', due: '2026-10-11', startDate: '2026-09-28',
  targetFirstLeaders: 3, targetTotalLeaders: 5,
  baselineFirstLeaders: 1, baselineTotalLeaders: 2,
  guide, homeReminder: false, updatedBy: 'lr', updatedAt: Date.now()
};
const week = (calls, bookings, showups, starters) => ({
  calls, bookings, showups, starters,
  actions: { calling: true, confirmation: false, onboarding: false, coaching: true },
  updatedBy: 'lr', updatedAt: Date.now()
});

assert.deepEqual(C.REQUIREMENTS, { TL: { first: 2, total: 2 }, AOP: { first: 3, total: 5 }, OP: { first: 4, total: 10 } });
assert.equal(C.isEligibleRole('IC'), false);
assert.equal(C.isEligibleRole('TL'), true);
assert.equal(C.weekKey('2026-09-28'), '2026-09-28');
assert.equal(C.weekKey('2026-10-04'), '2026-09-28');
assert.equal(C.weekKey('2026-02-30'), null);
assert.equal(C.validatePlan(plan, '2026-09-28').valid, true);
assert.equal(C.validatePlan({ ...plan, due: '2026-02-30' }).valid, false);
assert.equal(C.validatePlan({ ...plan, targetFirstLeaders: 4 }).valid, false);
assert.equal(C.validatePlan({ ...plan, homeReminder: 'true' }).valid, false);
assert.equal(C.validatePlan({ ...plan, guide: { ...guide, callsMin: 6, callsMax: 3 } }).valid, false);

const actor = { uid: 'lr', name: '이 리더', role: 'LR', status: 'active' };
const active = [
  actor,
  { uid: 'a', name: '김 하나', role: 'LR', status: 'active' },
  { uid: 'b', name: '박둘', role: 'TL', status: 'active' },
  { uid: 'c', name: '최셋', role: 'OP', status: 'active' },
  { uid: 'd', name: '직속 IC', role: 'IC', status: 'active' },
  { uid: 'e', name: '이탈', role: 'LR', status: 'retired' },
  { uid: 'a', name: '김하나', role: 'LR', status: 'active' }
];
const dossiers = {
  김하나: { upline: ' 이 리더 ' }, 박둘: { upline: '김 하나' }, 최셋: { upline: '박둘' },
  직속ic: { upline: '이리더' }, 이탈: { upline: '이리더' }
};
const counts = C.teamCounts(actor, active, dossiers);
assert.equal(counts.firstCount, 1);
assert.equal(counts.totalCount, 3);
assert.deepEqual(counts.allLeaders.map(u => u.uid).sort(), ['a', 'b', 'c']);
assert.deepEqual(C.directLeaders(actor, active, dossiers).map(u => u.uid), ['a']);
assert.equal(C.teamCounts(actor, [{ uid: 'cycle', name: '순환', role: 'LR', status: 'active' }], { 순환: { upline: 'A' }, a: { upline: '순환' } }).totalCount, 0);

const initial = C.calculate(plan, {}, { firstCount: 1, totalCount: 2 }, '2026-09-28');
assert.deepEqual(initial.targets, { bookings: 60, showups: 20, starters: 6 });
assert.equal(initial.weekly.bookings, 30);
assert.equal(initial.weekly.callsMin, 90);
assert.equal(initial.weekly.callsMax, 150);
assert.equal(initial.firstGap, 2);
assert.equal(initial.totalGap, 3);
assert.equal(initial.downstreamGap, 1);
assert.equal(initial.weeksRemaining, 2);

const progress = C.calculate(plan, {
  '2026-09-21': week(999, 999, 999, 999),
  '2026-09-28': week(120, 30, 10, 3),
  '2026-10-05': week(100, 25, 8, 2),
  '2026-10-12': week(999, 999, 999, 999)
}, { firstCount: 2, totalCount: 3 }, '2026-10-05');
assert.deepEqual(progress.totals, { calls: 220, bookings: 55, showups: 18, starters: 5 });
assert.equal(progress.weekly.bookings, 5);
assert.equal(progress.weekly.callsMin, 15);
assert.equal(progress.weekly.callsMax, 25);
assert.equal(progress.actionChecks.calling, true);
assert.equal(progress.actionChecks.confirmation, false);
assert.equal(progress.weeksRemaining, 1);

const noFirstGap = C.calculate(plan, {}, { firstCount: 3, totalCount: 3 }, '2026-10-11');
assert.equal(noFirstGap.weekly.bookings, 0);
assert.equal(noFirstGap.downstreamGap, 2);
assert.equal(noFirstGap.complete, false);
assert.equal(noFirstGap.weeksRemaining, 1);
const opPlan = { ...plan, targetRole: 'OP', targetFirstLeaders: 4, targetTotalLeaders: 10, due: '2026-10-25', baselineFirstLeaders: 3, baselineTotalLeaders: 5 };
const op = C.calculate(opPlan, {}, { firstCount: 4, totalCount: 6 }, '2026-09-28');
assert.equal(op.firstGap, 0);
assert.equal(op.totalGap, 4);
assert.equal(op.downstreamGap, 4);
assert.equal(op.complete, false);
assert.equal(op.weekly.bookings, 0);
const opInitial = C.calculate(opPlan, {}, { firstCount: 3, totalCount: 5 }, '2026-09-28');
assert.equal(opInitial.firstGap, 1);
assert.equal(opInitial.totalGap, 5);
assert.equal(opInitial.downstreamGap, 4);
assert.equal(opInitial.weekly.bookings, 8);
assert.equal(opInitial.weekly.callsMin, 24);
assert.equal(opInitial.weekly.callsMax, 40);
const departed = C.calculate({ ...plan, baselineFirstLeaders: 2, baselineTotalLeaders: 2 }, {}, { firstCount: 1, totalCount: 2 }, '2026-09-28');
assert.equal(departed.firstGap, 2);
assert.equal(departed.targets.bookings, 60);
assert.equal(departed.targets.showups, 20);
assert.equal(departed.targets.starters, 6);
const recovered = C.calculate({ ...plan, baselineFirstLeaders: 2, baselineTotalLeaders: 2 }, {}, { firstCount: 3, totalCount: 5 }, '2026-09-28');
assert.equal(recovered.complete, true);
assert.equal(recovered.remaining.bookings, 0);
const complete = C.calculate(plan, {}, { firstCount: 4, totalCount: 7 }, '2026-10-12');
assert.equal(complete.complete, true);
assert.equal(complete.weekly.callsMax, 0);
assert.equal(complete.overdue, true);
assert.equal(complete.weeksRemaining, 0);
console.log('PASS promotion core calculations, hierarchy, dates, and validation');
