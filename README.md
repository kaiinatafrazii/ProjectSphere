# ProjectSphere

ProjectSphere is a polished project discovery and publishing platform for developers, students, and research teams. It includes a React + Vite frontend and an Express + MySQL backend with authentication, project listing, publishing, and review flows.

## Repository structure

- Frontend/ - React + Vite frontend
- backend/ - Express API and MySQL-related code
- .gitignore - ignore rules for the repository
- README.md - setup and usage documentation

## Tech stack

- Frontend: React.js, Vite, React Router, CSS modules / custom CSS
- Backend: Node.js, Express.js
- Database: MySQL 8+
- Auth: JWT and bcrypt

## Prerequisites

- Node.js 18+
- npm 9+
- MySQL 8.0+

## 1. Install dependencies

Frontend:
```bash
cd Frontend
npm install
```

Backend:
```bash
cd ../backend
npm install
```

## 2. Configure environment

Create `Frontend/.env` from `Frontend/.env.example` and `backend/.env` from `backend/.env.example`. The checked-in `.env` files are ignored; update the backend file with your local MySQL values and a long random JWT secret.

```env
VITE_API_URL=http://localhost:5000/api
```

The backend environment variables are documented in `backend/.env.example`.

For production builds, configure the public frontend origin with `VITE_SITE_URL` (HTTPS). The frontend build generates
an absolute `sitemap.xml`, adds its URL to `robots.txt`, and writes an absolute canonical and social preview URL when
that deployment origin is provided. If no origin is configured, local builds skip sitemap generation rather than
publishing an invented domain.

## 3. Initialize MySQL schema

Use the migration script to create the base schema.

```bash
mysql -u your_user -p your_database < backend/migrations/001_init.sql
```

Optionally seed demo data:

```bash
mysql -u your_user -p your_database < backend/seeds/demo.sql
```

## 4. Run in development

Frontend:
```bash
cd Frontend
npm run dev
```

Backend:
```bash
cd backend
npm run dev
```

The frontend runs at http://localhost:5173 and the backend runs at http://localhost:5000.

## 5. Production build

Frontend:
```bash
cd Frontend
npm run build
```

Backend:
```bash
cd backend
npm start
```

## 6. API routes

- `GET /api/health`
- `POST /api/contact` (rate-limited; requires the `contact_messages` table)
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/projects`
- `GET /api/projects/:id`
- `POST /api/projects`
- `POST /api/projects/:id/reviews`
- `GET /api/users/:id`

## 7. Tests

```bash
cd backend
npm test
```

## Notes

- The frontend and backend are intentionally separated under their respective directories.
- Unsplash-hosted project images request cropped, quality-adjusted sizes; creator-provided image URLs are kept as supplied.
- Authentication uses an HttpOnly session cookie; the JWT is not exposed to browser JavaScript or stored in `localStorage`.
- Run the updated migration to add the `auth_sessions` table. MySQL sessions are revocable and expire after seven days.
- Contact-form messages are stored in the `contact_messages` table; configure a production database before accepting real inquiries.
- Contact rate limiting uses the default per-process store; deployments with multiple backend instances should configure a shared rate-limit store.
- The in-memory demo data store is development-only. Production requests fail safely instead of reporting unpersisted writes during database outages.
- No analytics provider or social account is configured, so none is included or reported as active.
- The root directory contains only the required two application folders and the two root files listed in this project structure.
- A local MySQL instance is expected for the database-backed flow.
