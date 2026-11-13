# MySQL Port, URL, and XAMPP Setup Guide (Local & Render)

This guide explains how to find/configure your MySQL **Port** and **URL** in **XAMPP**, why the Render deployment showed `ECONNREFUSED 127.0.0.1:3306`, and how to properly connect both locally and on Render.

---

## 1. Why Did Render Show `connect ECONNREFUSED 127.0.0.1:3306`?

- **Render runs in the cloud** on remote Linux servers.
- **`127.0.0.1` (localhost)** inside Render points to Render's own container, **not your personal computer**.
- Your local **XAMPP MySQL only runs on your laptop/PC**. Render cannot access `127.0.0.1` on your laptop unless you provide a **Cloud MySQL database** (like TiDB, Aiven, or Railway) or an external connection.
- When Render started `npm start` without cloud MySQL environment variables configured, the backend fell back to `127.0.0.1:3306` where no MySQL was running inside the container.

---

## 2. Local Setup: MySQL Port & URL in XAMPP

### Step 1: Check your MySQL Port in XAMPP

1. Open the **XAMPP Control Panel**.
2. Look at the **MySQL** module:
   - When you click **Start**, the **Port(s)** column typically displays `3306`.
3. If port `3306` is blocked or in use by another program:
   - Click **Config** next to MySQL -> select `my.ini`.
   - Look for `port=3306` (under `[client]` and `[mysqld]`).
   - If you change it (e.g. to `3307`), save the file and restart MySQL in XAMPP.

### Step 2: Open phpMyAdmin

> [!IMPORTANT]
> **Apache must be running** in XAMPP to open phpMyAdmin.
> - **MySQL** handles the database connections (Port 3306).
> - **Apache** serves the phpMyAdmin web browser interface (Port 80).
> - If Apache is stopped, the browser will show `ERR_CONNECTION_REFUSED`. Make sure to click **Start** next to **Apache** in the XAMPP Control Panel.

1. Open your browser and go to:
   ```text
   http://localhost/phpmyadmin
   ```
2. Click **New** on the left sidebar.
3. Enter Database Name: `projectsphere_app`.
4. Collation: `utf8mb4_unicode_ci`.
5. Click **Create**.
   *(Note: The backend also auto-creates the database on startup if it doesn't already exist).*

### Step 3: Construct the Local MySQL URL

The MySQL connection URL format is:

```text
mysql://<user>:<password>@<host>:<port>/<database>
```

In default XAMPP:

- **User:** `root`
- **Password:** *(empty)*
- **Host:** `127.0.0.1`
- **Port:** `3306`
- **Database:** `projectsphere_app`

Your complete Local Database URL is:

```text
mysql://root:@127.0.0.1:3306/projectsphere_app
```

### Step 4: Configure `backend/.env` for Local Development

In `backend/.env`, set:

```env
PORT=5000
JWT_SECRET=projectsphere-local-dev-secret-key-32chars
FRONTEND_URL=http://localhost:5173
NODE_ENV=development

# MySQL settings (Option A: individual variables)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=projectsphere_app
DB_SSL=false

# OR (Option B: full database URL)
# DATABASE_URL=mysql://root:@127.0.0.1:3306/projectsphere_app
```

Then run the migration script:

```powershell
cd backend
npm run migrate
npm run setup:admin
```

---

## 3. Render Deployment: How to Connect MySQL in the Cloud

Because Render cannot connect to your laptop's XAMPP `127.0.0.1`, you need a **free cloud-hosted MySQL database**.

### Step 1: Create a Free Cloud MySQL Database

Choose any of these free cloud providers (takes ~2 minutes):

1. **TiDB Cloud (Recommended - Free Tier with MySQL Compatibility):**

   - Go to [https://tidbcloud.com](https://tidbcloud.com) and sign up.
   - Create a free **Serverless Cluster**.
   - Click **Connect** -> Choose **Node.js** or **General**.
   - Copy the connection parameters (`Host`, `Port`, `User`, `Password`, `Database`).
2. **Aiven (Free MySQL):**

   - Go to [https://aiven.io](https://aiven.io) -> Create a free MySQL service.
   - Copy the Service URI (e.g. `mysql://avnadmin:password@host:port/defaultdb?ssl-mode=REQUIRED`).
3. **Clever Cloud / Railway:**

   - Create a free MySQL addon.
   - Copy the `MYSQL_URL` or `DATABASE_URL`.

---

### Step 2: Add Environment Variables in Render Dashboard

1. Go to your **Render Dashboard**: [https://dashboard.render.com](https://dashboard.render.com).
2. Click on your **ProjectSphere Backend Web Service**.
3. In the left menu, click **Environment**.
4. Add the following environment variables:

| Key                            | Example Value                                    | Description                                   |
| ------------------------------ | ------------------------------------------------ | --------------------------------------------- |
| `NODE_ENV`                   | `production`                                   | Production environment flag                   |
| `PORT`                       | `5000`                                         | Backend port                                  |
| `JWT_SECRET`                 | `your-secret-key-minimum-32-characters-long!`  | Secure session token secret                   |
| `FRONTEND_URL`               | `https://your-frontend.vercel.app`             | Allowed CORS frontend URL                     |
| `DATABASE_URL`               | `mysql://user:password@cloud-host:3306/dbname` | **Single connection URL** (Recommended) |
| `DB_SSL`                     | `true`                                         | Required for cloud databases                  |
| `DB_SSL_REJECT_UNAUTHORIZED` | `false`                                        | Prevents self-signed cert rejections          |

> **Alternative (Separate DB Variables):**
> If you prefer individual variables instead of `DATABASE_URL`, set:
>
> - `DB_HOST` = `<cloud-mysql-host>`
> - `DB_PORT` = `3306` (or provider's port)
> - `DB_USER` = `<cloud-username>`
> - `DB_PASSWORD` = `<cloud-password>`
> - `DB_NAME` = `<database-name>`
> - `DB_SSL` = `true`
> - `DB_SSL_REJECT_UNAUTHORIZED` = `false`

5. Click **Save Changes**.
6. Render will automatically trigger a new deployment. The backend will connect to your cloud MySQL, initialize tables, and start successfully without `ECONNREFUSED`!

---

## 4. Quick Verification Commands

### Test connection locally via Node.js

From the `backend` folder:

```powershell
node -e "import('./src/config/db.js').then(async (m) => { console.log('DB Available:', await m.isDatabaseAvailable()); await m.closeDatabase(); });"
```

### Run migrations:

```powershell
npm run migrate
```

### Run all tests:

```powershell
npm test
```
