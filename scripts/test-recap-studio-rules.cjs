#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const rootDir = path.resolve(__dirname, '..');
const rulesPath = path.join(rootDir, 'database.rules.json');
const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'demo-presence-recap-rules';
const emulatorHost = process.env.FIREBASE_DATABASE_EMULATOR_HOST;

if (!emulatorHost) {
  console.error('BLOCKED: FIREBASE_DATABASE_EMULATOR_HOST is not set. Run through firebase emulators:exec.');
  process.exit(2);
}

const dependencyRequire = process.env.RECAP_RULES_DEPS_DIR
  ? createRequire(path.join(path.resolve(process.env.RECAP_RULES_DEPS_DIR), 'package.json'))
  : require;
let rulesTesting;
let databaseSdk;
try {
  rulesTesting = dependencyRequire('@firebase/rules-unit-testing');
  databaseSdk = dependencyRequire('firebase/database');
} catch (error) {
  console.error('BLOCKED: @firebase/rules-unit-testing and firebase are required.');
  console.error(error && error.message ? error.message : error);
  process.exit(2);
}

const { initializeTestEnvironment, assertSucceeds, assertFails } = rulesTesting;
const { get, ref, set, update, remove } = databaseSdk;
const [host, rawPort] = emulatorHost.split(':');
const port = Number(rawPort);
if (!host || !Number.isInteger(port) || port <= 0) process.exit(2);
const rules = fs.readFileSync(rulesPath, 'utf8');
const CFG = 'cfg-v3-12345678';
let passCount = 0;

function interval(uid, assignmentId, teamKey, activeFrom, activeTo, name = uid, role = 'IC') {
  const value = {
    uid, assignmentId, teamKey, name, role, activeFrom,
    source: teamKey === 'presence' ? 'presence-direct-v3' : 'reviewed-v3',
    reviewedAt: Date.now(), reviewedBy: 'admin', configHash: CFG,
  };
  if (activeTo) value.activeTo = activeTo;
  return value;
}

function exactIndex(uid, assignmentId, teamKey, activeFrom, activeTo) {
  const value = { uid, assignmentId, teamKey, activeFrom, configHash: CFG };
  if (activeTo) value.activeTo = activeTo;
  return value;
}

function rosterSummary(value) {
  const copy = { ...value };
  delete copy.teamKey;
  return copy;
}

function recap(uid, payDate, teamKey, assignmentId, netPayment) {
  return {
    uid, payDate, weekEnding: payDate, netPayment,
    rejectCLCount: 0, rejectSWCount: 0, updatedAt: Date.now(),
    teamKey, assignmentId, assignmentConfigHash: CFG,
  };
}

function legacyRecap(uid, payDate, netPayment) {
  return {
    uid, payDate, weekEnding: payDate, netPayment,
    rejectCLCount: 0, rejectSWCount: 0, updatedAt: Date.now(),
  };
}

function marker(runId = 'run-complete') {
  return {
    state: 'complete', version: '2026-10-03.team-history-v3', runId,
    configHash: CFG, desiredHash: 'desired-v3', verifiedHash: 'verified-v3', completedAt: Date.now(),
  };
}

function status(state, runId = `run-${state}`) {
  const done = state === 'complete';
  return {
    state, runId, configHash: CFG, desiredHash: 'desired-v3', updatedAt: Date.now(),
    coverage: { expectedWeekly: 3, actualWeekly: done ? 3 : 0, expectedBep: 3, actualBep: done ? 3 : 0 },
    conflictCount: 0, unresolvedCount: 0,
  };
}

function lease(leaseId = 'lease-v3', expiresAt = Date.now() + 120000) {
  return { ownerUid: 'admin', leaseId, configHash: CFG, acquiredAt: Date.now(), expiresAt };
}

