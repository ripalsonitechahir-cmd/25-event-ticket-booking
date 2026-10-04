// Integration tests against a throwaway SQLite database.
// Run with: npm test  (creates test.db via `prisma db push`)
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const root = path.resolve(__dirname, '..');
const dbFile = path.join(root, 'prisma', 'test.db');
process.env.DATABASE_URL = 'file:./test.db';
process.env.ADMIN_TOKEN = 'test-token';
process.env.CORS_ORIGIN = '*';

let server, base, prisma;
const admin = { 'x-admin-token': 'test-token', 'content-type': 'application/json' };
const json = { 'content-type': 'application/json' };
const future = () => new Date(Date.now() + 7 * 864e5).toISOString();

const call = async (method, url, body, headers = json) => {
  const res = await fetch(base + url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

const newEvent = (seats = 10) =>
  call('POST', '/api/events', { title: 'T', venue: 'V', event_date: future(), price: 10, total_seats: seats }, admin);

before(async () => {
  for (const f of [dbFile, dbFile + '-journal']) fs.rmSync(f, { force: true });
  execSync('npx prisma db push --skip-generate', { cwd: root, stdio: 'ignore', env: process.env });
  prisma = require('../src/db');
  const app = require('../src/app');
  await new Promise((r) => (server = app.listen(0, r)));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await prisma.$disconnect();
  fs.rmSync(dbFile, { force: true });
});

test('health returns 200', async () => {
  const r = await call('GET', '/health');
  assert.equal(r.status, 200);
});

test('admin endpoints reject missing/invalid token', async () => {
  assert.equal((await call('POST', '/api/events', {}, json)).status, 401);
  assert.equal((await call('GET', '/api/admin/bookings', undefined, json)).status, 401);
});

test('event creation validates input', async () => {
  const r = await call('POST', '/api/events', { title: '', venue: 'x', event_date: 'nope', price: -1, total_seats: 0 }, admin);
  assert.equal(r.status, 400);
  assert.ok(r.body.fields.title && r.body.fields.event_date && r.body.fields.price && r.body.fields.total_seats);
});

test('create, list and fetch an event', async () => {
  const created = await newEvent(5);
  assert.equal(created.status, 201);
  assert.equal(created.body.available_seats, 5);
  const list = await call('GET', '/api/events');
  assert.ok(list.body.some((e) => e.id === created.body.id));
  assert.equal((await call('GET', `/api/events/${created.body.id}`)).status, 200);
  assert.equal((await call('GET', '/api/events/99999')).status, 404);
  assert.equal((await call('GET', '/api/events/abc')).status, 400);
});

test('booking validates input', async () => {
  const ev = (await newEvent()).body;
  const r = await call('POST', `/api/events/${ev.id}/book`, { name: '', email: 'bad', quantity: 0 });
  assert.equal(r.status, 400);
  assert.ok(r.body.fields.name && r.body.fields.email && r.body.fields.quantity);
  assert.equal((await call('POST', `/api/events/${ev.id}/book`, { name: 'a', email: 'a@b.co', quantity: 11 })).status, 400);
  const bad = await fetch(`${base}/api/events/${ev.id}/book`, { method: 'POST', headers: json, body: '{oops' });
  assert.equal(bad.status, 400);
  assert.equal((await call('POST', '/api/events/99999/book', { name: 'a', email: 'a@b.co', quantity: 1 })).status, 404);
});

test('book, look up, and cancel restores seats', async () => {
  const ev = (await newEvent(10)).body;
  const b = await call('POST', `/api/events/${ev.id}/book`, { name: 'Ann', email: 'Ann@Example.com', quantity: 3 });
  assert.equal(b.status, 201);
  assert.match(b.body.booking_code, /^EVT-[A-Z0-9]{8}$/);
  assert.equal((await call('GET', `/api/events/${ev.id}`)).body.available_seats, 7);

  const code = b.body.booking_code;
  assert.equal((await call('GET', `/api/bookings/${code}?email=ann@example.com`)).status, 200);
  assert.equal((await call('GET', `/api/bookings/${code}?email=other@example.com`)).status, 404);
  assert.equal((await call('GET', `/api/bookings/${code}`)).status, 400);

  const del = await call('DELETE', `/api/bookings/${code}?email=ann@example.com`);
  assert.equal(del.status, 200);
  assert.equal(del.body.status, 'CANCELLED');
  assert.equal((await call('GET', `/api/events/${ev.id}`)).body.available_seats, 10);
  assert.equal((await call('DELETE', `/api/bookings/${code}?email=ann@example.com`)).status, 409);
  assert.equal((await call('GET', `/api/events/${ev.id}`)).body.available_seats, 10);
});

test('overbooking is prevented under concurrency', async () => {
  const ev = (await newEvent(5)).body;
  const results = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      call('POST', `/api/events/${ev.id}/book`, { name: `U${i}`, email: `u${i}@x.co`, quantity: 1 })
    )
  );
  assert.equal(results.filter((r) => r.status === 201).length, 5);
  assert.equal(results.filter((r) => r.status === 409).length, 5);
  assert.equal((await call('GET', `/api/events/${ev.id}`)).body.available_seats, 0);
  const sold = await call('POST', `/api/events/${ev.id}/book`, { name: 'x', email: 'x@x.co', quantity: 1 });
  assert.equal(sold.status, 409);
  assert.match(sold.body.error, /sold out/i);
});

test('cannot book more than remaining seats', async () => {
  const ev = (await newEvent(2)).body;
  const r = await call('POST', `/api/events/${ev.id}/book`, { name: 'a', email: 'a@b.co', quantity: 3 });
  assert.equal(r.status, 409);
  assert.match(r.body.error, /Only 2/);
});

test('admin can list bookings', async () => {
  const r = await call('GET', '/api/admin/bookings', undefined, admin);
  assert.equal(r.status, 200);
  assert.ok(r.body.length > 0 && r.body[0].event.title);
});

test('unknown API route returns JSON 404', async () => {
  assert.equal((await call('GET', '/api/nope')).status, 404);
});
