const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { ZodError } = require('zod');

const prisma = require('./db');
const { logger, requestLogger } = require('./logger');
const { HttpError } = require('./errors');
const { bookingSchema, eventSchema, lookupSchema } = require('./validation');

const app = express();

app.disable('x-powered-by');
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '100kb' }));
app.use(requestLogger);

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_TOKEN;
  const given = Buffer.from(req.get('x-admin-token') || '');
  const want = Buffer.from(expected || '');
  if (!expected || given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    return next(new HttpError(401, 'Admin token missing or invalid'));
  }
  next();
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous characters
function generateBookingCode() {
  let s = '';
  for (const byte of crypto.randomBytes(8)) s += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return `EVT-${s}`;
}

function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'Invalid id');
  return id;
}

// ---------- Health ----------
app.get(
  '/health',
  wrap(async (req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({ status: 'ok', database: 'up' });
    } catch (err) {
      logger.error('health check failed', { error: err.message });
      res.status(503).json({ status: 'error', database: 'down' });
    }
  })
);

// ---------- Events ----------
app.get(
  '/api/events',
  wrap(async (req, res) => {
    const events = await prisma.event.findMany({
      where: { event_date: { gte: new Date() } },
      orderBy: { event_date: 'asc' },
    });
    res.json(events);
  })
);

app.get(
  '/api/events/:id',
  wrap(async (req, res) => {
    const event = await prisma.event.findUnique({ where: { id: parseId(req.params.id) } });
    if (!event) throw new HttpError(404, 'Event not found');
    res.json(event);
  })
);

app.post(
  '/api/events',
  requireAdmin,
  wrap(async (req, res) => {
    const data = eventSchema.parse(req.body);
    const event = await prisma.event.create({
      data: { ...data, available_seats: data.total_seats },
    });
    logger.info('event created', { event_id: event.id });
    res.status(201).json(event);
  })
);

// The seat decrement is one conditional UPDATE inside a transaction, so two
// concurrent requests can never take the same seats (SQLite serialises writers).
app.post(
  '/api/events/:id/book',
  wrap(async (req, res) => {
    const id = parseId(req.params.id);
    const { name, email, quantity } = bookingSchema.parse(req.body);

    const booking = await prisma.$transaction(async (tx) => {
      const event = await tx.event.findUnique({ where: { id } });
      if (!event) throw new HttpError(404, 'Event not found');
      if (event.event_date.getTime() <= Date.now()) {
        throw new HttpError(409, 'This event has already taken place');
      }

      const { count } = await tx.event.updateMany({
        where: { id, available_seats: { gte: quantity } },
        data: { available_seats: { decrement: quantity } },
      });
      if (count === 0) {
        throw new HttpError(
          409,
          event.available_seats === 0
            ? 'Sorry, this event is sold out'
            : `Only ${event.available_seats} seat(s) left`
        );
      }

      return tx.booking.create({
        data: { event_id: id, name, email, quantity, booking_code: generateBookingCode() },
        include: { event: true },
      });
    });

    logger.info('booking created', { booking_code: booking.booking_code, event_id: id, quantity });
    res.status(201).json(booking);
  })
);

// ---------- Bookings ----------
app.get(
  '/api/bookings/:code',
  wrap(async (req, res) => {
    const { code, email } = lookupSchema.parse({ code: req.params.code, email: req.query.email });
    const booking = await prisma.booking.findFirst({
      where: { booking_code: code.toUpperCase(), email },
      include: { event: true },
    });
    if (!booking) throw new HttpError(404, 'No booking found for that code and email');
    res.json(booking);
  })
);

app.delete(
  '/api/bookings/:code',
  wrap(async (req, res) => {
    const { code, email } = lookupSchema.parse({ code: req.params.code, email: req.query.email });

    const cancelled = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { booking_code: code.toUpperCase(), email },
      });
      if (!booking) throw new HttpError(404, 'No booking found for that code and email');

      // Conditional update guards against a concurrent double-cancel restoring seats twice.
      const { count } = await tx.booking.updateMany({
        where: { id: booking.id, status: 'CONFIRMED' },
        data: { status: 'CANCELLED' },
      });
      if (count === 0) throw new HttpError(409, 'Booking is already cancelled');

      await tx.event.update({
        where: { id: booking.event_id },
        data: { available_seats: { increment: booking.quantity } },
      });
      return tx.booking.findUnique({ where: { id: booking.id }, include: { event: true } });
    });

    logger.info('booking cancelled', { booking_code: cancelled.booking_code });
    res.json(cancelled);
  })
);

// ---------- Admin ----------
app.get(
  '/api/admin/events',
  requireAdmin,
  wrap(async (req, res) => {
    res.json(await prisma.event.findMany({ orderBy: { event_date: 'asc' } }));
  })
);

app.get(
  '/api/admin/bookings',
  requireAdmin,
  wrap(async (req, res) => {
    const where = {};
    if (req.query.event_id) where.event_id = parseId(req.query.event_id);
    res.json(
      await prisma.booking.findMany({
        where,
        include: { event: { select: { id: true, title: true } } },
        orderBy: { created_at: 'desc' },
      })
    );
  })
);

// ---------- Static frontend (production build) ----------
const distDir = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^\/(?!api\/|health).*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

// ---------- Errors ----------
app.use('/api', (req, res, next) => next(new HttpError(404, 'Route not found')));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof ZodError) {
    const fields = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || '_';
      if (!fields[key]) fields[key] = issue.message;
    }
    return res.status(400).json({ error: 'Validation failed', fields });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }
  logger.error('unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
