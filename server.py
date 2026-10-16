#!/usr/bin/env python3
"""Salmikkhang community website server (Python standard library only)."""
from __future__ import annotations
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from http.cookies import SimpleCookie
from urllib.parse import urlparse, parse_qs, unquote

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "instance"
DB_PATH = DATA_DIR / "salmikkhang.db"
PORT = int(os.environ.get("PORT", "8000"))
HOST = os.environ.get("HOST", "127.0.0.1")
SESSION_SECONDS = 7 * 24 * 60 * 60
PBKDF2_ROUNDS = 310_000
MEMBER_ID_RE = re.compile(r"^[A-Za-z0-9._-]{3,32}$")
ROLE_RE = re.compile(r"^[\w][\w .-]{1,30}$", re.UNICODE)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect_db() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    try:
        os.chmod(DATA_DIR, 0o700)
    except OSError:
        pass
    conn = sqlite3.connect(DB_PATH, timeout=15)
    try:
        if DB_PATH.exists():
            os.chmod(DB_PATH, 0o600)
    except OSError:
        pass
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db() -> None:
    with connect_db() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE COLLATE NOCASE,
            is_system INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            member_id TEXT UNIQUE COLLATE NOCASE,
            role_id INTEGER NOT NULL REFERENCES roles(id),
            password_hash TEXT NOT NULL,
            is_admin INTEGER NOT NULL DEFAULT 0,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
            token_hash TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            expires_at INTEGER NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            sender_name TEXT NOT NULL,
            sender_role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS auth_attempts (
            ip TEXT PRIMARY KEY,
            failures INTEGER NOT NULL DEFAULT 0,
            window_started INTEGER NOT NULL,
            locked_until INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(id);
        CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
        """)
        # The first roles are convenient starter roles. Admin can add/delete roles later.
        count = db.execute("SELECT COUNT(*) FROM roles").fetchone()[0]
        if count == 0:
            db.executemany(
                "INSERT INTO roles(name,is_system,created_at) VALUES(?,?,?)",
                [("Member", 1, now_iso()), ("Volunteer", 0, now_iso()), ("Coordinator", 0, now_iso())],
            )
        db.execute("DELETE FROM sessions WHERE expires_at < ?", (int(time.time()),))


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ROUNDS)
    import base64
    return f"pbkdf2_sha256${PBKDF2_ROUNDS}${base64.urlsafe_b64encode(salt).decode()}${base64.urlsafe_b64encode(digest).decode()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        import base64
        scheme, rounds, salt_text, digest_text = encoded.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        salt = base64.urlsafe_b64decode(salt_text.encode())
        expected = base64.urlsafe_b64decode(digest_text.encode())
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(rounds))
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def admin_exists(db: sqlite3.Connection) -> bool:
    return db.execute("SELECT 1 FROM users WHERE is_admin=1 LIMIT 1").fetchone() is not None


def safe_user(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"], "name": row["name"], "memberId": row["member_id"],
        "role": row["role_name"], "isAdmin": bool(row["is_admin"]),
        "isActive": bool(row["is_active"]), "createdAt": row["created_at"],
    }


def get_user_by_id(db: sqlite3.Connection, user_id: int):
    return db.execute("""SELECT u.*, r.name AS role_name FROM users u
        JOIN roles r ON r.id=u.role_id WHERE u.id=?""", (user_id,)).fetchone()


class Handler(SimpleHTTPRequestHandler):
    server_version = "SalmikkhangServer/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def log_message(self, fmt, *args):
        # Keep normal request logs, but never print request bodies/passwords.
        super().log_message(fmt, *args)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        super().end_headers()

    def read_json(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length > 65_536:
            raise ValueError("Request is too large.")
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        try:
            value = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise ValueError("Please send valid JSON.")
        if not isinstance(value, dict):
            raise ValueError("Invalid request data.")
        return value

    def json_response(self, status: int, data: dict, extra_headers=None):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        if extra_headers:
            for key, value in extra_headers:
                self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def error(self, status: int, message: str):
        self.json_response(status, {"error": message})

    def cookie_headers(self, token: str | None):
        secure = os.environ.get("COOKIE_SECURE", "").lower() in {"1", "true", "yes"} or self.headers.get("X-Forwarded-Proto", "").lower() == "https"
        bits = [f"salmikkhang_session={token or ''}", "Path=/", "HttpOnly", "SameSite=Strict"]
        bits.append(f"Max-Age={SESSION_SECONDS}" if token else "Max-Age=0")
        if secure:
            bits.append("Secure")
        return [("Set-Cookie", "; ".join(bits))]

    def session_token(self):
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
            return cookie["salmikkhang_session"].value if "salmikkhang_session" in cookie else None
        except Exception:
            return None

    def current_user(self, db):
        token = self.session_token()
        if not token:
            return None, None
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        row = db.execute("""SELECT s.token_hash, u.*, r.name AS role_name FROM sessions s
            JOIN users u ON u.id=s.user_id JOIN roles r ON r.id=u.role_id
            WHERE s.token_hash=? AND s.expires_at>? AND u.is_active=1""",
            (token_hash, int(time.time()))).fetchone()
        return (row, token_hash) if row else (None, token_hash)

    def require_user(self, db, admin=False):
        user, token_hash = self.current_user(db)
        if user is None:
            self.error(401, "Please sign in to continue.")
            return None, None
        if admin and not user["is_admin"]:
            self.error(403, "Admin permission is required.")
            return None, None
        return user, token_hash

    def do_GET(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        # Never expose the SQLite database, local metadata, or Python source through static file serving.
        if path == "/server.py" or path == "/.gitignore" or path.startswith(("/instance/", "/instance", "/.git/", "/.git", "/__pycache__/", "/__pycache__")) or path.endswith((".pyc", ".db", ".db-wal", ".db-shm")):
            self.send_error(404, "Not found")
            return
        if path.startswith("/api/"):
            self.api_get(path, parse_qs(parsed.query))
            return
        if path in ("/admin", "/admin/"):
            self.send_response(301); self.send_header("Location", "/admin/index.html"); self.end_headers(); return
        if path.startswith("/admin/") or path.startswith("/docs/admin/"):
            with connect_db() as db:
                user, _ = self.current_user(db)
            if not user or not user["is_admin"]:
                self.send_response(302)
                self.send_header("Location", "/login.html?next=%2Fadmin%2Findex.html")
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                return
        if path == "/setup.html":
            with connect_db() as db:
                if admin_exists(db):
                    self.send_response(302); self.send_header("Location", "/login.html"); self.end_headers(); return
        return super().do_GET()

    def do_POST(self):
        path = unquote(urlparse(self.path).path)
        if not path.startswith("/api/"):
            self.error(404, "Not found."); return
        try:
            payload = self.read_json()
            self.api_post(path, payload)
        except ValueError as exc:
            self.error(400, str(exc))
        except sqlite3.IntegrityError as exc:
            message = "That member ID or role already exists, or the item is in use."
            self.error(409, message)
        except Exception as exc:
            # Log server-side details only; do not leak database paths/errors to clients.
            print(f"API error on {path}: {type(exc).__name__}: {exc}")
            self.error(500, "Something went wrong. Please try again.")

    def do_PUT(self):
        path = unquote(urlparse(self.path).path)
        if not path.startswith("/api/"):
            self.error(404, "Not found."); return
        try:
            self.api_put(path, self.read_json())
        except ValueError as exc:
            self.error(400, str(exc))
        except sqlite3.IntegrityError:
            self.error(409, "That member ID already exists.")
        except Exception as exc:
            print(f"API error on {path}: {type(exc).__name__}: {exc}")
            self.error(500, "Something went wrong. Please try again.")

    def do_DELETE(self):
        path = unquote(urlparse(self.path).path)
        if not path.startswith("/api/"):
            self.error(404, "Not found."); return
        try:
            self.api_delete(path)
        except Exception as exc:
            print(f"API error on {path}: {type(exc).__name__}: {exc}")
            self.error(500, "Something went wrong. Please try again.")

    def api_get(self, path, query):
        with connect_db() as db:
            if path == "/api/setup-status":
                self.json_response(200, {"setupRequired": not admin_exists(db)}); return
            if path == "/api/roles":
                roles = [r["name"] for r in db.execute("SELECT name FROM roles ORDER BY is_system DESC, name COLLATE NOCASE")]
                self.json_response(200, {"roles": ["Admin"] + [r for r in roles if r.casefold() != "admin"]}); return
            if path == "/api/me":
                user, _ = self.current_user(db)
                if not user:
                    self.json_response(401, {"error": "Not signed in."}); return
                self.json_response(200, {"user": safe_user(user)}); return
            if path == "/api/admin/users":
                admin, _ = self.require_user(db, True)
                if not admin: return
                rows = db.execute("""SELECT u.*,r.name AS role_name FROM users u JOIN roles r ON r.id=u.role_id
                    ORDER BY u.is_admin DESC,u.created_at DESC""").fetchall()
                self.json_response(200, {"users": [safe_user(r) for r in rows]}); return
            if path == "/api/admin/roles":
                admin, _ = self.require_user(db, True)
                if not admin: return
                rows = db.execute("""SELECT r.id,r.name,r.is_system,r.created_at,COUNT(u.id) AS member_count
                    FROM roles r LEFT JOIN users u ON u.role_id=r.id GROUP BY r.id
                    ORDER BY r.is_system DESC,r.name COLLATE NOCASE""").fetchall()
                self.json_response(200, {"roles": [dict(id=r["id"],name=r["name"],isSystem=bool(r["is_system"]),createdAt=r["created_at"],memberCount=r["member_count"]) for r in rows]}); return
            if path in ("/api/community/messages", "/api/admin/messages"):
                user, _ = self.require_user(db, path.startswith("/api/admin/"))
                if not user: return
                try: after = max(0, int(query.get("after", ["0"])[0]))
                except ValueError: after = 0
                if after == 0:
                    rows = db.execute("SELECT * FROM (SELECT * FROM messages ORDER BY id DESC LIMIT 100) ORDER BY id ASC").fetchall()
                else:
                    rows = db.execute("SELECT * FROM messages WHERE id>? ORDER BY id ASC LIMIT 100", (after,)).fetchall()
                self.json_response(200, {"messages": [self.message_dict(r) for r in rows]}); return
        self.error(404, "Not found.")

    @staticmethod
    def message_dict(r):
        return {"id": r["id"], "userId": r["user_id"], "senderName": r["sender_name"], "senderRole": r["sender_role"], "content": r["content"], "createdAt": r["created_at"]}

    def api_post(self, path, payload):
        with connect_db() as db:
            if path == "/api/setup-admin":
                if admin_exists(db):
                    self.error(409, "The first administrator has already been created."); return
                name = str(payload.get("name", "")).strip()
                passcode = str(payload.get("passcode", ""))
                if not 2 <= len(name) <= 80: raise ValueError("Enter an admin name with at least 2 characters.")
                if len(passcode) < 10 or len(passcode) > 200: raise ValueError("Choose an admin passcode with at least 10 characters.")
                role = db.execute("SELECT id FROM roles WHERE name='Member' COLLATE NOCASE").fetchone()
                if not role:
                    role_id = db.execute("INSERT INTO roles(name,is_system,created_at) VALUES('Member',1,?)", (now_iso(),)).lastrowid
                else: role_id = role["id"]
                db.execute("INSERT INTO users(name,member_id,role_id,password_hash,is_admin,is_active,created_at) VALUES(?,NULL,?,?,1,1,?)",
                           (name, role_id, hash_password(passcode), now_iso()))
                db.commit()
                self.json_response(201, {"ok": True, "message": "Admin created. Sign in to continue."}); return
            if path == "/api/login/admin":
                if not self._login_guard(db): return
                name = str(payload.get("name", "")).strip()
                role = str(payload.get("role", ""))
                passcode = str(payload.get("passcode", ""))
                if role != "Admin": self._login_failed(db); self.error(401, "Choose the Admin role to sign in as admin."); return
                row = db.execute("""SELECT u.*,r.name AS role_name FROM users u JOIN roles r ON r.id=u.role_id
                    WHERE u.is_admin=1 AND u.is_active=1 AND u.name=? COLLATE NOCASE LIMIT 1""", (name,)).fetchone()
                if not row or not verify_password(passcode, row["password_hash"]):
                    self._login_failed(db); self.error(401, "Admin name or passcode is incorrect."); return
                self._login_success(db, row); return
            if path == "/api/login/member":
                if not self._login_guard(db): return
                member_id = str(payload.get("memberId", "")).strip()
                password = str(payload.get("password", ""))
                selected_role = str(payload.get("role", "")).strip()
                row = db.execute("""SELECT u.*,r.name AS role_name FROM users u JOIN roles r ON r.id=u.role_id
                    WHERE u.is_admin=0 AND u.member_id=? COLLATE NOCASE AND u.is_active=1 AND r.name=? COLLATE NOCASE LIMIT 1""",
                    (member_id, selected_role)).fetchone()
                if not row or not verify_password(password, row["password_hash"]):
                    self._login_failed(db); self.error(401, "Member ID, role or password is incorrect."); return
                self._login_success(db, row); return
            if path == "/api/logout":
                token = self.session_token()
                if token:
                    token_hash = hashlib.sha256(token.encode()).hexdigest()
                    db.execute("DELETE FROM sessions WHERE token_hash=?", (token_hash,))
                self.json_response(200, {"ok": True}, self.cookie_headers(None)); return
            if path == "/api/account/password":
                user, token_hash = self.require_user(db)
                if not user: return
                old = str(payload.get("currentPassword", ""))
                new = str(payload.get("newPassword", ""))
                if not verify_password(old, user["password_hash"]): self.error(400, "Current password/passcode is incorrect."); return
                if len(new) < 8 or len(new) > 200: raise ValueError("New password must contain at least 8 characters.")
                if old == new: raise ValueError("Choose a new password different from your current one.")
                db.execute("UPDATE users SET password_hash=? WHERE id=?", (hash_password(new), user["id"]))
                db.execute("DELETE FROM sessions WHERE user_id=? AND token_hash<>?", (user["id"], token_hash or ""))
                self.json_response(200, {"ok": True, "message": "Password changed successfully."}); return
            if path == "/api/community/messages":
                user, _ = self.require_user(db)
                if not user: return
                content = str(payload.get("content", "")).strip()
                if not content: raise ValueError("Write a message first.")
                if len(content) > 2000: raise ValueError("Messages must be 2,000 characters or fewer.")
                db.execute("INSERT INTO messages(user_id,sender_name,sender_role,content,created_at) VALUES(?,?,?,?,?)",
                           (user["id"], user["name"], user["role_name"], content, now_iso()))
                msg_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
                row = db.execute("SELECT * FROM messages WHERE id=?", (msg_id,)).fetchone()
                self.json_response(201, {"message": self.message_dict(row)}); return
            if path == "/api/admin/users":
                admin, _ = self.require_user(db, True)
                if not admin: return
                name = str(payload.get("name", "")).strip()
                member_id = str(payload.get("memberId", "")).strip()
                password = str(payload.get("password", ""))
                role_name = str(payload.get("role", "")).strip()
                if not 2 <= len(name) <= 80: raise ValueError("Full name must be between 2 and 80 characters.")
                if not MEMBER_ID_RE.fullmatch(member_id): raise ValueError("Member ID must be 3–32 characters and use letters, numbers, dot, underscore or hyphen.")
                if len(password) < 8 or len(password) > 200: raise ValueError("Initial password must contain at least 8 characters.")
                role = db.execute("SELECT id,name FROM roles WHERE name=? COLLATE NOCASE", (role_name,)).fetchone()
                if not role or role["name"].casefold() == "admin": raise ValueError("Choose a role created in role management. Admin is reserved.")
                db.execute("INSERT INTO users(name,member_id,role_id,password_hash,is_admin,is_active,created_at) VALUES(?,?,?,?,0,1,?)",
                           (name, member_id, role["id"], hash_password(password), now_iso()))
                user_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
                db.commit()
                self.json_response(201, {"ok": True, "user": safe_user(get_user_by_id(db, user_id))}); return
            if path == "/api/admin/roles":
                admin, _ = self.require_user(db, True)
                if not admin: return
                name = str(payload.get("name", "")).strip()
                if not ROLE_RE.fullmatch(name): raise ValueError("Role name must be 2–32 characters and use letters, numbers, spaces, dots, underscores or hyphens.")
                if name.casefold() == "admin": raise ValueError("Admin is a reserved role and cannot be recreated.")
                db.execute("INSERT INTO roles(name,is_system,created_at) VALUES(?,0,?)", (name, now_iso()))
                db.commit()
                self.json_response(201, {"ok": True, "name": name}); return
        self.error(404, "Not found.")

    def api_put(self, path, payload):
        if path.startswith("/api/admin/users/"):
            try: user_id = int(path.rsplit("/", 1)[1])
            except ValueError: self.error(400, "Invalid account ID."); return
            with connect_db() as db:
                admin, _ = self.require_user(db, True)
                if not admin: return
                target = get_user_by_id(db, user_id)
                if not target or target["is_admin"]:
                    self.error(404, "Member account not found."); return
                name = str(payload.get("name", target["name"])).strip()
                role_name = str(payload.get("role", target["role_name"])).strip()
                active = bool(payload.get("isActive", bool(target["is_active"])))
                if not 2 <= len(name) <= 80: raise ValueError("Name must be between 2 and 80 characters.")
                role = db.execute("SELECT id,name FROM roles WHERE name=? COLLATE NOCASE", (role_name,)).fetchone()
                if not role or role["name"].casefold() == "admin": raise ValueError("Choose a valid member role.")
                db.execute("UPDATE users SET name=?,role_id=?,is_active=? WHERE id=?", (name, role["id"], int(active), user_id))
                new_password = payload.get("password")
                if new_password is not None and str(new_password):
                    new_password = str(new_password)
                    if len(new_password) < 8 or len(new_password) > 200: raise ValueError("Password must contain at least 8 characters.")
                    db.execute("UPDATE users SET password_hash=? WHERE id=?", (hash_password(new_password), user_id))
                    db.execute("DELETE FROM sessions WHERE user_id=?", (user_id,))
                self.json_response(200, {"ok": True, "user": safe_user(get_user_by_id(db, user_id))}); return
        self.error(404, "Not found.")

    def api_delete(self, path):
        with connect_db() as db:
            if path.startswith("/api/admin/users/"):
                admin, _ = self.require_user(db, True)
                if not admin: return
                try: user_id = int(path.rsplit("/", 1)[1])
                except ValueError: self.error(400, "Invalid account ID."); return
                target = get_user_by_id(db, user_id)
                if not target or target["is_admin"]:
                    self.error(404, "Member account not found."); return
                db.execute("DELETE FROM users WHERE id=?", (user_id,))
                self.json_response(200, {"ok": True}); return
            if path.startswith("/api/admin/roles/"):
                admin, _ = self.require_user(db, True)
                if not admin: return
                try: role_id = int(path.rsplit("/", 1)[1])
                except ValueError: self.error(400, "Invalid role ID."); return
                role = db.execute("SELECT * FROM roles WHERE id=?", (role_id,)).fetchone()
                if not role or role["is_system"] or role["name"].casefold() == "admin":
                    self.error(403, "This role is protected and cannot be deleted."); return
                assigned = db.execute("SELECT COUNT(*) FROM users WHERE role_id=?", (role_id,)).fetchone()[0]
                if assigned:
                    self.error(409, f"This role is assigned to {assigned} account(s). Reassign or delete them first."); return
                db.execute("DELETE FROM roles WHERE id=?", (role_id,))
                self.json_response(200, {"ok": True}); return
            if path.startswith("/api/community/messages/"):
                admin, _ = self.require_user(db, True)
                if not admin: return
                try: message_id = int(path.rsplit("/", 1)[1])
                except ValueError: self.error(400, "Invalid message ID."); return
                result = db.execute("DELETE FROM messages WHERE id=?", (message_id,))
                if result.rowcount == 0: self.error(404, "Message not found."); return
                self.json_response(200, {"ok": True}); return
        self.error(404, "Not found.")

    def _login_guard(self, db):
        ip = self.client_address[0]
        row = db.execute("SELECT * FROM auth_attempts WHERE ip=?", (ip,)).fetchone()
        now = int(time.time())
        if row and row["locked_until"] > now:
            self.error(429, "Too many failed sign-in attempts. Try again in a few minutes.")
            return False
        if row and row["locked_until"] and row["locked_until"] <= now:
            db.execute("UPDATE auth_attempts SET failures=0,window_started=?,locked_until=0 WHERE ip=?", (now, ip))
        return True

    def _login_failed(self, db):
        ip = self.client_address[0]
        now = int(time.time())
        row = db.execute("SELECT * FROM auth_attempts WHERE ip=?", (ip,)).fetchone()
        if not row or now - row["window_started"] > 900:
            failures, start = 1, now
        else:
            failures, start = row["failures"] + 1, row["window_started"]
        lock = now + 900 if failures >= 8 else 0
        db.execute("INSERT INTO auth_attempts(ip,failures,window_started,locked_until) VALUES(?,?,?,?) ON CONFLICT(ip) DO UPDATE SET failures=excluded.failures,window_started=excluded.window_started,locked_until=excluded.locked_until", (ip, failures, start, lock))

    def _login_success(self, db, row):
        token = secrets.token_urlsafe(40)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        db.execute("DELETE FROM sessions WHERE expires_at<?", (int(time.time()),))
        db.execute("INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)", (token_hash, row["id"], int(time.time()) + SESSION_SECONDS, now_iso()))
        db.execute("DELETE FROM auth_attempts WHERE ip=?", (self.client_address[0],))
        db.commit()
        self.json_response(200, {"ok": True, "user": safe_user(row)}, self.cookie_headers(token))


def main():
    init_db()
    print(f"Salmikkhang website running at http://{HOST}:{PORT}")
    print(f"Database: {DB_PATH}")
    print("First run: open /setup.html and create your own admin name/passcode.")
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    finally:
        server.server_close()

if __name__ == "__main__":
    main()
