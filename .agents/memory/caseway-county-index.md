---
name: Caseway case-insensitive county/state index
description: Why the county landing-page filter needs a functional index, not a plain column index.
---

# Functional index for case-insensitive county/state filter

The county SEO landing pages filter case-insensitively:
`lower(state) = lower($1) AND lower(county) = lower($2)`. A plain b-tree index on the raw
`county` (or `state`) column is **not usable** by Postgres for a `lower(col) = ...` predicate, so it
gives no benefit. The index must match the expression: a functional composite index on
`(lower(state), lower(county))` (Drizzle: `index(name).on(sql\`lower(${t.state})\`, sql\`lower(${t.county})\`)`,
which requires importing `sql` from `drizzle-orm`).

**Why:** an index on `col` and a predicate on `lower(col)` are different expressions; the planner
won't use the former. This was shipped wrong once (plain `attorneys_county_idx`) and caught in review.
**How to apply:** whenever you add an index to speed up a query, confirm the indexed expression is
*identical* to the predicate expression (including any `lower()`/casts). If the query lowercases,
the index must lowercase too — or normalize the stored column instead.