async function allow(label, operation) {
  await assertSucceeds(operation());
  passCount += 1;
  console.log(`PASS allow: ${label}`);
}
async function deny(label, operation) {
  await assertFails(operation());
  passCount += 1;
  console.log(`PASS deny: ${label}`);
}
async function expectValue(label, db, location, expected) {
  const snapshot = await get(ref(db, location));
  assert.deepEqual(snapshot.val(), expected, label);
  passCount += 1;
  console.log(`PASS state: ${label}`);
}

async function seed(testEnv, migrationState = 'complete') {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const migration = migrationState === 'complete'
      ? { status: status('complete'), marker: marker() }
      : migrationState ? { status: status(migrationState) } : {};
    const fuseAssignment = interval('fuseMember', 'fuse-a', 'fuse', '2026-08-01', '2026-10-31', 'FUSE Member');
    const waveAssignment = interval('waveMember', 'wave-a', 'youngwave', '2026-08-01', '2026-10-31', 'Wave Member');
    const directAssignment = interval('direct', 'presence-a', 'presence', '2026-08-01', '2026-10-31', 'Direct Member');
    const inactiveAssignment = interval('inactive', 'inactive-a', 'fuse', '2026-08-01', '2026-10-31', 'Inactive Member');
    await set(ref(context.database()), {
      users: {
        admin: { uid: 'admin', name: 'Admin', role: 'Founder', status: 'active' },
        globalManager: { uid: 'globalManager', name: 'Global Manager', role: 'AOP', status: 'active' },
        fuseTl: { uid: 'fuseTl', name: 'FUSE TL', role: 'TL', status: 'active' },
        waveTl: { uid: 'waveTl', name: 'Wave TL', role: 'TL', status: 'active' },
        revokedTl: { uid: 'revokedTl', name: 'Revoked TL', role: 'TL', status: 'active' },
        fuseMember: { uid: 'fuseMember', name: 'FUSE Member', role: 'IC', status: 'active' },
        waveMember: { uid: 'waveMember', name: 'Wave Member', role: 'IC', status: 'active' },
        direct: { uid: 'direct', name: 'Direct Member', role: 'IC', status: 'active' },
        inactive: { uid: 'inactive', name: 'Inactive Member', role: 'IC', status: 'inactive' },
      },
      authSessions: {
        'auth-admin': { userUid: 'admin' },
        'auth-global': { userUid: 'globalManager' },
        'auth-fuse-tl': { userUid: 'fuseTl' },
        'auth-wave-tl': { userUid: 'waveTl' },
        'auth-revoked-tl': { userUid: 'revokedTl' },
        'auth-fuse-member': { userUid: 'fuseMember' },
        'auth-wave-member': { userUid: 'waveMember' },
        'auth-direct': { userUid: 'direct' },
        'auth-inactive': { userUid: 'inactive' },
      },
      managerAccess: { globalManager: true, fuseTl: true, waveTl: true, revokedTl: true },
      recapStudioAccess: { viewers: {
        globalManager: { scope: 'all', updatedAt: Date.now(), updatedBy: 'admin' },
        fuseTl: { scope: 'team', teamKey: 'fuse', updatedAt: Date.now(), updatedBy: 'admin' },
        waveTl: { scope: 'team', teamKey: 'youngwave', updatedAt: Date.now(), updatedBy: 'admin' },
        revokedTl: { scope: 'team', teamKey: 'fuse', updatedAt: Date.now(), updatedBy: 'admin', revokedAt: Date.now() - 1000 },
      } },
      recapStudioAssignments: {
        byUid: {
          fuseMember: { intervals: { 'fuse-a': fuseAssignment } },
          waveMember: { intervals: { 'wave-a': waveAssignment } },
          direct: { intervals: { 'presence-a': directAssignment } },
          inactive: { intervals: { 'inactive-a': inactiveAssignment } },
        },
        byPay: { '2026-09-11': {
          fuseMember: exactIndex('fuseMember', 'fuse-a', 'fuse', '2026-08-01', '2026-10-31'),
          waveMember: exactIndex('waveMember', 'wave-a', 'youngwave', '2026-08-01', '2026-10-31'),
          direct: exactIndex('direct', 'presence-a', 'presence', '2026-08-01', '2026-10-31'),
          inactive: exactIndex('inactive', 'inactive-a', 'fuse', '2026-08-01', '2026-10-31'),
        } },
        byMonth: { '2026-09': {
          fuseMember: exactIndex('fuseMember', 'fuse-a', 'fuse', '2026-08-01', '2026-10-31'),
          waveMember: exactIndex('waveMember', 'wave-a', 'youngwave', '2026-08-01', '2026-10-31'),
          direct: exactIndex('direct', 'presence-a', 'presence', '2026-08-01', '2026-10-31'),
          inactive: exactIndex('inactive', 'inactive-a', 'fuse', '2026-08-01', '2026-10-31'),
        } },
      },
      recapStudioTeams: {
        presence: {
          roster: { direct: rosterSummary(directAssignment) },
          weekly: { '2026-09-11': { direct: recap('direct', '2026-09-11', 'presence', 'presence-a', 300) } },
          bep: { '2026-09': { direct: 30 } },
        },
        fuse: {
          roster: { fuseMember: rosterSummary(fuseAssignment), inactive: rosterSummary(inactiveAssignment) },
          weekly: { '2026-09-11': {
            fuseMember: recap('fuseMember', '2026-09-11', 'fuse', 'fuse-a', 100),
            inactive: recap('inactive', '2026-09-11', 'fuse', 'inactive-a', 10),
          } },
          bep: { '2026-09': { fuseMember: 10, inactive: 1 } },
        },
        youngwave: {
          roster: { waveMember: rosterSummary(waveAssignment) },
          weekly: { '2026-09-11': { waveMember: recap('waveMember', '2026-09-11', 'youngwave', 'wave-a', 200) } },
          bep: { '2026-09': { waveMember: 20 } },
        },
      },
      recapStudioMigrations: { teamHistoryV3: migration },
      dossier: { fuseMember: { upline: 'FUSE TL' } },
    });
  });
}

