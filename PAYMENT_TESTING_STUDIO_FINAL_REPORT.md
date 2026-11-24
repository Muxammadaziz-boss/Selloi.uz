# SELLOI.UZ — PAYMENT TESTING STUDIO: HTTP 502 ROOT CAUSE TAHLILI VA TUZATISH HISOBOTI
**Hujjat turi:** Root Cause Analysis (RCA), Architecture Hardening & Verification Report  
**Modul:** Owner Admin → Finance → Payment Testing Studio  
**Integratsiya:** TezCheck Payment Gateway (Official API v1 & Test Provider)  
**Sana:** 2026-11-24  
**Holat:** YAKUNIY TASDIQLANGAN (PASSED — 53/53 studio tests, 120/120 full regression tests, 0 build errors)

---

## 1. HTTP 502 XATOLIGINING ANIQ ROOT CAUSE (ASL SABABI) TAHLILI

### Muammoning Ko'rinishi:
Payment Testing Studio sahifasida platforma egasi yangi sinov to‘lovini yaratish tugmasini bosganida, ekranda umumiy va noaniq `HTTP 502` xatoligi aks etayotgan edi.

### Asl Sabablar Zanjiri (Root Cause Chain):
1. **TezCheck API Kaliti Holati:**
   `.env` faylidagi `TEZCHECK_API_KEY` (`aps_...`) TezCheck rasmiy autentifikatsiya serverida (`https://api.tezcheck.uz/api/merchant/v1`) bekor qilingan (revoked) yoki yaroqsiz bo‘lib, `401 Unauthorized` (`auth.unauthenticated`, `api_key.missing_or_invalid`) qaytarmoqda.
2. **Kassa Stolidagi Test Provayderni Qidirish:**
   Test to‘lovi yaratilayotganda `payment_testing_service.create_test_payment` funksiyasi `find_test_provider_code()` -> `discover_payment_methods()` (`POST /payment-methods`) ni chaqiradi.
3. **Xatolikning Qatlamlar Osha Konversiyasi (Error Masking Bug):**
   - TezCheck HTTP 401 qaytarganda, `httpx` kutubxonasi `HTTPStatusError` ko‘tarardi.
   - `tezcheck_service.py` da bu xatolik umumiy `TezCheckError` ga o‘ralardi.
   - `app/api/platform.py` dagi `create_payment_test` endpointida:
     ```python
     except TezCheckError as exc:
         raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"TezCheck to'lov xizmati xatosi: {exc}")
     ```
     FastAPI 401 autentifikatsiya xatosini to‘g‘ridan-to‘g‘ri **`HTTP 502 Bad Gateway`** ga aylantirib yuborardi!
   - Next.js frontend proxy (`web/app/api/proxy/route.ts`) ushbu 502 javobini brauzerga uzatardi.
   - `web/app/lib/api.ts` kutubxonasida javob matni uzun bo‘lgani yoki `data.error` parse qilinmagani sababli, foydalanuvchiga faqat quruq `"HTTP 502"` xatosi ko‘rsatilardi.

---

## 2. MUAMMOLI ENDPOINT VA TEGISHLI FUNKSIYALAR

| Qatlam | Fayl va Joylashuvi | Funksiya / Metod | Muammo |
|---|---|---|---|
| **Frontend Call** | `web/app/components/saas/PaymentTestingStudio.tsx` | `handleCreateTest()` | `/api/platform/payment-testing/create` ga so‘rov yuborardi va 502 ni to‘g‘ridan-to‘g‘ri aks ettirardi |
| **API Client** | `web/app/lib/api.ts` | `fetchApi()` | Strukturali xato javoblarini (`data.error.message`) parse qilmasdan, 502 ga yiqilardi |
| **Backend Endpoint** | `app/api/platform.py:1242` | `create_payment_test()` | Barcha `TezCheckError` larni `HTTP_502_BAD_GATEWAY` ko‘rinishida niqoblardi |
| **Service Layer** | `app/services/payment_testing_service.py` | `create_test_payment()` | Test provayder qidirishdagi haqiqiy xatolikni yashirardi |
| **Gateway Client** | `app/services/tezcheck_service.py` | `discover_payment_methods()`, `create_bill()` | TezCheck dan qaytgan HTTP status kodlarini va JSON error detallarini alohida tasniflamasdi |

---

## 3. AMALGA OSHIRILGAN ARXITEKTURA TUZATISHLARI

### 3.1. Strukturali Xatoliklar Tizimi (`TezCheckAPIError`)
TezCheck qaytargan barcha holatlar bo‘yicha alohida xavfsiz tasniflash yo‘lga qo‘yildi:

