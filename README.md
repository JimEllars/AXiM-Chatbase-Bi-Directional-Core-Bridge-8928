AXiM Chatbase Core Bridge backend integration is pending backend activation.

Open Project Settings -> Integrations, then choose one:

1. Supabase: click Connect Supabase, sign in, and select the organization and project.
2. NoCodeBackend: connect the NoCodeBackend account there using the account token from the NoCodeBackend dashboard, choose it as the preferred backend, then ask Greta to create the database for this app.
3. Google Sheets: share the sheet with the Greta service account shown there and paste the sheet link.

After the backend is connected, the next implementation pass will add the gateway data layer, RBAC tables, edge function, Chatbase server-side client, HITL tool loop, conversation mirroring, and Onyx routing while preserving the current UI.

Do not use an environment variable as a backend connection. NCB_SECRET_KEY is only the recovery key for an already-connected NoCodeBackend database, and VITE_-prefixed variables are compiled into the public site bundle, so secrets must never use that prefix.