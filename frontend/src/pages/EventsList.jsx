import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDate, formatPrice } from '../api.js';

export default function EventsList() {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .listEvents()
      .then(setEvents)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="alert error">{error}</div>;
  if (!events) return <p className="muted">Loading events…</p>;

  return (
    <>
      <h1>Upcoming Events</h1>
      {events.length === 0 && <p className="muted">No upcoming events right now.</p>}
      <div className="grid">
        {events.map((ev) => (
          <article className="card event-card" key={ev.id}>
            <h2>{ev.title}</h2>
            <p className="meta">📅 {formatDate(ev.event_date)}</p>
            <p className="meta">📍 {ev.venue}</p>
            <div className="row between">
              <strong className="price">{formatPrice(ev.price)}</strong>
              {ev.available_seats === 0 ? (
                <span className="badge sold">Sold out</span>
              ) : (
                <span className={`badge ${ev.available_seats <= 10 ? 'low' : 'ok'}`}>
                  {ev.available_seats} seats left
                </span>
              )}
            </div>
            <Link className="btn" to={`/events/${ev.id}`}>
              {ev.available_seats === 0 ? 'View details' : 'Book now'}
            </Link>
          </article>
        ))}
      </div>
    </>
  );
}
