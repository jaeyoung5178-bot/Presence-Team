# Avatar Studio 기본 몸체 소실 회귀 감사

## 결론

“아이템을 선택하면 병아리 몸체가 사라지고 소품만 보이는” 현상은 단순한 CSS 문제보다 **저장된 구버전 프로필 값으로 존재하지 않는 기본 몸체 파일을 조합하는 렌더 경로**에서 가장 명확하게 재현됩니다.

과거 프로필에는 `sun`, `presence`처럼 현재 `COLORS` 목록에 없는 색상 값이 남을 수 있습니다. 이전 렌더러는 값이 비어 있는지만 검사하고 다음 경로를 만들었습니다.

```text
assets/pets/presence-base-{저장된 color}.webp
```

따라서 `color: "sun"`이면 실제로 존재하지 않는 다음 파일을 요청합니다.

```text
assets/pets/presence-base-sun.webp
```

기본 몸체 요청은 실패하지만 `presence-item-ball.webp` 같은 소품 레이어는 정상 로드되므로, 화면에는 소품만 남습니다. 이 현상은 특히 기본 캐릭터 또는 놀이 소품만 선택한 상태에서 직접 드러납니다. 의상·머리 일체형 이미지는 별도의 `presence-pet-*.webp`를 사용하므로 잠시 정상처럼 보이다가 해당 프리셋을 해제하거나 소품 상태로 돌아오면 다시 발생할 수 있습니다.

현재 작업 트리에는 이 경로를 방어하기 위한 `validColor()`, `validFeather()`, 기본 이미지 `onerror` 대체 경로가 추가되어 있습니다. 그러나 현행 `scripts/qa-audit.mjs`는 실제 렌더 HTML, 동적 이미지 경로, 이미지 로드 성공 여부를 검사하지 않으므로 같은 종류의 회귀를 자동으로 막지 못합니다.

## 재현 시나리오

### 재현 1: 구버전 색상 + 놀이 소품

초기 프로필:

```js
{
  color: 'sun',
  feather: 'classic',
  equipped: { prop: 'prop_ball_0' }
}
```

기존 렌더 결과:

```html
<img class="pgp-base" src="assets/pets/presence-base-sun.webp">
<img class="pgp-prop" src="assets/pets/presence-item-ball.webp">
```

예상 네트워크 결과:

- `presence-base-sun.webp`: 404
- `presence-item-ball.webp`: 200

사용자에게 보이는 결과:

- 병아리 몸체 없음
- 비치볼만 표시

### 재현 2: 구버전 색상 + 기본 코디

```js
{
  color: 'presence',
  equipped: {}
}
```

기존 렌더 결과는 `presence-base-presence.webp`를 요청합니다. 이 파일은 없으므로 아바타 전체가 비어 보일 수 있습니다.

### 재현 3: 일체형 프리셋이 문제를 가렸다가 다시 노출

1. 잘못된 `color: 'sun'` 프로필을 불러옵니다.
2. 의상 또는 머리를 선택하면 `presence-pet-raincoat.webp`, `presence-pet-shades.webp` 같은 일체형 master가 보여 정상처럼 보입니다.
3. 프리셋을 해제하거나 놀이 소품만 남깁니다.
4. 렌더러가 다시 `presence-base-sun.webp`를 사용하면서 몸체가 사라집니다.

이 때문에 사용자 입장에서는 “무언가를 눌렀더니 갑자기 몸체가 사라졌다”로 인식됩니다.

## 현재 렌더 구조 감사

파일: `assets/presence-avatar-studio.js`

### 정상 구조

`art()`는 최종적으로 다음 둘 중 하나를 반드시 생성해야 합니다.

- 일체형 의상·머리: `img.pgp-master` 정확히 1개
- 기본 몸체 + 분리 레이어: `img.pgp-base` 정확히 1개

놀이 소품은 기본 몸체 위에 추가되는 `img.pgp-prop`이어야 하며, 기본 몸체를 대체해서는 안 됩니다.

