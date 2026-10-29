# ProjectSphere

**Discover. Build. Share. Grow.**

ProjectSphere is a project discovery and publishing platform built for developers, students, and research teams. It provides a central space to showcase projects, explore innovative ideas, discover technologies, and engage with the developer community.

The platform features a modern React frontend, a Node.js and Express REST API, secure authentication, project submission workflows, ratings and reviews, and role-based administration.

## Features

### Project Discovery
- Browse published projects through a dedicated discovery interface.
- Explore project descriptions, technologies, categories, and available links.
- Open individual project detail pages.
- Discover projects through a clean, responsive interface.

### Project Publishing & Management
- Submit projects for review.
- Create, edit, and manage your own projects.
- Track project moderation status.
- View administrator feedback on submissions.
- Access project information and relevant repository or demo links.

### User Dashboard
- Dashboard with database-backed project statistics.
- Dedicated project management workspace.
- Project submission and editing pages.
- Bookmarks and reviews pages.
- User profile management.
- Responsive sidebar navigation.

### Administration & Moderation
- Dedicated admin dashboard.
- Overview of users, projects, and moderation activity.
- View and manage project submissions.
- Review pending projects and approve or reject submissions.
- Request changes with written feedback.
- View registered users.
- Access moderation history.
- Server-side role-based access control for admin APIs.

### Ratings & Reviews
- Submit ratings and reviews for eligible projects.
- Enforce one review per user per project.
- Prevent project owners from reviewing their own projects.
- Persist reviews in the database.
- Validate review submissions on the backend.

### Authentication & Security
- User registration and login.
- Editable profile details and profile photos.
- Password hashing with bcrypt.
- JWT-based authentication using an HttpOnly session cookie.
- Session revocation and expiration.
- Protected routes and owner-scoped project operations.
- Database-backed authorization for administrative actions.

### Contact
- Contact form with backend validation.
- Rate-limited contact submissions.
- Persistent contact-message storage in SQLite.

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React.js, Vite, React Router |
| Styling | CSS Modules, custom CSS |
| Backend | Node.js, Express.js |
| Database | SQLite (`better-sqlite3`) |
| Authentication | JWT, HttpOnly cookies, bcrypt |
| API | REST |
| Testing | Backend test suite via npm |

## Repository Structure

```text
ProjectSphere/
├── Frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── .env.example
├── backend/
│   ├── migrations/
│   ├── seeds/
│   ├── package.json
│   └── .env.example
├── .gitignore
└── README.md
```

The directory listing above describes the intended organization; the exact internal files depend on the current repository.

## Prerequisites

Install the following before running the application:

- Node.js 20 or later.
- npm 9 or later.
- Git.

Verify the installations:

```bash
node --version
npm --version
```

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/ProjectSphere.git
cd ProjectSphere
```

Replace `YOUR_USERNAME/ProjectSphere` with your actual repository URL.

### 2. Install Dependencies

Install frontend dependencies:

```bash
cd Frontend
npm install
```

Install backend dependencies:

```bash
cd ../backend
npm install
```

### 3. Configure Environment Variables

Create local environment files from the supplied examples.

For the frontend:

```bash
cd Frontend
```

Copy `.env.example` to `.env` and configure:

```env
VITE_API_URL=http://localhost:5000/api
```

For the backend:

```bash
cd ../backend
```

Copy `.env.example` to `.env` and configure a strong JWT secret, SQLite database path, server port, and frontend origin.

**Important:** Use the actual variable names defined in `backend/.env.example`. Do not commit real secrets or production credentials.

### 4. Initialize SQLite

The backend creates `backend/data/projectsphere.sqlite` and applies the versioned SQLite schema automatically on first startup. Set `SQLITE_DB_PATH` in `backend/.env` to use a different persistent file. SQLite data, WAL, SHM, and journal files are excluded from Git and are not served publicly.

### 5. Import existing MySQL data (if applicable)

The backend no longer connects to MySQL during normal operation. Existing MySQL tables are not deleted or changed. Back up your source database, configure its connection values in `backend/.env`, then run this explicit one-time import from `backend/`:

```powershell
npm run migrate:mysql
```

The importer reads supported ProjectSphere tables and inserts them into SQLite inside one transaction. Duplicate review pairs or invalid legacy rows fail and roll back the import; resolve them against a backup and retry. Existing SQLite records with matching IDs are left unchanged. If MySQL was not configured or available, no data is silently invented or discarded.

### 6. Create an Administrator Account

First, register a normal account through the application. Then promote the trusted account using a controlled database operation:

Promote a trusted existing account using SQLite:

```powershell
Set-Location backend
node --input-type=module -e "import { db } from './src/config/db.js'; const result = db.prepare('UPDATE users SET role = ? WHERE email = ?').run('admin', 'your-admin-email@example.com'); console.log('Updated accounts:', result.changes); db.close();"
```

Replace the example email with the actual registered email.

Do not expose an admin role selector on public registration or profile forms. Administrative privileges must be assigned through a trusted process.

### 7. Start the Backend

Open a terminal:

```bash
cd backend
npm run dev
```

The backend is expected to run at:

`http://localhost:5000`

### 8. Start the Frontend

Open a second terminal:

```bash
cd Frontend
npm run dev
```

The Vite development server is expected to run at:

`http://localhost:5173`

Open the frontend URL in your browser.

## Application Routes

### Public Pages

| Route | Description |
|---|---|
| `/` | Landing page |
| `/discover` | Project discovery |
| `/explore` | Alternative discovery route |
| `/projects/:id` | Project details |
| `/about` | About ProjectSphere |
| `/contact` | Contact form |
| `/login` | User login |
| `/register` | Account registration |

