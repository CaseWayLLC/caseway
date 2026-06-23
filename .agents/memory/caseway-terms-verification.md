---
name: Caseway terms audit + verification
description: Design constraints for the terms-acceptance audit log, admin verification badge, and contact-message inbox features.
---

- Terms acceptance is stamped SERVER-SIDE (termsAcceptedAt + termsAcceptedIp = req.ip) inside the authenticated attorney create AND the owner PATCH handlers, not sent by the client. The form still strips `agreeToTerms` before building the API body.
- **Why:** acceptance must be a trustworthy server record, and re-submitting the gated form re-affirms the terms, so PATCH re-stamps too.
- **termsAcceptedIp must NEVER be added to the OpenAPI `Attorney` response schema** — admins see the date (`termsAcceptedAt`) only; the IP stays internal. Responses are parsed through generated zod, so adding it to the schema is the only way it could leak.
- barNumber: optional/nullable in the API contract (so admin edits of legacy/demo rows without one don't 400) but REQUIRED client-side in the attorney-form zod for new signups. When adding a required form field, remember to render the actual input control — not just the zod rule + step-trigger field list (a missing input silently blocks step progression).
- isVerified is a manual admin attestation via POST /admin/attorneys/{id}/verify; it is independent of listing review `status` and drives the "Verified by Caseway" badge.
- Contact form: public POST /contact → contact_messages table; admin reads via GET /admin/contact-messages (unhandled first, then newest) + POST .../{id}/handled. No ContactAck zod response export is generated — the handler returns the `{ success: true }` literal directly.
