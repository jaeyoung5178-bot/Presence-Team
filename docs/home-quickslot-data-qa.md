# Home 퀵슬롯 데이터 무결성 검수

검수 범위: `assets/presence-home-quickslots.js`, `index.html`의 홈 검색·탭 이동 코드

## 결론

기본 구조는 안전하다. 퀵슬롯은 UID별 localStorage key와 원격 DB path를 사용하고, 추가 시 중복을 막으며, 저장 전 권한이 없는 탭·알 수 없는 탭·중복 항목을 제거하고 최대 8개로 제한한다. 검색 결과 클릭도 기능은 `goTab()`, 팀원은 `openMember()`로 연결된다.

다만 로컬과 원격 데이터에 버전 또는 `updatedAt`이 없어 원격 배열이 무조건 로컬을 덮어쓴다. 오프라인에서 만든 최신 퀵슬롯이 오래된 원격 배열에 의해 사라질 수 있다. 또한 동일 사용자가 로그아웃 후 같은 페이지에서 다시 로그인하면 `loadedUid` 때문에 재동기화하지 않는 문제, TABMETA 준비 전 `clean()`이 실행될 때 유효 슬롯을 빈 목록으로 판단할 수 있는 초기화 순서 문제가 있다.

## 1. 사용자별 저장 분리

### 로컬

`presence_home_quickslots_<uid>` 형식으로 저장한다 (`presence-home-quickslots.js:5-6`). 서로 다른 UID는 다른 key를 사용하므로 일반적인 계정 전환에서 퀵슬롯이 섞이지 않는다.

### 원격

`userPreferences/<uid>/quickSlots`에 배열을 저장한다 (`:9-10`). 원격 경로도 UID별로 분리되어 있다.

### 남은 경계 사례

- `save()` 자체에는 UID 필수 guard가 없다. 로그아웃 직후 남아 있는 전역 함수가 호출되면 `presence_home_quickslots_`와 `state.userPreferences['']`에 쓸 수 있다. UI에서는 uid가 없으면 render를 중단하므로 정상 사용에서는 드물지만 저장 함수에서도 차단해야 한다.
- `uid()`는 `window.me&&me.uid`를 사용한다. `window.me.uid`로 일관되게 접근하는 편이 전역 lexical binding 차이에 안전하다.
- `loadedUid`는 로그아웃 때 초기화되지 않는다. 같은 UID가 다시 로그인하면 `load()`가 `u===loadedUid`에서 종료되어 로컬·원격을 다시 읽지 않는다.
- 사용자 A의 원격 요청이 늦게 도착한 동안 B로 전환하는 경우에는 callback의 `if(u!==uid())return`이 교차 오염을 막는다. 이 부분은 적절하다.

## 2. 로컬·원격 병합 문제 (P0)

현재 load 순서는 다음과 같다.

1. localStorage 배열을 즉시 읽음
2. 원격 `quickSlots` 배열을 비동기로 읽음
3. 원격이 배열이면 시각 또는 버전 비교 없이 항상 slots와 localStorage를 덮어씀

`save()`는 메모리 `state.userPreferences[uid].updatedAt`만 만들고, 원격에는 배열만 저장한다. localStorage에도 배열만 저장한다. 따라서 어느 데이터가 최신인지 판별할 수 없다.

발생 가능한 손실:

- 오프라인에서 로컬 퀵슬롯 편집
- 다음 접속 때 오래된 원격 배열 수신
- 원격 배열이 최신 로컬 배열을 덮어씀

권고 모델:

```text
{
  version: 1,
  uid: "...",
  slots: ["today", "oneonone"],
  updatedAt: 178...
}
```

로컬과 원격 모두 같은 객체를 저장하고 `updatedAt`이 큰 쪽을 선택해야 한다. 선택한 최신 값을 오래된 저장소에 다시 쓰는 양방향 reconciliation이 필요하다. DB 저장 Promise 실패도 UI에 `로컬에만 저장됨`으로 표시해야 한다.

## 3. 초기화 순서 문제 (P1)

`clean()`은 `visible(k)`를 호출하고, `visible()`은 TABMETA가 없으면 false를 반환한다 (`:7-8`). 그런데 `load()`는 UID가 생기면 `loadedUid`를 먼저 기록한 뒤 local/remote 목록을 clean한다 (`:10`).

첫 boot 시 TABMETA 또는 권한 함수가 아직 준비되지 않았다면:

- 모든 로컬 슬롯이 일시적으로 무효 처리됨
- `loadedUid`가 이미 설정되어 재시도하지 않음
- 원격 응답도 너무 빨리 오면 빈 목록으로 clean한 뒤 localStorage를 빈 배열로 덮어쓸 수 있음

권고: `TABMETA`, `tabVisible`, `goTab`, 사용자 정보가 모두 준비된 뒤에만 loadedUid를 확정한다. 준비되지 않았으면 load 상태를 `pending`으로 두고 다음 boot에서 재시도해야 한다.

## 4. 중복·추가·삭제·순서 변경

### 정상 동작

- `clean()`의 `seen`으로 중복 제거 (`:8`)
- `addHomeQuickslot()`에서도 `slots.indexOf(k)>=0`로 중복 추가 차단 (`:20`)
- 최대 8개 제한을 clean과 add 양쪽에서 적용
- 존재하지 않거나 현재 역할에서 볼 수 없는 탭 제거
- move는 배열 범위를 검사한 뒤 swap하고 저장 (`:16`)
- remove는 해당 index를 splice한 뒤 저장 (`:17`)

