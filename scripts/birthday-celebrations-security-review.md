# Birthday celebrations: security review for root approval

Status: root-approved security node published and immediate readback verified; no production event/photo/DOB/user data writes. Client UI deployment is a separate gate.

## Fresh server baseline

Read `.settings/rules.json` through the existing Firebase CLI OAuth session (read only). Snapshot: `/tmp/birthday-server-current.json`.

- Root `.read` and `.write` are both boolean `false`.
- `birthdayCelebrations` does not exist in the baseline.
- `privateConfig` grants a broad authenticated-session read. This implementation does not store anything there.
- The emulator merges exactly one new top-level node. Every existing node and both ancestor rules are asserted unchanged.
- Before eventual deployment, fetch the server rules again and require an unchanged baseline; do not replace unrelated rules.

## API and schema

Global `PresenceBirthdayCloud` exposes `dateKey(timestamp?)`, `windowForDate(date)`, `isAdmin(actor)`, `buildAtomicUpdate(input, previous)`, and `save(input, previous)`.

Input includes transport-only `eventId` (1–100 ASCII alphanumeric/underscore/hyphen). The stored private config contains exactly:

```js
{version:1, revision:1, date:'YYYY-MM-DD', targetUid:'actual-account-uid',
 displayName:'name from users/targetUid', enabled:false,
 // faceDataUrl: cropped WebP data URL, optional only while disabled
 // crop: {zoom:1..3, x:0..1, y:0..1}, optional
 updatedAt:Date.now(), updatedBy:'admin'}
```

Private path: `birthdayCelebrations/private/admin/{eventId}`. Only the exact active `admin` UID, resolved by the real Firebase auth UID's existing `authSessions` record, may read this parent or write an event. Deletion is denied. Revision must be integer prior revision + 1 (first write 1). Name must equal the current active target account's name. Unknown fields are denied. Timestamp is limited to server now −5 minutes / +10 seconds.

Public date wrapper: `birthdayCelebrations/public/{date}` contains only `startsAt`, `endsAt`, and optional `events`. Public events contain exactly `version`, `targetUid`, `displayName`, `date`, `faceDataUrl`, and `updatedAt`. Public events must exactly match the atomically updated enabled private config. No crop metadata, notes, DOB, or source image is projected.

A face is mandatory for enabled private configs and all public projections. The server checks a WebP data-URL/base64 signature and a 205000-character maximum. Only the cropped image is persisted.

## Atomic operation

Use `DB.update('birthdayCelebrations', relativeLeafUpdates)`, never a write at database root:

```js
{
 ['private/admin/'+eventId]: config,
 ['public/'+date+'/startsAt']: kstWindow.startsAt,
 ['public/'+date+'/endsAt']: kstWindow.endsAt,
 ['public/'+date+'/events/'+eventId]: sanitizedProjection,
 // On date change:
 ['public/'+oldDate+'/events/'+eventId]: null
}
```

OFF preserves the private config with `enabled:false` and removes the old public event in the same update. A private-only OFF and a public-only deletion while enabled are both denied. Empty date wrappers are retained. Whole date/namespace writes and config deletion receive no write grant.

`save()` requires LIVE, Firebase ready, and exact current admin UID; rereads active admin/target profiles and the existing private revision; derives the display name and stamps immutable fields; then calls only the dedicated namespace update. Server CAS remains authoritative if a concurrent write happens after those reads.

## Date and image limitations for explicit root review

RTDB rules cannot parse a date string into an epoch or decode WebP dimensions. The server enforces a date-shaped key, matching event date, KST-midnight-aligned `startsAt` (`%86400000 == 54000000`), 24-hour duration, and server-now inclusive-start/exclusive-end reads. The client helper strictly validates calendar dates and computes their exact KST window; midnight and leap-day tests pass. A trusted image encoder in the UI must produce the actual 512×512 cropped WebP; raw image bytes must remain in memory only. The rules' format/size checks do not prove decoded dimensions or content.

Missing date reads may return null to active sessions. Root/public-parent reads are denied, and existing past/future date records are unreadable. Time-window reads do not depend on a UI clock.

## Emulator evidence

Run `scripts/test-birthday-celebrations-rules.cjs` with a fresh snapshot at `BIRTHDAY_BASE_RULES` and a loopback emulator at `BIRTHDAY_EMULATOR_URL` (defaults 127.0.0.1:19000). The harness rejects a non-loopback URL. It writes only synthetic emulator data.

52 checks passed: anonymous/member/TL/inactive/forged session denials; forged session creation; admin private parent; public date only; root denials; non-admin writes; no-face ON; oversize/bad-type image; unknown schema/crop/name/target/timestamp errors; CAS; atomic OFF; date-change cleanup; future/past/end-exclusive reads; KST client boundaries; actual helper-generated ON/OFF; stale helper revision; forged admin display name. Existing ancestor/node equality assertions pass.

Node canonical JSON SHA256: `53a2ca296a0d6a9b8faed14f59c3e276c986724a268484ce7e236a23982df5a2`.
Node file SHA256: `b48df5941418d12c2be3425a7d38b4a767557bf009c0ac25f83f1da5f7ca2890`.

The test/helper contain no deployment capability. The separate `birthday-rules-review.cjs` prepares read-only by default and requires explicit apply/reviewed hashes for publication.

## Root-approved publication evidence

Root explicitly approved the no-ETag path. The rules endpoint returned no ETag even with `X-Firebase-ETag:true`. Publication used secure untracked backup, approved node hash, two immediate fresh baseline comparisons, new-node-only merge, PUT, and immediate full readback.

- Backup and readback: `/tmp/birthday-rules-review-1794236591575` (directory mode 0700).
- Full merged sorted-JSON SHA256: `8b59144a1e0e0a5be7fa258437824e9c7e46ddad8a660c2b8644086c04f0a83b`.
- Every pre-existing rule/node sorted-JSON SHA256 before and after: `74903333827f7991e0b9bf657822a270e2c06a7c173251a4937536393445bab0`.
- Approved node insertion-order JSON SHA256 remains `53a2ca296a0d6a9b8faed14f59c3e276c986724a268484ce7e236a23982df5a2` (sorted-node SHA `635c87ce93deba43d454c0843a173993f90867760f333cbdf711c2ffa2d041ab`).
- Root `.read`/`.write` remain false; only `birthdayCelebrations` was added.
- No image/event/user data was created. No Pages/client runtime deployment was performed by this review task.

The client helper was subsequently hardened to reject a stale input draft revision against its provided base revision; the added emulator/API regression passed without modifying the published rule node.
