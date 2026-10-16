# Salmikkhang Admin Panel (Frontend Demo)

A responsive admin dashboard for the Salmikkhang Youth Community website.

## Run locally
1. Extract the ZIP.
2. Open a terminal in this folder.
3. Run `python -m http.server 8000`
4. Visit http://localhost:8000

You can also open `index.html` directly, though a local server is recommended.

## Included
- Dashboard metrics and activity
- CRUD-style management for members, news, events, projects, join requests and messages
- Gallery album label management
- English/Bangla language toggle for navigation and key labels
- Search, approve join requests, delete/edit records
- Community settings, JSON export, demo reset
- Responsive mobile sidebar and dark mode
- Browser localStorage persistence

## Important security limitation
This is a **frontend-only prototype**. It has no real login, server, database, permissions, or server-side validation. Any visitor can access the panel and browser-stored data is not shared between users/devices. Do not enter real private member information. Before production, add secure authentication and authorization, a backend API, database, input validation, HTTPS, backups, and secure image storage.


## Community login, member IDs and group chat

The existing homepage and Admin Panel are preserved. The rightmost header action now links to `community.html`. New pages: `community.html` (role dropdown, invite-code join request, member/admin login, group chat) and `members.html` (public name/photo/role directory). Admin Panel adds a protected `Community Control` section. To activate real authentication and shared chat, configure `community-config.js`, run `supabase/community_setup.sql`, create the initial admin account and deploy `supabase/functions/admin-create-account`; follow `supabase/SETUP_BN.md`. Never expose the Supabase service-role key in browser files. The original content editor remains browser-local demo data.
