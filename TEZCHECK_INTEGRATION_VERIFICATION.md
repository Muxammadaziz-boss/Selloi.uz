# TEZCHECK TO‘LOV PROVAYDERI INTEGRATSIYASI VA VERIFIKATSIYA HUJJATI
**Hujjat turi:** Technical Integration & Verification Guide  
**Provayder:** TezCheck (`https://tezcheck.uz/`, `https://tezcheck.uz/api-docs`)  
**API Versiyasi:** Merchant API v1  
**Sana:** 2026-11-24  
**Holat:** ISHCHI VA VERIFIKATSIYA QILINGAN

---

## 1. TEZCHECK RASMIY XUSUSIYATLARI VA PROTOKOLI

TezCheck O‘zbekistondagi zamonaviy to‘lov agregatori bo‘lib, savdogarlarga (merchant) to‘lov hisob-fakturalarini (bills) shakllantirish, to‘lov havolalarini generatsiya qilish va vebhooklar orqali to‘lov holatlarini sinxronlash imkonini beradi.

### 1.1. Asosiy API Ma'lumotlari
- **Asosiy Base URL:** `https://api.tezcheck.uz/api/merchant/v1`
- **Valyuta:** Qat'iy `UZS` (boshqa valyutalar qo‘llab-quvvatlanmaydi).
- **Summa birligi:** **Tiyin** (minor units, $1\text{ UZS} = 100\text{ tiyin}$).
  - Minimal to‘lov summasi: $100\,000\text{ tiyin}$ ($1\,000\text{ UZS}$).
- **Sandbox rejimi:** TezCheck alohida sandbox subdomenga ega emas. Sinovlar TezCheck platformasidagi test to‘lov usullari yoki mock provayder rejimi orqali amalga oshiriladi.

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

## 2. SO‘ROVLARNI IMZOLASH (HMAC-SHA256 REQUEST SIGNING)

Chiqish so‘rovlarining xavfsizligini ta'minlash uchun har bir `POST` va `GET` so‘roviga maxsus imzolar qo‘shiladi:

### Sarlavhalar (Request Headers)
```http
X-TezCheck-Api-Key: aps_otSW4gp5rB5Vg2hVf16tGN3_1LZsr8UdLATbSuNmosE
X-TezCheck-Timestamp: 1732456800
X-TezCheck-Signature: v1=9f83c1...
Content-Type: application/json
```

### Imzo generatsiyasi formulasi
```python
timestamp = str(int(time.time()))
body_sha256 = hashlib.sha256(raw_body.encode("utf-8")).hexdigest()
signature_payload = f"{timestamp}.{method.upper()}.{path}.{body_sha256}"
signature = hmac.new(
    secret_key.encode("utf-8"),
    signature_payload.encode("utf-8"),
    hashlib.sha256
).hexdigest()
header_signature = f"v1={signature}"
```

---

## 3. ASOSIY API OQIMI VA METODLAR

### 3.1. Hisob-faktura (Bill) yaratish: `POST /bills`

**So‘rov namunasi (Payload):**
```json
{
  "amount_minor": 100000,
  "amount": 1000,
  "currency": "UZS",
  "cash_desk_code": "cdk_WGChFftL986NeYSNnLW6kAReBwYP",
  "title": "Selloi Admin Test Payment (1,000 UZS)",
  "description": "Payment Testing Studio Diagnostics",
  "external_reference": "inv_test_01934abc",
  "return_url": "https://selloi.uz/dashboard/admin/payment-testing?status=success&invoice_id=inv_test_01934abc",
  "metadata": {
    "payment_purpose": "admin_payment_test",
    "environment": "live",
    "invoice_id": "inv_test_01934abc"
  }
}
```

**Muvaffaqiyatli javob (Response):**
```json
{
  "id": "bill_tz_98452134",
  "external_reference": "inv_test_01934abc",
  "amount_minor": 100000,
  "amount": 1000,
  "currency": "UZS",
  "status": "created",
  "payment_url": "https://pay.tezcheck.uz/checkout/bill_tz_98452134",
  "created_at": "2026-11-24T18:40:00Z"
}
```

---

### 3.2. Hisob holatini tekshirish: `GET /bills/{bill_id}`

To‘lov holatini qo‘lda sinxronlash yoki tekshirish uchun ishlatiladi:
- `bill_id`: TezCheck tomonidan berilgan hisob identifikatori.
- Qaytadigan holatlar: `created`, `pending`, `paid`, `failed`, `cancelled`, `expired`.

---

## 4. VEBHOOKLAR VA REPLAY HUJUMLARIDAN HIMOYA

### 4.1. Vebhook imzosini tekshirish
TezCheck to‘lov yakunlanganda platformaning `/api/v1/billing/tezcheck/webhook` manziliga bildirishnoma yuboradi.

Quyidagi qat'iy tekshiruvlar amalga oshiriladi:
1. **Timestamp tekshiruvi (Replay Protection):**
   Vebhook vaqti server vaqtidan $\pm 300$ soniyadan ko‘proq farq qilsa, so‘rov bekor qilinadi (Replay attack prevention).
2. **HMAC-SHA256 imzosi tekshiruvi:**
   `X-TezCheck-Signature` sarlavhasidagi `v1=<hash>` qiymati `TEZCHECK_SECRET_KEY` yordamida qayta hisoblanadi va `hmac.compare_digest` orqali solishtiriladi.
3. **Idempotensiya:**
   Bir xil vebhook voqeasi (event_id yoki invoice_id) takroriy kelganda tranzaksiya qayta ishlanmaydi va hisob-kitoblar buzilmaydi.
4. **Summa va valyuta yaxlitligi:**
   Agar vebhookdagi to‘lov summasi bazadagi boshlang‘ich hisob-faktura summasiga teng bo‘lmasa yoki valyuta `UZS` bo‘lmasa, to‘lov `paid` bo‘lmaydi, balki darhol `verification_required` holatiga o‘tkaziladi.

---

## 5. PLATFORMA EGASI UCHUN JONLI SINASH QO‘LLANMASI (LIVE TESTING PROTOCOL)

Platforma egasi real sharoitda TezCheck to‘lov shlyuzini tekshirishi uchun quyidagi xavfsiz qadamlar belgilangan:

1. **Kirish:** Selloi.uz boshqaruv paneliga superadmin/owner akkaunti bilan kiring.
2. **Bo‘limga o‘tish:** `Owner Admin` → `Finance` → `Payment Testing Studio`.
3. **Summani tanlash:** `1 000 UZS` (yoki 10 000 UZS gacha bo‘lgan boshqa kichik miqdor).
4. **Muhitni tanlash:** `Live` rejimini tanlang.
5. **Ogohlantirishni tasdiqlash:** Qizil ogohlantirish ostidagi `I understand this will initiate a REAL charge` belgisini qo‘ying.
6. **Hisob yaratish:** `Create Test Payment` tugmasini bosing.
7. **To‘lov oynasiga o‘tish:** Yaratilgan hisob kartochkasidagi `TezCheck Checkout` tugmasini bosing.
8. **To‘lovni amalga oshirish:** TezCheck sahifasida haqiqiy Uzcard yoki Humo kartasi orqali 1 000 UZS to‘lovni amalga oshiring.
9. **Sinxronlash va tasdiqlash:** Payment Testing Studio tarixida to‘lov holati `PAID` ga o‘zgarganligini ko‘ring.
10. **Izolyatsiya kafolati:** Mazkur to‘lov hech qanday mijoz obunasini faollashtirmaganligini tekshirish uchun `Billing` bo‘limiga qarang — tariflar o‘zgarmaydi.
