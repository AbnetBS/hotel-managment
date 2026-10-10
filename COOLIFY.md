# Deploy on Coolify (VPS)

One service for the web app + API, one PostgreSQL database. No other moving parts.

## 1. Push the project to GitHub

Everything needed is in this repository. Push it to a GitHub repo you control.

## 2. Create the database in Coolify

**New Resource → Databases → PostgreSQL**

- Version 16
- Note the connection string it gives you, it looks like:
  `postgres://user:password@host:5432/dbname`

## 3. Create the application

**New Resource → Application → pick your GitHub repo**

| Setting | Value |
| --- | --- |
| Build pack | **Dockerfile** (found automatically) |
| Port | `4000` |
| Health check path | `/api/health` |
| Environment variables | see below |

### Environment variables

| Name | Value |
| --- | --- |
| `DATABASE_URL` | the PostgreSQL connection string from step 2 |
| `NODE_ENV` | `production` |
| `PORT` | `4000` |

### Persistent storage (Volumes)

| Name | Container path |
| --- | --- |
| uploads | `/app/server/uploads` |

(Menu photos, room photos and staff uploads survive restarts and redeploys.)

Then **Deploy**. The first boot creates the demo hotel (rooms, menu, staff) and
prints the version in the logs.

## 4. Point a domain at it

Coolify → your application → **Domains** → add `hotel.yourdomain.com`, enable
HTTPS. The app works on the generated `*.sslip.io` address too.

## 5. After the first login

1. Sign in as **admin** (username `admin`, PIN `1234` — change it immediately
   under **Staff & access**).
2. **Hotel settings** → set the hotel name, phone, address and the text that
   appears on the website home page (hero title and tagline).
3. Set up rooms, prices and the menu — or keep the demo hotel and edit from there.

## Using PostgreSQL or the built-in SQLite

- **PostgreSQL (recommended):** set `DATABASE_URL` as above. The system detects it
  and stores everything in PostgreSQL.
- **SQLite (no database server):** leave `DATABASE_URL` empty. Data lives in
  `/app/server/data/clove.db` — mount that path as a volume too if you choose this.

## Receipt printers (USB / captain order printers)

Receipts and kitchen tickets print through the browser's print dialog, so any
printer the computer already knows works — USB thermal receipt printers
(80 mm) and captain order printers included. Open the site on the desk
computer, press **Print receipt**, pick the printer, done. Use the
"Save as PDF" option to keep an electronic copy.

## If something fails to log in

- The page loads but the sign-in panel says the server is not responding →
  the API is not reachable. In Coolify check that the build pack is
  **Dockerfile**, the port is `4000`, and the container is running.
- A wrong PIN repeated too often pauses sign-in from that network for a few
  minutes — wait, or clear it from **Audit log** while signed in as admin.
