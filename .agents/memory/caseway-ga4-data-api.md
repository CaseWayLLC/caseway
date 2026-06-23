---
name: Caseway GA4 Data API access
description: How the server reads Google Analytics 4 (property 542202072) — env vars, service-account requirements, and a dependency-free verification technique.
---

# Caseway GA4 Data API (read access)

Live credential env vars (both stored in the `shared` environment):
- `GA4_PROPERTY_ID` — numeric GA4 property id (currently 542202072).
- `GA4_CREDENTIALS_JSON` — the full Google Cloud **service-account** JSON key (raw file contents). Read with `JSON.parse(process.env.GA4_CREDENTIALS_JSON)`.

**Naming gotcha (important):** the obvious-sounding `GA4_SERVICE_ACCOUNT_JSON` is a *secret* that ended up holding a stale/wrong value (a project/property id string, not the key). The agent cannot modify or delete a secret — `setEnvVars`/`deleteEnvVars` only act on env vars and silently leave a same-named secret intact, and `setEnvVars` on that name fails with a "already set up as secrets" conflict. Only the user can remove it via the Secrets UI. To get unblocked we stored the real key under the **new** name `GA4_CREDENTIALS_JSON`. Always use `GA4_CREDENTIALS_JSON`, never `GA4_SERVICE_ACCOUNT_JSON`.

**Requirements for the key to actually return data:**
1. Enable the **Google Analytics Data API** in the Cloud project.
2. Add the service account's **client_email** (`caseway-analytics@prismatic-fact-500013-e3.iam.gserviceaccount.com`) as a **Viewer** under GA Admin → Property access management. Without this, `runReport` returns **403 PERMISSION_DENIED** even though the JWT/token exchange succeeds — it's purely a property-ACL issue, not a bad key.

**Verification (no SDK / no deps):** mint an RS256 JWT with Node `crypto` (claims: `iss`=client_email, `scope`=`https://www.googleapis.com/auth/analytics.readonly`, `aud`=token_uri), exchange it at `https://oauth2.googleapis.com/token` (grant_type `urn:ietf:params:oauth:grant-type:jwt-bearer`), then POST `https://analyticsdata.googleapis.com/v1beta/properties/<id>:runReport`. Run via **bash**, not the code_execution sandbox (sandbox doesn't get project secrets/env and may lack network). Never print `private_key` or `access_token`.

**Why a service account instead of a Replit connector:** there is no Replit managed connector for Google Analytics (catalog has Docs/Drive/Gmail/Sheets/Calendar; the analytics section has PostHog/Amplitude/etc., not GA4). The site already sends data to GA4 via gtag (measurement id G-3H3JLLEK1M) — that's write/collection; this credential is the separate read path.
