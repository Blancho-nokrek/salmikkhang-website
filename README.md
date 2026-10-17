# Salmikkhang Youth Community Website

## Included
- `index.html`, `styles.css`, `script.js`: existing public website and theme
- `admin/`: admin dashboard UI
- `member/`: member panel demo
- The header **Community** menu opens **Admin Panel** and **Member Panel**.

## Run locally
Open a terminal in this folder and run:
```bash
python -m http.server 8000
```
Then open http://localhost:8000.

## GitHub Pages
Upload the contents of this folder to the repository root (the `index.html` file must be at the published root). In repository Settings → Pages, select the correct branch and root folder.

## Important limitation
This project is a static front-end. The admin dashboard and member panel are not protected by real authentication, and browser localStorage is only local to one browser. Do not store private member data here. For a real multi-user community system, connect a secure backend/database and server-side authentication/authorization.
