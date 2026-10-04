import { formatDate, formatPrice } from '../api.js';

export default function BookingCard({ booking }) {
  const { event } = booking;
  return (
    <dl className="booking">
      <div>
        <dt>Booking code</dt>
        <dd className="code">{booking.booking_code}</dd>
      </div>
      <div>
        <dt>Status</dt>
        <dd>
          <span className={`badge ${booking.status === 'CONFIRMED' ? 'ok' : 'sold'}`}>
            {booking.status}
          </span>
        </dd>
      </div>
      <div>
        <dt>Event</dt>
        <dd>{event.title}</dd>
      </div>
      <div>
        <dt>When</dt>
        <dd>{formatDate(event.event_date)}</dd>
      </div>
      <div>
        <dt>Venue</dt>
        <dd>{event.venue}</dd>
      </div>
      <div>
        <dt>Name</dt>
        <dd>{booking.name}</dd>
      </div>
      <div>
        <dt>Email</dt>
        <dd>{booking.email}</dd>
      </div>
      <div>
        <dt>Tickets</dt>
        <dd>
          {booking.quantity} × {formatPrice(event.price)} ={' '}
          <strong>{formatPrice(booking.quantity * event.price)}</strong>
        </dd>
      </div>
      <div>
        <dt>Booked on</dt>
        <dd>{formatDate(booking.created_at)}</dd>
      </div>
    </dl>
  );
}