현재 VM 재현에서 생성된 구조는 다음과 같이 정상입니다.

| 선택 | 필수 몸체 | 추가 레이어 |
|---|---|---|
| `body_raincoat_0` | `pgp-master → presence-pet-raincoat.webp` | 없음 |
| `head_shades_0` | `pgp-master → presence-pet-shades.webp` | 없음 |
| `prop_ball_0` | `pgp-base → presence-base-honey.webp` | `pgp-prop → presence-item-ball.webp` |
| `prop_tube_0` | `pgp-base → presence-base-honey.webp` | `pgp-prop → presence-item-tube.webp` |

즉, 현재 문자열 조립 구조는 몸체를 포함합니다. 문제는 이 몸체 `src`가 실제로 로드 가능한 경로인지 기존 테스트가 보장하지 않았다는 점입니다.

### 현재 추가된 방어

현재 작업 트리에는 다음 방어가 들어와 있습니다.

- 허용 목록에 없는 색상은 `honey`로 정규화
- 허용 목록에 없는 털 모양은 `classic`으로 정규화
- 기본 몸체 또는 master 로드 실패 시 `presence-base-honey.png`로 1회 대체
- 프로필 `schemaVersion = 2`

이 방어는 적절하지만 테스트에 고정되지 않으면 추후 카탈로그 확장이나 렌더러 정리 과정에서 쉽게 제거될 수 있습니다.

## 에셋 누락·404 감사

### 현재 공개 렌더가 기대하는 파일

다음 파일 집합을 로컬에서 확인했습니다.

- 기본 색상 12종 `presence-base-*.webp`
- 털 모양 8종 `presence-feather-*.png`
- 공개 의상 master 4종 `presence-pet-{raincoat,leader,floral,swimsuit}.webp`
- 공개 머리 master 3종 `presence-pet-{shades,straw,wig}.webp`
- 공개 놀이 소품 2종 `presence-item-{ball,tube}.webp`
- 의상×머리 fitted master 12종 `presence-fitted-*.webp`

감사 시점에는 위 기대 파일이 모두 존재하며 0바이트 파일도 없습니다. 확인한 대표 WebP는 418×418, 알파 채널 포함 형식입니다.

### 실제로 누락된 동적 경로

다음은 현재 카탈로그에 없는 구버전 값으로만 생성되는 잘못된 경로입니다.

- `presence-base-sun.webp`
- `presence-base-presence.webp`
- 그 밖의 임의 문자열 기반 `presence-base-{unknown}.webp`

이 파일들은 만들어야 할 에셋이 아니라, 렌더 전에 현재 허용 색상으로 마이그레이션해야 하는 데이터입니다.

### 현행 감사가 놓치는 이유

`checkLocalAssets()`는 `index.html`에 정적으로 적힌 `src`와 `href`만 확인합니다. Avatar Studio의 경로는 JavaScript 문자열 조합으로 만들어지므로 현재 검사 대상에 들어가지 않습니다.

또한 “파일 존재”만으로는 다음을 확인할 수 없습니다.

- 브라우저에서 실제 디코딩 가능한지
- `naturalWidth`와 `naturalHeight`가 0이 아닌지
- master가 소품만 든 투명 레이어가 아니라 완성된 캐릭터인지
- CSS 적용 후 몸체가 보이는 크기를 갖는지

## 추가 위험: 렌더러 이중 소유

`index.html` 후반에는 기존 인라인 아바타 렌더러가 남아 있고, 그 뒤 `assets/presence-avatar-studio.js`가 같은 전역 함수들을 다시 덮어씁니다.

대표적으로 다음 전역이 여러 번 정의됩니다.

- `window.presencePetArt`
- `window.petShopAction`
- `window.renderPetShop`

현재는 외부 스크립트가 마지막에 로드되어 최종 소유자가 되지만, 캐시 불일치·스크립트 로드 실패·초기 렌더 타이밍에 따라 구버전 경로가 잠시 또는 계속 사용될 수 있습니다. 단위 테스트가 외부 JS 한 파일만 평가하면 실제 통합 페이지의 최종 전역 소유권 회귀를 잡지 못합니다.