### 개선 필요

- 역할이 바뀐 뒤 이미 메모리에 올라온 슬롯은 `render()`에서 다시 clean하지 않는다. 버튼은 보이지만 `openHomeQuickslot()`의 visible guard 때문에 눌러도 이동하지 않는 dead slot이 될 수 있다. boot의 load가 같은 UID에 대해 재실행되지 않아 계속 남을 수 있다.
- `removeHomeQuickslot(-1)` 같은 잘못된 전역 호출은 마지막 항목을 지운다. 화면이 만드는 index는 정상이나 함수 자체에서도 정수·범위 guard가 있어야 한다.
- 이동·삭제는 UI 결과만 바뀌고 원격 실패가 표시되지 않는다.
- picker에서 이미 추가된 항목은 `added` 스타일만 붙을 뿐 실제 disabled 속성이 없다. 함수 guard가 중복 저장은 막지만 사용자는 클릭이 무반응이라고 느낄 수 있다.

권고: render 시작 시 `slots=clean(slots)`를 수행하고, remove/move에서 index 검증, picker의 기존 항목에 `disabled aria-disabled=true`, 저장 상태 표시를 추가한다.

## 5. 검색 결과와 클릭 동작

퀵슬롯 검색창은 독자 검색을 하지 않고 기존 홈 검색 모달에 query를 전달한다 (`:21`).

흐름:

1. 퀵슬롯 검색어 읽기
2. `hsOpen()`으로 홈 검색 모달 열기
3. 20ms 후 `hsInput`에 검색어 복사
4. `hsRender()` 실행

기능 결과 클릭은 `hsGo(k)` → `hsClose()` → `goTab(k)`이다 (`index.html:9215`). `hsSearch()`가 `tabVisible(k)`로 먼저 필터하고, `goTab()`도 다시 `tabVisible()` 권한 guard를 적용하므로 권한 우회 가능성은 낮다.

팀원 결과는 관리자에게만 만들어지고 클릭 시 `hsGoUser(name)` → `openMember(name)`로 이동한다 (`index.html:9191-9196, 9208, 9213`).

검색 데이터 무결성 문제:

- 빈 검색어의 최근 탭은 전역 localStorage key `recentTabs`를 사용한다 (`index.html:9178`, 저장은 `8544-8546`). 같은 기기의 여러 사용자가 최근 탭 기록을 공유한다.
- 권한 필터 때문에 금지 탭이 열리지는 않지만, 다른 사용자의 사용 습관이 추천 순서에 섞인다.
- 20ms 전달 방식은 DOM 생성 지연에 의존한다. 저사양 기기에서 모달 input이 아직 없으면 검색어가 전달되지 않는다.

권고: 최근 탭 key도 `recentTabs_<uid>`로 분리하고, 검색 modal 준비 완료 callback 또는 동기 `hsOpen(query)` API를 만들어 timeout 의존을 제거한다.

## 6. 예외 처리와 저장 신뢰도

localStorage와 DB 호출의 예외를 모두 빈 catch로 삼킨다. 따라서 quota 초과, 브라우저 저장 차단, DB 권한 오류, 네트워크 오류가 발생해도 화면은 저장된 것처럼 보인다.

권고 상태:

- `saving`: 변경 직후
- `synced`: local + remote 성공
- `local-only`: local 성공, remote 실패/오프라인
- `error`: local도 실패

추가 toast만 성공처럼 표시하는 현재 방식보다, Home 편집 버튼 옆에 작은 지속 상태를 두는 편이 정확하다.

## 7. 배포 전 회귀 테스트

1. A 계정 3개 저장 → 로그아웃 → B 계정은 빈 목록 또는 B의 목록
2. A로 재로그인 → 반드시 local/remote 재동기화
3. A 원격 요청 중 B 전환 → A 결과가 B에 들어오지 않음
4. 같은 기능 두 번 클릭 → 1개만 존재
5. 8개 이후 추가 → 9번째 추가 차단 및 이유 표시
6. 첫·중간·마지막 삭제 → 정확한 항목만 제거
7. 좌우 이동 경계 → 첫 항목 왼쪽, 마지막 오른쪽 이동 차단
8. 역할 강등 후 새로고침 없이 render → 접근 불가 슬롯 즉시 제거 또는 별도 안내
9. 오프라인 로컬 편집 후 오래된 remote 연결 → 최신 local 유지
10. remote가 최신이면 local을 remote로 갱신
11. TABMETA 준비 전 boot → 저장 목록이 빈 배열로 덮이지 않음
12. 검색 기능 결과 클릭 → 정확한 탭, 검색 팀원 클릭 → 정확한 팀원
13. 검색 결과의 모든 탭이 현재 사용자 권한 내인지 확인
14. 같은 기기 A/B의 최근 탭 추천이 서로 분리됨
15. localStorage 차단·DB 실패 시 저장 상태가 명확히 표시됨

## 우선순위

1. P0: local/remote에 동일한 versioned object 저장, updatedAt 기준 병합
2. P1: logout/same-UID relogin에서 loadedUid 초기화 및 재동기화
3. P1: TABMETA 준비 전 clean 방지
4. P1: 저장 실패 상태 표시
5. P2: recentTabs UID 분리
6. P2: render 시 권한 재검증, picker disabled·index guard

