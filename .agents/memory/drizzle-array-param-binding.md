---
name: Drizzle array param binding in sql`` templates
description: How to bind a JS array as a single Postgres array parameter inside a raw drizzle sql`` template (node-postgres).
---

Interpolating a JS array directly into a drizzle `sql\`\`` template does NOT bind
a single Postgres array param — it expands to a comma-separated tuple of params.
So `sql\`unnest(${jsArray}::text[])\`` becomes `unnest(($4,$5,$6)::text[])`, a
record/row cast that fails at runtime (typecheck passes — it only fails when the
query executes).

**Fix:** build an explicit `ARRAY[...]` literal with `sql.join`:
```ts
const arr = jsArray.length > 0
  ? sql`ARRAY[${sql.join(jsArray.map((v) => sql`${v}`), sql`, `)}]::text[]`
  : sql`ARRAY[]::text[]`;
// then: sql`... unnest(${arr}) ...`
```
Each element is still a bound param, so it stays injection-safe.

**Why:** drizzle treats array values in `sql\`\`` as a param list (the same
expansion `inArray` relies on), not as one array-typed param. The pg driver
*would* serialize a JS array to a Postgres array literal, but drizzle never hands
it the array as a single value.

**How to apply:** any time you need a Postgres array parameter (`unnest`, `= ANY`,
`&&`, `@>`, array intersection) inside a raw `sql\`\`` fragment. Note a single
scalar is fine: `@> ARRAY[${scalar}]::text[]` works because `scalar` is not an
array. Verify array-param queries by actually executing them (curl/integration),
not just typechecking.
