import { NavLink, Route, Routes, Link } from 'react-router-dom';
import EventsList from './pages/EventsList.jsx';
import EventDetail from './pages/EventDetail.jsx';
import Confirmation from './pages/Confirmation.jsx';
import Lookup from './pages/Lookup.jsx';
import Admin from './pages/Admin.jsx';

export default function App() {
  return (
    <>
      <header className="site-header">
        <div className="container nav">
          <Link to="/" className="brand">
            🎟️ TicketHub
          </Link>
          <nav>
            <NavLink to="/" end>
              Events
            </NavLink>
            <NavLink to="/my-booking">My Booking</NavLink>
            <NavLink to="/admin">Admin</NavLink>
          </nav>
        </div>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<EventsList />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/confirmation/:code" element={<Confirmation />} />
          <Route path="/my-booking" element={<Lookup />} />
          <Route path="/admin" element={<Admin />} />
          <Route
            path="*"
            element={
              <div className="card center">
                <h2>Page not found</h2>
                <Link to="/">Back to events</Link>
              </div>
            }
          />
        </Routes>
      </main>
    </>
  );
}
