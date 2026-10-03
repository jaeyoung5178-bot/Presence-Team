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
  console.error(
    'BLOCKED: FIREBASE_DATABASE_EMULATOR_HOST is not set. Run this file through ' +
      '`firebase emulators:exec --only database --project demo-presence-recap-rules "node scripts/test-recap-studio-rules.cjs"`.',
  );
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
  console.error(
    'BLOCKED: install @firebase/rules-unit-testing and firebase in the workspace or an isolated directory, ' +
      'then set RECAP_RULES_DEPS_DIR to that directory.',
  );
  console.error(error && error.message ? error.message : error);
  process.exit(2);
}

const { initializeTestEnvironment, assertSucceeds, assertFails } = rulesTesting;
const { get, ref, set, update } = databaseSdk;

const [host, rawPort] = emulatorHost.split(':');
const port = Number(rawPort);
if (!host || !Number.isInteger(port) || port <= 0) {
  console.error(`BLOCKED: invalid FIREBASE_DATABASE_EMULATOR_HOST: ${emulatorHost}`);
  process.exit(2);
}

const rules = fs.readFileSync(rulesPath, 'utf8');
let passCount = 0;

function recap(uid, payDate, netPayment) {
  return {
    uid,
    payDate,
    weekEnding: payDate,
    netPayment,
    rejectCLCount: 0,
    rejectSWCount: 0,
    updatedAt: 1790985600000,
  };
}

function roster(uid, name, role, activeFrom, activeTo) {
  const value = {
    uid,
    name,
    role,
    activeFrom,
    reviewedAt: 1790985600000,
    reviewedBy: 'admin',
  };
  if (activeTo) value.activeTo = activeTo;
  return value;
}

