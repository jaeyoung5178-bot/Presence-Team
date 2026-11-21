# Recap Lab bond rules review

Status: proposed only; production deployment has not occurred.

Path: `recapStudioBonds/{uid}/{month}`. Root listing is active mapped admin only; active mapped owner may list their own historical months. Writes require active mapped admin, or the existing canonical monthly-assignment/status/config-hash self predicate. No client role flag grants access. Existing weekly self predicate has no separate role restriction.

Month root owns paidDate/payoutCents/reviewConfirmed/approvedBy. Nonadmin parent write requires every protected value to equal its stored value, so PUT, deletion, and child PATCH cannot bypass protection. Whole month deletion is denied. Rows forbid unknown fields and paidDate. Snapshot balance and event amount are required integer minor units; signed snapshot/adjustment, nonnegative credit/debit. Updater is mapped auth identity and timestamp is bounded. Dates use format/range checks server-side and strict calendar validation in the pure model.

Fresh complete server-rules snapshot plus only this new node compiled and executed 29 local emulator cases: owner creation/list, other/inactive/forged/parent denial, protected admin metadata PUT/PATCH/removal denial, row paidDate/unknown/fraction/missing amount/negative credit/updater denial, admin metadata, and existing weekly self/TL IC allowed with other-team denied. No production records were read or written by these tests.

Proof:
```json
{
  "newNodeOnly": true,
  "previouslyAbsent": true,
  "rootRead": false,
  "rootWrite": false,
  "existingNodesSHA": "82a3756cfeebc7e8f9691b789b7501ab4f59f261f0d4d541b37ee88ddd86a386",
  "existingAfterSHA": "82a3756cfeebc7e8f9691b789b7501ab4f59f261f0d4d541b37ee88ddd86a386",
  "nodeSortedSHA": "27e83346eec6ca17766898bd5eb59c907c0065c031f5c238d9e62f37ad550865",
  "mergedCompactBytes": 287051,
  "emulatorCases": 29,
  "productionWrites": 0
}
```

OCR: pinned Tesseract.js 6.0.1/core 6.0.0 and eng/kor 1.0.0 are self-hosted, loaded only on explicit OCR use. Synthetic Chrome OCR recognized exact 1,234.50 with real local worker/core/languages, external requests=0, uploads=0. All OCR results remain editable/unconfirmed; missing values remain null. No actual financial/photo values are included in public fixtures.
