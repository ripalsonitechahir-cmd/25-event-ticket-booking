import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, formatDate, formatPrice, isValidEmail } from '../api.js';

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', quantity: 1 });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () =>
    api
      .getEvent(id)
      .then(setEvent)
      .catch((e) => setLoadError(e.status === 404 ? 'Event not found' : e.message));

  useEffect(() => {
    load();
  }, [id]);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!isValidEmail(form.email)) errs.email = 'A valid email is required';
    const q = Number(form.quantity);
    if (!Number.isInteger(q) || q < 1) errs.quantity = 'Enter at least 1 ticket';
    else if (q > 10) errs.quantity = 'You can book at most 10 tickets at once';
    else if (event && q > event.available_seats)
      errs.quantity = `Only ${event.available_seats} seat(s) left`;
    return errs;
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSubmitting(true);
    try {
      const booking = await api.book(id, {
        name: form.name.trim(),
        email: form.email.trim(),
        quantity: Number(form.quantity),
      });
      navigate(`/confirmation/${booking.booking_code}`, { state: { booking } });
    } catch (err) {
      if (err.fields && Object.keys(err.fields).length) setErrors(err.fields);
      else setSubmitError(err.message);
      load(); // refresh seats left (e.g. someone else just booked)
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError)
    return (
      <div className="card center">
        <h2>{loadError}</h2>
        <Link to="/">Back to events</Link>
      </div>
    );
  if (!event) return <p className="muted">Loading…</p>;

  const soldOut = event.available_seats === 0;
  const total = Number(form.quantity) > 0 ? Number(form.quantity) * event.price : 0;

  return (
    <>
      <Link to="/" className="back">
        ← All events
      </Link>
      <div className="detail">
        <section className="card">
          <h1>{event.title}</h1>
          <p className="meta">📅 {formatDate(event.event_date)}</p>
          <p className="meta">📍 {event.venue}</p>
          <p className="meta">
            💵 <strong>{formatPrice(event.price)}</strong> per ticket
          </p>
          <p>
            {soldOut ? (
              <span className="badge sold">Sold out</span>
            ) : (
              <span className={`badge ${event.available_seats <= 10 ? 'low' : 'ok'}`}>
                {event.available_seats} of {event.total_seats} seats left
              </span>
            )}
          </p>
        </section>

        <section className="card">
          <h2>Book tickets</h2>
          {soldOut ? (
            <p className="alert error">This event is sold out.</p>
          ) : (
            <form onSubmit={submit} noValidate>
              {submitError && <div className="alert error">{submitError}</div>}
              <label>
                Full name
                <input value={form.name} onChange={set('name')} maxLength={100} autoComplete="name" />
                {errors.name && <span className="field-error">{errors.name}</span>}
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  autoComplete="email"
                />
                {errors.email && <span className="field-error">{errors.email}</span>}
              </label>
              <label>
                Number of tickets
                <input
                  type="number"
                  min="1"
                  max={Math.min(10, event.available_seats)}
                  value={form.quantity}
                  onChange={set('quantity')}
                />
                {errors.quantity && <span className="field-error">{errors.quantity}</span>}
              </label>
              <p className="total">
                Total: <strong>{formatPrice(total)}</strong>
              </p>
              <button className="btn primary" disabled={submitting}>
                {submitting ? 'Booking…' : 'Confirm booking'}
              </button>
            </form>
          )}
        </section>
      </div>
    </>
  );
}
