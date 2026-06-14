# Glido Frontend — Architecture Migration Report
**Prepared for:** Backend Developer  
**Date:** June 2026  
**Purpose:** Documents every frontend change required to migrate Glido from direct Supabase calls to the SRD Express + JWT architecture, and specifies all API endpoints the backend must expose.

---

## 1. Current State — Glido Frontend

Glido is a **Vite + React SPA** (not Next.js). It communicates with the database exclusively through the Supabase JS client, using the anon key stored in environment variables. There is no custom backend — Supabase acts as both the auth provider and the database API.

**Tech stack today:**
- Framework: Vite + React + React Router v6
- Auth: Supabase Auth (`supabase.auth.getSession`, `onAuthStateChange`)
- Database: Direct Supabase PostgREST calls (`supabase.from('table').select(...)`)
- HTTP abstraction: None — all calls go through `supabase` client
- State management: React Context only (no Zustand)
- Backend: None (Supabase is the backend)

**Files that contain Supabase calls (37 files total):**

| File | What it does |
|---|---|
| `src/lib/supabase.ts` | Creates the Supabase client (anon key, URL) |
| `src/contexts/AuthContext.tsx` | Supabase Auth session management |
| `src/contexts/ReceptionAuthContext.tsx` | Secondary auth context for reception staff |
| `src/lib/auth.ts` | Auth helpers |
| `src/lib/db/bookings.ts` | All booking CRUD operations |
| `src/lib/db/slots.ts` | Slot availability queries |
| `src/lib/db/walk-ins.ts` | Walk-in records |
| `src/lib/db/tenants.ts` | Tenant config |
| `src/lib/db/checkin-records.ts` | Check-in log |
| `src/lib/db/cfs-shipments.ts` | Shipment records |
| `src/lib/useTenantInfo.ts` | Tenant info hook |
| `src/pages/StaffLoginPage.tsx` | Staff login using Supabase Auth |
| `src/pages/VisitorLoginPage.tsx` | Visitor login using Supabase Auth |
| `src/pages/ForgotPasswordPage.tsx` | Password reset via Supabase Auth |
| `src/contexts/WizardContext.tsx` | Booking wizard — DB calls |
| `src/contexts/KioskContext.tsx` | Kiosk flow — DB calls |
| + ~21 page/component files | Direct `supabase.from(...)` calls |

---

## 2. Target State — SRD Architecture

The SRD project uses a **Next.js frontend** that never calls the database directly. All data access goes through a custom **Express backend** over a JWT-authenticated REST API.

**Target tech stack:**
- Auth: Custom JWT (HS256, via `jose` library), stored in `localStorage`
- HTTP layer: Centralized `apiClient()` function — attaches Bearer token, handles 401 redirect, deduplicates GET requests
- Fetcher wrappers: `fetcher`, `postFetcher`, `putFetcher`, `deleteFetcher`, `patchFetcher`
- State: Zustand stores with TTL-based caching and in-flight deduplication
- Backend proxy: All API calls use relative paths (`/api/v2/...`) — no hardcoded backend URLs in components

**Key principle:** The browser never holds database credentials. The JWT token is the only credential the frontend manages.

---

## 3. Gap Analysis — What Must Change on the Frontend

### 3.1 New Files to Create

These files do not exist in Glido and must be created from scratch, modelled on the SRD equivalents.

#### `src/lib/api-client.ts`
The single HTTP entry point for all API calls. Responsibilities:
- Reads JWT from `localStorage` (key: `glido_auth_token`)
- Attaches `Authorization: Bearer <token>` to every request
- Uses relative paths (`/api/v2/...`) — Vite dev proxy routes these to Express
- Deduplicates concurrent GET requests using an in-flight Map
- On 401 response: clears token, redirects to `/login`
- On 5xx response: shows a toast error
- On network failure: shows a connection error toast

#### `src/lib/fetcher.ts`
Convenience wrappers around `apiClient`. Must export:
- `fetcher(url, options?)` — GET
- `postFetcher(url, body)` — POST
- `putFetcher(url, body)` — PUT
- `patchFetcher(url, body)` — PATCH
- `deleteFetcher(url)` — DELETE
- `rawFetcher(url, options?)` — for blob/file responses (e.g. report downloads)

#### `src/lib/jwt.ts`
Client-side JWT helpers:
- `decodeJwtPayload(token)` — decodes payload without verifying signature (for instant UI restore on reload)
- `setToken(token | null)` — stores/removes token from `localStorage`
- `getToken()` — retrieves token from `localStorage`

---

### 3.2 Files to Replace — Auth Layer

#### `src/contexts/AuthContext.tsx` — Full Rewrite

Remove all Supabase Auth dependency. The new version must:

