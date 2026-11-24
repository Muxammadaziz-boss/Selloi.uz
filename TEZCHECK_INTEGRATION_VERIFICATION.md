# TEZCHECK TO‘LOV PROVAYDERI INTEGRATSIYASI VA VERIFIKATSIYA HUJJATI (PHASE 2)
**Hujjat turi:** Technical Integration & Verification Guide (Test Provider & Security Hardened)  
**Provayder:** TezCheck (`https://tezcheck.uz/`, `https://tezcheck.uz/api-docs`)  
**API Versiyasi:** Merchant API v1  
**Sana:** 2026-11-24  
**Holat:** ISHCHI VA TO‘LIQ VERIFIKATSIYA QILINGAN

---

## 1. TEZCHECK RASMIY XUSUSIYATLARI VA PROTOKOLI

TezCheck O‘zbekistondagi zamonaviy to‘lov agregatori bo‘lib, savdogarlarga (merchant) to‘lov hisob-fakturalarini (`bills`) shakllantirish, to‘lov havolalarini generatsiya qilish va vebhooklar orqali to‘lov holatlarini sinxronlash imkonini beradi.

### 1.1. Asosiy API Ma'lumotlari
- **Asosiy Base URL:** `https://api.tezcheck.uz/api/merchant/v1`
- **Valyuta:** Qat'iy `UZS` (boshqa valyutalar qo‘llab-quvvatlanmaydi).
- **Summa birligi:** **Tiyin** (minor units, $1\text{ UZS} = 100\text{ tiyin}$).
  - Minimal to‘lov summasi: $100\,000\text{ tiyin}$ ($1\,000\text{ UZS}$).
- **Rasmiy Test Provayder Rejimi:** TezCheck da alohida sandbox subdomeni mavjud emas. Buning o‘rniga savdogar hisobida maxsus "Test provider" to‘lov usuli mavjud.
  - Test tranzaksiyalari haqiqiy pul yechmaydi va savdogar balansiga tushmaydi.
  - To‘lov muvaffaqiyatli o‘tganda `paid: true`, `livemode: false`, `environment: "test"` qaytadi.
  - Test to‘lovlari 1 kundan so‘ng TezCheck tomonidan avtomatik bekor qilinadi.

### 1.2. Atrof-muhit konfiguratsiyasi (.env)
Platformada quyidagi rasmiy konfiguratsiya parametrlari qo‘llaniladi:
```env
TEZCHECK_API_URL=https://api.tezcheck.uz/api/merchant/v1
TEZCHECK_API_KEY=aps_otSW4gp5rB5Vg2hVf16tGN3_1LZsr8UdLATbSuNmosE
TEZCHECK_CASH_DESK_CODE=cdk_WGChFftL986NeYSNnLW6kAReBwYP
TEZCHECK_MERCHANT_ID=cdk_WGChFftL986NeYSNnLW6kAReBwYP
TEZCHECK_SECRET_KEY=whsec_00b08c1b995bb7b74c292bbea02ab0cac3e68516aebd1b15cf6087482f932525
```

---

## 2. CHIQISH SO‘ROVLARINI IMZOLASH (OUTGOING HMAC-SHA256 SIGNING)

Chiqish so‘rovlarining xavfsizligini ta'minlash uchun har bir `POST` va `GET` so‘roviga maxsus imzolar qo‘shiladi:

### Sarlavhalar (Request Headers)
```http
X-TezCheck-Api-Key: aps_otSW4gp5rB5Vg2hVf16tGN3_1LZsr8UdLATbSuNmosE
X-TezCheck-Timestamp: 1732456800
X-TezCheck-Signature: v1=9f83c1...
Content-Type: application/json
```

### Imzo generatsiyasi formulasi
TezCheck rasmiy hujjatlariga muvofiq, imzo quyidagicha shakllanadi:
$$\text{payload} = \text{timestamp} + "." + \text{METHOD} + "." + \text{path} + "." + \text{SHA256}(\text{raw\_body})$$
$$\text{signature} = \text{HMAC-SHA256}(\text{api\_key}, \text{payload})$$
$$\text{header} = \text{"v1="} + \text{signature}$$

Kod namunasi:
```python
timestamp = str(int(datetime.now(timezone.utc).timestamp()))
body_sha256 = hashlib.sha256(body_bytes).hexdigest()
path_clean = path.split("?")[0]
signature_payload = f"{timestamp}.{method.upper()}.{path_clean}.{body_sha256}"
signature = hmac.new(
    self.api_key.encode("utf-8"),
    signature_payload.encode("utf-8"),
    hashlib.sha256
).hexdigest()
headers["X-TezCheck-Signature"] = f"v1={signature}"
```

---

## 3. ASOSIY API METODLARI VA OQIMI

### 3.1. To‘lov usullarini aniqlash: `POST /payment-methods`
Kassada mavjud barcha to‘lov usullari (Payme, Click, Test provider va boshqalar) ro‘yxatini qaytaradi.
- Ushbu ro‘yxat orqali `test_provider` kodi avtomatik aniqlanadi.
- Agar Test provayder topilmasa, tizim `PaymentTestingValidationError("TezCheck Test provider kassa stolida yoqilmagan...")` xatosini beradi va hech qachon live rejimga o‘zboshimchalik bilan o‘tmaydi.

