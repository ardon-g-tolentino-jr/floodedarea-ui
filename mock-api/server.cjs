// Lightweight json-server mock mirroring baha-api, for offline UI development.
// Run with `npm run mock` (port 3001) and point the UI at it:
//   VITE_API_URL=http://localhost:3001 npm run dev   (or just `npm run dev:mock`)
//
// Reads/writes for /reports, /centers, /hotlines, /alerts, /rescue come from db.json.
// Auth + confirm + SSE are stubbed so the full UI flow works without a backend.
// /road-status is a static stub too: it synthesizes a short road segment through each non-passable
// report rather than doing real map-matching (which baha-api performs in production).

const jsonServer = require('json-server');
const path = require('path');

const server = jsonServer.create();
const router = jsonServer.router(path.join(__dirname, 'db.json'));
const middlewares = jsonServer.defaults({ logger: false });

server.use(middlewares);
server.use(jsonServer.bodyParser);

server.get('/healthcheck', (_req, res) => res.json({ status: 'ok' }));

// ── Auth (stubbed — accepts anything, returns a fake session) ──
function fakeSession(email, name) {
  const e = (email || 'demo@bahawatch.ph').toLowerCase();
  return {
    token: 'mock-jwt-token',
    userId: 1,
    email: e,
    name: name || e.split('@')[0],
    picture: null,
    role: e.startsWith('admin') ? 'ADMIN' : 'CITIZEN',
    isNew: false,
  };
}
server.post('/auth/login', (req, res) => res.json(fakeSession(req.body.email)));
server.post('/auth/register', (req, res) => res.status(201).json(fakeSession(req.body.email, req.body.name)));
server.post('/auth/google', (_req, res) => res.json(fakeSession('google.user@bahawatch.ph', 'Google User')));
server.get('/auth/me', (_req, res) => res.json({ ...fakeSession(), token: null }));
// Guest (no-login) session — mirrors POST /auth/guest on baha-api. A fixed userId lets the
// "one active report per guest" spam guard and the `mine` flag work in the mock.
const GUEST_TOKEN = 'mock-guest-jwt';
server.post('/auth/guest', (_req, res) => res.json({
  token: GUEST_TOKEN, userId: 2000, email: 'guest@local', name: 'Guest', picture: null, role: 'GUEST', isNew: true,
}));

// ── Flood-report writes ──
server.post('/reports', (req, res) => {
  const db = router.db;
  const ids = db.get('reports').map('id').value();
  const id = ids.length ? Math.max(...ids) + 1 : 1;
  const now = new Date().toISOString();
  const isGuest = req.headers.authorization === `Bearer ${GUEST_TOKEN}`;
  // Mirror the DB 'photo' column: store the compressed JPEG data-URL, expose only a photoUrl to
  // clients. The raw `photo` is stripped from every list/detail response (served via /photo instead).
  const photo = typeof req.body.photoDataUrl === 'string' && req.body.photoDataUrl.startsWith('data:image/')
    ? req.body.photoDataUrl
    : null;
  const report = {
    id,
    name: req.body.name,
    district: req.body.district,
    latitude: req.body.latitude,
    longitude: req.body.longitude,
    severity: req.body.severity,
    depthCm: req.body.depthCm,
    trend: req.body.trend || 'steady',
    road: req.body.road || 'risky',
    reportsCount: 1,
    status: 'active',
    reporterUserId: isGuest ? 2000 : 1,
    // Admin-logged "system" reports (news/other sources) get their own trust tier. baha-api gates
    // the flag on the ADMIN role; the mock accepts anything, mirroring its other stubbed auth.
    reporterTrust: req.body.system ? 'system' : isGuest ? 'guest' : 'verified',
    // Admin-set: when the source reported the flood (anchors the client-side TTL) and a custom
    // lifetime in minutes. Default reportedAt to now; ttlMinutes null ⇒ severity default.
    reportedAt: req.body.reportedAt || now,
    ttlMinutes: typeof req.body.ttlMinutes === 'number' ? req.body.ttlMinutes : null,
    photo,
    photoUrl: photo ? `/reports/${id}/photo` : null,
    createdAt: now,
    updatedAt: now,
  };
  db.get('reports').push(report).write();
  res.status(201).json(stripPhoto(report));
});

