---
name: Caseway saved & compare lawyers
description: Client-side shortlist/compare feature — localStorage-only, and the nested-interactive event-isolation gotcha.
---

# Saved & compare lawyers (client-side shortlist)

Lets a visitor (no account) bookmark attorneys while browsing and compare them on `/saved`.

**Storage is localStorage-only — there is NO backend/DB for saved lists.** Context/hook in `lib/saved-attorneys.tsx` (key `caseway:saved-attorneys`, array of attorney ids, MAX 50, cross-tab `storage` sync). The `/saved` page re-fetches each id via the public `getAttorney` (useQueries) and drops any that error (removed/unpublished) with `retry: false`. `noindex` + robots `Disallow: /saved`.

**Why:** a shortlist is per-device convenience for clients, not account data; keeping it local avoids auth, schema, and privacy surface for anonymous browsers.

## Gotcha: nested interactive inside a clickable Card needs BOTH pointer AND keyboard isolation

`SaveButton` sits inside `AttorneyCard`'s `Card`, which is itself `role="button"` with `onClick` AND an `onKeyDown` that opens the profile on Enter/Space. Stopping only `onClick` propagation is not enough — a keyboard user activating the bookmark would also trigger the card's keydown and navigate. The button must `stopPropagation()` on `onClick` **and** on `onKeyDown` (Enter/Space).

**How to apply:** any time you nest a button/link inside a clickable card (or any parent with its own key handler), isolate both the click and the keydown, or keyboard users get the parent's action instead of the child's.
