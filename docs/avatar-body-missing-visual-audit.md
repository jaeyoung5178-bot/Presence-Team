# Avatar Studio 본체 소실 긴급 시각 감사

최종 점검: 2026-07-18  
범위: Avatar Studio 본체·털·놀이 소품 렌더링, 이미지 경로, DOM 소유권, 레이어 순서  
검토 파일: `assets/presence-avatar-studio.js`, `assets/presence-avatar-studio.css`, `index.html`의 기존 병아리 인벤토리 패치, `assets/pets/*`  
이번 감사는 원인과 수정 지점을 확정하기 위한 것이며 코드는 수정하지 않았다.

## 결론

첨부 화면처럼 **Avatar Studio 틀만 나타나고 본체가 비어 있거나, 털·놀이 소품만 따로 보이며, 일부 카드에 깨진 이미지 아이콘이 뜨는 현상은 에셋 원화 부족이 아니라 렌더러 충돌과 잘못된 동적 경로 조합이 주원인**이다.

현재 한 화면을 세 세대의 코드가 동시에 관리한다.

1. `index.html:15057~15097` — 최초 이모지 코디샵 렌더러
2. `index.html:15172~15269` — 중간 단일 병아리 인벤토리 렌더러
3. `assets/presence-avatar-studio.js` — 현재 Avatar Studio 렌더러

이 세 코드가 `window.PRESENCE_SHOP_ITEMS`, `window.renderPetShop`, `window.petShopAction`, `window.setPetShopCat`, `window.presencePetArt`와 `.ps-shell` 내부 HTML을 차례로 덮어쓴다. 과거 코드의 주기 실행은 외부 Avatar Studio가 로드된 뒤에도 남아 있다. 따라서 데이터나 로딩 타이밍에 따라 서로 다른 ID 체계와 경로 규칙이 섞인다.

## P0 직접 원인

### 1. 새 아이템 ID를 과거 경로 생성기가 파일명으로 사용한다

현재 외부 카탈로그의 ID는 다음 형식이다.

- `body_raincoat_0`
- `head_shades_0`
- `prop_ball_0`

그러나 실제 원화 파일명은 `asset` 값만 사용한다.

- `assets/pets/presence-pet-raincoat.webp`
- `assets/pets/presence-item-shades.webp`
- `assets/pets/presence-icon-ball.webp`

중간 렌더러의 `index.html:15176~15178`은 아이템 전체 ID를 그대로 파일명에 연결한다.

```text
presence-pet-body_raincoat_0.webp
presence-item-head_shades_0.webp
presence-icon-prop_ball_0.webp
```

위 파일은 모두 존재하지 않는다. 그래서 중간 렌더러가 한 번이라도 실행되면 본체·착장·아이템 카드에서 404와 깨진 이미지 아이콘이 발생한다. 실제 디렉터리에는 새 Avatar Studio가 생성하는 canonical 경로의 원화가 모두 존재하고 파일 형식도 정상이다.

**정확한 수정 지점**

- 최선: `index.html:15172~15269`의 구형 인벤토리 렌더러와 타이머를 제거하고 `assets/presence-avatar-studio.js`만 DOM과 전역 API를 소유하게 한다.
- 임시 유지가 불가피하다면 `petAsset`, `itemAsset`, `iconAsset`에 ID가 아니라 `PRESENCE_SHOP_ITEMS[id].asset`을 전달해야 한다. 그러나 이 방식은 중복 렌더러 자체를 남기므로 최종 해결로 인정하지 않는다.
- 정적 QA에 `body_raincoat_0 -> presence-pet-body_raincoat_0.webp` 같은 잘못된 동적 URL이 생성되지 않는지 검사를 추가한다.

### 2. 과거 셸과 새 셸이 같은 `.ps-shell`을 주기적으로 재작성한다

