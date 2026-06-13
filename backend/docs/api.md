# FasalSaathi Backend — API Contract

Base URL (local): `http://localhost:8787`

All responses are JSON. Errors share one envelope:

```json
{ "error": { "code": "string", "message": "string", "details": {} } }
```

`details` is present only for validation errors (Zod field errors).

## Authentication

Every endpoint except `GET /health`, `POST /auth/signup`, and `POST /auth/login`
requires a Supabase Auth JWT:

```
Authorization: Bearer <supabase_jwt>
```

There are two ways to obtain that JWT:

1. **Google OAuth (primary):** the client signs in through **Supabase Auth with the
   Google provider** (handled client-side / by Supabase). Signup is **implicit** —
   on the first authenticated request the backend auto-creates the farmer row
   (load-or-create) with `onboarding_complete = false`.
2. **Email/password:** call `POST /auth/signup` then `POST /auth/login` (below).
   These return a Supabase session whose `access_token` is used as the Bearer JWT
   for all other endpoints.

The backend VERIFIES the JWT via `supabase.auth.getUser(token)` and resolves the
farmer row keyed by the auth user id.

Auth failures return `401 { "error": { "code": "unauthorized", ... } }`. The token,
the password, and any Aadhaar data are never echoed back.

---

## POST /auth/signup

Public. Creates an email/password account and returns a session. Intended for
clients that don't use Google sign-in.

This calls the Supabase **admin** `createUser` API with `email_confirm: true`, so
**no confirmation email is sent** — the account is usable immediately. This is a
deliberate DEMO choice; a production build would require email verification.
After creating the auth user it inserts the matching `farmers` row
(`id` = the new auth user id, `onboarding_complete = false`) and then signs in to
return a session.

**Headers:** `Content-Type: application/json`

**Request body:**
```json
{
  "email": "ramesh@example.in",
  "password": "correct-horse-1",
  "full_name": "Ramesh Kumar",
  "phone": "+919812345670"
}
```

Field rules:
- `email` — required; valid email.
- `password` — required; **min 8 characters**. Never logged or returned.
- `full_name` — optional; non-empty string. Stored on the farmer row if present.
- `phone` — optional; Indian format `(+91|0)?[6-9]\d{9}`.

**201** — account created:
```json
{
  "user": {
    "id": "uuid",
    "created_at": "2026-06-13T10:00:00.000Z",
    "updated_at": "2026-06-13T10:00:00.000Z",
    "full_name": "Ramesh Kumar",
    "phone": "+919812345670",
    "preferred_language": "hi",
    "aadhaar_last4": null,
    "farm_lat": null,
    "farm_lng": null,
    "farm_district": null,
    "farm_state": null,
    "farm_village": null,
    "farm_area_value": null,
    "farm_area_unit": null,
    "primary_crops": null,
    "land_record_id": null,
    "onboarding_complete": false
  },
  "session": {
    "access_token": "<supabase_jwt>",
    "refresh_token": "<refresh_token>",
    "expires_at": 1760000000
  }
}
```

`user` is the **safe farmer shape** (same projection as `GET /me`; `aadhaar_enc` and
any plaintext are never present).

**400** — validation error (`code: "validation_error"`), or invalid JSON
(`code: "invalid_json"`).

**409** — email already registered:
```json
{ "error": { "code": "email_taken", "message": "An account with this email already exists" } }
```

---

## POST /auth/login

Public. Verifies email/password via Supabase `signInWithPassword` and returns a
session + the safe farmer. If the farmer row is missing (e.g. a Google-first user
logging in by password), it is created (load-or-create).

**Headers:** `Content-Type: application/json`

**Request body:**
```json
{ "email": "ramesh@example.in", "password": "correct-horse-1" }
```

**200** — same `{ user, session }` shape as `POST /auth/signup`.

**400** — validation error or invalid JSON.

