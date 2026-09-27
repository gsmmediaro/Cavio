"""High-level defensive behavior tests (no exploit payloads)."""

from __future__ import annotations

import io
import os
import uuid

from web.backend.config import get_settings
from web.backend.rate_limit import limiter
from web.backend.services import credits as credits_service
from web.backend.tests.conftest import tiny_jpeg_bytes


def test_unauthenticated_scan_rejected(client):
    files = {'file': ('x.jpg', io.BytesIO(tiny_jpeg_bytes()), 'image/jpeg')}
    res = client.post('/api/analyze', files=files, data={'model_path': 'auto'})
    assert res.status_code == 401
    assert 'auth' in res.json()['detail'].lower() or 'Authentication' in res.json()['detail']


def test_oversized_upload_rejected(client, auth_headers):
    # MAX_UPLOAD_BYTES is 1024 in conftest; send slightly larger JPEG-looking bytes
    big = tiny_jpeg_bytes() + (b'A' * 2048)
    files = {'file': ('big.jpg', io.BytesIO(big), 'image/jpeg')}
    res = client.post('/api/analyze', files=files, data={'model_path': 'auto'}, headers=auth_headers)
    assert res.status_code == 413
    assert 'large' in res.json()['detail'].lower()


def test_rate_limit_returns_429(client, auth_headers):
    limiter._hits.clear()
    get_settings.cache_clear()
    files = {'file': ('x.jpg', io.BytesIO(tiny_jpeg_bytes()), 'image/jpeg')}
    # Exhaust limit with unauthenticated? Auth required — use auth headers.
    # Force zero credits path avoided by using a request that fails after rate check...
    # Rate limit runs first. Use invalid image magic after exhausting? Better: call analyze
    # until 429. Some may be 402/400 after credit/decode — still count toward limiter.
    codes = []
    for _ in range(8):
        r = client.post('/api/analyze', files=files, data={'model_path': 'auto'}, headers=auth_headers)
        codes.append(r.status_code)
        files = {'file': ('x.jpg', io.BytesIO(tiny_jpeg_bytes()), 'image/jpeg')}
    assert 429 in codes


def test_credits_block_when_zero(client):
    email = f'zero_{uuid.uuid4().hex[:8]}@example.com'
    res = client.post('/api/auth/register', json={'email': email, 'password': 'securepass1'})
    assert res.status_code == 200
    token = res.json()['access_token']
    uid = res.json()['uid']
    # Drain credits
    bal = credits_service.get_balance(uid)
    if bal > 0:
        credits_service.add_credits(uid, -bal, 'test_drain')
    assert credits_service.get_balance(uid) == 0
    files = {'file': ('x.jpg', io.BytesIO(tiny_jpeg_bytes()), 'image/jpeg')}
    r = client.post(
        '/api/analyze',
        files=files,
        data={'model_path': 'auto'},
        headers={'Authorization': f'Bearer {token}'},
    )
    assert r.status_code == 402
    assert 'credit' in r.json()['detail'].lower()


def test_register_and_me(client):
    email = f'user_{uuid.uuid4().hex[:8]}@example.com'
    res = client.post('/api/auth/register', json={'email': email, 'password': 'securepass1'})
    assert res.status_code == 200
    body = res.json()
    assert body['credits'] == int(os.environ['SIGNUP_BONUS_CREDITS'])
    me = client.get('/api/auth/me', headers={'Authorization': f"Bearer {body['access_token']}"})
    assert me.status_code == 200
    assert me.json()['email'] == email
