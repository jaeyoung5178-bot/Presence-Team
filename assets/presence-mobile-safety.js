/* Keep existing effect and admin controls together without changing their permission owners. */
(function(){
 'use strict';
 let queued=false;
 function sync(){
  queued=false;
  const music=document.getElementById('presenceBgmQuick'),season=document.querySelector('[data-presence-season-control]');
  if(!music&&!season)return;
  let dock=document.getElementById('presenceUtilityDock');
  if(!dock){dock=document.createElement('div');dock.id='presenceUtilityDock';dock.setAttribute('role','group');dock.setAttribute('aria-label','화면 효과와 음악');document.body.appendChild(dock);}
  const nav=document.getElementById('botbar'),height=nav?.getBoundingClientRect().height||0;
  dock.style.setProperty('--presence-nav-height',height+'px');
  for(const node of [music,document.getElementById('presenceMusicOpen'),season])if(node&&node.parentNode!==dock)dock.appendChild(node);
 }
 function queue(){if(!queued){queued=true;requestAnimationFrame(sync);}}
 function boot(){window.addEventListener('resize',queue,{passive:true});window.visualViewport?.addEventListener('resize',queue,{passive:true});new MutationObserver(queue).observe(document.body,{childList:true,subtree:true});sync();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