| TezCheck HTTP Status & Code | Selloi Tizimidagi Error Code | Foydalanuvchiga Ko‘rsatiladigan Xabar | HTTP Status |
|---|---|---|---|
| `401 auth.unauthenticated` | `TEZCHECK_AUTH_FAILED` | “TezCheck API kaliti yaroqsiz yoki noto‘g‘ri sozlangan.” | 401 |
| `401 request.signature_invalid` | `TEZCHECK_SIGNATURE_INVALID` | “TezCheck so‘rovi imzosini tekshirishda xatolik.” | 401 |
| `401 request.timestamp_out_of_window` | `TEZCHECK_TIMESTAMP_EXPIRED` | “Server vaqti noto‘g‘ri (timestamp out of window).” | 401 |
| `403 auth.forbidden` | `TEZCHECK_IP_FORBIDDEN` | “TezCheck ruxsat etilgan IP manzillar (allowlist) muammosi.” | 403 |
| `403 auth.permission_denied` | `TEZCHECK_PERMISSION_DENIED` | “Kassa ruxsati yetarli emas yoki taqiqlangan.” | 403 |
| `404 resource.not_found` | `TEZCHECK_RESOURCE_NOT_FOUND` | “TezCheck kassasi bilan bog‘lanishni tekshiring.” | 404 |
| `400 missing cash_desk` | `TEZCHECK_CASH_DESK_MISSING` | “TezCheck kassasi bilan bog‘lanishni tekshiring (cash_desk_code sozlanmagan).” | 400 |
| `400 test provider disabled` | `TEZCHECK_TEST_PROVIDER_NOT_ENABLED` | “TezCheck kabinetida Test provider faollashtirilmagan.” | 400 |
| `422 request.validation_failed` | `TEZCHECK_VALIDATION_FAILED` | “TezCheck so‘rov parametrlari noto‘g‘ri shakllantirilgan.” | 422 |
| `429 request.rate_limited` | `TEZCHECK_RATE_LIMITED` | “TezCheck so‘rovlar chegarasi oshgan.” | 429 |
| `5xx upstream error` | `TEZCHECK_SERVER_ERROR` | “TezCheck serveri vaqtincha javob bermayapti.” | 502 |
| `TimeoutException` | `TEZCHECK_TIMEOUT` | “TezCheck serveriga ulanish vaqti tugadi (timeout).” | 504 |
| `Non-JSON Response` | `TEZCHECK_INVALID_RESPONSE` | “TezCheck serveridan noto‘g‘ri formatdagi javob qaytdi.” | 502 |

### 3.2. Xavfsiz Strukturali Javob Formati
Barcha xatoliklar qat'iy standart formatda qaytariladi:
```json
{
  "success": false,
  "error": {
    "code": "TEZCHECK_AUTH_FAILED",
    "message": "TezCheck API kaliti yaroqsiz yoki noto‘g‘ri sozlangan.",
    "request_id": "req_01M872G93NSHAGWQJ2VM23D644",
    "retryable": false
  }
}
```
**Xavfsizlik kafolati:** API kalit (`aps_...`), maxfiy sir (`whsec_...`), Authorization headeri yoki karta ma'lumotlari javoblarga yoki loglarga hech qachon chiqarilmaydi.

### 3.3. Frontend Interfeysidagi Yangilanishlar
- **Nomlanishi:** Rasmiy spetsifikatsiyaga muvofiq **`TEZCHECK TEST PROVIDER`** deb o‘rnatildi.
- **Izoh:** “TezCheck Test provider orqali haqiqiy pul yechilmaydi. Test tranzaksiyalari `environment=test` bilan belgilanadi.”
- **Xatoliklar UI Paneli:** Ekranda `HTTP 502` o‘rniga aniq tushunarli o‘zbek tilidagi xabar, xatolik kodi nishoni (`badge`) hamda diagnostika uchun ichki `request_id` aks etadi.

---

## 4. TEZCHECK JONLI SERVERIDAN OLINGAN HAQIQIY DIAGNOSTIK JAVOB