1. On mount, read JWT from `localStorage` and decode it locally (no network) to instantly restore the session and prevent the login-page flash
2. Validate expiry from the JWT `exp` claim — clear the token without a network call if expired
3. In the background, call `GET /api/v2/auth/me` to verify the token server-side (catches revocations)
4. Only redirect to `/login` on a definitive 401 — never on network errors or 5xx
5. Expose: `user`, `isAuthenticated`, `isLoading`, `login(email, password)`, `logout()`
6. `login()` must call `POST /api/v2/auth/login`, store the returned JWT, and set the user state
7. `logout()` must clear the token from `localStorage` and redirect to `/login`

The `AuthUser` interface remains the same (`id`, `email`, `role`, `firstName`).

**Remove:** `src/contexts/ReceptionAuthContext.tsx` — consolidate into the single `AuthContext`. Role checking is handled by reading `user.role` from the JWT.

#### `src/pages/StaffLoginPage.tsx` — Minor Edit
Replace `supabase.auth.signInWithPassword(...)` with a call to `login(email, password)` from `useAuth()`. No other structural changes needed.

#### `src/pages/VisitorLoginPage.tsx` — Minor Edit
Same as above — replace Supabase Auth call with `login()` from context.

#### `src/pages/ForgotPasswordPage.tsx` — Depends on Backend
Replace `supabase.auth.resetPasswordForEmail(...)` with `POST /api/v2/auth/forgot-password`. The UI flow stays the same.

#### `src/lib/supabase.ts` — Delete
This file is removed entirely once all consumers are migrated.

---

### 3.3 Files to Replace — Database Layer

All files in `src/lib/db/` currently call Supabase directly. Each function must be rewritten to call the corresponding Express REST endpoint via `fetcher`.

The function signatures stay **identical** — only the implementation changes. This is the key advantage of the existing abstraction: components do not need to change, only the `db/` files.

#### `src/lib/db/bookings.ts`

| Current Supabase function | Replacement call |
|---|---|
| `getBookings()` | `GET /api/v2/bookings` |
| `getBookingsByDateRange(from, to)` | `GET /api/v2/bookings?from=&to=` |
| `getBookingById(id)` | `GET /api/v2/bookings/:id` |
| `getBookingByRef(ref)` | `GET /api/v2/bookings?ref=` |
| `getBookingByRego(rego)` | `GET /api/v2/bookings?rego=&status=scheduled` |
| `findBooking(idOrRef)` | `GET /api/v2/bookings/find?q=` |
| `getTodayBookings()` | `GET /api/v2/bookings?date=today` |
| `getBookingsByDate(date)` | `GET /api/v2/bookings?date=` |
| `getDashboardStats()` | `GET /api/v2/dashboard` |
| `checkInBooking(id)` | `PATCH /api/v2/bookings/:id/checkin` |
| `completeBooking(id, notes?)` | `PATCH /api/v2/bookings/:id/complete` |
| `getBookingsByUserId(userId)` | `GET /api/v2/bookings?userId=` |
| `rescheduleBooking(id, date, start, end)` | `PATCH /api/v2/bookings/:id/reschedule` |
| `cancelBooking(id)` | `PATCH /api/v2/bookings/:id/cancel` |
| `createBooking(input)` | `POST /api/v2/bookings` |
| `getBookingsByGroupRef(groupRef)` | `GET /api/v2/bookings?groupRef=` |

#### `src/lib/db/slots.ts`

| Current | Replacement |
|---|---|
| `getSlots(date)` | `GET /api/v2/slots?date=` |
| `getSlotsByDateRange(from, to)` | `GET /api/v2/slots?from=&to=` |
| `getSlotBusyness(date)` | `GET /api/v2/slots/busyness?date=` |

#### `src/lib/db/walk-ins.ts`

| Current | Replacement |
|---|---|
| `getWalkIns()` | `GET /api/v2/walk-ins` |
| `createWalkIn(input)` | `POST /api/v2/walk-ins` |
| `updateWalkIn(id, updates)` | `PATCH /api/v2/walk-ins/:id` |

#### `src/lib/db/tenants.ts`

| Current | Replacement |
|---|---|
| `getTenant(id)` | `GET /api/v2/tenants/:id` |
| `updateTenant(id, updates)` | `PATCH /api/v2/tenants/:id` |

#### `src/lib/db/checkin-records.ts`

| Current | Replacement |
|---|---|
| `getCheckinRecords(bookingId)` | `GET /api/v2/checkin-records?bookingId=` |
| `createCheckinRecord(input)` | `POST /api/v2/checkin-records` |

#### `src/lib/db/cfs-shipments.ts`

| Current | Replacement |
|---|---|
| `getShipments()` | `GET /api/v2/shipments` |
| `getShipmentByBill(billNumber)` | `GET /api/v2/shipments?billNumber=` |

---

### 3.4 Vite Dev Proxy — `vite.config.ts`

Since Glido is a Vite SPA (not Next.js), there are no server-side API routes. API calls must be proxied to Express during development. Add the following to `vite.config.ts`:

```ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:5000',
      changeOrigin: true,
    }
  }
}
```

