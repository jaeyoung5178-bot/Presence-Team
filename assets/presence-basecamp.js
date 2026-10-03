(function(){
  'use strict';
  function mount(){
    var gate=document.getElementById('authGate');if(!gate)return;
    gate.classList.add('presence-basecamp');
    if(gate.querySelector('.auth-basecamp-scene'))return;
    var scene=document.createElement('section');scene.className='auth-basecamp-scene';scene.setAttribute('aria-label','Presence Base Camp');
    scene.innerHTML='<div class="bc-sky-glow"></div><div class="bc-cloud one"></div><div class="bc-cloud two"></div><div class="bc-copy"><div class="bc-mark"><i>P</i><span>PRESENCE WORLD</span></div><div class="bc-kicker">TEAM OPERATING ADVENTURE</div><h1 class="bc-title">사람과 성장이<br><em>만나는 베이스캠프</em></h1><p class="bc-desc">오늘의 실행부터 팀의 성장, 현장의 성과까지. Presence 팀의 모든 여정을 한 공간에서 이어갑니다.</p><div class="bc-worlds"><span>TODAY</span><span>PEOPLE</span><span>PROGRESS</span><span>PROFIT</span><span>MY AVATAR</span></div></div><div class="bc-ground"></div><div class="bc-tent"></div><div class="bc-pet"><img src="assets/pets/presence-pet-base.png" alt="Presence 병아리"></div>';
    gate.insertBefore(scene,gate.firstChild);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
