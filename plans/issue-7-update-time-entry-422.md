# Implementation Plan: Fix `update_time_entry` 422 Error (Issue #7)

## Problem Summary

`update_time_entry` always returns a 422 Unprocessable Entity from the FreshBooks API.

**Root Cause:** The FreshBooks time tracking API endpoint uses **PUT** (not PATCH) for updates. PUT semantics require a complete resource body — every required field must be present. The current implementation sends only the user-supplied fields (e.g. `{ note: "updated" }`), leaving out required fields like `started_at`, `duration`, and `is_logged`. The API rejects these incomplete requests with 422.

**Secondary Gap:** The `update_time_entry` tool schema is missing `service_id` as a parameter. This field is present on time entries after creation (set during `create_time_entry`) but is silently dropped on updates, which may also contribute to API rejections and causes user data loss.

---

## Fix Strategy: Fetch-Before-Update (Read-Modify-Write)

Before sending the PUT request, fetch the existing time entry to get its current field values. Merge the caller-supplied fields on top of the fetched values. Send the full merged object in the PUT body. This guarantees all required fields are always present.

---

## Files to Modify

### 1. `src/freshbooks/types.ts`

**What:** Add `service_id` to the `FreshBooksTimeEntry` interface.

**Why:** `service_id` is returned by the FreshBooks API on time entries (it is set during creation) but is currently absent from the type. This causes TypeScript to not track it, and it gets lost on updates.

**Exact change — find this block (lines 195–210):**
```typescript
export interface FreshBooksTimeEntry {
  id: number;
  identity_id: number;
  project_id: number;
  task_id: number | null;
  client_id: number | null;
  is_logged: boolean;
  duration: number; // seconds
  note: string | null;
  started_at: string; // ISO 8601
  created_at: string;
  updated_at: string;
  billable: boolean;
  billed: boolean;
  active: boolean;
}
```

**Replace with:**
```typescript
export interface FreshBooksTimeEntry {
  id: number;
  identity_id: number;
  project_id: number;
  task_id: number | null;
  service_id: number | null;
  client_id: number | null;
  is_logged: boolean;
  duration: number; // seconds
  note: string | null;
  started_at: string; // ISO 8601
  created_at: string;
  updated_at: string;
  billable: boolean;
  billed: boolean;
  active: boolean;
}
```

---

### 2. `src/freshbooks/client.ts`

**What:** Rewrite `updateTimeEntry` to implement fetch-before-update and add `service_id` to the updatable body type.

**Why:** Sending a partial PUT body causes 422. We need to pre-populate all fields from the existing record and overlay only the caller-supplied values.

**Exact change — find this method (lines 512–527):**
```typescript
async updateTimeEntry(timeEntryId: number, body: {
  project_id?: number;
  duration?: number;
  started_at?: string;
  note?: string;
  task_id?: number;
  is_logged?: boolean;
  billable?: boolean;
}): Promise<FreshBooksTimeEntry> {
  await this.ensureIdentity();
  const { data } = await this.http.put(
    `/timetracking/business/${this.businessId}/time_entries/${timeEntryId}`,
    { time_entry: body }
  );
  return data.time_entry;
}
```

**Replace with:**
```typescript
async updateTimeEntry(timeEntryId: number, body: {
  project_id?: number;
  duration?: number;
  started_at?: string;
  note?: string;
  service_id?: number;
  task_id?: number;
  is_logged?: boolean;
  billable?: boolean;
}): Promise<FreshBooksTimeEntry> {
  await this.ensureIdentity();
  const existing = await this.getTimeEntry(timeEntryId);
  const merged = {
    project_id: body.project_id ?? existing.project_id,
    duration: body.duration ?? existing.duration,
    started_at: body.started_at ?? existing.started_at,
    note: body.note !== undefined ? body.note : existing.note,
    service_id: body.service_id !== undefined ? body.service_id : existing.service_id,
    task_id: body.task_id !== undefined ? body.task_id : existing.task_id,
    is_logged: body.is_logged ?? existing.is_logged,
    billable: body.billable ?? existing.billable,
    client_id: existing.client_id,
  };
  const { data } = await this.http.put(
    `/timetracking/business/${this.businessId}/time_entries/${timeEntryId}`,
    { time_entry: merged }
  );
  return data.time_entry;
}
```