// Strip the heavy base64 `photo` out of any report before it goes over the wire; guarantee a
// photoUrl field (null for older seed records that have no photo).
function stripPhoto(r) {
  const { photo, ...rest } = r;
  return { ...rest, photoUrl: rest.photoUrl ?? null };
}

// Custom GET /reports (wins over the json-server router below): mirrors baha-api's severity filter
// and returns reports WITHOUT the base64 photo — the list stays light. The photo is fetched
// separately via GET /reports/:id/photo.
server.get('/reports', (req, res) => {
  const severity = req.query.severity;
  let items = router.db.get('reports').value() || [];
  if (severity) items = items.filter((r) => r.severity === severity);
  res.json(items.map(stripPhoto));
});

// Stream a report's photo, decoded from its stored data-URL, with the right Content-Type.
server.get('/reports/:id/photo', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const report = router.db.get('reports').find({ id }).value();
  const m = report && typeof report.photo === 'string'
    ? /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/s.exec(report.photo)
    : null;
  if (!m) return res.status(404).json({ message: 'No photo for this report' });
  res.setHeader('Content-Type', m[1]);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.end(Buffer.from(m[2], 'base64'));
});

server.post('/reports/:id/confirm', (req, res) => {
  const db = router.db;
  const id = parseInt(req.params.id, 10);
  const report = db.get('reports').find({ id }).value();
  if (!report) return res.status(404).json({ message: 'Report not found' });
  db.get('reports').find({ id }).assign({ reportsCount: report.reportsCount + 1 }).write();
  res.json(db.get('reports').find({ id }).value());
});

// ── Report history — reports created in [from, to) regardless of status (powers the water-level
// chart's date browsing). Must be declared before the json-server router so it wins over /reports. ──
server.get('/reports/history', (req, res) => {
  const from = Date.parse(req.query.from);
  const to = Date.parse(req.query.to);
  const reports = (router.db.get('reports').value() || []).filter((r) => {
    const t = Date.parse(r.createdAt);
    return (Number.isNaN(from) || t >= from) && (Number.isNaN(to) || t < to);
  });
  res.json(reports.map(stripPhoto));
});

// ── Road status (stub) — synthesize a ~150 m segment through each non-passable report so the
// flooded-road overlay and route-avoidance can be exercised offline. No real map-matching. ──
server.get('/road-status', (_req, res) => {
  const db = router.db;
  const reports = db.get('reports').value() || [];
  const segments = reports
    .filter((r) => r.severity === 'high' || r.severity === 'medium')
    .map((r) => {
      const d = 0.0015; // ~150 m offset; orient the segment by report id for variety
      const dx = r.id % 2 === 0 ? d : d * 0.4;
      const dy = r.id % 2 === 0 ? d * 0.4 : d;
      return {
        id: r.id,
        name: r.name,
        status: r.severity === 'high' ? 'impassable' : 'risky',
        path: [
          { lat: r.latitude - dy, lng: r.longitude - dx },
          { lat: r.latitude, lng: r.longitude },
          { lat: r.latitude + dy, lng: r.longitude + dx },
        ],
        reportsCount: r.reportsCount || 1,
        updatedAt: r.updatedAt || new Date().toISOString(),
      };
    });
  res.json(segments);
});

// ── SSE — tracks open clients so dev endpoints can broadcast live events ──
const sseClients = new Set();
function broadcast(event, data) {
  const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) client.write(frame);
}

// ── SOS rescue — persist requests (with district) so the per-district chart has data, and
// broadcast over SSE so the chart updates live. baha-api persists these server-side. ──
server.get('/rescue', (_req, res) => {
  res.json(router.db.get('rescues').value() || []);
});

