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
        x: { userUid: 'inactive' }, z: { userUid: 'admin' }
      },
      users: {
        admin: { uid: 'admin', role: 'AOP', status: 'active' },
        lr: { uid: 'lr', role: 'LR', status: 'active' },
        tl: { uid: 'tl', role: 'TL', status: 'active' },
        inactive: { uid: 'inactive', role: 'TL', status: 'inactive' }
      }
    }));
    const db = id => env.authenticatedContext(id).database();
    const admin = db('a'), lr = db('l'), tl = db('t');
    const inactive = db('x'), anonymous = env.unauthenticatedContext().database();
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

    await env.withSecurityRulesDisabled(async context => set(ref(context.database(), 'users/admin/status'), 'inactive'));
    await no(set(ref(admin, milestonePath), milestone('completed', '2026-09-28')));
    await no(get(ref(admin, cheerPath)));
    await no(set(ref(admin, cheerPath + '/admin'), cheer('👏')));
    console.log('PASS ' + count + ' promotion journey milestone and cheer rule checks');
  } finally {
    await env.cleanup();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
