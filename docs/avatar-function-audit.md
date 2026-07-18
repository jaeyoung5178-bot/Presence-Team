# Avatar Studio 기능 감사 — 색상·털·코스튬·저장 동기화

작성일: 2026-07-18  
대상: `index.html`, `assets/presence-avatar-studio.js`, `assets/presence-avatar-studio.css`, `database.rules.json`

## 결론

클릭 핸들러가 없는 문제는 아니다. 현재 외부 스크립트는 선택값을 `state.petProfiles[uid]`, 로컬 저장소, Firebase `petProfiles/{uid}`에 쓰도록 연결되어 있다. 그러나 렌더러가 선택값 일부를 의도적으로 무시하고, 구형 렌더러와 신형 렌더러가 서로 다른 아이템 ID 체계를 사용하며, Firebase 실패를 성공처럼 처리한다. 이 세 문제가 합쳐져 사용자는 실제로 “눌러도 그대로”라고 느끼게 된다.

가장 큰 원인은 다음 네 가지다.

1. 신형 합성 렌더러가 의상/머리의 `integrated master`를 선택한 순간 색상 tint와 털 레이어를 모두 끈다.
2. 전용 색상 이미지 12개가 이미 있는데도 사용하지 않고, 항상 노란 기본 이미지 위에 마스크/blend만 올린다.
3. 닭장/성장 SVG 렌더러는 `leader`, `shades` 같은 구형 ID만 알고, 신형 저장값 `body_leader_0`, `head_shades_0` 등을 모른다.
4. Firebase 저장 Promise를 기다리지 않고 성공 토스트를 띄우며, 다음 원격 이벤트/새로고침에서는 원격값이 로컬 최신값을 무조건 덮는다.

따라서 상태 버튼의 `on` 테두리나 요약문은 바뀔 수 있어도 캐릭터는 그대로일 수 있고, 저장 실패 후 새로고침하면 이전 코디로 돌아갈 수 있다.

## 확인한 데이터 흐름

현재 외부 스크립트의 정상 의도는 아래와 같다.

```text
onclick
  -> setPresencePetColor / setPresencePetFeather / petShopAction
  -> profile() 복제
  -> save()
     -> state.petProfiles[uid] 갱신
     -> localStorage presence_pet_{uid} 갱신
     -> DB.set('petProfiles/{uid}', profile) 요청
     -> Avatar Studio + 닭장 + 성장 화면 + 입장 화면 재렌더
```

Firebase 규칙의 `petProfiles/$uid` 쓰기 조건은 로그인한 활성 사용자가 자기 UID에 쓰는 경우를 허용하므로 규칙 자체가 일차 원인은 아니다(`database.rules.json:29-33`). 문제는 클라이언트가 쓰기 거절/네트워크 실패를 관찰하지 않는다는 점이다.

## P0 — 즉시 고쳐야 하는 렌더 문제

### 1. 의상을 입으면 BODY COLOR와 FEATHER STYLE이 무효화됨

근거: `assets/presence-avatar-studio.js:48-55`

- `integratedMaster()`가 body 또는 head 하나만 있어도 master 이미지를 반환한다.
- `integrated === true`이면 `tint=0`이 된다.
- 동일 분기에서 `.pgp-tone`, `.pgp-feather`, body/head item layer를 전부 만들지 않는다.
- 결과적으로 의상이나 안경/모자를 하나라도 착용한 상태에서는 색상과 털 버튼이 저장만 되고 화면에는 보이지 않는다.
- body/head의 루비·오션 같은 tone variant도 master 이미지에는 `item.filter`를 적용하지 않으므로 0번과 1~11번 변형이 같은 그림으로 보인다.

#### 최소 수정 원칙

전용 컬러 베이스를 사용하고, integrated master는 `honey + classic + original tone` 조합에서만 사용한다. 그 밖의 조합은 베이스 + feather + item layer 합성으로 내려가야 한다.

`art()` 내부의 핵심 분기를 다음 형태로 바꾸는 것이 안전하다.

