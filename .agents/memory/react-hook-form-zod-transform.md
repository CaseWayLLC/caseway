---
name: react-hook-form + zod transform pitfall
description: Why a zod .transform() inside a react-hook-form schema breaks the resolver typing.
---

# Don't put `.transform()` in a react-hook-form schema

A zod `.transform()` makes the schema's **input** type differ from its **output** type
(e.g. `z.string().transform(s => s.split(","))` is `string` in, `string[]` out).
`useForm<z.infer<typeof schema>>` uses the output type, but the form fields operate on the
input type, so `zodResolver(schema)` no longer matches the `useForm` generic and you get a
`Resolver<...>` incompatibility error on `control`/`resolver`.

**How to apply:** keep the field as its raw input type in the schema
(`jurisdictions: z.string().min(2)`) and do the transform in the submit handler
(`values.jurisdictions.split(",").map(s => s.trim()).filter(Boolean)`).