장기적으로는 렌더러를 하나만 남겨야 합니다. 최소한 통합 브라우저 테스트는 모든 스크립트가 로드된 뒤 최종 함수가 생성하는 DOM을 검사해야 합니다.

## `scripts/qa-audit.mjs`에 추가할 회귀 게이트

코드는 이번 감사에서 변경하지 않습니다. 다음 게이트를 추가해야 합니다.

### Gate 1. 모든 선택 결과에 몸체 노드가 정확히 하나 존재

공개 아이템을 한 개씩 장착한 프로필을 만들고 `presencePetArt()` 결과를 검사합니다.

```js
const published = avatarItems.filter((item) =>
  ['body', 'head', 'prop'].includes(item.cat) && item.file !== 'accessory'
);

for (const item of published) {
  const profile = {
    color: 'honey',
    feather: 'classic',
    equipped: { [item.cat]: item.id },
  };
  const html = avatarWindow.presencePetArt(profile);
  const bodyNodes = html.match(/class="[^"]*\bpgp-(?:base|master)\b[^"]*"/g) || [];
  if (bodyNodes.length !== 1) {
    failures.push(`avatar: ${item.id} must render exactly one base/master body`);
  }
}
```

핵심은 아이템 레이어의 존재가 아니라 **몸체 노드 존재를 별도로 보장**하는 것입니다.

### Gate 2. 소품은 몸체를 대체하지 않음

각 `prop`에 대해 다음을 동시에 검사합니다.

- `pgp-base` 1개
- `pgp-prop` 1개
- `pgp-master` 0개
- base가 prop보다 HTML상 먼저 등장

```js
if (!html.includes('pgp-base') || !html.includes('pgp-prop')) {
  failures.push(`avatar: ${item.id} prop preview must retain the base body`);
}
```

### Gate 3. 구버전·오염된 색상 값 정규화

아래 값을 각각 프로필에 넣어 렌더합니다.

```js
[undefined, '', 'sun', 'presence', 'unknown-color']
```

각 결과는 반드시 다음 경로 중 하나를 사용해야 합니다.

- 유효한 `presence-base-{현재 12색}.webp`
- fallback `presence-base-honey.png`

다음 문자열이 결과에 남으면 실패시킵니다.

```text
presence-base-sun.webp
presence-base-presence.webp
presence-base-unknown-color.webp
presence-base-undefined.webp
```

털 모양도 같은 방식으로 `classic` 정규화를 검사해야 합니다.

### Gate 4. JavaScript가 생성한 모든 로컬 에셋 경로 존재 검사

정적 HTML 검사와 별도로 Avatar Studio가 만들 수 있는 경로를 수집합니다.

권장 수집 범위:

- 12색 기본 프로필
- 8개 털 모양
- 공개 body/head/prop 각 단독 선택
- 허용된 fitted body×head 조합
- 각 카드 미리보기 override

각 HTML에서 `src="assets/pets/..."`를 추출하여 다음을 검사합니다.

```js
const absolute = path.resolve(workbookRoot, src);
if (!fs.existsSync(absolute) || fs.statSync(absolute).size === 0) {
  failures.push(`avatar: missing dynamic asset: ${src}`);
}
```

이 게이트는 `checkLocalAssets(index.html)`와 별개여야 합니다.

### Gate 5. 기본/master 이미지에 fallback 존재

`pgp-base`와 `pgp-master`에는 로드 실패 시 기본 PNG로 전환하는 경로가 있어야 합니다. 문자열에 `onerror`가 있는지만 보는 것은 약한 검사지만, Node 기반 감사의 최소 안전망으로 사용할 수 있습니다.

더 강한 검사는 아래 브라우저 게이트에서 수행합니다.

### Gate 6. 공개 master 파일의 최소 품질 메타데이터

파일 존재 외에 다음을 확인해야 합니다.

