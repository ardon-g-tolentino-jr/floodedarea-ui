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

// ── Flood-report writes ──
server.post('/reports', (req, res) => {
  const db = router.db;
  const ids = db.get('reports').map('id').value();
  const id = ids.length ? Math.max(...ids) + 1 : 1;
  const now = new Date().toISOString();
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
    reporterUserId: 1,
    createdAt: now,
    updatedAt: now,
  };
  db.get('reports').push(report).write();
  res.status(201).json(report);
});

server.post('/reports/:id/confirm', (req, res) => {
  const db = router.db;
  const id = parseInt(req.params.id, 10);
  const report = db.get('reports').find({ id }).value();
  if (!report) return res.status(404).json({ message: 'Report not found' });
  db.get('reports').find({ id }).assign({ reportsCount: report.reportsCount + 1 }).write();
  res.json(db.get('reports').find({ id }).value());
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

server.use(router);
server.listen(3001, () => process.stdout.write('[baha mock-api] http://localhost:3001\n'));
