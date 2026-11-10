# Youngwave promotion campaign — revised TL policy review

**Status: source/emulator validated; production rules and financial data unchanged.**

The earlier admin-only node/hash `23fd…` is revoked and is not the publication candidate. The user explicitly approved the revised scope: “네, 이 범위로 권한 추가·검증·운영 반영 승인”. A new root hash review/GO is still required before production publication.

## Purpose and confirmed source

This is a display-only AOP goal, not an actual role promotion or authority change. The source is manually entered **팀 생산성(본드 전)**, stored internally under the `dailyFundraising` basis. No personal Profit, bank `netPayment`, recap, reject model, daily sales × unit rate, or automatic income import is used.

Default weeks: Nov 9–15 and Nov 16–22, 2026; display starts Nov 11. Each week's **net** target is KRW 3,200,000 independently. Default bond deduction is 45%, retaining 55%; admin can edit the deduction from 0% through 100%.

Net is rounded once per week:

```text
round(sum(confirmed daily team production) × (10000 − deduction basis points) / 10000)
```

No week-to-week carry. Target achievement is independent of coverage: a partial week can achieve its target. `overallComplete` means both weeks achieved, not that all 14 dates are entered. Coverage is missing/partial/complete for 0/1–6/7 confirmed dates. Missing amount and explicit confirmed zero remain different.

## Permissions

| Actor | Exact campaign private read | Parent/list read | Day ledger edit | Config edit |
| --- | --- | --- | --- | --- |
| Exact active admin UID | Yes | Yes | Yes | Yes |
| Exact active canonical TL matching stored targetUid | Yes | No | Yes | No |
| Other TL, other team, IC, anonymous, inactive | No | No | No | No |

The actual Firebase auth UID resolves through `authSessions/{auth.uid}/userUid`. The TL must currently have role `TL`, be active, match the campaign's target UID, and still exist in canonical `recapStudioTeams/youngwave/roster`. Campaign team is **youngwave only**. Display name must match the current actual user's name; the target user must be active and actually TL.

`promotionGoalCampaigns/private/admin/{campaignId}` retains its existing proposed path. Admin-only parent reads do not grant TL listing; TL gets only the exact child permission. No grant is added to users, Profit, recap, or other nodes.

TL cannot create/delete a campaign or change target, team, goal-role label, goal, bond rate, dates, display start, enabled state, source/basis, currency, or week count. Server validation compares every config field with its prior value. TL may change only ledger amounts and the required campaign/row revision and writer stamps. Dates and day epochs are immutable for TL.

## Private schema

Flat config: version, revision, targetUid, displayName, goalRoleLabel:'AOP', teamKey:'youngwave', week1Start, weeklyTarget, weekCount:2, displayFrom, currency:'KRW', bondDeductionBps, multiplierBps, thresholdBasis:'net', calcBasis:'dailyFundraising', calculationMode:'bondDeduction', enabled, updatedAt, updatedBy, ledger.

