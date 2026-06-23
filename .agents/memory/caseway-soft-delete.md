---
name: Caseway listing soft-delete (archive/restore)
description: How admin listing deletion is soft-delete + restore, and which reads must exclude archived rows.
---

# Archive / soft-delete

Admin "delete" is a soft delete: it sets `attorneys.archived_at` (timestamp, nullable) instead
of hard-deleting. Restore clears `archived_at`; the listing's `status` is untouched so it returns
to wherever it was (approved/pending/etc.). A separate permanent-delete endpoint hard-deletes, and
is guarded to only act on already-archived rows (so nothing is purged without passing through the
archive first). Admin delete/restore/permanent are NOT owner-scoped (work on ownerless demo/promoted rows).

**Rule:** every public read AND the admin review queue must exclude `archived_at IS NOT NULL` rows.
This is orthogonal to the existing `isDemo`/demo-mode gating — both filters stack. The shared
`approvedVisibleCondition()` helper carries both; direct-condition reads (`/attorneys/:id`,
similar target lookup) and raw-SQL reads (`/stats`, `/counties`, and the `seo.ts` `sitemap.xml`
queries) add `archived_at is null` separately.
`/attorneys/mine` (owner dashboard) also excludes archived so a deleted listing disappears there too.

**Audit gotcha (the easy ones to miss):** the raw-SQL public reads that DON'T go through
`approvedVisibleCondition()` are exactly where the archived filter gets forgotten. `/counties`
(attorneys.ts) and BOTH `sitemap.xml` queries in `routes/seo.ts` (a non-OpenAPI route, so it's
out of sight of the Orval/zod contract) each leaked archived rows into public output until
`and archived_at is null` was added. When auditing visibility, grep every `status = 'approved'`
raw-SQL site and confirm it also has `archived_at is null` AND the demo filter.
**Why:** archived = soft-deleted; it must behave exactly like a hard delete from every reader's POV,
recoverable only from the admin Archived view.

**How to apply:** any NEW read path that returns attorneys must add the archived exclusion, same as
the demo-mode rule. Forget it and soft-deleted listings leak back into public view.

**Cross-tab "jump to listing" gotcha:** archived rows live ONLY in the admin Archived tab; they are
excluded from `/admin/applications`. So any feature that links/jumps from elsewhere (e.g. the admin
Accounts tab listing chips → Applications row) must NOT offer a clickable jump for an archived
listing — it would scroll-target a row that isn't rendered and silently no-op. Render archived
listings as non-clickable (with an "Archived" badge) or route them to the Archived tab instead.

# Owner write-guards must re-check archived in the UPDATE predicate

Owner-scoped mutations (PATCH/resubmit, pause/resume, delete) must put `isNull(archived_at)` in the
**write predicate itself** (the `.where(...)` of the UPDATE/DELETE), not only in a preliminary
ownership SELECT. A SELECT-then-UPDATE leaves a TOCTOU window where a concurrent admin archive
between the two lets the owner still mutate/resubmit/pause an archived listing.
**Why:** archived is admin's authoritative "removed" state; an owner must never be able to revive or
edit it, even under a race. **How to apply:** for any owner-scoped write, stack
`eq(id), eq(ownerId), isNull(archivedAt)` in the same `and(...)` predicate of the write.
