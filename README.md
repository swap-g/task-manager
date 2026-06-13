# Personal Task Manager

A polished single-page task manager built with **Vite + React 18 (JavaScript)**,
wired to **Supabase** for auth, cross-device sync, and real-time updates.

- List / Board (Kanban, drag-and-drop) / Table views — your choice is remembered
- Custom pop-up calendar + time picker, priorities, free-text categories
- Color-coded tags with a per-tag swatch recolorer (colors persist)
- "Risk if not completed" notes + red styling that appear only once a task is due
- Status / Today / Upcoming filters, click-to-filter categories & tags, search
- Completion ring, per-category progress bars, dark/light theme
- Optional browser notifications when a task's due time passes
- Email/password auth with **sign up**, **sign in**, and a **password-reset** flow

The whole UI is one component (`src/TaskManager.jsx`) that talks to storage only
through a backend-agnostic `window.storage` interface, so the Supabase layer can
be swapped without touching the UI.

## Architecture

| File | Role |
| --- | --- |
| `src/supabaseClient.js` | Creates the Supabase client from env vars |
| `src/db.js` | `makeStorage(userId)` → the `window.storage` interface (get/set/delete/list/subscribe), backed by the `app_kv` table + Realtime |
| `src/App.jsx` | Auth gate: sign in / sign up / forgot+reset password; sets `window.storage` then mounts `TaskManager` |
| `src/TaskManager.jsx` | The entire app UI + real-time sync with echo suppression |
| `supabase/schema.sql` | `app_kv` table, RLS policy, Realtime publication |

Two storage keys are used:

- `tasks:v1` — JSON string of the task array
- `prefs:v1` — JSON of `{ dark, view, tagColors, notify }`

## Setup

### 1. Create a Supabase project
Go to [supabase.com](https://supabase.com), create a new project, and wait for it
to finish provisioning.

### 2. Run the schema
In the dashboard: **SQL Editor → New query**, paste the contents of
[`supabase/schema.sql`](supabase/schema.sql), and click **Run**. This creates the
`app_kv` table, enables Row Level Security with an owner-only policy, and adds the
table to the `supabase_realtime` publication.

### 3. Configure environment variables
Copy the example file and fill in your project's values
(**Project Settings → API**):

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### 4. (Optional) Disable email confirmation for quick testing
**Authentication → Providers → Email** → turn **off** "Confirm email" so you can
sign up and sign in immediately without checking your inbox. Turn it back on for
real use.

### 5. Install & run

```bash
npm install
npm run dev
```

Open the printed local URL, create an account, and start adding tasks. Open the
same account in a second browser/device to watch changes sync in real time.

## Password reset

On the sign-in screen, **Forgot password?** sends a reset email via
`supabase.auth.resetPasswordForEmail`. The link returns to the app, which detects
the `PASSWORD_RECOVERY` event and shows a "Set a new password" screen that calls
`supabase.auth.updateUser`. Make sure your site URL and redirect URLs are allowed
under **Authentication → URL Configuration** (add your dev URL, e.g.
`http://localhost:5173`).

## Notes

- `.env` is git-ignored; never commit your keys. The `anon` key is safe for the
  browser because RLS restricts every row to its owner.
- Real-time updates are applied in place: your current view, filters, and scroll
  position are preserved, and a device ignores the echo of its own writes.
