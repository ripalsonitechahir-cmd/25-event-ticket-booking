# Event Ticket Booking System

React + Express + Prisma (SQLite), packaged with Docker and deployable to Kubernetes.

## Quick start

Requires Node.js 18+.

```bash
# 1. Backend: install, create DB, seed sample events
cd backend
npm install
cp .env.example .env        # (Windows: copy .env.example .env)
npm run setup

# 2. Frontend: install and build (served by the backend)
cd ../frontend
npm install
npm run build

# 3. Run
cd ../backend
npm start                   # http://localhost:4000
```

Open http://localhost:4000. The admin token is `ADMIN_TOKEN` in `backend/.env`
(default `change-me-admin-token`; change it).

### Development mode (hot reload)

```bash
cd backend  && npm run dev      # API on :4000
cd frontend && npm run dev      # UI on :5173, proxies /api to :4000
```

### Tests

```bash
cd backend && npm test          # 10 integration tests, uses a throwaway SQLite DB
```

## Docker

One image (multi-stage build: React build, then Express + Prisma runtime, non-root user).
SQLite lives on the named volume `app-data` mounted at `/data`.

```bash
docker compose up --build -d     # http://localhost:8080
docker compose logs -f app
docker compose down              # stop (data kept); add -v to delete the volume
```

Set `ADMIN_TOKEN` via a `.env` file next to `docker-compose.yml` (see `.env.example`).

## Kubernetes (Docker Desktop, single pod)

Manifests are in [k8s/](k8s/): namespace, ConfigMap, Secret, PVC, Deployment, NodePort Service.
Docker Desktop's cluster uses the local Docker image store, so build the image first.

```bash
docker build -t event-ticket-booking:1.0.0 .
kubectl apply -f k8s/
kubectl get all,pvc -n event-ticket-booking
# open http://localhost:30081
kubectl logs deploy/app -n event-ticket-booking
kubectl delete ns event-ticket-booking     # teardown
```

Why one replica: the database is a SQLite file on a ReadWriteOnce volume, so it can't be
shared between pods (the Deployment uses the `Recreate` strategy for the same reason).
Running 2+ replicas would need a networked database such as PostgreSQL.
NodePort 30081 is used because 30080 may be taken by other projects on the same cluster.
For minikube or kind, load the image into the cluster (`minikube image load` / `kind load docker-image`).

## Configuration (`backend/.env`)

| Variable       | Purpose                                 |
| -------------- | --------------------------------------- |
| `PORT`         | API/UI port (default 4000)              |
| `DATABASE_URL` | SQLite file, e.g. `file:./dev.db`       |
| `ADMIN_TOKEN`  | Secret for admin endpoints              |
| `CORS_ORIGIN`  | Allowed origin when UI runs separately  |

## API

| Method | Path                             | Notes                                          |
| ------ | -------------------------------- | ---------------------------------------------- |
| GET    | `/api/events`                    | Upcoming events                                |
| GET    | `/api/events/:id`                |                                                |
| POST   | `/api/events`                    | Admin (`x-admin-token` header)                 |
| POST   | `/api/events/:id/book`           | `{name, email, quantity}` (1-10)               |
| GET    | `/api/bookings/:code?email=`     | Lookup                                         |
| DELETE | `/api/bookings/:code?email=`     | Cancel, seats are released                     |
| GET    | `/health`                        | 200 when the DB is reachable, else 503         |
| GET    | `/api/admin/events`, `/api/admin/bookings` | Admin (added for the admin panel)    |

Overbooking is prevented by a conditional seat decrement (`available_seats >= quantity`)
inside a Prisma transaction. SQLite serialises writers, and a concurrency test
(10 parallel bookings for 5 seats) verifies exactly 5 succeed.