```js
var color = COLORS.some(function (x) { return x[0] === p.color; }) ? p.color : 'honey';
var feather = FEATHERS.some(function (x) { return x[0] === p.feather; }) ? p.feather : 'classic';
var hasCustomTone = ['body', 'head'].some(function (k) {
  return chosen[k] && chosen[k].filter && chosen[k].filter !== 'none';
});
var fitted = integratedMaster(chosen.body, chosen.head);
var mayUseFitted = !!fitted && color === 'honey' && feather === 'classic' && !hasCustomTone;
var baseSrc = ROOT + 'presence-base-' + color + '.webp';

html += '<img class="' + (mayUseFitted ? 'pgp-master' : 'pgp-base') +
  '" src="' + (mayUseFitted ? fitted : baseSrc) + '" alt="" draggable="false">';

if (!mayUseFitted) {
  if (feather !== 'classic') {
    html += '<img class="pgp-feather" src="' + ROOT + 'presence-feather-' + feather + '.png" alt="" draggable="false">';
  }
  html += itemLayer(chosen.body, 'pgp-body');
  html += itemLayer(chosen.head, 'pgp-head');
}
```

현재 폴더에는 `presence-base-honey.webp`부터 `presence-base-cocoa.webp`까지 12개, 털 8개, 카탈로그가 참조하는 item/accessory/fitted 파일이 모두 존재함을 확인했다. 새 이미지를 만들지 않아도 이 수정은 가능하다.

### 2. 기존 성장 화면 렌더러는 신형 아이템 ID를 이해하지 못함

근거:

- 구형 catalog 및 `equippedItem()`: `index.html:15053-15068`
- 신형 catalog ID 생성: `assets/presence-avatar-studio.js:17-19`
- 성장 캐릭터 호출: `index.html:5856-5860`

구형 렌더러는 `p.equipped.body === 'leader'`를 기대하지만, Avatar Studio는 `body_leader_0`을 저장한다. 따라서 `renderAnimal()`이 호출되어도 `petCostumeSvg()`는 해당 아이템을 찾지 못하고 아무 레이어도 반환하지 않는다. back/neck/wrist/feet/waist/weapon 슬롯은 구형 렌더러에 아예 없다.

#### 권장 수정

`renderAnimal()`에 신형 ID를 다시 구형 ID로 억지 변환하지 말고, 모든 화면이 `window.presencePetArt(profile, context)` 하나를 사용하게 해야 한다. SVG 안에는 HTML `<div>`를 넣을 수 없으므로 성장 카드에 별도의 HTML avatar mount를 추가하고 기존 `animalSvg`는 배경/성장 연출만 담당하게 분리한다.

최소 호환 패치가 필요하다면 우선 아래처럼 asset 이름만 추출해 구형 3개 슬롯이라도 보이게 할 수 있다.

```js
function legacyAssetId(id) {
  var item = window.PRESENCE_SHOP_ITEMS && window.PRESENCE_SHOP_ITEMS[id];
  return item ? item.asset : id;
}
```

다만 이 방법은 9개 슬롯 중 head/body/prop만 보이므로 최종 해결책이 아니다.

### 3. integrated master가 아이템 tone variant를 무시함

`ITEMS`에는 동일 의상마다 8~12개 색 변형이 있지만 master 파일명은 asset 이름만 사용한다. 예를 들어 `body_leader_0`과 `body_leader_7` 모두 `presence-pet-leader.webp`가 된다. 위 1번의 `hasCustomTone` 조건으로 해결해야 하며, master 자체에 filter를 거는 방식은 얼굴/몸 전체 색까지 바꾸므로 사용하면 안 된다.

## P0 — mount 안정성

사용자 캡처에는 우측 wardrobe만 있고 좌측 `#asStage` 미리보기 카드가 보이지 않는다. 현재 소스의 `shell()`은 stage를 생성하지만 `data-avatar-studio="2"`만 보고 mount 완료로 간주한다(`assets/presence-avatar-studio.js:66`). 같은 페이지에 구형 shop renderer가 여럿 있고 모두 같은 `.ps-shell`의 `innerHTML`을 교체한다. 다른 코드가 DOM만 덮고 dataset을 남기면 외부 스크립트는 영구적으로 복구하지 않는다.

dataset만 확인하지 말고 필수 DOM을 함께 검사해야 한다.

```js
function shell() {
  var panel = document.getElementById('m-petshop');
  var host = panel && panel.querySelector('.ps-shell');
  if (!host) return null;
  var mounted = host.dataset.avatarStudio === '3' &&
    host.querySelector('#asStage') && host.querySelector('#asColors') && host.querySelector('#asGrid');
  if (!mounted) {
    host.dataset.avatarStudio = '3';
    // 현재 Avatar Studio markup 삽입
  }
  return host;
}
```

그리고 장기적으로는 `index.html`의 세 shop 구현 중 두 개를 제거하고 Avatar Studio만 단일 소유자로 남겨야 한다. 주기적 `setInterval()`로 서로 복구하는 방식은 UI race를 숨길 뿐 해결하지 않는다.

