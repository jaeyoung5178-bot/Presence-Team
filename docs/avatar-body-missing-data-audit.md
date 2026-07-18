# Avatar Studio 병아리 본체 누락 — 데이터·상태 긴급 감사

## 결론

왼쪽 메인 미리보기에서 **병아리 본체는 사라지고 털(feather) 레이어만 보이는 현상의 1차 원인은 CSS가 아니라 저장된 프로필의 `color` 값이 현재 색상 카탈로그와 맞지 않는 상태**다.

현재 `profile()`은 값이 비어 있을 때만 기본값을 넣는다. 따라서 `sun`, `gold`, `#f6cf58`, 공백 문자열처럼 **존재하지만 유효하지 않은 과거 값**은 그대로 통과한다. `art()`는 이 값을 검증하지 않고 파일명에 직접 넣어 `assets/pets/presence-base-<color>.webp`를 요청한다. 그 파일이 없으면 base `<img>`만 로드 실패하고, 유효한 `presence-feather-*.png`는 계속 로드되므로 화면에는 털 레이어만 남는다.

현재 저장소에는 아래 12개 base만 존재한다.

`honey`, `vanilla`, `cream`, `peach`, `coral`, `rose`, `lilac`, `sky`, `mint`, `sage`, `silver`, `cocoa`

모든 파일은 418×418, alpha 포함 WebP로 확인됐다. 즉 현재 카탈로그 ID로 만든 base 자체가 누락된 문제는 아니다.

## 정확한 코드 경로

### 1. 유효성 검사가 없는 프로필 병합

- 파일: `assets/presence-avatar-studio.js`
- 함수: `profile()` (현재 39행)
- 조건:

```js
p.color = p.color || 'honey';
p.feather = p.feather || 'classic';
```

이 코드는 `color: 'sun'`처럼 truthy인 레거시 값을 허용한다. `COLORS`에 실제로 존재하는지 검사하지 않는다. `feather`도 같은 위험이 있지만, invalid feather는 털만 사라지게 할 뿐 본체 누락의 직접 원인은 아니다.

### 2. 검증되지 않은 값으로 base URL 생성

- 파일: `assets/presence-avatar-studio.js`
- 함수: `art()` (현재 55~61행)
- 조건: body/head 일체형 master가 선택되지 않은 기본 코디 경로(`integrated === false`)

```js
var color = p.color || 'honey';
html += '<img class="pgp-base" src="assets/pets/presence-base-' + color + '.webp">';
```

`tone` 계산은 `COLORS[0]`으로 안전하게 fallback하지만, **이미지 URL에는 fallback 전의 원본 `color`가 사용된다.** 이 불일치가 핵심 결함이다.

### 3. 털만 남는 이유

- `art()`는 base `<img>` 뒤에 feather `<img>`를 별도로 만든다.
- CSS에서 base/master는 z-index 1, feather는 z-index 3이다.
- `.pgp-base`를 숨기는 CSS 조건은 없고, 정상 파일이면 보여야 한다.
- 따라서 base URL이 404가 나면 `<img>`는 투명하게 실패하고 feather만 정상 표시된다.

이 현상은 `integratedMaster()`가 빈 문자열을 반환하는 기본 코디에서 재현된다. body/head 일체형 master가 활성화된 상태에서는 feather를 렌더하지 않으므로 "털만 보임" 상태가 나오지 않는다.

## 최소 재현 상태

아래처럼 현재 사용자 로컬 프로필을 만들고 Avatar Studio를 다시 렌더하면 재현된다.

```js
localStorage.setItem('presence_pet_' + uid, JSON.stringify({
  updatedAt: Date.now() + 1,
  color: 'sun',
  feather: 'cloud',
  equipped: {}
}));
renderPetShop();
```

예상 DOM:

```html
<img class="pgp-base" src="assets/pets/presence-base-sun.webp"> <!-- 404 -->
<img class="pgp-feather" src="assets/pets/presence-feather-cloud.png"> <!-- 정상 -->
```

동시에 BODY COLOR 12개 버튼 중 어느 것도 선택 상태(`.on`)가 되지 않는다면 invalid `color` 프로필이라는 추가 진단 신호다.

## 상태 병합이 문제를 지속시키는 조건

`profile()`은 로컬과 원격 중 `updatedAt` 숫자가 큰 한쪽 전체를 선택한다.

```js
raw = Number(local.updatedAt || 0) > Number(remote.updatedAt || 0)
  ? local
  : remote;
```

따라서 다음 상황에서 문제가 계속된다.

1. 유효한 원격 프로필보다 invalid `color`를 가진 로컬 프로필의 `updatedAt`이 더 큼.
2. 로컬에서 색상을 다시 누르기 전까지 새로고침·재로그인해도 같은 로컬 값이 계속 우선됨.
3. 원격 또는 로컬의 `updatedAt`이 ISO 문자열이면 `Number()`가 `NaN`이 되어 의도와 다른 원본이 선택될 수 있음.
4. `normalizeEq()`가 레거시/미공개 body/head를 비우면서 기본 base 경로로 돌아왔을 때, 이전부터 잠복하던 invalid `color`가 처음으로 노출될 수 있음.

