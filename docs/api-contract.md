# API Extensions for Mobile Parity (Backward Compatible)

## Chat (WebSocket `/chat`)
- **Existing**: `chat:join`, `chat:typing`, `message:new` (unchanged).
- **New**:
  - `chat:presence` (server → clients): `{ userId, status: 'online' | 'offline', timestamp }`.
  - `chat:read` (client → server → room): payload `{ threadId, messageIds?: string[] }`; broadcast `{ threadId, readerId, messageIds: string[], timestamp }`.

## Calling (WebSocket `/calling`)
- Handshake: `auth.userId` (existing behavior).
- Events:
  - `call:incoming` (server → callee): `{ callId, callerId, callType: 'audio' | 'video', sdp }`
  - `call:answer` / `call:answered`: `{ callId, threadId?, sdp }`
  - `call:ice-candidate`: `{ callId, candidate, sdpMid?, sdpMLineIndex? }`
  - `call:reject`, `call:end`, `call:busy`: `{ callId }`
  - Errors: `call:error` (unchanged)

## Matching / Discovery
- **New** `GET /matching/recommendations?city=&skill=&limit=`: returns other users filtered by city/skill (excludes caller).
- **New** `GET /locations/filters`: `{ cities: string[], skills: string[] }` to power map/discover filters.
- Existing `/users`, `/locations/cities` untouched.

## Notifications / Sessions Actions
- Existing REST remains. Reschedule/mark-read endpoints unchanged; clients may optimistically use `chat:read` for receipts.

## Auth / Accessibility
- No breaking changes; login/register endpoints unchanged. Clients may attach accessibility metadata client-side (no backend changes required).