## P1 — 저장·새로고침·Firebase 동기화

### 4. Firebase 실패를 성공으로 표시함

근거: `assets/presence-avatar-studio.js:60`

`db.set()` Promise를 반환받지 않고, 즉시 “반영됐어요” 토스트를 띄운다. 권한 거절, 연결 끊김, SDK 초기화 실패를 모두 삼킨다. 온라인 상태에서 저장 실패가 나도 사용자는 성공으로 인식한다.

`save()`는 Promise를 반환하고 Firebase 결과에 따라 동기화 상태를 표시해야 한다.

```js
function persistRemote(u, p) {
  var host = window.PRESENCE_AVATAR_HOST;
  var db = host && host.getDb && host.getDb();
  var live = host && host.isLive && host.isLive();
  var testUser = !!(host && host.isTestUser && host.isTestUser(u));
  if (!live || !db || !db.set || testUser) return Promise.resolve({ localOnly: true });
  return db.set('petProfiles/' + u.uid, p).then(function () {
    return { synced: true };
  });
}

function save(p, msg) {
  var u = currentUser(), st = currentState();
  if (!u || !st) return Promise.reject(new Error('avatar host unavailable'));
  p.updatedAt = Date.now();
  p.adoptedAt = p.adoptedAt || Date.now();
  st.petProfiles = st.petProfiles || {};
  st.petProfiles[u.uid] = p;
  localStorage.setItem('presence_pet_' + u.uid, JSON.stringify(p));
  renderEverywhere(p); // optimistic UI
  return persistRemote(u, p).then(function (result) {
    if (msg && window.toast) toast(result.localOnly ? '기기에 저장했어요' : msg);
    return p;
  }).catch(function (err) {
    p.syncPending = true;
    localStorage.setItem('presence_pet_' + u.uid, JSON.stringify(p));
    if (window.toast) toast('⚠️ 화면에는 적용했지만 서버 저장에 실패했어요. 연결 후 다시 시도합니다.');
    throw err;
  });
}
```

클릭 핸들러에서는 반환 Promise를 `catch()`해 unhandled rejection만 막는다. 성공 토스트는 `then()` 이후에만 띄운다.

### 5. 원격값이 로컬 최신값을 무조건 이김

근거: `assets/presence-avatar-studio.js:28-33`

현재 `Object.assign({}, local, remote)`라서 remote가 항상 우선이다. Firebase 저장이 실패한 뒤 새로고침하면 로컬에 최신 코디가 있어도 예전 remote가 덮는다. 로컬 fallback이 실질적으로 작동하지 않는다.

`updatedAt`으로 최신값을 선택해야 한다.

```js
function chooseLatest(local, remote) {
  if (!local) return remote || {};
  if (!remote) return local;
  return Number(local.updatedAt || 0) > Number(remote.updatedAt || 0) ? local : remote;
}

var raw = chooseLatest(readLocalProfile(u), remote);
```

`syncPending` 로컬 프로필은 로그인/온라인 복귀 시 한 번 재전송하고, 성공하면 해당 플래그를 제거한다.

### 6. Firebase 구독이 Avatar Studio를 직접 다시 그리지 않음

근거: `index.html:15032`

`DB.on('petProfiles')`는 `state.petProfiles`를 통째로 교체한 뒤 닭장과 성장 화면만 그린다. Avatar Studio는 최대 3.5초 주기 boot에 의존한다. 콜백에 아래를 추가해야 한다.

```js
if (typeof window.renderPetShop === 'function') window.renderPetShop();
if (typeof window.renderEntryCostume === 'function') window.renderEntryCostume();
```

더 안전한 방식은 `petProfiles/{me.uid}`만 구독해 다른 사용자의 변경 때문에 전체 map이 교체되지 않도록 하는 것이다.

## P1 — top-level `state` / `me`와 외부 스크립트 경계

`state`와 `me`는 각각 `let state`(`index.html:3990`)와 `let me`(`index.html:4095`)로 선언되어 `window.state`, `window.me`가 아니다. 현재 외부 파일은 일반 classic script라서 `typeof me !== 'undefined' ? me : null` fallback으로 같은 global lexical environment를 읽을 수 있다. 즉 이것만으로 현재 클릭이 실패한다고 단정하면 안 된다.

다만 외부 파일이 `type="module"`, 번들, strict sandbox로 바뀌는 순간 끊기는 매우 취약한 계약이다. `window.me` 우선/fallback 패턴도 상태의 단일 출처를 흐린다. `index.html`에서 명시적 host bridge를 한 번만 공개해야 한다.

