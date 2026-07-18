# Avatar Studio 코스튬·아이템 중복 전수 감사

검수 범위: `assets/presence-avatar-studio.js`, `index.html`, `assets/pets/` 전체 176개 파일  
검수 기준: 카탈로그 ID/이름 → 실제 asset reference → 최종 렌더 경로 → SHA-256 → 65×65 알파 합성 dHash

## 결론

사용자가 본 중복은 착각이 아니라 **카탈로그 생성 방식의 구조적 중복**이었다. 기존 구현은 서로 다른 원화를 추가한 것이 아니라, 동일한 원화 한 장에 색상명과 CSS 필터만 바꾸어 별도 아이템처럼 등록했다.

- 전체 카탈로그: 172개 이름 → 실제 원화 key 25개
- 공개 카탈로그: 84개 이름 → 실제 원화 key 9개
- body/head는 일체형 master 렌더에서 색상 필터가 적용되지 않아 이름만 다르고 화면은 완전히 같았다.
- prop/accessory는 필터 색은 달랐지만 실루엣·디테일·착용 위치는 동일했다. 이것은 새 아이템이 아니라 같은 아이템의 색상 옵션이다.
- 4개 body × 3개 head의 조합은 이름 기준 1,152개 조합이 가능했지만 실제 출력은 12개 fitted master뿐이었다. 각 master마다 96개 이름 조합이 똑같은 이미지로 수렴했다.

따라서 “원화 1개 = 카탈로그 항목 1개”로 통합하고, 색상은 아이템 이름이 아닌 해당 아이템 안의 별도 색상 선택 옵션으로 다루는 것이 맞다.

## 1. 정확한 중복 그룹 — 공개 항목

| 슬롯 | 실제 asset key | 중복 ID 범위 | 이름 수 | 이름 패턴 | 실제 화면 |
|---|---|---:|---:|---|---|
| body | `item:raincoat` | `body_raincoat_0…7` | 8 | 오리지널/루비/오렌지/라임/에메랄드/오션/인디고/바이올렛 레인 코트 | 8개 모두 같은 `presence-pet-raincoat.webp` |
| body | `item:leader` | `body_leader_0…7` | 8 | 동일 8색 리더 재킷 | 8개 모두 같은 `presence-pet-leader.webp` |
| body | `item:floral` | `body_floral_0…7` | 8 | 동일 8색 플로럴 원피스 | 8개 모두 같은 `presence-pet-floral.webp` |
| body | `item:swimsuit` | `body_swimsuit_0…7` | 8 | 동일 8색 스윔 수트 | 8개 모두 같은 `presence-pet-swimsuit.webp` |
| head | `item:shades` | `head_shades_0…11` | 12 | 오리지널부터 나이트까지 12색 선글라스 | 12개 모두 같은 `presence-pet-shades.webp` |
| head | `item:straw` | `head_straw_0…11` | 12 | 동일 12색 밀짚모자 | 12개 모두 같은 `presence-pet-straw.webp` |
| head | `item:wig` | `head_wig_0…11` | 12 | 동일 12색 스타일 헤어 | 12개 모두 같은 `presence-pet-wig.webp` |
| prop | `item:ball` | `prop_ball_0…7` | 8 | 동일 8색 비치볼 | 같은 원화 + 필터만 변경 |
| prop | `item:tube` | `prop_tube_0…7` | 8 | 동일 8색 스윔 튜브 | 같은 원화 + 필터만 변경 |

공개 영역에서만 84개 카드 중 75개가 새 원화 없이 만들어진 반복 항목이었다. body 32개는 실제 의상 4종, head 36개는 실제 머리 장식 3종, prop 16개는 실제 소품 2종이다.

## 2. 정확한 중복 그룹 — 품질 대기/비공개 항목

| 슬롯 | 실제 asset key | 중복 ID 범위 | 이름 수 |
|---|---|---:|---:|
| weapon | `accessory:watergun` | `weapon_watergun_0…7` | 8 |
| weapon | `accessory:sword` | `weapon_sword_0…7` | 8 |
| weapon | `accessory:wand` | `weapon_wand_0…7` | 8 |
| weapon | `accessory:shield` | `weapon_shield_0…7` | 8 |
| back | `accessory:backpack` | `back_backpack_0…5` | 6 |
| back | `accessory:cape` | `back_cape_0…5` | 6 |
| neck | `accessory:medal` | `neck_medal_0…5` | 6 |
| neck | `accessory:pearls` | `neck_pearls_0…5` | 6 |
| wrist | `accessory:friendship` | `wrist_friendship_0…3` | 4 |
| wrist | `accessory:watch` | `wrist_watch_0…3` | 4 |
| wrist | `accessory:sportband` | `wrist_sportband_0…3` | 4 |
| wrist | `accessory:flowers` | `wrist_flowers_0…3` | 4 |
| feet | `accessory:rainboots` | `feet_rainboots_0…3` | 4 |
| feet | `accessory:winged-sneakers` | `feet_winged-sneakers_0…3` | 4 |
| feet | `accessory:hero-boots` | `feet_hero-boots_0…3` | 4 |
| waist | `accessory:utility-belt` | `waist_utility-belt_0…3` | 4 |

이 16개 그룹도 이름과 필터만 다르고 각 그룹당 실제 원화는 한 장이다. 현재 품질 게이트 때문에 공개되지는 않지만, 다시 공개하기 전 동일 정책으로 정리해야 한다.

