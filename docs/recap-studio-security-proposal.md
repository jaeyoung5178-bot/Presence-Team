# Recap Studio RTDB security implementation

Status: **approved and implemented** in `database.rules.json`. The static security contract passes, and the Firebase RTDB Rules emulator completed **39/39 assertions successfully** on 2026-10-03. `docs/recap-studio-rules.patch` is the exact current `origin/main` diff for the rules file.

## Implemented authorization boundary

1. Resolve the application user with `authSessions/{auth.uid}/userUid`; every permission below also requires `users/{userUid}/status == "active"`.
2. Treat the existing owner identity `userUid == "admin"` as the only ACL/roster administrator.
3. Add `recapStudioAccess/viewers/{uid}` entries with either:
   - `{ scope: "all", updatedAt, updatedBy: "admin" }`, or
   - `{ scope: "team", teamKey: "presence" | "fuse" | "youngwave", updatedAt, updatedBy: "admin" }`.
4. Add `recapStudioTeams/{teamKey}/{roster,weekly,bep}`. The teams root is readable only by active `admin` or `scope == "all"`. A team child is readable only by those identities or a viewer whose `scope == "team"` and whose `teamKey` exactly equals the requested child.
5. `managerAccess` must never grant a Recap Studio ACL/team read.
6. A team-scoped viewer must not use `managerAccess` to read canonical `weeklyProfitRecaps`, `weeklyProfitRecapsPrivate`, `profitMonthlyBep`, or `profitMonthlyBepPrivate` roots. Canonical root read remains available to active `admin` and an active `managerAccess == true` identity only when its Recap ACL scope is not `team`. Existing private self-read remains available.
7. Canonical writes retain existing self writes. Writes by another person are allowed to:
   - active `admin`;
   - an active `managerAccess == true` identity whose Recap ACL scope is not `team`; or
   - an exact team-scoped viewer when the target UID is in that ACL team's reviewed roster and the pay date is inside the roster interval.
8. Mirror writes use the same privileged cases. A self mirror write additionally requires the self UID to be in that mirror team's roster for the effective date. Cross-team and unrostered writes are denied.
9. `activeFrom` and `activeTo` are ISO dates with inclusive boundaries. Missing `activeTo` means open-ended. BEP month authorization uses interval overlap with `[YYYY-MM-01, YYYY-MM-31]` because the existing BEP value path has month—not pay date—granularity.
10. ACL and roster creation, edits, and deletion are admin-only. Roster records carry `{ uid, name, role, activeFrom, activeTo?, reviewedAt, reviewedBy: "admin" }`. Unknown ACL/roster fields are rejected.

## Implemented rule-tree change

```text
+ recapStudioAccess
  + .read: active && (admin || own scope == all)
  + viewers/$uid
    + .read: active && (self || admin || caller scope == all)
    + .write: active admin
    + validate scope/teamKey/admin provenance

+ recapStudioTeams
  + .read: active && (admin || scope == all)
  + $teamKey
    + .read: active && (admin || scope == all || exact team ACL)
    + validate teamKey in presence|fuse|youngwave
    + roster/$uid
      + .write: active admin
      + validate identity + inclusive reviewed interval
    + weekly/$payDate/$uid
      + .write: admin || non-team global manager || rostered self || exact scoped-team + interval
      + validate UID/pay-date binding and recap numeric fields
    + bep/$month/$uid
      + .write: same authority cases, using month/interval overlap
      + validate non-negative number

~ weeklyProfitRecaps/.read
~ weeklyProfitRecapsPrivate/.read and $uid/.read
~ profitMonthlyBep/.read
~ profitMonthlyBepPrivate/.read and $uid/.read
  active admin || (managerAccess && recap scope != team)
  private child additionally retains self-read

~ all four canonical leaf writes
  self || admin || (managerAccess && recap scope != team)
  || (recap scope == team && target is in that exact team's roster for the date)
```

## Verified deny/allow evidence

| Scenario | Expected |
|---|---:|
| Admin reads teams root and every team | Allow |
| `scope=all` active global manager reads root/every team | Allow |
| FUSE TL reads `recapStudioTeams/fuse` | Allow |
| FUSE TL reads Young Wave or teams root | Deny |
| Young Wave TL reads `recapStudioTeams/youngwave` | Allow |
| Young Wave TL reads FUSE or teams root | Deny |
| Ordinary member reads a Studio team | Deny |
| Team-scoped TL with `managerAccess=true` reads canonical root | Deny |
| Ordinary member writes its own canonical recap | Allow |
| Unrostered member writes a team mirror | Deny |
| TL writes ACL or roster | Deny |
| Admin writes valid ACL or roster | Allow |
| FUSE TL writes transfer on inclusive FUSE `activeTo` | Allow |
| FUSE TL writes transfer after FUSE `activeTo` | Deny |
| Young Wave TL writes transfer before Young Wave `activeFrom` | Deny |
| Young Wave TL writes transfer on inclusive Young Wave `activeFrom` | Allow |
| Inactive admin/all identity reads or writes | Deny |

The static contract is run with:

```bash
node scripts/qa-recap-studio-security.mjs
```

The emulator run is recorded in `qa/recap-studio-rules-p0-20261003.log` with 39/39 passing assertions. It covers active/inactive and anonymous identities, exact-team isolation, canonical access, ACL and roster ownership, transfer boundary dates, input validation, and a three-location atomic write with no partial persistence on denial. The application saves canonical public/private records and the authorized team mirror in one root update; reviewed roster data must exist before the first mirror write.
