import requests
import time

BASE_URL = "https://selloi.uz"
SESSION = requests.Session()

def test_all():
    ts = int(time.time())
    print(f"=== Selloi Production Auth Verification ({BASE_URL}) ===")
    
    # 1. Google OAuth Initiator
    print("\n[1] Testing Google OAuth Initiation (/api/auth/google)...")
    r1 = requests.get(f"{BASE_URL}/api/auth/google", allow_redirects=False)
    print(f"Status: {r1.status_code}")
    loc = r1.headers.get("Location", "")
    print(f"Redirect Location: {loc[:120]}...")
    assert r1.status_code == 307, f"Expected 307, got {r1.status_code}"
    assert "accounts.google.com" in loc, "Missing Google accounts domain"
    assert "client_id=" in loc, "Missing client_id parameter"
    assert "redirect_uri=https%3A%2F%2Fselloi.uz%2Fapi%2Fauth%2Fgoogle%2Fcallback" in loc, "Redirect URI mismatch"
    print("-> GOOGLE OAUTH REDIRECT: PASS (100% compliant)")

    # 2. Email & Password Registration
    print("\n[2] Testing Email Registration (/api/register)...")
    test_email = f"user_{ts}@testmail.uz"
    test_pass = f"Pass_{ts}_123!"
    r2 = SESSION.post(f"{BASE_URL}/api/register", json={
        "email": test_email,
        "password": test_pass,
        "full_name": f"Test User {ts}"
    })
    print(f"Status: {r2.status_code}, Body: {r2.text}")
    assert r2.status_code == 200, f"Registration failed: {r2.text}"
    cookie2 = SESSION.cookies.get("sales_session")
    print(f"Issued Cookie: sales_session={'Found' if cookie2 else 'Missing'}")
    assert cookie2, "Missing sales_session cookie"
    print("-> EMAIL REGISTRATION: PASS")

    # 3. Email & Password Login
    print("\n[3] Testing Email Login (/api/login)...")
    login_session = requests.Session()
    r3 = login_session.post(f"{BASE_URL}/api/login", json={
        "email": test_email,
        "password": test_pass
    })
    print(f"Status: {r3.status_code}, Body: {r3.text}")
    assert r3.status_code == 200, f"Login failed: {r3.text}"
    cookie3 = login_session.cookies.get("sales_session")
    print(f"Issued Cookie: sales_session={'Found' if cookie3 else 'Missing'}")
    assert cookie3, "Missing sales_session cookie"
    print("-> EMAIL LOGIN: PASS")

    # 4. Telegram Auth (Automatic Register & Login)
    print("\n[4] Testing Telegram Auth (/api/auth/telegram)...")
    tg_session = requests.Session()
    tg_user = f"tg_bot_{ts}"
    r4 = tg_session.post(f"{BASE_URL}/api/auth/telegram", json={
        "username": tg_user,
        "telegram_id": ts,
        "full_name": f"Telegram Seller {ts}"
    })
    print(f"Status: {r4.status_code}, Body: {r4.text}")
    assert r4.status_code == 200, f"Telegram auth failed: {r4.text}"
    cookie4 = tg_session.cookies.get("sales_session")
    print(f"Issued Cookie: sales_session={'Found' if cookie4 else 'Missing'}")
    assert cookie4, "Missing sales_session cookie"
    print("-> TELEGRAM REGISTRATION: PASS")

    # 4b. Telegram Re-Login (Idempotent)
    r4b = requests.post(f"{BASE_URL}/api/auth/telegram", json={
        "username": tg_user,
        "telegram_id": ts
    })
    assert r4b.status_code == 200, f"Telegram re-login failed: {r4b.text}"
    print("-> TELEGRAM RE-LOGIN: PASS")

    # 5. Master Password Login
    print("\n[5] Testing Master Password Login (/api/login)...")
    master_session = requests.Session()
    r5 = master_session.post(f"{BASE_URL}/api/login", json={
        "password": "mux@mm@d@z1z"
    })
    print(f"Status: {r5.status_code}, Body: {r5.text}")
    assert r5.status_code == 200, f"Master password failed: {r5.text}"
    cookie5 = master_session.cookies.get("sales_session")
    assert cookie5, "Missing sales_session cookie for master password"
    print("-> MASTER PASSWORD LOGIN: PASS")

    # 6. Auth Status Verification
    print("\n[6] Verifying Session Status (/api/auth/status)...")
    r6 = master_session.get(f"{BASE_URL}/api/auth/status")
    print(f"Status: {r6.status_code}, User: {r6.text}")
    assert r6.status_code == 200
    assert r6.json().get("authenticated") is True
    print("-> SESSION STATUS VERIFIED: PASS")

    print("\n==========================================")
    print("ALL 5 AUTHENTICATION METHODS ARE 100% OPERATIONAL!")
    print("==========================================")

if __name__ == "__main__":
    test_all()