**401** — bad credentials (does not reveal whether the email exists):
```json
{ "error": { "code": "invalid_credentials", "message": "Invalid email or password" } }
```

---

## GET /health

Public. No auth.

**200**
```json
{ "status": "ok", "service": "fasalsaathi-backend", "time": "2026-06-13T10:01:03.300Z" }
```

---

## GET /me

Returns the authenticated farmer's profile in the **safe shape**: Aadhaar is
represented ONLY by `aadhaar_last4`. The encrypted value (`aadhaar_enc`) and any
plaintext are never returned.

**Headers:** `Authorization: Bearer <supabase_jwt>`

**200**
```json
{
  "farmer": {
    "id": "uuid",
    "created_at": "2026-06-13T10:00:00.000Z",
    "updated_at": "2026-06-13T10:00:00.000Z",
    "full_name": "Ramesh Kumar",
    "phone": "+919812345670",
    "preferred_language": "hi",
    "aadhaar_last4": "9012",
    "farm_lat": 19.9975,
    "farm_lng": 73.7898,
    "farm_district": "Nashik",
    "farm_state": "Maharashtra",
    "farm_village": "Pimpalgaon",
    "farm_area_value": 2.5,
    "farm_area_unit": "acre",
    "primary_crops": ["onion", "grapes"],
    "land_record_id": "MH-NSK-DEMO-001",
    "onboarding_complete": true
  }
}
```

**401** — missing/invalid token.

---

## POST /me/profile

Create / complete the authenticated farmer's own profile. Upserts the caller's
own row (always scoped to the verified `auth.uid()`).

If `aadhaar` (12 digits) is supplied it is encrypted at rest (AES-256-GCM) into
`aadhaar_enc` and `aadhaar_last4` is derived. `onboarding_complete` is set to
`true` automatically when all required onboarding fields are present
(`full_name`, `farm_district`, `farm_state`, `farm_area_value`, `farm_area_unit`,
`primary_crops`).

**Headers:** `Authorization: Bearer <supabase_jwt>`, `Content-Type: application/json`

**Request body** (all fields except `full_name` optional):
```json
{
  "full_name": "Ramesh Kumar",
  "phone": "+919812345670",
  "preferred_language": "hi",
  "aadhaar": "123456789012",
  "farm_lat": 19.9975,
  "farm_lng": 73.7898,
  "farm_district": "Nashik",
  "farm_state": "Maharashtra",
  "farm_village": "Pimpalgaon",
  "farm_area_value": 2.5,
  "farm_area_unit": "acre",
  "primary_crops": ["onion", "grapes"],
  "land_record_id": "MH-NSK-DEMO-001"
}
```

Field rules:
- `full_name` — non-empty string (required).
- `phone` — optional; Indian format `(+91|0)?[6-9]\d{9}`.
- `preferred_language` — defaults to `"hi"`.
- `aadhaar` — optional; exactly 12 digits. Never logged or returned.
- `farm_area_unit` — one of `acre`, `hectare`, `bigha`.
- `farm_area_value` — positive number.
- `primary_crops` — array of non-empty strings.

**200** — returns the safe farmer shape (same as `GET /me`).

**400** — validation error:
```json
{ "error": { "code": "validation_error", "message": "Invalid profile payload", "details": { "fieldErrors": { "farm_area_unit": ["Invalid enum value..."] } } } }
```

**401** — missing/invalid token.

---

## PUT /me/profile

Partial update of the authenticated farmer's own profile. Same field rules as
POST, but **every field is optional**. At least one field must be provided.
`onboarding_complete` is recomputed against the merged row.

**Headers:** `Authorization: Bearer <supabase_jwt>`, `Content-Type: application/json`

**Request body** (example):
```json
{ "preferred_language": "mr", "primary_crops": ["soybean"] }
```

**200** — returns the safe farmer shape.

**400** — validation error, or `"No fields to update"` if the body is empty.

**401** — missing/invalid token.