async function setMigration(testEnv, value) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await set(ref(context.database(), 'recapStudioMigrations/teamHistoryV3'), value);
  });
}

async function main() {
  console.log(`RTDB emulator: ${host}:${port}`);
  console.log(`Rules under test: ${rulesPath}`);
  const testEnv = await initializeTestEnvironment({ projectId, database: { host, port, rules } });
  try {
    await testEnv.clearDatabase();
    await seed(testEnv, 'complete');
    const admin = testEnv.authenticatedContext('auth-admin').database();
    const globalManager = testEnv.authenticatedContext('auth-global').database();
    const fuseTl = testEnv.authenticatedContext('auth-fuse-tl').database();
    const waveTl = testEnv.authenticatedContext('auth-wave-tl').database();
    const revokedTl = testEnv.authenticatedContext('auth-revoked-tl').database();
    const fuseMember = testEnv.authenticatedContext('auth-fuse-member').database();
    const waveMember = testEnv.authenticatedContext('auth-wave-member').database();
    const direct = testEnv.authenticatedContext('auth-direct').database();
    const inactive = testEnv.authenticatedContext('auth-inactive').database();
    const anonymous = testEnv.unauthenticatedContext().database();

    await allow('admin reads team root', () => get(ref(admin, 'recapStudioTeams')));
    await allow('scope=all manager reads team root', () => get(ref(globalManager, 'recapStudioTeams')));
    await allow('FUSE TL reads exact parent', () => get(ref(fuseTl, 'recapStudioTeams/fuse')));
    await allow('Wave TL reads exact parent', () => get(ref(waveTl, 'recapStudioTeams/youngwave')));
    await deny('FUSE TL cannot read team root', () => get(ref(fuseTl, 'recapStudioTeams')));
    await deny('FUSE TL cannot read Wave parent', () => get(ref(fuseTl, 'recapStudioTeams/youngwave')));
    await deny('Wave TL cannot read FUSE parent', () => get(ref(waveTl, 'recapStudioTeams/fuse')));
    await deny('team TL cannot read legacy canonical root', () => get(ref(fuseTl, 'weeklyProfitRecaps')));
    await deny('revoked TL cannot read former team', () => get(ref(revokedTl, 'recapStudioTeams/fuse')));
    await deny('inactive identity cannot read team', () => get(ref(inactive, 'recapStudioTeams/fuse')));
    await deny('anonymous cannot read team', () => get(ref(anonymous, 'recapStudioTeams/fuse')));

    await allow('member reads own assignment intervals', () => get(ref(fuseMember, 'recapStudioAssignments/byUid/fuseMember')));
    await allow('member reads own pay index', () => get(ref(fuseMember, 'recapStudioAssignments/byPay/2026-09-11/fuseMember')));
    await allow('member reads own month index', () => get(ref(fuseMember, 'recapStudioAssignments/byMonth/2026-09/fuseMember')));
    await deny('member cannot read sibling assignment', () => get(ref(fuseMember, 'recapStudioAssignments/byUid/waveMember')));
    await allow('member reads own weekly record', () => get(ref(fuseMember, 'recapStudioTeams/fuse/weekly/2026-09-11/fuseMember')));
    await allow('member reads own BEP record', () => get(ref(fuseMember, 'recapStudioTeams/fuse/bep/2026-09/fuseMember')));
    await deny('member cannot read team parent', () => get(ref(fuseMember, 'recapStudioTeams/fuse')));
    await deny('member cannot read sibling record', () => get(ref(fuseMember, 'recapStudioTeams/fuse/weekly/2026-09-11/inactive')));
    await deny('member cannot read other team record', () => get(ref(fuseMember, 'recapStudioTeams/youngwave/weekly/2026-09-11/waveMember')));
    await deny('outside interval/path without exact index is denied', () => get(ref(fuseMember, 'recapStudioTeams/fuse/weekly/2026-07-31/fuseMember')));
    await allow('direct Presence member reads own record', () => get(ref(direct, 'recapStudioTeams/presence/weekly/2026-09-11/direct')));

    await allow('FUSE member writes own indexed weekly record after complete', () =>
      set(ref(fuseMember, 'recapStudioTeams/fuse/weekly/2026-09-11/fuseMember'), recap('fuseMember', '2026-09-11', 'fuse', 'fuse-a', 111)));
    await allow('Wave member writes own indexed BEP after complete', () =>
      set(ref(waveMember, 'recapStudioTeams/youngwave/bep/2026-09/waveMember'), 21));
    await deny('member cannot write sibling record', () =>
      set(ref(fuseMember, 'recapStudioTeams/fuse/weekly/2026-09-11/inactive'), recap('inactive', '2026-09-11', 'fuse', 'inactive-a', 999)));
    await deny('member cannot write wrong team', () =>
      set(ref(fuseMember, 'recapStudioTeams/youngwave/weekly/2026-09-11/fuseMember'), recap('fuseMember', '2026-09-11', 'youngwave', 'fuse-a', 999)));
    await deny('wrong assignmentId is denied', () =>
      set(ref(fuseMember, 'recapStudioTeams/fuse/weekly/2026-09-11/fuseMember'), recap('fuseMember', '2026-09-11', 'fuse', 'wrong-a', 999)));
    await deny('TL is read-only for another team member', () =>
      set(ref(fuseTl, 'recapStudioTeams/fuse/weekly/2026-09-11/fuseMember'), recap('fuseMember', '2026-09-11', 'fuse', 'fuse-a', 999)));
    await deny('inactive member cannot write despite exact index', () =>
      set(ref(inactive, 'recapStudioTeams/fuse/weekly/2026-09-11/inactive'), recap('inactive', '2026-09-11', 'fuse', 'inactive-a', 999)));

    await deny('TL cannot seed assignment', () =>
      set(ref(fuseTl, 'recapStudioAssignments/byUid/fuseTl/intervals/tl-a'), interval('fuseTl', 'tl-a', 'fuse', '2026-09-01', '2026-10-31', 'FUSE TL', 'TL')));
    await deny('member cannot write roster', () =>
      set(ref(fuseMember, 'recapStudioTeams/fuse/roster/fuseMember'), rosterSummary(interval('fuseMember', 'fuse-a', 'fuse', '2026-08-01', '2026-10-31', 'FUSE Member'))));
    await deny('member cannot write migration status', () => set(ref(fuseMember, 'recapStudioMigrations/teamHistoryV3/status'), status('failed')));
    await deny('member cannot acquire migration lease', () => set(ref(fuseMember, 'recapStudioMigrations/teamHistoryV3/lock'), lease('member-lease')));
    await deny('ordinary member cannot modify dossier ancestry', () => set(ref(fuseMember, 'dossier/fuseMember/upline'), 'Other TL'));
    await allow('Founder/admin can modify dossier ancestry', () => set(ref(admin, 'dossier/fuseMember/upline'), 'FUSE TL'));

    await deny('legacy weekly write is denied after complete', () =>
      set(ref(fuseMember, 'weeklyProfitRecaps/2026-09-11/fuseMember'), legacyRecap('fuseMember', '2026-09-11', 501)));
    await setMigration(testEnv, { status: status('rolled-back') });
    await allow('legacy weekly write is allowed before a lock', () =>
      set(ref(fuseMember, 'weeklyProfitRecaps/2026-09-11/fuseMember'), legacyRecap('fuseMember', '2026-09-11', 502)));
    await deny('new canonical write is denied before complete marker', () =>
      set(ref(fuseMember, 'recapStudioTeams/fuse/weekly/2026-09-11/fuseMember'), recap('fuseMember', '2026-09-11', 'fuse', 'fuse-a', 503)));

    await setMigration(testEnv, { status: status('locked'), lock: lease('lease-active') });
    await deny('legacy write is denied once migration is locked', () =>
      set(ref(fuseMember, 'weeklyProfitRecaps/2026-09-11/fuseMember'), legacyRecap('fuseMember', '2026-09-11', 504)));
    const newUid = 'migratedMember';
    const newAssignment = interval(newUid, 'migrated-a', 'fuse', '2026-09-01', '2026-10-31', 'Migrated Member');
    const newIndex = exactIndex(newUid, 'migrated-a', 'fuse', '2026-09-01', '2026-10-31');
    await allow('admin atomically seeds interval, exact index, roster and canonical record under lease', () =>
      update(ref(admin), {
        [`recapStudioAssignments/byUid/${newUid}/intervals/migrated-a`]: newAssignment,
        [`recapStudioAssignments/byPay/2026-09-11/${newUid}`]: newIndex,
        [`recapStudioTeams/fuse/roster/${newUid}`]: rosterSummary(newAssignment),
        [`recapStudioTeams/fuse/weekly/2026-09-11/${newUid}`]: recap(newUid, '2026-09-11', 'fuse', 'migrated-a', 700),
      }));
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await set(ref(context.database(), 'recapStudioTeams/fuse/weekly/2026-09-11/stale'), recap('stale', '2026-09-11', 'fuse', 'stale-a', 1));
    });
    await allow('admin removes stale canonical record under active lease', () => remove(ref(admin, 'recapStudioTeams/fuse/weekly/2026-09-11/stale')));

    const before = (await get(ref(admin, 'recapStudioTeams/fuse/weekly/2026-09-11/fuseMember'))).val().netPayment;
    await deny('mixed valid and cross-team multi-location update is atomic', () =>
      update(ref(fuseMember), {
        'recapStudioTeams/fuse/weekly/2026-09-11/fuseMember': recap('fuseMember', '2026-09-11', 'fuse', 'fuse-a', 888),
        'recapStudioTeams/youngwave/weekly/2026-09-11/fuseMember': recap('fuseMember', '2026-09-11', 'youngwave', 'fuse-a', 888),
      }));
    await expectValue('denied atomic update leaves valid sibling untouched', admin, 'recapStudioTeams/fuse/weekly/2026-09-11/fuseMember/netPayment', before);
    await expectValue('denied atomic update creates no cross-team record', admin, 'recapStudioTeams/youngwave/weekly/2026-09-11/fuseMember', null);

    await allow('admin writes valid audit row', () =>
      set(ref(admin, 'recapStudioMigrations/teamHistoryV3/audit/run-audit'), {
        action: 'migrate', actorUid: 'admin', startedAt: Date.now(), state: 'applying', configHash: CFG,
        desiredHash: 'desired-v3', counts: { writes: 4, cleanup: 1 }, conflictCount: 0, unresolvedCount: 0,
      }));
    await allow('admin writes backup metadata when snapshots are empty', () =>
      set(ref(admin, 'recapStudioMigrations/teamHistoryV3/backup/run-audit'), { createdAt: Date.now(), configHash: CFG }));
    await setMigration(testEnv, { status: status('failed'), lock: lease('stale-lease', Date.now() - 1000) });
    await allow('admin clears an expired lease', () => remove(ref(admin, 'recapStudioMigrations/teamHistoryV3/lock')));

    await setMigration(testEnv, { status: status('complete'), marker: marker('run-final') });
    await allow('new canonical write is restored after complete marker', () =>
      set(ref(direct, 'recapStudioTeams/presence/weekly/2026-09-11/direct'), recap('direct', '2026-09-11', 'presence', 'presence-a', 333)));
    await deny('legacy private write remains frozen after complete marker', () =>
      set(ref(direct, 'weeklyProfitRecapsPrivate/direct/2026-09-11'), legacyRecap('direct', '2026-09-11', 333)));

    await setMigration(testEnv, { status: status('complete', 'run-rollback-source'), marker: marker('run-rollback-source'), lock: lease('lease-rollback') });
    await allow('admin atomically rolls reviewed leaves back under an active lease', () =>
      update(ref(admin), {
        'recapStudioTeams/fuse/roster/fuseMember': null,
        'recapStudioTeams/fuse/weekly/2026-09-11/fuseMember': null,
        'recapStudioTeams/fuse/bep/2026-09/fuseMember': null,
        'recapStudioAssignments/byUid/fuseMember/intervals/fuse-a': null,
        'recapStudioAssignments/byPay/2026-09-11/fuseMember': null,
        'recapStudioAssignments/byMonth/2026-09/fuseMember': null,
        'recapStudioMigrations/teamHistoryV3/marker': null,
        'recapStudioMigrations/teamHistoryV3/status': status('rolled-back', 'run-rollback'),
        'recapStudioMigrations/teamHistoryV3/audit/run-rollback': {
          action: 'rollback', actorUid: 'admin', startedAt: Date.now(), completedAt: Date.now(),
          state: 'rolled-back', configHash: CFG, desiredHash: 'desired-v3',
          counts: { writes: 2, cleanup: 0 }, conflictCount: 0, unresolvedCount: 0,
        },
      }));
    await expectValue('rollback removes canonical weekly leaf atomically', admin, 'recapStudioTeams/fuse/weekly/2026-09-11/fuseMember', null);
    await expectValue('rollback removes assignment interval atomically', admin, 'recapStudioAssignments/byUid/fuseMember/intervals/fuse-a', null);
    await expectValue('rollback removes completion marker atomically', admin, 'recapStudioMigrations/teamHistoryV3/marker', null);
    await expectValue('rollback records rolled-back status atomically', admin, 'recapStudioMigrations/teamHistoryV3/status/state', 'rolled-back');

    console.log(`PASS Recap Studio RTDB Rules v3 matrix (${passCount} assertions)`);
  } finally {
    await testEnv.cleanup();
  }
}

main().catch((error) => {
  console.error('FAIL Recap Studio RTDB Rules v3 matrix');
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
