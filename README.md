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
- Upload an optional private ZIP source archive for administrator review.
- Private archives are never included in public project responses.

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
- Persistent contact-message storage in MySQL.

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React.js, Vite, React Router |
| Styling | CSS Modules, custom CSS |
| Backend | Node.js, Express.js |
| Database | MySQL (`mysql2` connection pool) via XAMPP / MariaDB / Cloud MySQL |
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
- MySQL / MariaDB via **XAMPP** (or standalone MySQL 8+ server).

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

Copy `.env.example` to `.env` and configure your MySQL database credentials, JWT secret, server port, and frontend origin.

**Important:** Use the actual variable names defined in `backend/.env.example`. Do not commit real secrets or production credentials.

### 4. Database Setup with XAMPP MySQL

> **Note:** For a dedicated step-by-step guide on MySQL ports, connection URLs, and resolving Render deployment errors, see [XAMPP_MYSQL_GUIDE.md](file:///c:/Users/kainat%20afrazi/OneDrive/Desktop/ProjectSphere/XAMPP_MYSQL_GUIDE.md).

1. **Start MySQL in XAMPP:**
   - Open the **XAMPP Control Panel** and click **Start** next to MySQL (or run `C:\xampp\mysql_start.bat`).
   - By default, XAMPP runs MySQL on port `3306` with user `root` and an empty password.

2. **Configure backend `.env`:**
   ```env
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=projectsphere_app
   DB_CONNECTION_LIMIT=10
   DB_SSL=false
   ```

3. **Run Migrations:**
   The backend automatically ensures the database exists and creates all required tables on startup. You can also run migrations explicitly:
   ```powershell
   npm run migrate
   ```

4. **(Optional) Seed Development Data:**
   Populate the database with sample projects for development:
   ```powershell
   npm run seed:dev
   ```

### 5. Create an Administrator Account

The development-only command below creates or updates an administrator account in MySQL. It hashes the password, uses a transaction, and revokes existing sessions when updating an account. It refuses to run when `NODE_ENV=production`.

```powershell
Set-Location backend
$env:ADMIN_EMAIL = 'your-development-admin@example.test'
$env:ADMIN_PASSWORD = 'choose-a-local-development-password'
npm run setup:admin
Remove-Item Env:ADMIN_EMAIL
Remove-Item Env:ADMIN_PASSWORD
```

Use a unique development password, change it after first sign-in, and never reuse it in a deployed environment. Credentials can also be configured in `backend/.env` using `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

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
| `/creators/:id` | Public profile and published projects for a creator |
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
| `/admin/reviews` | Ratings and reviews |
| `/admin/contact-messages` | Review contact form messages |
| `/admin/moderation-history` | Moderation audit history |
| `/admin/profile` | Administrator profile and password |
| `/admin/login` | Dedicated administrator login |

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
| GET/POST | `/api/projects/:id/source-code` | View your archive metadata or submit/replace your private ZIP archive |
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
| GET | `/api/admin/projects/:id` | View full project, owner, reviews, moderation history, and private archive metadata |
| GET | `/api/admin/projects/:id/source-code/download` | Download a private project ZIP archive |
| GET | `/api/admin/reviews` | View and search persisted project reviews |
| POST | `/api/admin/projects/:id/moderate` | Moderate a project |
| GET | `/api/admin/users` | Retrieve users |
| GET | `/api/admin/users/:id` | View a user's profile, projects, and reviews |
| GET | `/api/admin/contact-messages` | List contact form submissions |
| PATCH | `/api/admin/contact-messages/:id` | Mark a contact message read or unread |
| GET | `/api/admin/history` | Retrieve moderation history |
| GET | `/api/admin/profile` | Retrieve the signed-in administrator profile |
| PUT | `/api/admin/password` | Change the admin password and revoke other sessions |
| GET | `/api/users/:id` | Retrieve a user profile |

Authentication, validation, ownership checks, and admin authorization are enforced server-side.

Private archive uploads accept ZIP files up to 20 MB. The backend checks the extension, media type, and ZIP signature, assigns a generated storage key, and saves the file outside public web directories. Uploaded code is never extracted or executed. Only an authenticated administrator can download an archive; public project APIs never return private archive metadata or storage locations.

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

- Configure MySQL connection variables (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`).
- For Render or cloud-hosted MySQL databases, set `DB_SSL=true` and `DB_SSL_REJECT_UNAUTHORIZED=false` (or provide `DB_SSL_CA`).
- Set all required environment variables (`JWT_SECRET`, `NODE_ENV=production`, `FRONTEND_URL`).
- Use HTTPS.
- Configure the correct frontend origin and backend API URL.
- Configure secure cookie settings for the production domain.
- Run `npm run provision:admin` to initialize the designated production administrator.
- Ensure environment files and secrets are excluded from Git.
- Configure suitable logging, monitoring, and rate limiting.
- Verify that the frontend sitemap and canonical URLs use the actual deployed domain.

### Production Deployment on Render

1. **Deploying the Backend on Render:**
   - Create a **Web Service** pointing to the repository's `backend` directory.
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Add the following Environment Variables in the Render dashboard:
     ```env
     NODE_ENV=production
     PORT=5000
     JWT_SECRET=<strong-random-32-plus-char-secret>
     FRONTEND_URL=https://<your-frontend-domain>
     DB_HOST=<render-or-cloud-mysql-host>
     DB_PORT=3306
     DB_USER=<mysql-user>
     DB_PASSWORD=<mysql-password>
     DB_NAME=<mysql-database-name>
     DB_SSL=true
     DB_SSL_REJECT_UNAUTHORIZED=false
     ```
   - On startup, the backend automatically connects to MySQL, checks table definitions, and applies all required migrations.

2. **Deploying the Frontend:**
   - Create a **Static Site** on Render (or Vercel) pointing to `Frontend`.
   - Build Command: `npm run build`
   - Publish Directory: `dist`
   - Set `VITE_API_URL=https://<your-backend-domain>/api`

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

- Notifications and account settings are fully supported via MySQL models.
- Backend runs with `mysql2` and a connection pool (`DB_CONNECTION_LIMIT=10`).
- Profile photos support JPG, PNG, and WebP uploads; they are resized in the browser and stored in MySQL user records.
- Contact rate limiting that uses an in-memory store is not shared across multiple backend instances.
- Production deployment requires a persistent, properly configured MySQL database.
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