## 3. 렌더 경로가 중복을 더 심하게 만든 이유

기존 `addVariants()`는 같은 `asset`을 유지한 채 ID, 이름, `filter`만 바꿨다. 그러나 `art()`의 body/head 렌더는 `itemLayer()`가 아니라 `integratedMaster()`를 사용했다.

```text
body_leader_0…7
  -> asset = leader
  -> integratedMaster()
  -> presence-pet-leader.webp
  -> item.filter는 적용되지 않음
```

head도 동일하다. body와 head를 함께 고르면 `presence-fitted-{body}-{head}.webp` 한 장으로 치환되므로 양쪽 tone 이름은 모두 사라진다. 이 때문에 사용자는 다른 이름을 눌러도 이미지가 전혀 바뀌지 않았다.

prop과 accessory는 `filter`가 적용되어 색조는 달라질 수 있지만, 새 디자인·새 실루엣·새 착장으로 볼 수 없다. 색상 옵션을 별도 아이템 수로 부풀린 문제다.

## 4. 파일 해시·시각 유사성 결과

### SHA-256

- `assets/pets/` 파일 수: 176
- SHA-256 고유 해시: 176
- byte-identical 파일 그룹: 0

이는 중복이 없다는 뜻이 아니다. PNG와 WebP는 같은 원화를 다른 압축 형식으로 저장하면 바이트 해시가 달라진다. 또한 이번 핵심 중복은 파일 복사가 아니라 **여러 이름과 ID가 하나의 동일 파일 경로를 참조하는 매핑 중복**이다.

### perceptual dHash

- 같은 stem의 PNG/WebP 쌍: 76쌍
- 65×65 알파 합성 dHash가 완전히 동일한 쌍: 54쌍
- 전체 76쌍 모두 비트 일치율 98.8% 이상

PNG는 편집/알파 원본, WebP는 런타임 최적화본인 경우가 많으므로 이 쌍을 무조건 삭제해서는 안 된다. 다만 카탈로그가 둘을 서로 다른 아이템으로 세면 안 된다.

현재 공개 렌더에 직접 사용되는 canonical 9개 원화와 body/head 조합 master 12개를 비교한 결과, 서로 다른 asset 이름끼리 byte-identical 파일은 없었다. 알파 영역을 기준으로 정규화한 형태 dHash에서도 동일 원화로 볼 수준의 쌍은 발견되지 않았다. 즉 **진짜 서로 다른 원화 9개를 하나씩만 노출하는 정책은 안전하다.**

## 5. 제거·통합 권고

1. **원화 1개 = 아이템 1개**
   - `body_leader_0`만 canonical로 남기고 `_1…7`은 제거한다.
   - head, prop, accessory도 같은 방식으로 통합한다.

2. **색상은 variant가 아니라 item option**
   - 카드 하나를 누른 뒤 `COLOR` swatch를 고르게 한다.
   - 색상별로 독립 원화가 있고 착장 QA를 통과한 경우에만 별도 색상을 지원한다.
   - CSS hue filter만으로 만든 색은 아이템 수에 포함하지 않는다.

3. **`artKey`와 visual signature를 품질 게이트에 사용**
   - `artKey = fileType + ':' + asset`이 중복이면 빌드/QA를 실패시킨다.
   - body/head 조합은 최종 master 경로까지 포함한 `renderSignature`로 검사한다.

4. **레거시 ID 자동 통합**
   - `body_leader_7` 같은 기존 선택은 `body_leader_0`으로 마이그레이션한다.
   - 사용자의 기존 착장 상태가 기본값으로 사라지지 않도록 변환 후 저장한다.

5. **PNG/WebP는 역할을 명시**
   - PNG는 `source/` 또는 `work/`, WebP는 `runtime/`처럼 분리한다.
   - 같은 stem의 두 형식을 카탈로그가 동시에 참조하지 않도록 검사한다.

6. **새 아이템 등록 승인 기준**
   - 고유 원화/고유 실루엣/고유 착장 위치 중 최소 하나가 명확해야 한다.
   - 이름만 변경, CSS 필터만 변경, crop만 변경한 것은 새 아이템으로 승인하지 않는다.
   - 정면 카드뿐 아니라 실제 stage·닭장·모바일 축소 상태에서 검수한다.

## 6. 현재 작업본 판정

현재 작업본은 `addVariants()`를 `addUniqueItems()`로 교체해 다음 상태다.

- 전체 canonical ID: 25개
- 공개 canonical ID: 9개 (`body 4 + head 3 + prop 2`)
- 공개 `artKey`: 9개, 중복 0개
- 비공개 품질 대기: 16개
- 기존 tone suffix ID는 `_0` canonical ID로 복원 가능

이 방향은 정확하다. 다만 배포 전에는 아래 회귀 검수가 필요하다.

- 기존 `_1…11` 저장값이 `_0`으로 복원되는지
- 공개 카드 수가 9개인지
- 카드 이름과 실제 이미지가 1:1로 대응하는지
- 선택·새로고침·다른 기기 복원 후에도 canonical ID가 유지되는지
- body/head 조합 12개가 각기 올바른 fitted master를 사용하는지
- 비공개 accessory가 사용자 저장 데이터에서 삭제되지 않는지

