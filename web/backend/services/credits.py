"""SQLite-backed credit balances and local auth accounts."""

from __future__ import annotations

import sqlite3
import uuid
from pathlib import Path
from typing import Optional

from web.backend.config import get_settings

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "accounts.db"


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db() -> None:
    conn = _connect()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            uid TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            password_hash TEXT,
            provider TEXT NOT NULL DEFAULT 'local',
            credits INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
            ON users(email) WHERE email != '';
        CREATE TABLE IF NOT EXISTS credit_ledger (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uid TEXT NOT NULL,
            delta INTEGER NOT NULL,
            reason TEXT NOT NULL,
            ref TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS processed_stripe_events (
            event_id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        """
    )
    conn.commit()
    conn.close()


def ensure_user(uid: str, email: str, provider: str) -> dict:
    """Create user row if missing; award signup bonus once."""
    init_db()
    settings = get_settings()
    conn = _connect()
    row = conn.execute("SELECT * FROM users WHERE uid = ?", (uid,)).fetchone()
    if row:
        if email and row["email"] != email:
            conn.execute("UPDATE users SET email = ? WHERE uid = ?", (email, uid))
            conn.commit()
        data = dict(conn.execute("SELECT * FROM users WHERE uid = ?", (uid,)).fetchone())
        conn.close()
        return data

    bonus = settings.signup_bonus_credits
    conn.execute(
        """
        INSERT INTO users (uid, email, password_hash, provider, credits)
        VALUES (?, ?, NULL, ?, ?)
        """,
        (uid, email or "", provider, bonus),
    )
    if bonus:
        conn.execute(
            "INSERT INTO credit_ledger (uid, delta, reason, ref) VALUES (?, ?, ?, ?)",
            (uid, bonus, "signup_bonus", None),
        )
    conn.commit()
    data = dict(conn.execute("SELECT * FROM users WHERE uid = ?", (uid,)).fetchone())
    conn.close()
    return data


def create_local_user(email: str, password_hash: str) -> dict:
    init_db()
    settings = get_settings()
    email_norm = email.strip().lower()
    conn = _connect()
    existing = conn.execute(
        "SELECT uid FROM users WHERE lower(email) = ?", (email_norm,)
    ).fetchone()
    if existing:
        conn.close()
        raise ValueError("Email already registered")
    uid = f"local_{uuid.uuid4().hex}"
    bonus = settings.signup_bonus_credits
    conn.execute(
        """
        INSERT INTO users (uid, email, password_hash, provider, credits)
        VALUES (?, ?, ?, 'local', ?)
        """,
        (uid, email_norm, password_hash, bonus),
    )
    if bonus:
        conn.execute(
            "INSERT INTO credit_ledger (uid, delta, reason, ref) VALUES (?, ?, ?, ?)",
            (uid, bonus, "signup_bonus", None),
        )
    conn.commit()
    data = dict(conn.execute("SELECT * FROM users WHERE uid = ?", (uid,)).fetchone())
    conn.close()
    return data


def get_user_by_email(email: str) -> Optional[dict]:
    init_db()
    conn = _connect()
    row = conn.execute(
        "SELECT * FROM users WHERE lower(email) = ?", (email.strip().lower(),)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def get_user(uid: str) -> Optional[dict]:
    init_db()
    conn = _connect()
    row = conn.execute("SELECT * FROM users WHERE uid = ?", (uid,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_balance(uid: str) -> int:
    user = get_user(uid)
    return int(user["credits"]) if user else 0


def add_credits(uid: str, delta: int, reason: str, ref: Optional[str] = None) -> int:
    init_db()
    conn = _connect()
    conn.execute("BEGIN IMMEDIATE")
    row = conn.execute("SELECT credits FROM users WHERE uid = ?", (uid,)).fetchone()
    if not row:
        conn.execute("ROLLBACK")
        conn.close()
        raise KeyError(uid)
    new_balance = int(row["credits"]) + delta
    if new_balance < 0:
        conn.execute("ROLLBACK")
        conn.close()
        raise ValueError("insufficient_credits")
    conn.execute("UPDATE users SET credits = ? WHERE uid = ?", (new_balance, uid))
    conn.execute(
        "INSERT INTO credit_ledger (uid, delta, reason, ref) VALUES (?, ?, ?, ?)",
        (uid, delta, reason, ref),
    )
    conn.commit()
    conn.close()
    return new_balance


def deduct_scan_credit(uid: str, cost: Optional[int] = None) -> int:
    settings = get_settings()
    amount = settings.scan_credit_cost if cost is None else cost
    return add_credits(uid, -amount, "scan", None)


def mark_stripe_event_processed(event_id: str) -> bool:
    """Return True if newly recorded, False if duplicate."""
    init_db()
    conn = _connect()
    try:
        conn.execute(
            "INSERT INTO processed_stripe_events (event_id) VALUES (?)",
            (event_id,),
        )
        conn.commit()
        conn.close()
        return True
    except sqlite3.IntegrityError:
        conn.close()
        return False