### 3.2. Hisob-faktura (Bill) yaratish: `POST /bills`
Sinov to‘lovlari uchun `allowed_provider_codes` orqali to‘lov faqat Test provayder bilan cheklanadi.

**So‘rov namunasi (Test Provider Payload):**
```json
{
  "amount_minor": 100000,
  "currency": "UZS",
  "external_reference": "inv_test_01934abc",
  "title": "Selloi Admin Diagnostic Test (1,000 UZS)",
  "description": "Payment Testing Studio Diagnostics (Test provider)",
  "return_url": "https://selloi.uz/dashboard/admin/payment-testing?status=success&invoice_id=inv_test_01934abc",
  "allowed_provider_codes": ["test_provider"],
  "metadata": {
    "payment_purpose": "admin_payment_test",
    "environment": "test",
    "invoice_id": "inv_test_01934abc"
  }
}
```

**Muvaffaqiyatli javob:**
```json
{
  "id": "bill_tz_98452134",
  "external_reference": "inv_test_01934abc",
  "amount_minor": 100000,
  "currency": "UZS",
  "status": "created",
  "payment_url": "https://pay.tezcheck.uz/checkout/bill_tz_98452134",
  "environment": "test",
  "livemode": false
}
```

### 3.3. Hisob holatini tekshirish: `POST /bills/{bill_id}`
Rasmiy holat tekshiruvi `POST /bills/{bill_id}` orqali amalga oshiriladi (fallback: `GET /bills/{bill_id}`).
Qaytgan ma'lumotlarda:
- `amount_minor` kutilgan summaga tengligi tekshiriladi.
- `currency == "UZS"` ekanligi tekshiriladi.
- Test to‘lovida `livemode == False` va `environment == "test"` ekanligi tekshiriladi.
- Har qanday nomuvofiqlikda status `verification_required` ga o‘tkaziladi.

### 3.4. To‘lov havolasini yangilash: `POST /bills/{bill_id}/reissue`
Hisob havolasini yangilash kerak bo‘lganda `POST /bills/{bill_id}/reissue` chaqiriladi. Bu yangi to‘lov tokeni hosil qiladi va oldingi havolani bekor qiladi.

---

## 4. VEBHOOKLAR VA ULARNI VERIFIKATSIYA QILISH (WEBHOOK HARDENING)

### 4.1. Vebhook Sarlavhalari
TezCheck serveridan keluvchi HTTP sarlavhalari:
- `X-Checkout-Event`: Voqea turi (masalan, `payment.succeeded`, `payment.failed`).
- `X-Checkout-Event-Id`: Ushbu voqeaning unikal identifikatori (masalan, `evt_019...`).
- `X-Checkout-Delivery`: Ushbu yetkazib berish urinishining identifikatori (`deliv_019...`).
- `X-Checkout-Timestamp`: Unix timestamp (soniyalarda).
- `X-Checkout-Signature`: HMAC-SHA256 imzosi (`v1=<hex>`).

### 4.2. Vebhook Imzosini Tekshirish Formulasi
$$\text{signed\_string} = \text{timestamp} + "." + \text{delivery\_id} + "." + \text{raw\_body}$$
$$\text{expected\_sig} = \text{"v1="} + \text{HMAC-SHA256}(\text{secret\_key}, \text{signed\_string})$$

- Konstant vaqtli taqqoslash: `hmac.compare_digest`.
- Bir nechta imzo (`v1=hash1, v1=hash2`) qo‘llab-quvvatlanadi (secret rotation).
- Replay hujumlariga qarshi: `|now - timestamp| <= 300` soniya.

### 4.3. Hodisalarni Deduplikatsiya Qilish
Har bir vebhook qabul qilinganda `X-Checkout-Event-Id` (yoki payload `id`) tekshiriladi.
- `WebhookEvent` jadvalida unikal indeks mavjud.
- Agar ayni bir `event_id` qayta yuborilsa, so‘rov qayta ishlanmaydi va darhol idempotent `HTTP 200 OK` qaytariladi.
- `X-Checkout-Delivery` hech qachon tadbir deduplikatsiyasi uchun ishlatilmaydi, chunki bitta hodisaning takroriy urinishlarida bu qiymat o‘zgarishi mumkin.

---

## 5. TEST VA VERIFIKATSIYA STATISTIKASI

1. **Acceptance Tests (`test_payment_testing_studio.py`):** 42/42 PASSED.
2. **Full Regression Suite (Barcha 4 ta modul):** 109/109 PASSED.
3. **Next.js Frontend Build (`web`):** 0 xatolik, 25 ta sahifa to‘liq kompilyatsiya qilindi.
4. **Tranzaksiya Izolyatsiyasi:** Test to‘lovlari tijorat tushumiga kiritilmaydi (`is_revenue: False`) va mijoz obunalarini uzaytirmaydi.
