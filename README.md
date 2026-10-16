# Salmikkhang Village Youth Community

A responsive bilingual (English/Bangla) village youth community website, retaining the original homepage design and admin dashboard, with server-backed sign-in, role management, member accounts and a private group chat.

## Run locally (Arch Linux / Linux / macOS)

Python 3 is the only runtime requirement. No `pip install` or npm packages are needed.

```bash
cd salmikkhang-website
python3 server.py
```

Open **http://127.0.0.1:8000**. On the first run, open **http://127.0.0.1:8000/setup.html** and create your own admin name and passcode (at least 10 characters). There is no preset admin password. Once created, the first-time setup page is disabled and admin access requires that name, the `Admin` role and the passcode.

If port 8000 is in use:

```bash
PORT=8080 python3 server.py
```

Stop the server with `Ctrl+C`. Account data and chat messages are saved in `instance/salmikkhang.db`. Back up this directory regularly; do not commit it to a public repository.

## Added functionality

- Role-aware sign-in with the roles list delivered by the server.
- First-run creation of the first administrator, with server-side role checks and hashed passwords/passcodes.
- Admin panel pages for creating/deactivating/deleting member accounts, assigning roles and resetting member passwords.
- Admin-managed roles, reflected in the sign-in dropdown. The reserved Admin role cannot be assigned to member accounts.
- A WhatsApp-inspired private community chat at `/community.html`, with server-persisted messages, automatic refresh, password changes and admin message moderation.
- A **Community** chat shortcut placed beside **Join Our Community** in the homepage header (compact icon on small screens).
- Original homepage content, styling and existing admin dashboard pages retained.

## How members join

An admin signs in, opens **Member accounts**, creates a member ID, chooses a role and sets an initial password. Share those credentials privately with the member. The member signs in at `/login.html` and can change their password from the Community page.

## Security / deployment notes

The database uses SQLite, passwords are stored with PBKDF2-HMAC-SHA256 hashes, sessions use opaque server-side tokens in HttpOnly/SameSite cookies, the server enforces admin permissions, and sign-in attempts are temporarily throttled after repeated failures. These are useful baseline protections, not a substitute for a production security review.

- For an internet-facing deployment, use a maintained Python hosting service/reverse proxy with HTTPS, set `COOKIE_SECURE=1`, use a strong unique admin passcode, keep Python and the host updated, and back up the database securely.
- Do not expose the development server directly to the public internet. The included server uses Python's standard-library HTTP server and is intended for local testing or a trusted/private deployment behind proper HTTPS infrastructure.
- GitHub Pages and other static-only hosting cannot run this backend, provide secure server-side authentication, or persist a shared chat. Deploy the whole project to a Python-capable host if you need these functions.
- The public news/events/projects and the legacy CMS-style content editing views remain the original front-end prototype and still use browser local storage. Server-backed authentication, member accounts, role management and chat are shared and persistent. Do not treat those legacy content edits as published site-wide CMS changes.
- Replace illustrative images and placeholder news/events with approved, verified community content before public launch. Add a proper privacy policy and community guidelines.

## Project structure

- `index.html`, `styles.css`, `script.js` — original public website
- `login.html`, `setup.html`, `auth.css`, `auth.js` — sign-in and first-admin setup
- `community.html`, `community.css`, `community.js` — member group chat
- `admin/` — existing dashboard, now protected, with member-account, role and chat-moderation pages added
- `server.py` — standard-library HTTP server, APIs, authentication and SQLite database
- `instance/` — created automatically for the database (ignored by Git)