```js
window.PRESENCE_AVATAR_HOST = Object.freeze({
  getUser: function () { return me; },
  getState: function () { return state; },
  getDb: function () { return DB; },
  isLive: function () { return LIVE; },
  isTestUser: function (u) { return typeof isTestBot === 'function' && isTestBot(u); }
});
```

외부 스크립트의 `currentUser/currentState/save`는 이 bridge만 사용해야 한다. `window.me = me`처럼 값을 복사하면 로그인/로그아웃 뒤 stale reference가 되므로 사용하지 않는다.

## P2 — 렌더 일관성 및 360도 요구사항

- `patchCoop()`의 compact 모드는 back, wrist, feet, prop, weapon을 숨기고 neck/waist만 그린다(`assets/presence-avatar-studio.js:51-56`). “모든 화면에 반영” 문구와 모순된다. 작은 화면에서도 최소한 back/feet/weapon까지 포함하거나, 슬롯별 축소 가이드가 필요하다.
- 진짜 360도 회전은 현재의 정면 2D PNG/WebP 한 장 구조로 구현할 수 없다. CSS로 평면 이미지를 Y축 회전하면 뒷모습/백팩 착용 상태가 생성되지 않고 뒤집힌 앞면만 보인다. 최소 8방향(front, front-quarter, side, back-quarter, back × 좌우) base/feather/item asset과 `angleIndex` 기반 renderer가 필요하다. 품질 기준이 “가방의 뒤 부착 상태 확인”이라면 back view asset은 필수다.
- 회전 UI보다 먼저 “클릭 즉시 stage 변화 + 저장 상태 표시 + 새로고침 유지”를 자동 테스트로 잠가야 한다.

## 권장 적용 순서

1. `shell()` mount invariant 추가 — 좌측 미리보기 소실 방지.
2. 전용 컬러 base 사용 + integrated master 조건 축소 — 색/털/tone variant를 즉시 보이게 함.
3. `save()` Promise 처리와 최신 `updatedAt` 병합 — 새로고침 지속성과 Firebase 실패 표시.
4. `petProfiles` 구독에서 Studio/입장 화면도 즉시 재렌더.
5. 구형 shop catalog/renderer 제거 후 `presencePetArt` 단일 렌더러로 통합.
6. 8방향 asset schema를 별도 작업으로 구축해 드래그 회전 구현.

## 회귀 테스트 체크리스트

아래는 배포 전 자동화해야 한다.

1. 무의상 상태에서 12색 각각 클릭 시 `img.pgp-base.src`가 해당 `presence-base-{color}.webp`로 바뀐다.
2. 의상 착용 상태에서도 색 클릭 시 base가 바뀌고 의상은 유지된다.
3. head/body 착용 상태에서 8개 feather 각각 클릭 시 `.pgp-feather` src가 바뀐다.
4. 같은 의상의 original/ruby/ocean을 선택했을 때 item layer의 computed filter 또는 픽셀 스냅샷이 서로 다르다.
5. 각 9개 slot을 착용/해제할 때 `state.petProfiles[uid].equipped[slot]`, Studio stage, coop/entry mount가 같은 tick에 바뀐다.
6. Firebase `set` 성공 뒤 새로고침해 같은 `color`, `feather`, `equipped`가 복원된다.
7. Firebase `set` reject 모킹 시 성공 토스트를 띄우지 않고 `syncPending` 로컬값을 유지한다.
8. 원격값보다 로컬 `updatedAt`이 최신이면 로컬이 보이고, 동기화 성공 후 양쪽이 같아진다.
9. legacy short ID (`leader`)가 저장된 기존 사용자는 `body_leader_0`으로 정상 마이그레이션된다.
10. Avatar Studio mount의 `#asStage`를 임의 제거한 뒤 boot를 호출하면 shell이 자동 복구된다.

## 검증 범위와 제약

- 소스의 상태/렌더/저장/Firebase 규칙 경로를 정적 추적했다.
- 카탈로그가 참조하는 12색 base, 8개 feather, body/head/prop/accessory/fitted 파일의 존재를 확인했다.
- 이 환경에는 실행 가능한 브라우저 세션과 Node 런타임이 없어 실제 로그인 계정의 클릭 및 Firebase round-trip은 수행하지 못했다. 따라서 위 회귀 테스트는 수정 적용 후 배포 전 별도로 실행해야 한다.