In production, Nginx (or the hosting platform) handles the proxy — same pattern as the SRD project.

---

### 3.5 Optional — Zustand Store

The SRD project uses a Zustand store (`useDashboardStore`) to cache dashboard data with a 15-second TTL, preventing duplicate API calls across components.

Glido currently has no equivalent. This is **optional for v1** — React Context is sufficient — but recommended once traffic grows. If added, it should follow the same pattern:
- Single `fetchDashboard()` action
- TTL check before re-fetching
- `_inFlightPromise` deduplication guard
- Single atomic `set()` call

---

## 4. API Endpoints the Backend Must Expose

This is the complete list of endpoints the migrated Glido frontend expects. All endpoints are prefixed `/api/v2/` and require `Authorization: Bearer <token>` except where marked public.

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v2/auth/login` | Public | Email + password → returns `{ success, data: { token, user } }` |
| GET | `/api/v2/auth/me` | Required | Returns current user from JWT |
| POST | `/api/v2/auth/logout` | Required | Invalidates session (optional if stateless JWT) |
| POST | `/api/v2/auth/forgot-password` | Public | Sends reset email |
| POST | `/api/v2/auth/reset-password` | Public | Accepts reset token + new password |

### Bookings
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/v2/bookings` | Required | List bookings — supports query params: `date`, `from`, `to`, `ref`, `rego`, `userId`, `groupRef`, `status` |
| GET | `/api/v2/bookings/find?q=` | Required | Find by ID or reference number |
| GET | `/api/v2/bookings/:id` | Required | Single booking by ID |
| POST | `/api/v2/bookings` | Required | Create booking |
| PATCH | `/api/v2/bookings/:id/checkin` | Required | Mark as checked in |
| PATCH | `/api/v2/bookings/:id/complete` | Required | Mark as completed (accepts `{ notes }` body) |
| PATCH | `/api/v2/bookings/:id/reschedule` | Required | Reschedule (accepts `{ date, startTime, endTime }`) |
| PATCH | `/api/v2/bookings/:id/cancel` | Required | Cancel (only if status = scheduled) |

### Dashboard
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/v2/dashboard` | Required | KPI stats for today — `todaysVisitors`, `checkedIn`, `pending`, `icsHeld`, `recentVisitors` |

### Slots
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/v2/slots` | Required | Slots — supports `date`, `from`, `to` query params |
| GET | `/api/v2/slots/busyness?date=` | Required | Busyness level per slot for a given date |

### Walk-ins
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/v2/walk-ins` | Required | All walk-in records |
| POST | `/api/v2/walk-ins` | Required | Create walk-in |
| PATCH | `/api/v2/walk-ins/:id` | Required | Update walk-in |

### Tenants
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/v2/tenants/:id` | Required | Get tenant config |
| PATCH | `/api/v2/tenants/:id` | Required | Update tenant settings |

### Check-in Records
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/v2/checkin-records?bookingId=` | Required | Records for a booking |
| POST | `/api/v2/checkin-records` | Required | Create check-in record |

### Shipments (CFS)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/v2/shipments` | Required | All shipments |
| GET | `/api/v2/shipments?billNumber=` | Required | Filter by house bill number |

---

## 5. Standard API Response Shape

All endpoints must return the same envelope the SRD backend uses, so the frontend `apiClient` can handle errors consistently:

```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": { "message": "Human-readable message" } }
```

HTTP status codes:
- `200` — success
- `400` — bad request (validation error)
- `401` — unauthenticated (triggers frontend redirect to `/login`)
- `403` — forbidden (wrong role)
- `404` — not found
- `500` — server error (triggers frontend toast)

---

## 6. JWT Token Shape

The frontend decodes the JWT payload client-side (without verifying) to restore the session instantly on page reload. The payload must include:

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "First Last",
  "role": "reception_admin | reception_staff | visitor_registered",
  "exp": 1234567890
}
```

The `role` field drives route guarding (`ReceptionGuard`) and feature visibility throughout the app.

---

## 7. Migration Effort Summary

| Area | Files | Effort |
|---|---|---|
| New files (`api-client`, `fetcher`, `jwt`) | 3 new files | ~3 hrs |
| Auth context rewrite | 2 files (AuthContext, ReceptionAuthContext) | ~3 hrs |
| Login pages (minor edit) | 2 files | ~1 hr |
| `src/lib/db/` rewrites | 6 files | ~1 day |
| Vite proxy config | 1 line | ~15 min |
| Component-level Supabase calls (scattered) | ~21 files | ~4 hrs |
| **Total frontend** | | **~2.5 days** |
| **Backend (Express endpoints)** | | **~5–7 days** |

**The frontend changes are purely mechanical.** Because all database calls are already isolated in `src/lib/db/`, no component logic changes. The migration is: swap the implementation inside each `db/*.ts` function, rewrite `AuthContext`, add the three new lib files, and configure the Vite proxy.

---

*End of report*