server.post('/rescue', (req, res) => {
  const db = router.db;
  const now = new Date();
  const hourAgo = now.getTime() - 60 * 60 * 1000;

  // Dedup mirror of baha-api: refresh the most recent open request from within the last hour
  // instead of creating a duplicate. The mock has no per-user auth, so this matches across all
  // senders (approximation) rather than per user.
  const recent = (db.get('rescues').value() || [])
    .filter((r) => r.status === 'pending' || r.status === 'dispatched')
    .filter((r) => new Date(r.lastRequestedAt || r.createdAt).getTime() > hourAgo)
    .sort((a, b) => new Date(b.lastRequestedAt || b.createdAt) - new Date(a.lastRequestedAt || a.createdAt))[0];
  if (recent) {
    const updated = db.get('rescues').find({ id: recent.id }).assign({
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      district: req.body.district || recent.district,
      city: req.body.city || null,
      barangay: req.body.barangay || null,
      note: req.body.note || null,
      lastRequestedAt: now.toISOString(),
    }).write();
    broadcast('rescue-updated', { id: recent.id });
    return res.status(200).json(updated);
  }

  const ids = db.get('rescues').map('id').value();
  const id = ids.length ? Math.max(...ids) + 1 : 1;
  const rescue = {
    id,
    latitude: req.body.latitude,
    longitude: req.body.longitude,
    district: req.body.district || 'Unknown area',
    city: req.body.city || null,
    barangay: req.body.barangay || null,
    note: req.body.note || null,
    status: 'pending',
    createdAt: now.toISOString(),
    lastRequestedAt: now.toISOString(),
  };
  db.get('rescues').push(rescue).write();
  broadcast('rescue-created', { id });
  res.status(201).json(rescue);
});

// Responder action: advance a request's status (pending → dispatched → resolved). baha-api does
// this server-side; the broadcast lets the response console refresh live.
const RESCUE_STATUSES = ['pending', 'dispatched', 'resolved'];
server.patch('/rescue/:id', (req, res) => {
  const db = router.db;
  const id = parseInt(req.params.id, 10);
  const rescue = db.get('rescues').find({ id }).value();
  if (!rescue) return res.status(404).json({ message: 'Rescue request not found' });
  const next = RESCUE_STATUSES.includes(req.body.status) ? req.body.status : rescue.status;
  const updated = db.get('rescues').find({ id }).assign({ status: next }).write();
  broadcast('rescue-updated', { id });
  res.json(updated);
});

server.get('/sse/activity', (_req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write('event: connected\ndata: ok\n\n');
  sseClients.add(res);
  res.on('close', () => sseClients.delete(res));
});

// ── Dev only: flip a rainfall alert's active/level and push it over SSE, so the live
// AlertRibbon path can be exercised offline. e.g. POST /alerts/1/toggle  { "level": "red" }
const ALERT_LEVELS = ['yellow', 'orange', 'red'];
server.post('/alerts/:id/toggle', (req, res) => {
  const db = router.db;
  const id = parseInt(req.params.id, 10);
  const alert = db.get('alerts').find({ id }).value();
  if (!alert) return res.status(404).json({ message: 'Alert not found' });
  const nextActive = typeof req.body.active === 'boolean' ? req.body.active : !alert.active;
  const nextLevel = ALERT_LEVELS.includes(req.body.level) ? req.body.level : alert.level;
  db.get('alerts').find({ id }).assign({ active: nextActive, level: nextLevel, updatedAt: new Date().toISOString() }).write();
  const updated = db.get('alerts').find({ id }).value();
  broadcast(nextActive ? 'alert-updated' : 'alert-deactivated', { id });
  res.json(updated);
});

// ── Feedback (bug reports & feature requests). Anyone (account or guest) can submit; an admin
// accepts/declines; accepted items appear on the public board where anyone can upvote. The custom
// routes below win over json-server (declared before `server.use(router)`); PATCH /feedback/:id
// (status moderation) still falls through to it. Role gating is the UI's job (the mock accepts anything). ──

// Map the bearer token to a stable voter id: the guest token → 2000, any full-account token → 1,
// nothing → null (anonymous, can't vote). Mirrors how the report routes tell guests from accounts.
function callerId(req) {
  const auth = req.headers.authorization || '';
  if (auth === `Bearer ${GUEST_TOKEN}`) return 2000;
  if (auth.startsWith('Bearer ')) return 1;
  return null;
}