- 중간 코드 `inventoryShell()`은 `data-inventory="1"`이 아니면 `.ps-shell.innerHTML`을 과거 구조로 바꾼다.
- 새 코드 `shell()`은 `data-avatar-studio="3"`이 아니면 같은 `.ps-shell.innerHTML`을 Avatar Studio 구조로 다시 바꾼다.
- 중간 `correctiveBoot`는 7초마다, 새 `boot`는 3.5초마다 실행된다.

따라서 두 셸이 서로의 `data-*` 표식을 인정하지 않고 같은 영역을 계속 교체한다. 렌더링 도중 `#asStage`, `#asColors`, `#asFeathers`, `#asGrid`가 제거되거나 새로 생길 수 있어 본체·선택 상태·아이템 목록이 순간적으로 또는 지속적으로 비어 보인다.

**정확한 수정 지점**

- `index.html:15267~15268`의 `correctiveBoot`에서 `inventoryShell()` 및 구형 `renderPetShop()` 소유권을 제거한다.
- `index.html:15095~15096`의 최초 코디샵 부트와 주기 보정도 Avatar Studio 로드 후에는 실행하지 않는다.
- `.ps-shell`의 유일한 소유자는 `assets/presence-avatar-studio.js`의 `shell()`이어야 한다.
- 주기적으로 전체 HTML을 재작성하지 말고, 로그인·프로필 수신·사용자 액션 같은 명시적 상태 변경에서만 부분 렌더링한다.

### 3. 사용자 데이터가 준비되기 전에 빈 Avatar Studio 셸을 먼저 노출한다

`assets/presence-avatar-studio.js:76`의 `render()`는 조건식 평가 과정에서 `shell()`을 먼저 실행한 뒤 `currentUser()`를 확인한다.

```text
if (!shell() || !currentUser()) return;
```

로그인 사용자 정보가 아직 준비되지 않았으면 셸에는 제목과 빈 컨테이너만 생성되고 즉시 반환된다. 이 상태가 첨부 화면의 **빈 본체 무대, BODY COLOR/FEATHER STYLE 라벨만 있는 빈 영역, 비어 있는 아이템 영역**과 일치한다. 이후 렌더가 예외 또는 렌더러 충돌로 중단되면 빈 셸이 그대로 남는다.

**정확한 수정 지점**

- `render()`는 `currentUser()`와 `currentState()`를 먼저 확인하고, 둘 다 준비된 경우에만 `shell()`을 마운트한다.
- 준비 전에는 빈 Studio가 아니라 명시적인 스켈레톤/“아바타 불러오는 중” 상태를 표시한다.
- 프로필 수신 이벤트에서 즉시 한 번 렌더하고, 3.5초 폴링에 복구를 의존하지 않는다.
- `boot()`의 빈 `catch(e){}`를 제거하고 오류를 진단 채널에 기록하며 사용자에게 재시도 상태를 표시한다.

### 4. 저장된 색상·털 값은 검증하지 않은 채 URL에 삽입된다

`profile()`은 빈 값만 기본값으로 바꾼다. truthy이지만 허용 목록에 없는 과거 값은 그대로 남는다.

```text
p.color = p.color || 'honey'
p.feather = p.feather || 'classic'
```

그 결과 과거 데이터가 `color:'sun'`, 오타, 한국어 라벨 등의 값을 가지면 다음처럼 존재하지 않는 URL을 만든다.

```text
assets/pets/presence-base-sun.webp
assets/pets/presence-feather-<legacy>.png
```

톤 색상 계산은 허니로 fallback하지만 실제 `src`는 fallback하지 않으므로 본체만 사라질 수 있다.

**정확한 수정 지점**

- `profile()`에서 `COLORS.some(id)`와 `FEATHERS.some(id)`로 값을 canonicalize한 뒤 URL을 만든다.
- 허용되지 않은 값은 각각 `honey`, `classic`으로 바꾸고 한 번만 저장 마이그레이션한다.
- URL 생성은 문자열 자유 조합 대신 검증된 asset registry만 통과시킨다.

