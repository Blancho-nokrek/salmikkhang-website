# Salmikkhang Admin Workspace

The existing dashboard design and original news/events/projects/gallery/request/message views are retained. The admin workspace is now protected by the server; opening `/admin/` without an active administrator session redirects to sign-in.

## Access

1. Start the project from its root folder with `python3 server.py`.
2. Create the first admin at `/setup.html` on first run.
3. Sign in at `/login.html` using the admin name, role **Admin**, and the passcode you created.
4. Open **Member accounts** to generate member IDs and initial passwords, **Roles** to maintain the role dropdown, or **Community chat** to send/delete messages.

The database is stored in `instance/salmikkhang.db`. Passwords are hashed server-side; do not share admin credentials or commit the database to a public repository.

The older CMS-style data views are preserved as they were and continue to use browser localStorage. Their edits do not automatically publish content to all website visitors; this is noted in the main README.
