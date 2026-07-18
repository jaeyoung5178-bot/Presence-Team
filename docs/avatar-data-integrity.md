# Avatar Studio 데이터 무결성 검수

검수 범위: `assets/presence-avatar-studio.js`, `index.html`, `assets/pets/`

## 결론

현재 작업본은 사용자가 지적한 “이름만 다르고 같은 코스튬이 반복되는” 직접 원인을 제거하는 방향으로 바뀌었다. 기존 카탈로그는 동일 원화 하나를 CSS 색상 필터로 4~12개씩 복제해 172개 ID를 만들었고, 공개 영역만도 84개 이름이 9개 원화에 연결되어 있었다. 특히 body/head는 일체형 master 렌더 경로에서 필터가 적용되지 않아 이름과 ID가 달라도 화면은 완전히 같았다.

현재 작업본의 `addUniqueItems()`는 원화 1개당 항목 1개만 생성한다. 총 25개 ID 중 품질 게이트를 통과한 body 4개, head 3개, prop 2개, 합계 9개만 공개된다. 9개 공개 원화와 12개 body/head 조합 master는 파일 해시 기준 서로 다른 파일이다.

다만 레거시 `equipped.look`, 비공개 액세서리 보존, 원격 저장 실패 처리에는 아직 데이터 손실 또는 오해 가능성이 남는다.

## 1. 중복 코스튬의 정확한 원인

### 수정 전 구조

- body: 4종 × 8 tone = 32개 이름
- head: 3종 × 12 tone = 36개 이름
- prop: 2종 × 8 tone = 16개 이름
- 공개 합계: 84개 이름, 실제 asset key는 9개
- 전체 슬롯 합계: 172개 ID

ID는 `cat_asset_toneIndex`로 서로 달랐지만 `asset`은 같은 값을 공유했다. 예를 들어 `body_leader_0`부터 `body_leader_7`까지 이름과 filter만 다르고 원화는 모두 `presence-pet-leader.webp`였다.

더 큰 문제는 body/head가 `integratedMaster()`로 들어가면 item의 filter를 master `<img>`에 적용하지 않았다는 점이다. 따라서 다음이 발생했다.

- 같은 body의 8개 tone은 모두 같은 단일 이미지
- 같은 head의 12개 tone도 모두 같은 단일 이미지
- body 32 × head 36 = 1,152개 이름 조합이 실제로는 12개 fitted master로 축약

즉 사용자가 본 반복은 데이터 중복이면서 렌더 중복이었다.

### 현재 작업본

`presence-avatar-studio.js:16-22`에서 tone 복제 방식을 없애고 `artKey=(file||'item')+':'+asset` 기준으로 원화 1개당 항목 1개만 생성한다.

- 공개: 9개 (body 4, head 3, prop 2)
- 비공개 품질 대기: 16개 (weapon/back/neck/wrist/feet/waist)
- 전체: 25개
- ID 중복: 없음
- 공개 `artKey` 중복: 없음
- 공개 원화 파일의 byte-identical hash 중복: 없음
- 12개 fitted master의 byte-identical hash 중복: 없음

이 구조에서는 “색상 필터만 다른 항목”을 새 코스튬 숫자로 세지 않는다. 실제 독립 원화가 생길 때만 새 ID를 추가하는 것이 맞다.

## 2. 슬롯 무결성

표준 슬롯은 다음 9개다.

`back`, `body`, `neck`, `waist`, `head`, `wrist`, `feet`, `prop`, `weapon`

`petShopAction()`은 item의 `cat` 슬롯 하나만 교체하므로 같은 슬롯에서 동시에 두 아이템이 선택되는 문제는 없다. body/head/prop 선택과 해제 상태도 각각 독립적으로 저장된다.

하지만 현재 공개 탭은 `all/body/head/prop`만 제공한다. 나머지 슬롯을 나중에 공개할 경우 각 슬롯 탭과 조합 규칙을 함께 추가해야 한다. 단순히 `isPublished()`만 바꾸면 all 목록에는 나타나지만 분류·검수 UI가 불완전하다.

## 3. 선택 → 저장 → 복원 경로

### 선택

- 색상: `setPresencePetColor()`
- 털: `setPresencePetFeather()`
- 아이템: `petShopAction()`

색상이나 털을 바꿀 때 body/head 일체형 master가 해당 변화를 가리는 것을 막기 위해 body/head preset을 해제한다. 이 동작은 시각 변화가 보이지 않는 문제를 해결하지만, 사용자가 입던 두 슬롯을 자동 해제하므로 UI에서 사전 안내가 중요하다.

### 저장

`save()`는 같은 profile을 세 곳에 반영한다.

1. 메모리 `state.petProfiles[uid]`
2. 로컬 `localStorage['presence_pet_'+uid]`
3. 원격 `DB.set('petProfiles/'+uid, profile)`

### 복원

`profile()`은 local과 remote 중 숫자형 `updatedAt`이 더 큰 쪽을 사용한다. 이는 실시간 구독이 오래된 원격 값을 다시 넣더라도 최근 로컬 선택을 우선하는 데 도움이 된다.

남은 위험:

