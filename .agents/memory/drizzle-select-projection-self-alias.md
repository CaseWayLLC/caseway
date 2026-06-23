---
name: Drizzle correlated subquery self-alias in SELECT projection
description: Why a correlated count subquery over a self-aliased table silently returns 0 in a SELECT projection, and the literal-qualifier fix.
---

# Drizzle correlated self-alias renders unqualified in SELECT projection

When you build a correlated subquery over a *self-aliased copy of the same table*
and reference the OUTER row via `${table.col}` inside a **SELECT projection**,
Drizzle renders that reference UNQUALIFIED (just `"col"`). Because the inner
FROM aliases the same table (e.g. `... from "attorneys" as r`), the bare `"col"`
binds to the inner alias `r`, not the outer row. The correlation collapses to
`r.referred_by_id = r.id` and matches nothing → every count is silently 0.

The trap: the SAME `${table.col}` reference IS correctly qualified
(`"attorneys"."col"`) in an **ORDER BY** context. So an ORDER BY using the
expression sorts as if it worked, while the SELECTed value is all zeros — a
confusing mismatch where ranking "half works."

**Why:** Drizzle's select-field renderer omits the table qualifier (assumes the
column belongs to the primary table); ORDER BY rendering fully qualifies it.

**How to apply:** In a correlated subquery's WHERE, pin the outer column to a
LITERAL fully-qualified reference, e.g. `"attorneys"."id"`, instead of
`${attorneysTable.id}`. This renders identically in SELECT and ORDER BY.
Caveat: the literal hard-codes the outer table name, so it is only safe when
every caller selects FROM the *unaliased* table. If a caller ever aliases the
outer table, the literal breaks — refactor the helper to take an explicit outer
alias. Detect this class of bug at RUNTIME (typecheck passes); verify the actual
counts with a quick `tsx` repro, not just that the query compiles.