Ledger has exactly d0–d13. Each row contains date, **startsAt** (that date's KST midnight epoch), revision, updatedAt, updatedBy, and optional integer amount. Daily cap is KRW 1,000,000,000, keeping all weekly × basis-point intermediate values within safe integer arithmetic. Unknown fields are rejected at every level.

Config CAS revision increments once for every descendant edit. Changed rows increment their own revision with a fresh current-actor writer stamp; unchanged rows retain theirs. Admin-only settings use admin stamps; TL changes use the actual TL UID. Whole campaign deletion is denied.

Changing a populated period is blocked, including periods containing explicit zero. An empty period may move and regenerate only date/epoch metadata. No amount is silently reassigned or lost.

## Server-side future-day guard

The first row epoch must be Monday KST midnight. Each subsequent row epoch equals d0 + fixed index × 86400000; every epoch is KST-midnight aligned. TL cannot change row date or epoch. An amount is valid only when server `now >= row.startsAt`, including amount zero. Future metadata without an amount is valid, enabling an empty scheduled reservation.

Rules cannot parse a date string into an epoch. The trusted admin helper strictly derives all 14 date strings and epochs from the selected Monday. The server independently enforces the epoch sequence/Monday and TL immutability, so TL cannot backdate a future amount to bypass the guard. Admin identity/date mapping and epoch windows are explicit root-reviewed constraints, not a financial-source fallback.

## Public projection

Only `public/{campaignId}` is readable by active validated sessions, inside the server-time window from displayFrom KST midnight to the exclusive midnight after week 2 ends. Root/public-parent reads are denied. Missing records may return null; existing future/past records are denied even to admin.

Projection contains sanitized goal metadata, startsAt/endsAt, sourceUpdatedAt, overallComplete and weeks w1/w2. Each week has startDate, endDate, targetAmount, optional gross/net, confirmedDays, expectedDays:7, status and achieved. It contains **no private ledger, daily amounts, per-person income, notes or raw source paths**.

Enabled empty reservations are valid: all 14 rows may have no amounts. Their public gross/net keys are omitted, coverage is 0/missing, and the UI shows input pending/em dash. No actual zero amount is synthesized.

## Atomic consistency

The helper sends only a namespaced update:

```js
DB.update('promotionGoalCampaigns', {
  ['private/admin/'+id]: privateRecord,
  ['public/'+id]: enabled ? sanitizedProjection : null
});
```

Private validation requires a matching new public revision/source stamp when enabled; its CAS forces the public record to be updated. Public validation then recomputes both seven-slot gross totals, coverage, once-weekly integer rounding, target achievement and exact config/revision consistency against the atomic private snapshot. This removes duplicate rule expressions without weakening validation. OFF retains private data and atomically removes public data. Private-only edits while enabled, forged public values and public-only deletion while enabled are denied.

## Helper API

`PresencePromotionCampaignCloud` exports:

- `saveConfig(input,previous)` — admin-only. `save` remains an admin-only compatibility alias.
- `saveDay(input,previous)` — admin or exact current canonical target TL; settings immutable. It does not require TL access to recap/roster data: the server verifies canonical membership.
- `subscribeCampaign(id,onValue,onError)` — exact private campaign, for the target TL or admin.
- `subscribeAdmin(onValue,onError)` — administrator parent listing only.
- `subscribePublic(id,onValue,onError)` — exact sanitized public snapshot/null.
- `buildAtomicUpdate`, `project`, `campaignWeeks`, `datesForCampaign`, `dateKey`, `windowForPeriod`, `isAdmin`, `isCampaignWriter`.

Writes require LIVE/Firebase ready and reject preview modes, actor changes, stale UI/base/server revisions and future amounts. No future public readback is used. Subscriber errors clear outputs, and the controller must dispose UI-owned private caches on revocation/logout/preview changes.

## Current evidence and publication gate

Fresh baseline snapshot: `/tmp/promotion-goal-server-before.json`. Root read/write are false and the campaign node is absent. The test merges only this candidate and asserts every existing rule/node unchanged.

**78 security/API checks passed** in the isolated loopback emulator: actual TL compound day write with TL writer stamps and no recap read dependency; exact private read; parent/other TL/create/delete denials; eight immutable config changes; valid TL day/CAS payloads with public windows shifted both earlier and later denied; roster/status revocation; server future zero/positive amounts and epoch backdating denied; plus monetary rounding/coverage/no-carry, empty ON, explicit zero, schema/CAS/atomic OFF and existing actor gates.

**3 focused helper source-date checks passed**: current-day amount accepted; future zero and positive amounts rejected; empty enabled metadata reservation retained.

Future monetary arithmetic examples are tested through pure buildAtomicUpdate/raw synthetic emulator payloads on past-period fixtures. Real save API calls respect current/past-only source policy. There is no production bypass or real financial fixture write.

Candidate insertion-order JSON SHA256:
`6447ddc77d779f4750db33bd9dd410bf7d33e9d503e829c81374fe0d531b3b8c`

Candidate file SHA256:
`a37773f61eb90890954316d1aa60c1e4f369df491b345da51c67798334ba6728`

Helper SHA256:
`2a8d05811a8c06fd8a88aa6c9bc44a174293c85a437d4bb2e87fefd97ad4bb87`

Compact full baseline-plus-candidate size: **259789 bytes**. The exact full merge compiled and passed the emulator suite; this report does not assume a Firestore/Storage size limit applies to RTDB.

Production rules publication completed after explicit user scope approval and root review of this exact object, followed by secure backup, root false/absent-node checks, two immediately fresh unchanged-baseline reads and immediate readback. Only promotionGoalCampaigns was added; every pre-existing rule/node remained deep-equal. ETag was unavailable, so the explicitly approved double-fresh-hash path was used. No campaign seed, sample amount or financial data write occurred. No operating script is added to public source.

Published/readback node insertion SHA: `6447ddc77d779f4750db33bd9dd410bf7d33e9d503e829c81374fe0d531b3b8c`. The identical object sorted-canonical SHA is `6547c27b743d6e42688d5296e80dc8d45acf77b902b68fa68d402838c37f6d00`; their difference is key serialization order only, independently verified before publication. Existing full rules excluding the new node retained sorted-canonical SHA `8b59144a1e0e0a5be7fa258437824e9c7e46ddad8a660c2b8644086c04f0a83b`. Full merged readback SHA: `939158dcfe78d0940c0a00c7eff094429ca7b79568a4ad6fd6b98f5cc03c334b`. Root read/write remained false. Verification completed 2026-11-10T11:34:32Z.

Root P0 window hardening: public startsAt/endsAt may change only for the exact active administrator. Every TL ON compound write must preserve both existing public timestamps; absent ON projection cannot be recreated by TL. OFF public null remains permitted only alongside disabled private config. This supersedes candidate 422845.