- `DB.set()` Promise를 기다리지 않으므로 원격 실패 전에 성공 toast가 뜬다.
- 원격 저장이 실패하면 다른 기기에서는 최신 코디가 복원되지 않는다.
- `currentUser()` 또는 `currentState()`가 없으면 `save()`가 조용히 종료되어 클릭이 무반응처럼 보인다.
- `updatedAt`이 숫자가 아닌 레거시 ISO 문자열이면 `Number()`가 `NaN`이 되어 비교가 신뢰할 수 없다.

권고: 저장 상태를 `saving/saved/local-only/error`로 관리하고, DB 성공 후 “모든 기기에 저장됨”, 실패 시 “이 기기에만 임시 저장됨”을 구분해 표시한다. `updatedAt`은 migration 시 epoch millisecond로 정규화한다.

## 4. 레거시 마이그레이션

현재 `normalizeEq()`는 두 종류를 처리한다.

1. 구형 9개 ID: `leader`, `shades`, `ball` 등을 새 canonical ID로 변환
2. 직전 tone ID: `body_leader_7` 같은 suffix를 `_0`으로 변환

이 때문에 기존 tone 선택은 같은 원화의 canonical 항목으로 안전하게 합쳐진다.

아직 처리하지 않는 구조:

- `equipped.look='leader'`처럼 단일 `look` 슬롯에 저장된 구형 profile
- 슬롯 밖에 남은 알 수 없는 필드
- 비공개 액세서리 ID

특히 `index.html:15175,15191`의 이전 migration은 `window.PRESENCE_SHOP_ITEMS[equipped.look]`가 있어야만 `look`을 옮긴다. 외부 Studio 카탈로그에는 `leader`라는 key가 없고 `body_leader_0`만 있으므로, 외부 스크립트 로드 뒤에는 구형 `look='leader'`를 옮기지 못한다. `normalizeEq()`도 `look`을 보지 않기 때문에 이 profile은 기본 코디처럼 보일 수 있다.

권고: `look`을 먼저 legacy map으로 canonical ID로 바꾸고 해당 item.cat 슬롯으로 이동한 뒤 `look`을 삭제하는 단일 migration 함수를 둔다. migration version을 profile에 기록해 반복 변환을 막는다.

## 5. 비공개 액세서리 데이터 손실 위험

`normalizeEq()`는 item이 존재하더라도 `isPublished()`가 false면 슬롯 값을 빈 문자열로 만든다. 현재 weapon/back/neck/wrist/feet/waist가 여기에 해당한다.

이는 품질 미달 아이템을 숨기는 데는 성공하지만, 과거에 장착했던 ID를 profile에서 지우고 다음 저장 때 원격에도 덮어쓸 수 있다. “미노출”과 “무효 데이터”를 같은 판단으로 처리하기 때문이다.

권고:

- `normalizeStoredEq()`: 존재하는 ID와 legacy ID만 정규화하고 비공개 ID는 보존
- `renderableEq()`: 현재 공개·검수 통과 항목만 화면에 사용

두 단계를 분리하면 액세서리를 다시 공개했을 때 사용자의 이전 선택을 복구할 수 있다.

## 6. 여러 렌더러 간 ID 규격 충돌

`index.html`에는 이전 9개 ID 기반 렌더러와 migration 코드가 남아 있고, 마지막에 외부 `presence-avatar-studio.js`가 전역 함수와 카탈로그를 덮어쓴다.

- 이전 fitted renderer는 `leader-shades` 같은 legacy 조합을 기대한다 (`index.html:15179-15186`).
- 현재 Studio는 `body_leader_0`, `head_shades_0`을 저장한다.
- 마지막 외부 스크립트가 Studio 화면은 장악하지만, 성장 화면·로그인 화면·닭장 훅 중 일부가 이전 closure를 계속 호출할 수 있다.

권고: profile schema와 renderer를 외부 모듈 하나로 단일화하고, `index.html`의 구형 SHOP_ITEMS/renderer/save 함수를 제거한다. 최소한 모든 화면이 `window.presenceAvatarProfile()`과 `window.presencePetArt()`만 사용하도록 연결해야 한다.

## 7. 배포 전 필수 회귀 테스트

1. 구형 `equipped.body='leader'` 복원 → `body_leader_0`
2. 직전 tone `equipped.body='body_leader_7'` 복원 → `body_leader_0`
3. 구형 `equipped.look='leader'` 복원 → body 슬롯으로 이동
4. body/head/prop 각각 선택 → 같은 슬롯은 교체, 다른 슬롯은 유지
5. 선택 후 새로고침 → 동일 코디
6. 다른 기기 로그인 → 동일 코디
7. 원격 저장 실패 → 로컬 전용 상태가 명확히 표시
8. 비공개 액세서리 ID 보존 → 화면에는 숨지만 DB에서 삭제되지 않음
9. Avatar Studio, 로그인 로비, 성장 화면, 닭장 모두 같은 profile과 같은 렌더 결과
10. 카탈로그 검수: `id`, `name`, `artKey`, 실제 파일 hash 각각 중복 없음

## 최우선 후속 순서

1. 현재의 원화 1개 = 항목 1개 정책 유지
2. `equipped.look` migration 보완
3. 비공개와 무효 ID 정규화 분리
4. DB 저장 성공/실패 상태 표시
5. 구형 inline renderer 제거, profile/renderer 단일화

