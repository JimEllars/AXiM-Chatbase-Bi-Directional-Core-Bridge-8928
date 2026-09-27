### Context & Objective
We are in production hardening mode on the AXiM Chatbase Bi-Directional Core Bridge (commit 7c93e750). The codebase is hosted on Cloudflare Pages and acts as an autonomous, self-contained micro-app communicating with our Supabase layer and AXiM Core API.

Our priority is 95% execution on activating current systems, hardening live telemetry, perfecting modern UI/UX workflows, and locking down session persistence. Do not introduce extraneous dependencies, separate databases, or breaking structural rewrites. Implement targeted updates in small, verifiable increments.

### Specific Tasks & Deliverables

#### 1. Telemetry Bar Live Edge Binding (`src/components/TelemetryBar.jsx` & `src/services/agentTunnels.js`)
- Wire `TelemetryBar.jsx` to live health checks instead of mock counters.
- Track real ping latency against Supabase Edge / Cloudflare Workers endpoints, active bi-directional socket state, unhandled queue depth, and pending approval totals.
- Implement an automatic status indicator: `Operational` (green, <150ms), `Degraded` (amber, 150-400ms), or `Disconnected` (red, connection retry loop).

#### 2. Bridge Transport & Buffer Resiliency (`src/services/bridgeClient.js` & `src/services/localBridge.js`)
- Add an in-memory ring buffer (maximum 50 items) for outbound tool actions dispatched during transient network drops or socket reconnections.
- Implement exponential backoff with jitter (initial: 500ms, max: 8000ms) for reconnection attempts without dropping message sequence IDs.
- Ensure pending actions requiring human approval in `InlineApprovalCard.jsx` remain locked and do not double-dispatch upon reconnection.

#### 3. Auth Persistence & Dashboard Continuity (`src/lib/auth.js` & `src/lib/supabase.js`)
- Verify that Supabase auth token auto-refresh handles network reconnection cleanly via `onAuthStateChange`.
- Ensure session loss triggers a non-destructive banner or modal rather than unmounting active agent chat threads or resetting current form states.
- Maintain persistent local caching of active agent session IDs so user views survive page refreshes or mobile backgrounding.

#### 4. Cloudflare Pages Optimization (`public/_headers` & `public/_routes.json`)
- Update `public/_headers` CSP policy to explicitly allow required edge connect-src targets:
  - `https://*.supabase.co`
  - `wss://*.supabase.co`
  - `https://www.chatbase.co`
  - Local bridge endpoints (`http://localhost:*`, `ws://localhost:*`)
- Verify `public/_routes.json` cleanly routes all non-static asset requests to `/index.html` for single-page routing integrity.

#### 5. UI Polish & Theme Consistency (`src/App.jsx` & Tailwind tokens)
- Polish the dark-mode layout with unified Tailwind slate/zinc neutral tones, crisp border contrasts, and high-visibility status tags.
- Ensure the drawer trigger for `PendingApprovalsDrawer.jsx` displays a real-time badge count reflecting pending actions.

### Implementation Constraints
- Keep all micro-program code self-contained; leverage browser storage and the existing Supabase configuration without creating top-heavy database schema requirements.
- Verify `npm run build` passes with zero ESLint errors and produces an optimized static build in `/dist`.
- Document all file modifications and operational checks in the task summary.
Verification Checklist & Immediate Next StepsStageAction ItemVerification Target1. Local VerificationRun npm run buildZero syntax/ESLint warnings, /dist bundle contains complete assets2. Auth ContinuitySimulate offline toggle in browser DevToolsSession state stays mounted; reconnect resumes without login prompt3. Telemetry StreamInspect TelemetryBar metrics during bridge trafficLive ms latency and queue depths update reactively4. Cloudflare Header AuditInspect network request headersCSP flags permit Supabase, Chatbase, and WebSocket streams5. Branch DeliveryCommit updates as an isolated incremental PRMaintain clean Git history off 7c93e750 for staging deploymentCommit the instructions above to the active coding agent branch.Run automated validation checks on Vite compilation and Tailwind asset minification.Validate Cloudflare Pages preview deployment before promoting to production.
