# Salmikkhang Village Youth Community — Frontend

A responsive bilingual (English/Bangla) static frontend prototype for the Salmikkhang village youth community.

## Included
- Nature-inspired green homepage and responsive navigation
- English/Bangla UI language switcher
- About, news, events, projects, gallery, learning, join and contact sections
- Search filtering for sample news/events/projects
- Click-to-enlarge gallery lightbox
- Contact form front-end validation and honest demo feedback
- Mobile, tablet and desktop layouts

## Run locally
You can open `index.html` directly, or use a local server:

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Important before public launch
- The photos are illustrative stock photos from Unsplash. Replace them with approved Salmikkhang community images.
- News and events are sample/placeholder content, not confirmed real announcements. Update dates and details before publishing.
- The contact form does not send or save messages yet. Connect a verified community email or a secure backend.
- Add a real privacy policy, terms of use, verified contact details, and any correct social links.
- This is a static frontend. No database, admin panel, member login, registration storage, or deployment is included.
- Add spam protection and server-side validation before accepting public submissions.

## Files
- `index.html` — page content and semantic structure
- `styles.css` — visual design and responsive breakpoints
- `script.js` — language toggle, mobile navigation, search, gallery viewer and form demo behavior


## Community login, member IDs and group chat

The existing homepage and Admin Panel are preserved. The rightmost header action now links to `community.html`. New pages: `community.html` (role dropdown, invite-code join request, member/admin login, group chat) and `members.html` (public name/photo/role directory). Admin Panel adds a protected `Community Control` section. To activate real authentication and shared chat, configure `community-config.js`, run `supabase/community_setup.sql`, create the initial admin account and deploy `supabase/functions/admin-create-account`; follow `supabase/SETUP_BN.md`. Never expose the Supabase service-role key in browser files. The original content editor remains browser-local demo data.
