'use strict';
const {spawnSync}=require('node:child_process'),path=require('node:path');
// One gate for the recovered recap read/eligibility boundaries. No cloud writes.
const tests=['test-recap-lab-week-eligibility.cjs','test-recap-lab-bridge.cjs','test-recap-lab-bridge-races.cjs'];
if(process.argv.includes('--rules')){
 if(!process.env.RULES_FILE||!process.env.TEST_TL_UID)throw Error('--rules requires private RULES_FILE and TEST_TL_UID; emulator must be running at 127.0.0.1:19019');
 tests.push('test-recap-missing-weekly-read.cjs');
}
if(process.argv.includes('--mobile'))tests.push('test-recap-lab-mobile-controls.mjs');
for(const file of tests){const r=spawnSync(process.execPath,[path.join(__dirname,file)],{stdio:'inherit',env:process.env,timeout:30000});if(r.error)throw r.error;if(r.status!==0)process.exit(r.status||1);}
console.log('PASS recap recovery gate'+(process.argv.includes('--rules')?' including emulator ACL':' (UI/model only; run --rules for ACL)'));