function threeWay(teamKey, payDate, uid, amount) {
  const value = recap(uid, payDate, amount);
  return {
    [`weeklyProfitRecaps/${payDate}/${uid}`]: value,
    [`weeklyProfitRecapsPrivate/${uid}/${payDate}`]: value,
    [`recapStudioTeams/${teamKey}/weekly/${payDate}/${uid}`]: value,
  };
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

async function main() {
  console.log(`RTDB emulator: ${host}:${port}`);
  console.log(`Rules under test: ${rulesPath}`);

  const testEnv = await initializeTestEnvironment({
    projectId,
    database: { host, port, rules },
  });

  try {
    await testEnv.clearDatabase();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await set(ref(context.database()), {
        users: {
          admin: { uid: 'admin', name: 'Admin', role: 'Founder', status: 'active' },
          globalManager: { uid: 'globalManager', name: 'Global Manager', role: 'TL', status: 'active' },
          fuseTl: { uid: 'fuseTl', name: 'FUSE TL', role: 'TL', status: 'active' },
          waveTl: { uid: 'waveTl', name: 'Young Wave TL', role: 'TL', status: 'active' },
          fuseMember: { uid: 'fuseMember', name: 'FUSE Member', role: 'AOP', status: 'active' },
          waveMember: { uid: 'waveMember', name: 'Young Wave Member', role: 'AOP', status: 'active' },
          transfer: { uid: 'transfer', name: 'Transfer', role: 'AOP', status: 'active' },
          member: { uid: 'member', name: 'Ordinary Member', role: 'AOP', status: 'active' },
          newViewer: { uid: 'newViewer', name: 'New Viewer', role: 'TL', status: 'active' },
          inactiveAll: { uid: 'inactiveAll', name: 'Inactive', role: 'TL', status: 'inactive' },
        },
        authSessions: {
          'auth-admin': { userUid: 'admin' },
          'auth-global': { userUid: 'globalManager' },
          'auth-fuse-tl': { userUid: 'fuseTl' },
          'auth-wave-tl': { userUid: 'waveTl' },
          'auth-fuse-member': { userUid: 'fuseMember' },
          'auth-member': { userUid: 'member' },
          'auth-inactive': { userUid: 'inactiveAll' },
        },
        managerAccess: {
          globalManager: true,
          fuseTl: true,
          waveTl: true,
          inactiveAll: true,
        },
        recapStudioAccess: {
          viewers: {
            globalManager: { scope: 'all', updatedAt: 1790985600000, updatedBy: 'admin' },
            fuseTl: { scope: 'team', teamKey: 'fuse', updatedAt: 1790985600000, updatedBy: 'admin' },
            waveTl: { scope: 'team', teamKey: 'youngwave', updatedAt: 1790985600000, updatedBy: 'admin' },
            inactiveAll: { scope: 'all', updatedAt: 1790985600000, updatedBy: 'admin' },
          },
        },
        recapStudioTeams: {
          presence: { roster: {} },
          fuse: {
            roster: {
              fuseMember: roster('fuseMember', 'FUSE Member', 'AOP', '2026-01-01'),
              transfer: roster('transfer', 'Transfer', 'AOP', '2026-01-01', '2026-09-11'),
            },
          },
          youngwave: {
            roster: {
              waveMember: roster('waveMember', 'Young Wave Member', 'AOP', '2026-01-01'),
              transfer: roster('transfer', 'Transfer', 'AOP', '2026-09-18'),
            },
          },
        },
      });
    });

    const admin = testEnv.authenticatedContext('auth-admin').database();
    const globalManager = testEnv.authenticatedContext('auth-global').database();
    const fuseTl = testEnv.authenticatedContext('auth-fuse-tl').database();
    const waveTl = testEnv.authenticatedContext('auth-wave-tl').database();
    const fuseMember = testEnv.authenticatedContext('auth-fuse-member').database();
    const member = testEnv.authenticatedContext('auth-member').database();
    const inactiveAll = testEnv.authenticatedContext('auth-inactive').database();
    const anonymous = testEnv.unauthenticatedContext().database();

    // Owner and scope=all coverage.
    await allow('admin reads the complete team root', () => get(ref(admin, 'recapStudioTeams')));
    await allow('admin reads FUSE', () => get(ref(admin, 'recapStudioTeams/fuse')));
    await allow('admin reads Young Wave', () => get(ref(admin, 'recapStudioTeams/youngwave')));
    await allow('admin reads the ACL root', () => get(ref(admin, 'recapStudioAccess')));
    await allow('scope=all manager reads every team', () => get(ref(globalManager, 'recapStudioTeams')));

    // Exact-team reads and cross-team/root denials.
    await allow('FUSE TL reads exact FUSE team', () => get(ref(fuseTl, 'recapStudioTeams/fuse')));
    await deny('FUSE TL cannot read teams root', () => get(ref(fuseTl, 'recapStudioTeams')));
    await deny('FUSE TL cannot read Young Wave', () => get(ref(fuseTl, 'recapStudioTeams/youngwave')));
    await deny('FUSE TL manager flag cannot bypass canonical root guard', () => get(ref(fuseTl, 'weeklyProfitRecaps')));
    await allow('Young Wave TL reads exact Young Wave team', () => get(ref(waveTl, 'recapStudioTeams/youngwave')));
    await deny('Young Wave TL cannot read teams root', () => get(ref(waveTl, 'recapStudioTeams')));
    await deny('Young Wave TL cannot read FUSE', () => get(ref(waveTl, 'recapStudioTeams/fuse')));
    await deny('Young Wave TL manager flag cannot bypass canonical root guard', () => get(ref(waveTl, 'weeklyProfitRecapsPrivate')));

    // Ordinary, inactive, and anonymous identities cannot browse Studio data.
    await deny('ordinary member cannot read a Studio team', () => get(ref(member, 'recapStudioTeams/fuse')));
    await deny('ordinary member cannot read canonical recap root', () => get(ref(member, 'weeklyProfitRecaps')));
    await deny('inactive scope=all identity is denied', () => get(ref(inactiveAll, 'recapStudioTeams')));
    await deny('anonymous identity is denied', () => get(ref(anonymous, 'recapStudioTeams/fuse')));

    // ACL and reviewed roster administration is owner-only.
    const validAcl = { scope: 'team', teamKey: 'presence', updatedAt: 1790985600001, updatedBy: 'admin' };
    await deny('FUSE TL cannot write ACL', () => set(ref(fuseTl, 'recapStudioAccess/viewers/newViewer'), validAcl));
    await deny('ordinary member cannot write ACL', () => set(ref(member, 'recapStudioAccess/viewers/newViewer'), validAcl));
    await allow('admin writes a valid ACL', () => set(ref(admin, 'recapStudioAccess/viewers/newViewer'), validAcl));

    const validRoster = roster('newViewer', 'New Viewer', 'TL', '2026-10-01');
    await deny('FUSE TL cannot write reviewed roster', () => set(ref(fuseTl, 'recapStudioTeams/fuse/roster/newViewer'), validRoster));
    await deny('ordinary member cannot write reviewed roster', () => set(ref(member, 'recapStudioTeams/fuse/roster/newViewer'), validRoster));
    await allow('admin writes a valid reviewed roster', () => set(ref(admin, 'recapStudioTeams/presence/roster/newViewer'), validRoster));

    // Existing self-canonical writes remain valid, but unrostered mirrors do not.
    await allow('ordinary member writes own canonical recap', () =>
      set(ref(member, 'weeklyProfitRecaps/2026-10-02/member'), recap('member', '2026-10-02', 202)),
    );
    await deny('unrostered member cannot write FUSE mirror', () =>
      set(ref(member, 'recapStudioTeams/fuse/weekly/2026-10-02/member'), recap('member', '2026-10-02', 202)),
    );
    await allow('rostered FUSE member writes own FUSE mirror', () =>
      set(
        ref(fuseMember, 'recapStudioTeams/fuse/weekly/2026-10-02/fuseMember'),
        recap('fuseMember', '2026-10-02', 302),
      ),
    );

    // Inclusive transfer boundary and atomic canonical-public + canonical-private + mirror saves.
    await allow('FUSE TL 3-way save on inclusive FUSE activeTo', () =>
      update(ref(fuseTl), threeWay('fuse', '2026-09-11', 'transfer', 911)),
    );
    await expectValue(
      'FUSE activeTo save reached its mirror',
      admin,
      'recapStudioTeams/fuse/weekly/2026-09-11/transfer/netPayment',
      911,
    );

    await deny('Young Wave TL 3-way save before Young Wave activeFrom', () =>
      update(ref(waveTl), threeWay('youngwave', '2026-09-11', 'transfer', 111)),
    );
    await expectValue(
      'denied Young Wave save did not alter canonical public record',
      admin,
      'weeklyProfitRecaps/2026-09-11/transfer/netPayment',
      911,
    );
    await expectValue(
      'denied Young Wave save created no partial mirror',
      admin,
      'recapStudioTeams/youngwave/weekly/2026-09-11/transfer',
      null,
    );

    await deny('FUSE TL 3-way save after FUSE activeTo', () =>
      update(ref(fuseTl), threeWay('fuse', '2026-09-18', 'transfer', 118)),
    );
    await expectValue(
      'denied FUSE save created no partial canonical record',
      admin,
      'weeklyProfitRecaps/2026-09-18/transfer',
      null,
    );
    await expectValue(
      'denied FUSE save created no partial mirror',
      admin,
      'recapStudioTeams/fuse/weekly/2026-09-18/transfer',
      null,
    );

    await allow('Young Wave TL 3-way save on inclusive Young Wave activeFrom', () =>
      update(ref(waveTl), threeWay('youngwave', '2026-09-18', 'transfer', 918)),
    );
    await expectValue(
      'Young Wave activeFrom save reached canonical private record',
      admin,
      'weeklyProfitRecapsPrivate/transfer/2026-09-18/netPayment',
      918,
    );
    await expectValue(
      'Young Wave activeFrom save reached exact-team mirror',
      admin,
      'recapStudioTeams/youngwave/weekly/2026-09-18/transfer/netPayment',
      918,
    );

    // Cross-team mirror paths remain denied even when the target is valid for that other team/date.
    await deny('FUSE TL cannot target Young Wave mirror', () =>
      set(
        ref(fuseTl, 'recapStudioTeams/youngwave/weekly/2026-09-18/transfer'),
        recap('transfer', '2026-09-18', 999),
      ),
    );
    await deny('Young Wave TL cannot target FUSE mirror', () =>
      set(
        ref(waveTl, 'recapStudioTeams/fuse/weekly/2026-09-11/transfer'),
        recap('transfer', '2026-09-11', 999),
      ),
    );

    console.log(`PASS Recap Studio RTDB Rules P0 matrix (${passCount} assertions)`);
  } finally {
    await testEnv.cleanup();
  }
}

main().catch((error) => {
  console.error('FAIL Recap Studio RTDB Rules P0 matrix');
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