## P1 구조·시각 위험

### 5. 같은 전역 API를 세 코드가 덮어쓴다

`renderPetShop`, `petShopAction`, `setPetShopCat`, `presencePetArt`가 여러 스크립트에서 재정의된다. 스크립트 로드 순서만 보면 마지막 외부 코드가 이기지만, 과거 코드의 클로저·타이머·MutationObserver는 계속 살아 있다. 기능을 눌렀는데 아무 변화가 없거나 잠시 뒤 원래 상태로 돌아오는 현상도 이 구조에서 발생할 수 있다.

**수정 기준:** 한 모듈만 전역 브리지를 등록하고, 나머지 코드는 제거한다. 등록 시 개발 모드에서 중복 정의를 오류로 처리한다.

### 6. 본체 레이어가 실패해도 독립 레이어는 계속 표시된다

새 렌더러의 레이어 순서는 다음과 같다.

| 레이어 | 클래스 | z-index |
|---|---|---:|
| 뒤 장비 | `.pgp-back` | 0 |
| 필수 본체/일체형 마스터 | `.pgp-base`, `.pgp-master` | 1 |
| 색상 톤 | `.pgp-tone` | 2 |
| 털 | `.pgp-feather` | 3 |
| 의상 | `.pgp-body` | 4 |
| 목·허리 | `.pgp-neck`, `.pgp-waist` | 5 |
| 머리 | `.pgp-head` | 6 |
| 손목·발 | `.pgp-wrist`, `.pgp-feet` | 7 |
| 놀이 소품 | `.pgp-prop` | 8 |
| 무기 | `.pgp-weapon` | 9 |

순서 자체는 타당하지만 필수 본체 이미지가 404여도 상위 독립 레이어는 렌더링된다. 그래서 털 조각이나 놀이 소품만 허공에 보이는 실패 화면이 만들어진다.

**수정 기준**

- 본체는 렌더 성공의 필수 조건으로 다룬다.
- 본체 `load` 완료 전에는 독립 레이어를 보이지 않고 스켈레톤을 유지한다.
- 본체 `error` 시 즉시 검증된 `presence-base-honey.webp`로 한 번 fallback한다.
- fallback도 실패하면 조각 레이어를 숨기고 오류 카드와 재시도 버튼을 표시한다.

### 7. 이미지 URL에 배포 버전이 없다

CSS/JS 링크에는 `?v=...`가 있으나 JS가 만드는 `assets/pets/*` 이미지 URL에는 배포 버전이 없다. CDN/브라우저 캐시에 이전 404 또는 이전 원화가 남으면 새 코드와 다른 에셋 세대를 함께 볼 수 있다.

**수정 기준:** 에셋 manifest에 해시 파일명 또는 공통 `ASSET_VERSION`을 적용하고, HTML·CSS·JS·이미지가 한 릴리스 단위로 원자적으로 배포되게 한다.

## 확인된 정상 에셋

다음 필수 파일은 로컬에 실제 존재하며 유효한 PNG/WebP다.

- 색상 본체 12종: `presence-base-{honey...cocoa}.webp`
- 털 8종: `presence-feather-{classic...plume}.png`
- 의상 4종: `presence-pet-{raincoat,leader,floral,swimsuit}.webp`
- 머리 3종: `presence-pet-{shades,straw,wig}.webp`
- 놀이 소품 2종: `presence-item-{ball,tube}.webp`
- 몸+머리 일체형 마스터 12종: `presence-fitted-{body}-{head}.webp`

따라서 원화를 다시 만드는 것이 1차 조치가 아니다. 먼저 경로와 렌더러 단일화를 해결해야 한다.

## 최종 PASS 기준

### A. 본체·경로