## 안전한 마이그레이션 제안

### A. 읽기 단계에서 필드 단위 정규화

프로필 전체를 버리지 말고 `color`, `feather`, `updatedAt`, `equipped`를 각각 정규화한다.

```js
const validColor = COLORS.some(([id]) => id === rawColor);
const validFeather = FEATHERS.some(([id]) => id === rawFeather);

p.color = validColor ? rawColor : COLOR_ALIASES[rawColor] || 'honey';
p.feather = validFeather ? rawFeather : FEATHER_ALIASES[rawFeather] || 'classic';
```

별칭은 실제 과거 데이터에서 확인된 값만 명시적으로 매핑해야 한다. 추정 별칭은 모두 `honey`/`classic`으로 보내는 것이 안전하다. 공백은 `trim()` 후 검증한다.

### B. 렌더 직전 최종 방어

프로필 마이그레이션이 실패해도 `art()`가 invalid ID를 파일명에 넣지 않도록 렌더에서 한 번 더 canonical ID를 계산한다.

```js
const color = COLORS.some(([id]) => id === p.color) ? p.color : 'honey';
const feather = FEATHERS.some(([id]) => id === p.feather) ? p.feather : 'classic';
```

base 이미지 `error` 시 `presence-base-honey.webp`로 즉시 교체하는 최후 fallback도 필요하다. 오류 난 `<img>` 위에 털만 보이는 상태를 사용자에게 절대 노출하지 않아야 한다.

### C. 로컬·원격을 먼저 검증한 뒤 병합

- `updatedAt`은 숫자, 숫자 문자열, ISO 날짜를 모두 timestamp로 바꾼다.
- 최신 레코드가 일부 invalid여도 전체 레코드를 폐기하지 않는다.
- 최신 레코드의 nickname/equipped 등은 유지하고 invalid 필드만 안전값으로 교정한다.
- "최신 invalid 로컬 vs 이전 valid 원격"에서는 최신 데이터를 보존하되 `color`만 교정한다.

### D. 한 번만 저장하는 버전 마이그레이션

`avatarSchemaVersion`을 두고 버전이 낮은 프로필만 1회 교정 저장한다. 렌더마다 DB를 쓰면 여러 탭·여러 기기에서 갱신 경쟁이 생기므로 금지한다.

권장 순서:

1. 로컬/원격 읽기
2. 각 레코드 필드 검증
3. timestamp 비교·병합
4. canonical color/feather/equipped 생성
5. 현재 스키마 버전보다 낮을 때만 로컬·state·DB에 1회 저장
6. 개인값 없이 마이그레이션 건수/사유만 로그

## 회귀 테스트 필수 항목

1. `color` 누락/null/빈 문자열 → honey base 표시
2. `color: 'sun'`, `'#f6cf58'`, `' honey '` → canonical 처리 후 base 표시
3. 12개 현재 color → 각각 존재하는 base 파일 사용
4. invalid feather → classic 처리, base 유지
5. 최신 invalid 로컬 + 이전 valid 원격 → 개인정보/장비 보존, base 정상
6. 최신 invalid 원격 + 이전 valid 로컬 → 개인정보/장비 보존, base 정상
7. ISO `updatedAt`과 숫자 `updatedAt` 비교
8. invalid/미공개 body/head 정리 후 기본 base 경로에서도 본체 표시
9. DOM 불변식: `integrated === false`이면 `.pgp-base`가 성공적으로 로드되어야 함
10. 화면 불변식: feather만 보이는 프레임은 허용하지 않음

## 즉시 확인 체크리스트

- 깨진 사용자에서 콘솔로 `.as-stage .pgp-base`의 `src`, `complete`, `naturalWidth` 확인
- `naturalWidth === 0`이고 URL이 현재 12개 이외 ID라면 본 감사의 원인이 확정됨
- `presenceAvatarProfile().color`가 12개 중 하나인지 확인
- BODY COLOR 버튼 중 `.on`이 정확히 하나인지 확인
- localStorage `presence_pet_<uid>`와 `state.petProfiles[uid]`의 color/updatedAt을 비교

## 우선순위

1. **P0:** `profile()`과 `art()` 양쪽에 canonical color/feather 검증
2. **P0:** base 이미지 로드 실패 fallback
3. **P1:** 로컬/원격 timestamp 정규화와 필드 단위 병합
4. **P1:** 1회성 스키마 마이그레이션 및 회귀 테스트

이 수정은 캐릭터 원화나 CSS를 바꾸는 작업이 아니라, 저장 데이터가 어떤 상태여도 최소 한 마리의 정상 병아리 본체가 반드시 보이게 만드는 데이터 무결성 보강이다.
