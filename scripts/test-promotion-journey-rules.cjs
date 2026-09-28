const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const deps = process.env.PRESENCE_QA_DEPS || '/tmp/presence-workspace-tooling/runtime/node_modules';
const { initializeTestEnvironment, assertSucceeds, assertFails } = require(deps + '/@firebase/rules-unit-testing');
const { ref, set, get, update, remove } = require(deps + '/firebase/database');

(async () => {
  const env = await initializeTestEnvironment({
    projectId: 'demo-presence-promotion',
    database: { host: '127.0.0.1', port: 9000, rules: readFileSync(join(__dirname, '../database.rules.json'), 'utf8') }
  });
  let count = 0;
  const ok = async promise => { await assertSucceeds(promise); count++; };
  const no = async promise => { await assertFails(promise); count++; };
  try {
    await env.clearDatabase();
    await env.withSecurityRulesDisabled(async context => set(ref(context.database()), {
      authSessions: {
        a: { userUid: 'admin' }, l: { userUid: 'lr' }, t: { userUid: 'tl' },
        x: { userUid: 'inactive' }, c: { userUid: 'ic' }
      },
      users: {
        admin: { uid: 'admin', role: 'AOP', status: 'active' },
        lr: { uid: 'lr', role: 'LR', status: 'active' },
        tl: { uid: 'tl', role: 'TL', status: 'active' },
        inactive: { uid: 'inactive', role: 'TL', status: 'inactive' },
        ic: { uid: 'ic', role: 'IC', status: 'active' }
      }
    }));
    const db = id => env.authenticatedContext(id).database();
    const admin = db('a'), lr = db('l'), tl = db('t');
    const inactive = db('x'), ic = db('c'), anonymous = env.unauthenticatedContext().database();
    const unmapped = db('unknown');
    const milestonePath = 'workspacePromotionMilestones/tl/TL';
    const milestone = (status, hitDate) => ({
      status, ...(hitDate ? { hitDate } : {}), updatedBy: 'admin', updatedAt: Date.now()
    });
    const cheerPath = 'workspacePromotionCheers/presenceOP';
    const cheer = emoji => ({ emoji, updatedAt: Date.now() });

    await no(get(ref(anonymous, milestonePath)));
    await no(get(ref(unmapped, milestonePath)));
    await no(get(ref(inactive, milestonePath)));
    await no(get(ref(lr, 'workspacePromotionMilestones')));
    await no(get(ref(lr, 'workspacePromotionCheers')));
    await ok(get(ref(lr, milestonePath)));
    await ok(get(ref(tl, milestonePath)));
    await ok(get(ref(lr, cheerPath)));
    await no(get(ref(anonymous, cheerPath)));
    await no(get(ref(inactive, cheerPath)));

    await no(set(ref(anonymous, milestonePath), milestone('completed', '2026-09-28')));
    await no(set(ref(lr, milestonePath), milestone('completed', '2026-09-28')));
    await no(set(ref(tl, milestonePath), milestone('completed', '2026-09-28')));
    await no(set(ref(inactive, milestonePath), milestone('completed', '2026-09-28')));
    await no(set(ref(admin, 'workspacePromotionMilestones'), { tl: { TL: milestone('completed', '2026-09-28') } }));
    await no(set(ref(admin, 'workspacePromotionMilestones/lr/TL'), milestone('completed', '2026-09-28')));
    await no(set(ref(admin, 'workspacePromotionMilestones/inactive/TL'), milestone('completed', '2026-09-28')));
    await no(set(ref(admin, 'workspacePromotionMilestones/tl/OP'), milestone('completed', '2026-09-28')));
    await ok(set(ref(admin, milestonePath), milestone('completed', '2026-09-28')));
    await ok(get(ref(lr, milestonePath)));
    await ok(update(ref(admin, milestonePath), { hitDate: '2024-02-29', updatedAt: Date.now() }));
    await ok(set(ref(admin, milestonePath), milestone('completed')));
    await no(set(ref(admin, milestonePath), milestone('pending', '2026-09-28')));
    await no(set(ref(admin, milestonePath), milestone('pending')));
    await no(set(ref(admin, milestonePath), milestone('completed', '2026-02-30')));
    await no(set(ref(admin, milestonePath), milestone('completed', '2026-04-31')));
    await no(set(ref(admin, milestonePath), milestone('completed', '2027-02-29')));
    await no(set(ref(admin, milestonePath), { ...milestone('completed', '2026-09-28'), extra: true }));
    await no(set(ref(admin, milestonePath), { ...milestone('completed', '2026-09-28'), updatedBy: 'tl' }));
    await no(set(ref(admin, milestonePath), { ...milestone('completed', '2026-09-28'), updatedAt: 1 }));
    await no(remove(ref(admin, milestonePath)));
    await ok(set(ref(admin, milestonePath), milestone('completed')));

    await no(set(ref(anonymous, cheerPath + '/lr'), cheer('👏')));
    await no(set(ref(unmapped, cheerPath + '/lr'), cheer('👏')));
    await no(set(ref(inactive, cheerPath + '/inactive'), cheer('👏')));
    await no(set(ref(lr, cheerPath), { lr: cheer('👏') }));
    await no(set(ref(admin, cheerPath + '/lr'), cheer('👏')));
    await no(set(ref(lr, cheerPath + '/tl'), cheer('👏')));
    await ok(set(ref(lr, cheerPath + '/lr'), cheer('👏')));
    await ok(set(ref(tl, cheerPath + '/tl'), cheer('🔥')));
    await ok(get(ref(lr, cheerPath)));
    await no(set(ref(lr, cheerPath + '/lr'), cheer('❤️')));
    await no(set(ref(lr, cheerPath + '/lr'), { ...cheer('🚀'), userUid: 'tl' }));
    await no(set(ref(lr, cheerPath + '/lr'), { ...cheer('💚'), updatedAt: 1 }));
    await no(remove(ref(lr, cheerPath + '/tl')));
    await no(remove(ref(admin, cheerPath + '/tl')));
    await ok(set(ref(lr, cheerPath + '/lr'), cheer('🚀')));
    await ok(remove(ref(lr, cheerPath + '/lr')));
    await ok(set(ref(lr, cheerPath + '/lr'), cheer('💚')));

    const publicPath = 'workspacePromotionPlans/lr';
    const privatePath = 'workspaceSelfPromotions/lr/plan';
    const privatePlan = due => ({
      version: 1, targetRole: 'TL', due, startDate: '2026-09-01',
      targetFirstLeaders: 2, targetTotalLeaders: 2,
      baselineFirstLeaders: 0, baselineTotalLeaders: 0,
      guide: { bookings: 30, showups: 10, starters: 3, callsMin: 3, callsMax: 5 },
      homeReminder: false, updatedBy: 'lr', updatedAt: Date.now()
    });
    const publicPlan = due => ({
      version: 1, targetRole: 'TL', due, updatedBy: 'lr', updatedAt: Date.now()
    });
    await no(get(ref(anonymous, 'workspacePromotionPlans')));
    await no(get(ref(inactive, 'workspacePromotionPlans')));
    await no(get(ref(unmapped, 'workspacePromotionPlans')));
    await ok(get(ref(tl, 'workspacePromotionPlans')));
    await no(get(ref(tl, privatePath)));
    await no(set(ref(lr, 'workspacePromotionPlans'), { lr: publicPlan('2026-11-01') }));
    await no(set(ref(admin, publicPath), publicPlan('2026-11-01')));
    await no(set(ref(ic, 'workspacePromotionPlans/ic'), { ...publicPlan('2026-11-01'), updatedBy: 'ic' }));
    await no(set(ref(inactive, 'workspacePromotionPlans/inactive'), { ...publicPlan('2026-11-01'), updatedBy: 'inactive' }));
    await no(set(ref(lr, publicPath), { ...publicPlan('2026-11-01'), guide: { bookings: 30 } }));
    await no(set(ref(lr, publicPath), { ...publicPlan('2026-11-01'), updatedBy: 'admin' }));
    await no(set(ref(lr, publicPath), publicPlan('2026-02-30')));
    await no(set(ref(lr, publicPath), publicPlan('2026-04-31')));
    await no(set(ref(lr, publicPath), publicPlan('2027-02-29')));
    await no(remove(ref(lr, publicPath)));
    const atomic = due => ({
      [privatePath]: privatePlan(due),
      [publicPath]: publicPlan(due)
    });
    await ok(update(ref(lr), atomic('2026-11-01')));
    if ((await get(ref(lr, privatePath))).val().due !== '2026-11-01') throw new Error('Private plan was not saved');
    if ((await get(ref(tl, publicPath))).val().due !== '2026-11-01') throw new Error('Public projection was not saved');
    await ok(update(ref(lr), atomic('2026-12-01')));
    await no(update(ref(lr), { ...atomic('2027-01-01'), [publicPath]: { ...publicPlan('2027-01-01'), secret: true } }));
    if ((await get(ref(lr, privatePath))).val().due !== '2026-12-01') throw new Error('Rejected projection changed private plan');
    await no(update(ref(lr), { ...atomic('2027-01-01'), [privatePath]: { ...privatePlan('2027-01-01'), targetFirstLeaders: 3 } }));
    if ((await get(ref(tl, publicPath))).val().due !== '2026-12-01') throw new Error('Rejected private plan changed public projection');
    await ok(get(ref(ic, publicPath)));

    await no(get(ref(lr, 'workspacePromotionCheers')));
    await no(get(ref(lr, 'workspacePromotionCheers/ic')));
    await no(set(ref(lr, 'workspacePromotionCheers/ic/lr'), cheer('👏')));
    await no(set(ref(inactive, 'workspacePromotionCheers/lr/inactive'), cheer('👏')));
    await no(set(ref(admin, 'workspacePromotionCheers/lr/tl'), cheer('👏')));
    await ok(set(ref(lr, 'workspacePromotionCheers/tl/lr'), cheer('👏')));
    await ok(set(ref(lr, 'workspacePromotionCheers/admin/lr'), cheer('🔥')));
    await ok(set(ref(tl, 'workspacePromotionCheers/lr/tl'), cheer('🚀')));
    await ok(get(ref(lr, 'workspacePromotionCheers/tl')));
    await ok(get(ref(tl, 'workspacePromotionCheers/lr')));
    if ((await get(ref(tl, 'workspacePromotionCheers/lr'))).val().lr) throw new Error('Votes leaked between owner collections');
    await ok(update(ref(lr), {
      'workspacePromotionCheers/admin/lr': null,
      'workspacePromotionCheers/presenceOP/lr': null
    }));
    if ((await get(ref(lr, 'workspacePromotionCheers/admin'))).val()?.lr) throw new Error('Admin cheer was not removed');
    if ((await get(ref(lr, cheerPath))).val()?.lr) throw new Error('Legacy cheer was not removed');

    await ok(set(ref(admin, 'workspacePromotionMilestones/admin/AOP'), milestone('completed')));
    await ok(set(ref(admin, 'workspacePromotionMilestones/admin/TL'), milestone('completed')));
    await no(set(ref(admin, 'workspacePromotionMilestones/tl/AOP'), milestone('completed')));
    await no(set(ref(tl, 'workspacePromotionMilestones/admin/AOP'), milestone('completed')));
    await no(set(ref(admin, 'workspacePromotionMilestones/admin/OP'), milestone('completed')));
    await ok(get(ref(lr, 'workspacePromotionMilestones/admin/AOP')));

    await env.withSecurityRulesDisabled(async context => set(ref(context.database(), 'users/admin/status'), 'inactive'));
    await no(set(ref(admin, milestonePath), milestone('completed', '2026-09-28')));
    await no(get(ref(admin, cheerPath)));
    await no(set(ref(admin, cheerPath + '/admin'), cheer('👏')));
    console.log('PASS ' + count + ' promotion journey plan, milestone, and cheer rule checks');
  } finally {
    await env.cleanup();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
