export class ApiError extends Error {
  constructor(message, status, fields) {
    super(message);
    this.status = status;
    this.fields = fields || {};
  }
}

async function request(method, url, { body, headers } = {}) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Cannot reach the server. Please try again.', 0);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON response */
  }
  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data?.fields);
  }
  return data;
}

const adminHeaders = (token) => ({ 'x-admin-token': token });

export const api = {
  listEvents: () => request('GET', '/api/events'),
  getEvent: (id) => request('GET', `/api/events/${id}`),
  book: (id, body) => request('POST', `/api/events/${id}/book`, { body }),
  lookup: (code, email) =>
    request('GET', `/api/bookings/${encodeURIComponent(code)}?email=${encodeURIComponent(email)}`),
  cancel: (code, email) =>
    request('DELETE', `/api/bookings/${encodeURIComponent(code)}?email=${encodeURIComponent(email)}`),
  admin: {
    events: (token) => request('GET', '/api/admin/events', { headers: adminHeaders(token) }),
    bookings: (token) => request('GET', '/api/admin/bookings', { headers: adminHeaders(token) }),
    createEvent: (token, body) =>
      request('POST', '/api/events', { body, headers: adminHeaders(token) }),
  },
};

export const formatDate = (iso) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const formatPrice = (n) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n);

export const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
