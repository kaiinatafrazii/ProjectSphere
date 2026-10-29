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

Create `backend/.env` from `backend/.env.example` and update it with your local MySQL values.

```env
PORT=5000
JWT_SECRET=replace_with_a_secure_secret
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=projectsphere
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

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
- `POST /api/auth/register`
- `POST /api/auth/login`
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
- The root directory contains only the required two application folders and the two root files listed in this project structure.
- A local MySQL instance is expected for the database-backed flow.
