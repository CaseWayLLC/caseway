---
name: Orval + react-query codegen gotchas
description: Recurring friction points when consuming Orval-generated react-query hooks and zod schemas in this monorepo.
---

# Orval / react-query / zod codegen gotchas

## Query hooks require `queryKey` in options (react-query v5)
Generated query hooks type their `query` option as the full `UseQueryOptions`, which in
react-query v5 makes `queryKey` **required**. Passing `{ query: { enabled } }` alone fails
typecheck.
**How to apply:** supply it via the generated helper, e.g.
`useGetAttorney(id, { query: { enabled: !!id, queryKey: getGetAttorneyQueryKey(id) } })`.
Helpers are named `get<HookName>QueryKey` and exported from the same barrel.

## Import from the barrel only
Generated code is re-exported from `@workspace/api-client-react` (and `@workspace/api-zod`).
Deep paths like `@workspace/api-client-react/src/generated/api.schemas` are NOT in `exports`
and will fail to resolve. Always import the type/hook from the package root.

## `z.coerce.boolean()` is broken for URL query params
Orval's zod config coerces query booleans with `z.coerce.boolean()`, which treats the string
`"false"` as truthy (any non-empty string is `true`). So `?flag=false` is read as `true`.
**How to apply:** for boolean query filters, read the raw value in the route
(`req.query.flag === "true"`) instead of trusting the coerced zod value.

## Path param + query param on one endpoint → Orval type collision
Defining both a path param and a query param on the same operation can generate two
conflicting `<Operation>Params` types (TS2308). If a query param is optional/cosmetic
(e.g. a `limit`), drop it from the spec and handle it server-side.

## After editing openapi.yaml
Run `pnpm --filter @workspace/api-spec run codegen` before relying on new hooks/schemas.
Do not change `info.title` — it controls generated filenames.