- [ ] PASS: 로그인 후 첫 Avatar Studio 진입에서 1초 안에 병아리 본체가 보인다.
- [ ] PASS: 네트워크 요청에 `presence-pet-body_*`, `presence-icon-prop_*` 형태의 URL이 단 한 건도 없다.
- [ ] PASS: Studio 진입부터 색상·털·카테고리 전환 5분 동안 이미지 404가 0건이다.
- [ ] PASS: 저장 데이터에 알 수 없는 color/feather 값이 있어도 허니·클래식 본체로 안전하게 복구한다.
- [ ] FAIL: 빈 무대 위에 털, 비치볼, 튜브만 보인다.
- [ ] FAIL: 어떤 카드든 브라우저의 깨진 이미지 아이콘이 나타난다.

### B. 단일 렌더러·상태 유지

- [ ] PASS: `.ps-shell`의 `innerHTML` 소유자는 Avatar Studio 모듈 하나뿐이다.
- [ ] PASS: `renderPetShop`, `petShopAction`, `setPetShopCat`, `presencePetArt`는 각각 한 번만 정의된다.
- [ ] PASS: 30초 관찰 중 셸 DOM이 주기적으로 교체되지 않고 선택·검색·스크롤 위치가 유지된다.
- [ ] PASS: 색상·털·아이템 클릭 직후 무대와 카드 선택 상태가 동시에 바뀌고 다시 되돌아가지 않는다.
- [ ] FAIL: 3.5초/7초 타이머에 따라 본체가 깜박이거나 선택이 초기화된다.

### C. 레이어 완성도

- [ ] PASS: 본체가 로드된 뒤에만 털·의상·소품이 같은 1:1 캔버스에서 표시된다.
- [ ] PASS: 모든 레이어의 투명 캔버스 크기와 눈·부리·날개·발 기준점이 동일하다.
- [ ] PASS: 색상 12종 × 털 8종 × 공개 의상·머리·놀이소품 전체 조합에서 본체와 분리된 조각이 없다.
- [ ] PASS: 본체 오류 시 상위 레이어가 숨겨지고 안전한 fallback 또는 명시적 오류 상태가 나온다.
- [ ] FAIL: 본체 없이 액세서리만 남거나, 아이템이 프레임 바깥으로 잘린다.

### D. 로딩·오류 표시

- [ ] PASS: 사용자/프로필 준비 전에는 빈 Studio가 아니라 로딩 상태가 보인다.
- [ ] PASS: 이미지 오류와 렌더 예외는 콘솔 및 내부 진단 로그에 파일 URL·사용자 상태·렌더 단계와 함께 남는다.
- [ ] PASS: 오류가 발생해도 검색·색상·털 컨트롤이 반쯤 비어 있는 완성 화면처럼 노출되지 않는다.
- [ ] FAIL: 예외를 빈 `catch`로 삼키고 빈 셸을 정상 UI처럼 보여준다.

## 배포 전 재현 매트릭스

| 상태 | 필수 확인 |
|---|---|
| 신규 사용자, 프로필 없음 | 로딩 후 허니·클래식 기본 본체 |
| 구형 `variant:sun/mint/peach`만 존재 | 기본 본체로 마이그레이션, 404 없음 |
| 잘못된 color/feather 값 | 허용값 fallback 및 저장 정규화 |
| 구형 아이템 ID `raincoat` | `body_raincoat_0`으로 정규화 |
| 필터 시대 ID `body_raincoat_5` | 원본 `body_raincoat_0`으로 정규화 |
| 의상·머리 동시 저장 | 검수된 일체형 또는 명시된 단일 프리셋, 조각 겹침 없음 |
| 느린 3G·이미지 캐시 없음 | 스켈레톤 후 본체부터 원자적으로 표시 |
| 본체 URL 강제 404 | 허니 fallback, 실패 시 조각 레이어 숨김 |
| 1440·1024·834·430·390·360px | 본체 비율·기준점·카드 이미지 정상 |

위 매트릭스를 신규/기존 프로필 각각 수행하고 네트워크 404 0건, 콘솔 오류 0건, 셸 교체 0건을 확인해야 배포 PASS다.
