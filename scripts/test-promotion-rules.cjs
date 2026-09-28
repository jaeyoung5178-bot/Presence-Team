const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const deps = process.env.PRESENCE_QA_DEPS || '/tmp/presence-workspace-tooling/runtime/node_modules';
const { initializeTestEnvironment, assertSucceeds, assertFails } = require(deps + '/@firebase/rules-unit-testing');
const { ref, set, get, update } = require(deps + '/firebase/database');

(async () => {
  const env = await initializeTestEnvironment({
    projectId: 'demo-presence-promotion',
    database: { host: '127.0.0.1', port: 9000, rules: readFileSync(join(__dirname, '../database.rules.json'), 'utf8') }
  });
  let count = 0;
  const ok = async operation => { await assertSucceeds(operation); count++; };
  const no = async operation => { await assertFails(operation); count++; };
  try {
    await env.clearDatabase();
    await env.withSecurityRulesDisabled(async context => set(ref(context.database()), {
      authSessions: {
        a: { userUid: 'admin' }, l: { userUid: 'lr' }, t: { userUid: 'tl' },
        c: { userUid: 'ic' }, s: { userUid: 'stranger' }, i: { userUid: 'inactive' }
      },
      users: {
        admin: { uid: 'admin', role: 'AOP', status: 'active' },
        lr: { uid: 'lr', role: 'LR', status: 'active' },
        tl: { uid: 'tl', role: 'TL', status: 'active' },
        ic: { uid: 'ic', role: 'IC', status: 'active' },
        stranger: { uid: 'stranger', role: 'LR', status: 'active' },
        inactive: { uid: 'inactive', role: 'LR', status: 'retired' }
      },
      workspaceAccess: { lr: { leaderUid: 'tl', teamName: 'Presence' } },
      workspacePromotions: { lr: { targetRole: 'TL', criteria: 'coach plan', due: '2026-10-01', status: 'preparing', updatedBy: 'tl', updatedAt: Date.now() } }
    }));
    const db = id => env.authenticatedContext(id).database();
    const admin = db('a'), lr = db('l'), tl = db('t'), ic = db('c'), stranger = db('s'), inactive = db('i');
    const plan = (owner, role = 'TL') => ({
      version: 1, targetRole: role, due: '2026-10-11', startDate: '2026-09-28',
      targetFirstLeaders: role === 'TL' ? 2 : role === 'AOP' ? 3 : 4,
      targetTotalLeaders: role === 'TL' ? 2 : role === 'AOP' ? 5 : 10,
      baselineFirstLeaders: 0, baselineTotalLeaders: 0,
      guide: { bookings: 30, showups: 10, starters: 3, callsMin: 3, callsMax: 5 },
      homeReminder: false, updatedBy: owner, updatedAt: Date.now()
    });
    const week = owner => ({
      calls: 20, bookings: 5, showups: 2, starters: 1,
      actions: { calling: true, confirmation: false, onboarding: true, coaching: false },
      updatedBy: owner, updatedAt: Date.now()
    });
    const path = 'workspaceSelfPromotions/lr';
    await ok(set(ref(lr, path + '/plan'), plan('lr')));
    await ok(set(ref(lr, path + '/weeks/2026-09-28'), week('lr')));
    await ok(get(ref(lr, path)));
    await ok(get(ref(tl, path)));
    await ok(get(ref(admin, path)));
    await no(get(ref(stranger, path)));
    await no(get(ref(ic, path)));
    await no(get(ref(lr, 'workspaceSelfPromotions')));
    await no(get(ref(env.unauthenticatedContext().database(), path)));
    await no(set(ref(tl, path + '/plan'), plan('tl')));
    await no(set(ref(admin, path + '/plan'), plan('admin')));
    await no(set(ref(tl, path + '/weeks/2026-09-28'), week('tl')));
    await no(set(ref(ic, 'workspaceSelfPromotions/ic/plan'), plan('ic')));
    await no(set(ref(inactive, 'workspaceSelfPromotions/inactive/plan'), plan('inactive')));
    await ok(set(ref(tl, 'workspaceSelfPromotions/tl/plan'), plan('tl', 'AOP')));
    await ok(set(ref(admin, 'workspaceSelfPromotions/admin/plan'), plan('admin', 'OP')));
    await no(set(ref(lr, path + '/plan'), { ...plan('lr'), updatedBy: 'admin' }));
    await no(set(ref(lr, path + '/plan'), { ...plan('lr'), updatedAt: 1 }));
    await no(set(ref(lr, path + '/plan'), { ...plan('lr'), extra: true }));
    await no(set(ref(lr, path + '/plan'), { ...plan('lr'), guide: { ...plan('lr').guide, secret: 1 } }));
    await no(set(ref(lr, path + '/plan'), { ...plan('lr'), targetFirstLeaders: 3 }));
    await no(set(ref(lr, path + '/plan'), { ...plan('lr'), baselineFirstLeaders: 1 }));
    await no(set(ref(stranger, 'workspaceSelfPromotions/stranger/plan'), { ...plan('stranger'), startDate: '2026-02-30' }));
    await no(set(ref(stranger, 'workspaceSelfPromotions/stranger/plan'), { ...plan('stranger'), startDate: '2026-04-01', due: '2026-04-31' }));
    await no(set(ref(stranger, 'workspaceSelfPromotions/stranger/plan'), { ...plan('stranger'), startDate: '2027-02-28', due: '2027-02-29' }));
    await ok(set(ref(stranger, 'workspaceSelfPromotions/stranger/plan'), { ...plan('stranger'), startDate: '2028-02-28', due: '2028-02-29' }));
    await no(set(ref(lr, path + '/plan'), null));
    await no(set(ref(lr, path), { plan: plan('lr') }));
    await no(set(ref(lr, path + '/weeks/2026-09-28'), { ...week('lr'), secret: 1 }));
    await no(set(ref(lr, path + '/weeks/2026-09-28'), { ...week('lr'), actions: { ...week('lr').actions, secret: true } }));
    await no(set(ref(lr, path + '/weeks/2026-09-28'), { ...week('lr'), bookings: -1 }));
    await no(set(ref(lr, path + '/weeks/2026-09-28'), { ...week('lr'), updatedBy: 'admin' }));
    await no(set(ref(lr, path + '/weeks/2026-09-28'), null));
    await no(set(ref(lr, path + '/weeks/bad-date'), week('lr')));
    await no(set(ref(lr, path + '/weeks/2026-02-30'), week('lr')));
    await no(set(ref(lr, path + '/weeks/2026-04-31'), week('lr')));
    await ok(set(ref(stranger, 'workspaceSelfPromotions/stranger/weeks/2028-02-28'), week('stranger')));
    await no(set(ref(stranger, path + '/weeks/2026-09-28'), week('stranger')));
    await no(set(ref(lr, 'workspaceSelfPromotions/stranger/weeks/2026-09-28'), week('lr')));
    await no(set(ref(lr, 'workspaceSelfPromotions/stranger/weeks/2026-09-28'), week('stranger')));
    await no(set(ref(lr, 'workspaceSelfPromotions/stranger/weeks/2026-10-05'), week('stranger')));
    await ok(update(ref(lr, path + '/plan'), { homeReminder: true, updatedAt: Date.now() }));
    await ok(get(ref(tl, 'workspacePromotions/lr')));
    const oldCoachPlan = (await get(ref(tl, 'workspacePromotions/lr'))).val();
    if (oldCoachPlan.criteria !== 'coach plan') throw new Error('Legacy coach plan changed');
    await env.withSecurityRulesDisabled(async context => set(ref(context.database(), 'workspaceAccess/lr/leaderUid'), ''));
    await no(get(ref(tl, path)));
    await ok(get(ref(lr, path)));
    await ok(get(ref(admin, path)));
    console.log('PASS ' + count + ' promotion database authorization and validation checks');
  } finally { await env.cleanup(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
