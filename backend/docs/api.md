# FasalSaathi Backend — API Contract

Base URL (local): `http://localhost:8787`

All responses are JSON. Errors share one envelope:

```json
{ "error": { "code": "string", "message": "string", "details": {} } }
```

`details` is present only for validation errors (Zod field errors).

## Authentication

Every endpoint except `GET /health` requires a Supabase Auth JWT:

```
Authorization: Bearer <supabase_jwt>
```

The client obtains this JWT by signing in through **Supabase Auth with the Google
provider** (handled entirely client-side / by Supabase). The backend VERIFIES the
JWT via `supabase.auth.getUser(token)` and resolves the farmer row keyed by the
auth user id. On first authenticated request, a farmer row is auto-created
(load-or-create) with `onboarding_complete = false`.

Auth failures return `401 { "error": { "code": "unauthorized", ... } }`. The token
and any Aadhaar data are never echoed back.

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
