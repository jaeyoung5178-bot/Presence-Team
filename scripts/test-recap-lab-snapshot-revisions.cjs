'use strict';
const assert = require('node:assert/strict');
const M = require('../assets/presence-recap-lab-model.js');
const cents = value => M.parseMoneyCents(value, {allowNegative: true});
const snapshot = (id, month, amount, asOfDate, extra = {}) => ({id, kind: 'snapshot', month, balanceCents: cents(amount), asOfDate, ...extra});
const original = snapshot('legacy_may', '2026-05', '-17,590.50', null);
const revision = snapshot('verified_may_20261122', '2026-05', '2.00', '2026-11-22', {supersedesSnapshotIds: [original.id]});
const book = {snapshots: [original, revision], events: []};
const before = JSON.stringify(book);
let view = M.monthBondView(book, '2026-05');
assert.equal(view.selectedSnapshot.id, revision.id);
assert.equal(view.snapshotBalanceCents, 200);
assert.equal(view.snapshots.length, 2);
assert.deepEqual(view.supersededSnapshotIds, ['legacy_may']);
assert.equal(view.snapshots[0].asOfDate, null);
assert.equal(view.snapshots[0].balanceCents, -1759050);
assert.equal(JSON.stringify(book), before);
assert.equal(M.monthBondView(book, '2026-05', {asOf: '2026-11-21'}).selectedSnapshot.id, original.id);
assert.equal(M.monthBondView(book, '2026-05', {asOf: '2026-11-22'}).selectedSnapshot.id, revision.id);
assert.equal(M.buildView({month: '2026-05', asOf: '2026-11-21', bond: book}).bond.snapshotBalanceCents, original.balanceCents);
console.log('PASS explicit dated revision preserves legacy and activates only on capture date');

const values = [
 ['2025-12', '0.00'], ['2026-01', '0.00'], ['2026-02', '0.00'], ['2026-03', '-31,245.50'],
 ['2026-04', '0.00'], ['2026-05', '2.00'], ['2026-06', '-42,010.50'], ['2026-07', '93,120.50'],
 ['2026-08', '-19,750.00'], ['2026-09', '507,302.00'], ['2026-10', '665,100.00'], ['2026-11', '254,190.00']
];
const all = {snapshots: values.map(([month, amount], i) => snapshot('capture_'+i, month, amount, '2026-11-22'))};
for (const [month, amount] of values) {
 const result = M.monthBondView(all, month, {asOf: '2026-11-22'});
 assert.equal(result.snapshotBalanceCents, cents(amount));
 assert.equal(result.snapshots.length, 1);
 assert.equal(result.selectedSnapshot.month, month);
}
assert.equal(M.monthBondView(all, '2026-11').snapshots.length, 1);
assert.equal(M.monthBondView(all, '2026-06').snapshotBalanceCents, -4201050);
assert.equal(M.monthBondView(all, '2026-02').snapshotBalanceCents, 0);
assert.equal(M.monthBondView(all, '2026-06', {asOf: '2026-11-21'}).snapshotBalanceCents, null);
console.log('PASS all 12 screenshot cohorts retain explicit month, negative cents and zero');

const unrelated = snapshot('unrelated', '2026-05', '3.00', null);
assert.equal(M.monthBondView({snapshots: [original, {...revision, supersedesSnapshotIds: undefined}]}, '2026-05').selectedSnapshot, null);
assert.equal(M.monthBondView({snapshots: [original, revision, unrelated]}, '2026-05').selectedSnapshot, null);
const conflict = {...revision, id: 'other_same_date', balanceCents: cents('5.00')};
assert.equal(M.monthBondView({snapshots: [original, revision, conflict]}, '2026-05').selectedSnapshot, null);
const later = snapshot('verified_may_20261123', '2026-05', '-0.50', '2026-11-23', {supersedesSnapshotIds: [revision.id]});
assert.equal(M.monthBondView({snapshots: [original, revision, later]}, '2026-05').snapshotBalanceCents, -50);
assert.equal(M.monthBondView({snapshots: [original, revision, later]}, '2026-05', {asOf: '2026-11-22'}).selectedSnapshot.id, revision.id);
console.log('PASS mixed unknown captures and same-day conflicts stay unknown; revision chains respect cutoff');