// Public shape: hide the internal voter list and derive `upvotedByMe` for the caller.
function publicFeedback(item, viewerId) {
  const { upvoterIds = [], ...rest } = item;
  return {
    ...rest,
    upvotes: typeof item.upvotes === 'number' ? item.upvotes : upvoterIds.length,
    upvotedByMe: viewerId != null && upvoterIds.includes(viewerId),
  };
}

// Public board: accepted bugs + features, ordered by upvotes desc.
server.get('/feedback/accepted', (req, res) => {
  const viewer = callerId(req);
  const items = (router.db.get('feedback').value() || [])
    .filter((f) => f.status === 'accepted')
    .map((f) => publicFeedback(f, viewer))
    .sort((a, b) => b.upvotes - a.upvotes);
  res.json(items);
});

// Admin queue: every item with derived fields (newest first). Custom so `upvoterIds` is never leaked.
server.get('/feedback', (req, res) => {
  const viewer = callerId(req);
  const items = (router.db.get('feedback').value() || [])
    .map((f) => publicFeedback(f, viewer))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(items);
});

server.post('/feedback', (req, res) => {
  const db = router.db;
  const ids = db.get('feedback').map('id').value();
  const id = ids.length ? Math.max(...ids) + 1 : 1000;
  const now = new Date().toISOString();
  const isGuest = req.headers.authorization === `Bearer ${GUEST_TOKEN}`;
  const item = {
    id,
    type: req.body.type === 'bug' ? 'bug' : 'feature',
    title: req.body.title || '',
    details: req.body.details || null,
    status: 'pending',
    submittedByUserId: isGuest ? 2000 : 1,
    submitterName: isGuest ? 'Guest' : 'Demo User',
    upvotes: 0,
    upvoterIds: [],
    createdAt: now,
    updatedAt: now,
  };
  db.get('feedback').push(item).write();
  res.status(201).json(publicFeedback(item, callerId(req)));
});

// Toggle the caller's upvote (one per device/account). Returns the updated item.
server.post('/feedback/:id/upvote', (req, res) => {
  const db = router.db;
  const id = parseInt(req.params.id, 10);
  const item = db.get('feedback').find({ id }).value();
  if (!item) return res.status(404).json({ message: 'Feedback not found' });
  const viewer = callerId(req);
  if (viewer == null) return res.status(401).json({ message: 'Sign in to upvote' });
  const voters = Array.isArray(item.upvoterIds) ? item.upvoterIds : [];
  const has = voters.includes(viewer);
  const nextVoters = has ? voters.filter((v) => v !== viewer) : [...voters, viewer];
  const nextCount = Math.max(0, (typeof item.upvotes === 'number' ? item.upvotes : 0) + (has ? -1 : 1));
  db.get('feedback').find({ id }).assign({ upvoterIds: nextVoters, upvotes: nextCount, updatedAt: new Date().toISOString() }).write();
  res.json(publicFeedback(db.get('feedback').find({ id }).value(), viewer));
});

// ── Visit counter — mirrors baha-api's public stats endpoints. POST increments the all-time
// tally and returns the new total; GET reads it without incrementing. Persisted in db.json. ──
function readVisits() {
  const v = router.db.get('stats.visits').value();
  return typeof v === 'number' ? v : 0;
}
server.get('/stats/visits', (_req, res) => res.json({ total: readVisits() }));
server.post('/stats/visit', (_req, res) => {
  const total = readVisits() + 1;
  router.db.set('stats.visits', total).write();
  res.status(201).json({ total });
});

// ── Global app settings (e.g. community chat visibility). GET is public; PATCH mirrors the
// baha-api ADMIN gate in spirit only — the mock accepts anything, matching its other stubs. ──
server.get('/settings', (_req, res) => {
  const s = router.db.get('settings').value() || {};
  res.json({ chatEnabled: s.chatEnabled !== false });
});
server.patch('/settings', (req, res) => {
  const db = router.db;
  const current = db.get('settings').value() || {};
  const next = { ...current };
  if (typeof req.body.chatEnabled === 'boolean') next.chatEnabled = req.body.chatEnabled;
  db.set('settings', next).write();
  res.json({ chatEnabled: next.chatEnabled !== false });
});

server.use(router);
server.listen(3001, () => process.stdout.write('[baha mock-api] http://localhost:3001\n'));