**Important implementation notes:**
- `note` and `service_id` and `task_id` use `!== undefined` checks (not `??`) because `null` is a valid value for these fields. Using `??` would incorrectly fall through to the existing value when the caller explicitly passes `null` to clear a field.
- `client_id` is always taken from the existing entry — it is not user-settable on update per the FreshBooks API.
- `project_id` is kept in the body type so callers can move a time entry to a different project if needed.

---

### 3. `src/tools/time-entries.ts`

**What:** Add `service_id` and `is_logged` to the `update_time_entry` MCP tool's parameter schema.

**Why:** `service_id` exists on time entries but was omitted from the update tool's schema, making it impossible for callers to change or preserve this field. `is_logged` was also silently omitted. Both are now supported by the updated `updateTimeEntry` client method.

**Exact change — find this `server.tool` call (lines 76–93):**
```typescript
server.tool(
  'update_time_entry',
  'Update an existing FreshBooks time entry.',
  {
    time_entry_id: z.number().int().positive().describe('The time entry ID to update'),
    duration: z.number().int().positive().optional().describe('New duration in seconds'),
    started_at: z.string().optional().describe('New start time (ISO 8601)'),
    note: z.string().optional().describe('Updated note'),
    task_id: z.number().int().positive().optional(),
    billable: z.boolean().optional(),
  },
  async ({ time_entry_id, ...body }) => {
    const entry = await getClient().updateTimeEntry(time_entry_id, body);
    return {
      content: [{ type: 'text', text: JSON.stringify(entry, null, 2) }],
    };
  }
);
```

**Replace with:**
```typescript
server.tool(
  'update_time_entry',
  'Update an existing FreshBooks time entry.',
  {
    time_entry_id: z.number().int().positive().describe('The time entry ID to update'),
    duration: z.number().int().positive().optional().describe('New duration in seconds'),
    started_at: z.string().optional().describe('New start time as an ISO 8601 datetime string'),
    note: z.string().optional().describe('Updated note / work description'),
    service_id: z.number().int().positive().optional().describe('Updated service ID to associate with this entry'),
    task_id: z.number().int().positive().optional().describe('Updated task ID within the project'),
    billable: z.boolean().optional().describe('Whether this time is billable'),
    is_logged: z.boolean().optional().describe('Whether the time entry is fully logged (as opposed to a running timer)'),
  },
  async ({ time_entry_id, ...body }) => {
    const entry = await getClient().updateTimeEntry(time_entry_id, body);
    return {
      content: [{ type: 'text', text: JSON.stringify(entry, null, 2) }],
    };
  }
);
```

---

## Order of Changes

Apply in this order to avoid TypeScript compile errors mid-way:

1. **`src/freshbooks/types.ts`** — add `service_id` to `FreshBooksTimeEntry`
2. **`src/freshbooks/client.ts`** — rewrite `updateTimeEntry` (depends on `service_id` being in the type)
3. **`src/tools/time-entries.ts`** — add `service_id` and `is_logged` to tool schema (depends on client accepting those fields)

---

## Verification Steps

After applying the changes:

1. **TypeScript compile check:** Run `npx tsc --noEmit` from the project root. Expect zero errors.
2. **Manual end-to-end test (if live credentials available):**
   - Call `create_time_entry` with `project_id`, `duration`, `started_at`, and `service_id`.
   - Note the returned `id`.
   - Call `update_time_entry` with `time_entry_id` set to that `id` and `note: "updated note"` (only that field).
   - Expect a 200 response with the time entry returned, where `note` is changed and all other fields match the original.
3. **Verify `service_id` survives an update:** After the above, call `get_time_entry` with the same ID and confirm `service_id` is still set (not null/dropped).

---

## What This Does NOT Change

- The `create_time_entry` tool — already works correctly.
- The `delete_time_entry` tool — no relation.
- The `list_time_entries` / `get_time_entry` tools — read-only, no relation.
- The HTTP method used (PUT) — this is correct per the FreshBooks API; the fix is the body content, not the method.
- Error handling / response wrapping — kept identical to current behaviour.
