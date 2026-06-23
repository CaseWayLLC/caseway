---
name: Orval request-body type vs zod-body name
description: Which generated identifier is the TS type for a POST body vs the zod schema in this repo's codegen.
---

For a POST operation, the generated **TypeScript request-body type** is the OpenAPI
*schema* name (e.g. body `$ref: EventInput` → import `type EventInput`), NOT
`<OperationId>Body`. The `<OperationId>Body` identifier (e.g. `TrackEventBody`) is the
**zod** export, not a TS type — importing it as a type fails.

**Why:** Assuming the `<Operation>Body` convention for the TS type cost a typecheck
cycle on the analytics tracker (`TrackEventBody` does not exist as a type;
`EventInput` does).

**How to apply:** When wiring a generated mutation's body type on the frontend, use
the request schema's name from `openapi.yaml` (`type EventInput`), and pass the
mutation as `mutate({ data })`. Verify by grepping `api.schemas.ts` for
`interface <SchemaName>` before importing.