const invalids = [
 {snapshots: [original, {...revision, supersedesSnapshotIds: ['missing']}]},
 {snapshots: [original, {...revision, supersedesSnapshotIds: ['other_month']}, snapshot('other_month', '2026-06', '1.00', null)]},
 {snapshots: [snapshot('dated_later', '2026-05', '1.00', '2026-11-23'), {...revision, supersedesSnapshotIds: ['dated_later']}]},
 {snapshots: [{...revision, id: 'cycle_a', supersedesSnapshotIds: ['cycle_b']}, {...revision, id: 'cycle_b', supersedesSnapshotIds: ['cycle_a']}]}
];
for (const invalid of invalids) {
 const result = M.monthBondView(invalid, '2026-05');
 assert.equal(result.selectedSnapshot, null);
 assert.ok(result.warnings.length);
}
for (const supersedesSnapshotIds of [[], ['legacy_may', 'legacy_may'], [revision.id], ['bad/path'], 'legacy_may']) {
 assert.throws(() => M.normalizeBondRow({...revision, supersedesSnapshotIds}));
}
assert.throws(() => M.normalizeBondRow({...revision, asOfDate: null}));
assert.throws(() => M.normalizeBondRow({id: 'event', kind: 'credit', month: '2026-05', amountCents: 1, asOfDate: '2026-11-22', supersedesSnapshotIds: [original.id]}));
assert.throws(() => M.mergeBondRows([revision], [{...revision, supersedesSnapshotIds: ['different_legacy']}]));
assert.equal(M.mergeBondRows([revision], [revision]).length, 1);
console.log('PASS missing/cross-cohort/backdated/cyclic revision references and changed ID semantics rejected');

const weekly = [
 ['2026-11-01', '85,030.50'], ['2026-11-08', '37,159.50'], ['2026-11-15', '132,000.00'],
 ['2026-11-22', '0.00'], ['2026-11-29', '0.00']
].map(([date, amount], i) => ({id: 'we_'+i, kind: 'credit', month: '2026-11', amountCents: cents(amount), weekEnding: date, occurredOn: null}));
assert.equal(weekly.reduce((sum, row) => sum + row.amountCents, 0), cents('254,190.00'));
const november = {snapshots: [snapshot('november_capture', '2026-11', '254,190.00', '2026-11-22')], events: weekly.concat({id: 'later_credit', kind: 'credit', month: '2026-11', amountCents: 5000, occurredOn: '2026-11-23', weekEnding: null})};
view = M.monthBondView(november, '2026-11');
assert.equal(view.snapshotBalanceCents, cents('254,190.00'));
assert.equal(view.events.length, 6);
assert.equal(view.automaticReleaseCents, null);
assert.equal(view.eventsIncludedInSnapshotUnknown, true);
assert.equal(M.monthBondView(november, '2026-11', {asOf: '2026-11-22'}).events.length, 5);
console.log('PASS snapshot balance never adds weekly credits or later events; WE-only timing remains unknown');

const julyOld = snapshot('july_old', '2026-07', '-0.50', null);
const julyNew = snapshot('july_new', '2026-07', '93,120.50', '2026-11-22', {supersedesSnapshotIds: [julyOld.id]});
const julyBook = {snapshots: [julyOld, julyNew]};
const person = {uid: 'a', firstField: '2026-01-01', fieldDays: 3, sales: 1, bond: julyBook};
assert.equal(M.buildBondRanking({recapMonth: '2026-11', asOf: '2026-11-21', people: [person]}).rows[0].balanceCents, -50);
assert.equal(M.buildBondRanking({recapMonth: '2026-11', asOf: '2026-11-22', people: [person]}).rows[0].balanceCents, 9312050);
assert.equal(M.bondHealth({today: '2026-11-21', firstField: person.firstField, bond: julyBook}).tone, 'red');
assert.equal(M.bondHealth({today: '2026-11-22', firstField: person.firstField, bond: julyBook}).tone, 'green');
const futureOnly = {snapshots: [julyNew]};
assert.equal(M.buildBondRanking({recapMonth: '2026-11', asOf: '2026-11-21', people: [{...person, bond: futureOnly}]}).rows.length, 0);
assert.equal(M.bondHealth({today: '2026-11-21', firstField: person.firstField, bond: julyNew}).state, 'no-data');
assert.equal(M.buildBondRanking({recapMonth: '2026-11', asOf: '2026-11-21', people: [{...person, bond: {selectedSnapshot: julyNew}}]}).rows.length, 0);
console.log('PASS ranking, health and direct snapshot paths cannot use future capture balances');
