import { useCallback, useEffect, useState } from 'react';
import { api, formatDate, formatPrice } from '../api.js';

const TOKEN_KEY = 'admin_token';
const getStoredToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
};

export default function Admin() {
  const [token, setToken] = useState(getStoredToken);
  const [input, setInput] = useState('');
  const [authError, setAuthError] = useState('');

  const logout = () => {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
    setToken('');
  };

  const login = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      await api.admin.events(input.trim()); // verifies the token
      try {
        sessionStorage.setItem(TOKEN_KEY, input.trim());
      } catch {
        /* ignore */
      }
      setToken(input.trim());
      setInput('');
    } catch (err) {
      setAuthError(err.status === 401 ? 'Invalid admin token' : err.message);
    }
  };

  if (!token) {
    return (
      <form className="card narrow" onSubmit={login}>
        <h1>Admin Panel</h1>
        {authError && <div className="alert error">{authError}</div>}
        <label>
          Admin token
          <input type="password" value={input} onChange={(e) => setInput(e.target.value)} />
        </label>
        <button className="btn primary">Sign in</button>
      </form>
    );
  }
  return <Dashboard token={token} onLogout={logout} />;
}

const emptyForm = { title: '', venue: '', event_date: '', price: '', total_seats: '' };

function Dashboard({ token, onLogout }) {
  const [events, setEvents] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [ev, bk] = await Promise.all([api.admin.events(token), api.admin.bookings(token)]);
      setEvents(ev);
      setBookings(bk);
    } catch (err) {
      if (err.status === 401) onLogout();
      else setError(err.message);
    }
  }, [token, onLogout]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setNotice('');
    setError('');
    const errs = {};
    if (!form.title.trim()) errs.title = 'Title is required';
    if (!form.venue.trim()) errs.venue = 'Venue is required';
    if (!form.event_date) errs.event_date = 'Date is required';
    else if (new Date(form.event_date) <= new Date()) errs.event_date = 'Date must be in the future';
    if (form.price === '' || Number(form.price) < 0) errs.price = 'Enter a price of 0 or more';
    if (!Number.isInteger(Number(form.total_seats)) || Number(form.total_seats) < 1)
      errs.total_seats = 'Enter at least 1 seat';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      await api.admin.createEvent(token, {
        title: form.title.trim(),
        venue: form.venue.trim(),
        event_date: new Date(form.event_date).toISOString(),
        price: Number(form.price),
        total_seats: Number(form.total_seats),
      });
      setForm(emptyForm);
      setNotice('Event created.');
      refresh();
    } catch (err) {
      if (err.status === 401) onLogout();
      else if (err.fields && Object.keys(err.fields).length) setErrors(err.fields);
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const shown = filter ? bookings.filter((b) => String(b.event_id) === filter) : bookings;

  return (
    <>
      <div className="row between">
        <h1>Admin Panel</h1>
        <button className="btn ghost" onClick={onLogout}>
          Sign out
        </button>
      </div>
      {error && <div className="alert error">{error}</div>}

      <section className="card">
        <h2>Add event</h2>
        {notice && <div className="alert success">{notice}</div>}
        <form onSubmit={submit} noValidate className="form-grid">
          <label>
            Title
            <input value={form.title} onChange={set('title')} maxLength={150} />
            {errors.title && <span className="field-error">{errors.title}</span>}
          </label>
          <label>
            Venue
            <input value={form.venue} onChange={set('venue')} maxLength={150} />
            {errors.venue && <span className="field-error">{errors.venue}</span>}
          </label>
          <label>
            Date &amp; time
            <input type="datetime-local" value={form.event_date} onChange={set('event_date')} />
            {errors.event_date && <span className="field-error">{errors.event_date}</span>}
          </label>
          <label>
            Price (USD)
            <input type="number" min="0" step="0.01" value={form.price} onChange={set('price')} />
            {errors.price && <span className="field-error">{errors.price}</span>}
          </label>
          <label>
            Total seats
            <input type="number" min="1" value={form.total_seats} onChange={set('total_seats')} />
            {errors.total_seats && <span className="field-error">{errors.total_seats}</span>}
          </label>
          <div className="form-actions">
            <button className="btn primary" disabled={busy}>
              {busy ? 'Saving…' : 'Add event'}
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <h2>Events</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Date</th>
                <th>Venue</th>
                <th>Price</th>
                <th>Seats left</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td>{ev.title}</td>
                  <td>{formatDate(ev.event_date)}</td>
                  <td>{ev.venue}</td>
                  <td>{formatPrice(ev.price)}</td>
                  <td>
                    {ev.available_seats} / {ev.total_seats}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="row between">
          <h2>Bookings ({shown.length})</h2>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by event">
            <option value="">All events</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title}
              </option>
            ))}
          </select>
        </div>
        {shown.length === 0 ? (
          <p className="muted">No bookings yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Event</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Qty</th>
                  <th>Status</th>
                  <th>Booked</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((b) => (
                  <tr key={b.id}>
                    <td className="code">{b.booking_code}</td>
                    <td>{b.event.title}</td>
                    <td>{b.name}</td>
                    <td>{b.email}</td>
                    <td>{b.quantity}</td>
                    <td>
                      <span className={`badge ${b.status === 'CONFIRMED' ? 'ok' : 'sold'}`}>
                        {b.status}
                      </span>
                    </td>
                    <td>{formatDate(b.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