Selloi serveridan TezCheck jonli API endpointiga (`https://api.tezcheck.uz/api/merchant/v1/me`) yuborilgan so‘rov natijasi:
```http
HTTP/1.1 401 Unauthorized
Date: Tue, 24 Nov 2026 15:24:01 GMT
Content-Type: application/json
X-Request-Id: req_01M872G93NSHAGWQJ2VM23D644

{
  "error": {
    "code": "auth.unauthenticated",
    "message": "Davom etish uchun tizimga kiring.",
    "status": 401,
    "request_id": "req_01M872G93NSHAGWQJ2VM23D644",
    "details": [
      {
        "code": "api_key.missing_or_invalid",
        "message": "So‘rovda «Authorization: Bearer aps_…» sarlavhasi bilan amal qiluvchi maxfiy API kalit yuborilishi kerak."
      }
    ],
    "retryable": false
  }
}
```
- **Tizim vaqti sinxronligi:** Selloi serveri vaqti TezCheck serveri bilan 100% mos keladi (vaqt siljishi: 0 soniya).
- **Chiquvchi ommaviy IP:** `144.124.192.209`.
- **Xulosa:** `.env` dagi kalit TezCheck tomonidan bekor qilingan; savdogar kabinetidan yangi API kalit olinganda tizim darhol to‘liq jonli ishlashga tayyor.

---

## 5. AVTOMATLASHTIRILGAN TEST VA REGRESSIYA NATIJALARI

### 5.1. Payment Testing Studio Suite (53/53 PASSED)
`tests/test_payment_testing_studio.py` faylidagi barcha 53 ta test to‘liq muvaffaqiyatli o‘tdi:
- 1–23: Phase 1 asosiy qabul testlari (1 000–10 000 UZS, UZS->Tiyin, RBAC, izolyatsiya).
- 24–42: Phase 2 TezCheck Test provayderi, HMAC request signing, webhook hardening, deduplication.
- 43: To‘g‘ri API kalit va Test provider bilan test bill yaratilishi.
- 44: Noto‘g‘ri API kalit — aniq autentifikatsiya xatosi (`TEZCHECK_AUTH_FAILED`).
- 45: Kassa kodi mavjud emas (`TEZCHECK_CASH_DESK_MISSING`).
- 46: Test provider yoqilmagan (`TEZCHECK_TEST_PROVIDER_NOT_ENABLED`).
- 47: Noto‘g‘ri HMAC imzosi (`TEZCHECK_SIGNATURE_INVALID`).
- 48: TezCheck timeout (`TEZCHECK_TIMEOUT`, 504, retryable=True).
- 49: TezCheck 502 javobi (`TEZCHECK_SERVER_ERROR`).
- 50: TezCheck noto‘g‘ri JSON qaytarishi (`TEZCHECK_INVALID_RESPONSE`).
- 51: Frontend va endpoint xatoni sirlarni oshkor qilmasdan to‘g‘ri aks ettirishi.
- 52: Test provider'dan Live provider'ga fallback bo‘lmasligi.
- 53: Test to‘lovi hech qanday tijorat obunasini faollashtirmasligi (`is_revenue=False`).

### 5.2. To'liq Billing Regressiya Natijasi (120/120 PASSED)
```bash
pytest tests/test_payment_testing_studio.py \
       tests/test_payment_security_remediation.py \
       tests/test_centralized_pricing_engine.py \
       tests/test_subscription_billing_lifecycle.py -q
================ 120 passed in 46.87s ================
```

### 5.3. Next.js Frontend Production Build
```bash
npm --prefix web run build
✓ Compiled successfully in 6.6s
✓ Generating static pages (25/25)
0 errors, 0 warnings
```

---

## 6. O‘ZGARTIRILGAN FAYLLAR RO‘YXATI

1. `app/services/tezcheck_service.py` — `TezCheckAPIError` va `parse_tezcheck_http_error` joriy qilindi; xatoliklar aniq tasniflandi; timeout va invalid response ushlandi; `find_test_provider_code` xatoliklarni yutib yubormasligi ta'minlandi.
2. `app/services/payment_testing_service.py` — `PaymentTestingValidationError` ga `code`, `status_code`, `request_id` va `to_dict()` qo‘shildi; Test provayder yoqilmaganda `TEZCHECK_TEST_PROVIDER_NOT_ENABLED` kodi berildi.
3. `app/api/platform.py` — `create_payment_test` va `sync_payment_test_status` endpointlaridagi 502 niqoblashi olib tashlandi; structured `JSONResponse` qaytarilishi ta'minlandi.
4. `web/app/lib/api.ts` — `fetchApi` da `data.error.message` va `data.error.code` qo‘llab-quvvatlandi.
5. `web/app/api/proxy/route.ts` — Backend bilan aloqa uzilganda structured JSON qaytarildi.
6. `web/app/components/saas/PaymentTestingStudio.tsx` — `TEZCHECK TEST PROVIDER` nomi, rasmiy izohi va xatoliklar uchun `code` + `request_id` aks etuvchi UI paneli joriy qilindi.
7. `tests/test_payment_testing_studio.py` — 11 ta yangi diagnostika va regression test qo‘shildi (jami 53 ta test).
