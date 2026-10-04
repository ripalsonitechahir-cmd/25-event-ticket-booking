import { Link, useLocation, useParams } from 'react-router-dom';
import BookingCard from '../components/BookingCard.jsx';

// The booking is passed through router state right after booking. A refresh (or a
// shared link) has no state, so we send the user to the lookup page instead, because
// looking a booking up requires both the code and the email.
export default function Confirmation() {
  const { code } = useParams();
  const { state } = useLocation();
  const booking = state?.booking?.booking_code === code ? state.booking : null;

  if (!booking) {
    return (
      <div className="card center">
        <h2>Booking {code}</h2>
        <p>To view this booking, look it up with your booking code and email.</p>
        <Link className="btn" to={`/my-booking?code=${encodeURIComponent(code)}`}>
          Look up booking
        </Link>
      </div>
    );
  }

  return (
    <div className="card confirm">
      <div className="center">
        <div className="check">✓</div>
        <h1>Booking confirmed!</h1>
        <p className="muted">Keep your booking code — you need it, with your email, to look up or cancel.</p>
      </div>
      <BookingCard booking={booking} />
      <div className="row center-row">
        <Link className="btn" to="/">
          Browse more events
        </Link>
        <Link className="btn ghost" to="/my-booking">
          My booking
        </Link>
      </div>
    </div>
  );
}
