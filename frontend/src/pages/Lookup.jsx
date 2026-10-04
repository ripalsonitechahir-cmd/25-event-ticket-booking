import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, isValidEmail } from '../api.js';
import BookingCard from '../components/BookingCard.jsx';

export default function Lookup() {
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get('code') || '');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [booking, setBooking] = useState(null);
  const [busy, setBusy] = useState(false);

  const search = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setBooking(null);
    const errs = {};
    if (!code.trim()) errs.code = 'Booking code is required';
    if (!isValidEmail(email)) errs.email = 'A valid email is required';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      setBooking(await api.lookup(code.trim(), email.trim()));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!window.confirm('Cancel this booking? Your seats will be released.')) return;
    setBusy(true);
    setError('');
    try {
      setBooking(await api.cancel(booking.booking_code, booking.email));
      setNotice('Your booking has been cancelled.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="narrow">
      <h1>My Booking</h1>
      <form className="card" onSubmit={search} noValidate>
        <label>
          Booking code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="EVT-XXXXXXXX"
            autoCapitalize="characters"
          />
          {errors.code && <span className="field-error">{errors.code}</span>}
        </label>
        <label>
          Email used for booking
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </label>
        <button className="btn primary" disabled={busy}>
          {busy ? 'Searching…' : 'Find booking'}
        </button>
      </form>

      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert success">{notice}</div>}

      {booking && (
        <div className="card">
          <BookingCard booking={booking} />
          {booking.status === 'CONFIRMED' && (
            <button className="btn danger" onClick={cancel} disabled={busy}>
              Cancel booking
            </button>
          )}
        </div>
      )}
    </div>
  );
}