- 418×418 기준 캔버스
- 0바이트 아님
- 이미지 디코딩 성공
- 알파 채널 포함
- 지나치게 작은 파일은 실패 처리

단순 크기 임계값은 보조 수단일 뿐이며, 최종적으로는 알파 바운딩 박스나 기준 스크린샷 비교가 필요합니다.

### Gate 7. 최종 통합 페이지의 렌더러 소유권

실제 `index.html`을 모두 로드한 뒤 다음을 검사합니다.

- `window.presencePetArt` 존재
- `window.petShopAction` 클릭 후 `#asStage`가 갱신됨
- 최종 DOM이 `.presence-game-pet`과 `.pgp-base` 또는 `.pgp-master`를 포함
- 구버전 인라인 렌더러가 외부 Studio 렌더 결과를 다시 덮어쓰지 않음

이 검사는 VM 단위 테스트만으로는 충분하지 않습니다.

## 브라우저 회귀 테스트 제안

`qa-audit.mjs`의 문자열 검사는 빠른 1차 게이트로 두고, 배포 전에는 실제 브라우저 테스트를 추가해야 합니다.

### 테스트 절차

1. QA 사용자로 Avatar Studio를 엽니다.
2. 저장 프로필에 `color: 'sun'`을 주입한 마이그레이션 fixture를 사용합니다.
3. 기본, 의상, 머리, 비치볼, 튜브를 차례로 선택합니다.
4. 매 선택 후 모든 아바타 이미지의 로딩 완료를 기다립니다.
5. 다음 조건을 검사합니다.

```js
const body = stage.locator('img.pgp-base, img.pgp-master');
await expect(body).toHaveCount(1);
await expect(body).toBeVisible();

const loaded = await body.evaluate((img) =>
  img.complete && img.naturalWidth > 0 && img.naturalHeight > 0
);
expect(loaded).toBeTruthy();
```

6. `page.on('response')` 또는 요청 실패 수집으로 `/assets/pets/`의 404를 실패 처리합니다.
7. 각 상태의 기준 스크린샷을 비교합니다.

### 시각 게이트

DOM에 몸체 이미지가 있어도 완전히 투명하거나 화면 밖이면 사용자에게는 보이지 않습니다. 따라서 각 상태에서 다음을 함께 검사합니다.

- 몸체 `getBoundingClientRect()`의 폭·높이가 0보다 큼
- `display`, `visibility`, `opacity`가 표시 상태
- 스테이지 중심 영역에 기준 스크린샷 대비 충분한 비투명 픽셀이 존재
- prop-only 스크린샷과 base+prop 스크린샷이 확실히 다름

권장 기준 스크린샷:

- 기본 허니
- 레인 코트
- 선글라스
- 허니 + 비치볼
- 허니 + 튜브
- 구버전 `sun` fixture의 자동 honey fallback

## 검수 우선순위

1. 오염된 색상/털 프로필 정규화 게이트
2. 모든 공개 아이템의 base/master 필수 게이트
3. 동적 에셋 존재·0바이트 검사
4. 브라우저 `naturalWidth`·404 검사
5. 기준 스크린샷 비교
6. 인라인·외부 이중 렌더러 통합 정리

## 배포 판정 기준

다음 조건이 모두 충족되어야 통과입니다.

- 기본, body, head, prop 모든 상태에 몸체가 보임
- 놀이 소품 선택 시 몸체와 소품이 동시에 보임
- 구버전 `sun`, `presence` 프로필도 honey 기본 몸체로 복구됨
- 모든 공개 동적 에셋이 존재하고 브라우저에서 디코딩됨
- `/assets/pets/` 요청에 404가 없음
- 새로고침 후에도 동일 상태가 유지됨
- Avatar Studio 카드 미리보기와 좌측 최종 스테이지가 동일한 렌더 규칙을 사용함

현재 에셋 집합 자체에는 공개 렌더 기준 누락이 없었습니다. 이번 회귀의 핵심은 **동적 경로를 만드는 프로필 데이터와 실제 브라우저 렌더 결과를 QA가 검증하지 않았던 것**입니다.