### User Dashboard

| Route | Description |
|---|---|
| `/dashboard` | Dashboard overview |
| `/dashboard/projects` | Manage your projects |
| `/dashboard/projects/new` | Submit a project |
| `/dashboard/projects/:id/edit` | Edit an existing project |
| `/dashboard/bookmarks` | Saved projects |
| `/dashboard/reviews` | Ratings and reviews |
| `/dashboard/profile` | User profile |

### Admin Dashboard

| Route | Description |
|---|---|
| `/admin` | Admin overview |
| `/admin/projects` | All projects |
| `/admin/projects/pending` | Pending submissions |
| `/admin/projects/approved` | Approved projects |
| `/admin/projects/rejected` | Rejected projects |
| `/admin/users` | User management |
| `/admin/moderation-history` | Moderation audit history |

Routes should be verified against the actual React Router configuration before release.

## API Reference

The following endpoints are documented for the application.

### Health & Contact

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| POST | `/api/contact` | Submit a contact message |

### Authentication

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Register a user |
| POST | `/api/auth/login` | Authenticate a user |
| GET | `/api/auth/me` | Retrieve the authenticated account |
| POST | `/api/auth/logout` | End the authenticated session |

### Projects & Reviews

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/projects` | Discover published projects |
| GET | `/api/projects/dashboard` | Retrieve user dashboard statistics |
| GET | `/api/projects/mine` | Retrieve the current user's projects |
| GET | `/api/projects/:id` | Retrieve project details |
| POST | `/api/projects` | Submit a project |
| PUT | `/api/projects/:id` | Update an owned project |
| DELETE | `/api/projects/:id` | Delete an owned project |
| POST | `/api/projects/:id/reviews` | Submit or update a review |
| POST/DELETE | `/api/projects/:id/bookmark` | Save or remove a bookmark |
| GET/PUT | `/api/users/me` | Retrieve or update your profile |
| GET | `/api/users/me/bookmarks` | Retrieve saved projects |

### Administration

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/admin/overview` | Admin dashboard statistics |
| GET | `/api/admin/projects` | Retrieve projects for moderation |
| GET | `/api/admin/reviews` | View and search persisted project reviews |
| POST | `/api/admin/projects/:id/moderate` | Moderate a project |
| GET | `/api/admin/users` | Retrieve users |
| GET | `/api/admin/history` | Retrieve moderation history |
| GET | `/api/users/:id` | Retrieve a user profile |

Authentication, validation, ownership checks, and admin authorization are enforced server-side.

## Project Moderation Workflow

1. A registered user submits a project.
2. The project enters the pending-review workflow.
3. An authorized administrator opens the submission.
4. The administrator approves it, rejects it with a reason, or requests changes.
5. The moderation decision and relevant feedback are persisted.
6. The project owner can view the updated status and feedback.
7. Public discovery displays only projects eligible for publication.

Moderation decisions should be recorded in an audit history. Private administrator feedback must not be exposed as a public review.

## Development Commands

### Frontend

```bash
cd Frontend
npm run dev
npm run build
```

Run linting if the frontend package defines a lint script:

```bash
npm run lint
```

### Backend

```bash
cd backend
npm run dev
npm start
npm test
```

Run only the commands that are defined in the respective `package.json` files.

## Production Build

Build the frontend:

```bash
cd Frontend
npm run build
```

Start the backend using the production command:

```bash
cd backend
npm start
```

Before deployment:

- Configure a persistent SQLite path and protect database backups.
- Set all required environment variables.
- Use HTTPS.
- Configure the correct frontend origin and backend API URL.
- Configure secure cookie settings for the production domain.
- Back up the database and test migrations.
- Ensure environment files and secrets are excluded from Git.
- Configure suitable logging, monitoring, and rate limiting.
- Verify that the frontend sitemap and canonical URLs use the actual deployed domain.

Set `VITE_SITE_URL` to the real public frontend origin when the frontend build requires it for sitemap and canonical metadata generation. Do not use a placeholder domain in production.

## Security Notes

- Passwords must be stored as hashes, never plaintext.
- JWTs should not be exposed to browser JavaScript when using the documented HttpOnly cookie approach.
- Admin access must be validated against the current server-side account role.
- Project operations must enforce ownership checks.
- SQL queries must use parameterized statements.
- Public discovery must follow the application's publication rules.
- Contact submissions and other sensitive endpoints should have appropriate rate limits.
- Production credentials must never be committed to the repository.

## Known Limitations & Configuration

- Notifications, account settings, a separate admin profile, and standalone admin review/feedback pages are not included in the documented route list unless implemented separately.
- MySQL configuration is needed only for the explicit migration importer.
- The SQLite database file defaults to `backend/data/projectsphere.sqlite`; set `SQLITE_DB_PATH` for a deployment-specific path.
- Profile photos support JPG, PNG, and WebP uploads; they are resized in the browser and saved as JPEG image data in the account's SQLite record.
- Contact rate limiting that uses an in-memory store is not shared across multiple backend instances.
- Production deployment requires a persistent, properly configured database.
- Analytics and social integrations should only be documented as active after they have been configured and verified.

## Contributing

1. Create a feature branch.
2. Make focused, maintainable changes.
3. Test frontend and backend changes.
4. Verify authorization and database behavior.
5. Submit a pull request describing the changes and test results.

## License

Add a `LICENSE` file and specify the applicable license before distributing the project publicly.

---

**ProjectSphere — A shared space for discovering ideas, showcasing projects, and growing as a developer.**