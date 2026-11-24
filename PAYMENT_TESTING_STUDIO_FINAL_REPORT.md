# SELLOI.UZ — PAYMENT TESTING STUDIO: YAKUNIY AMALGA OSHIRISH VA TEKSHIRUV HISOBOTI
**Hujjat turi:** Production Acceptance & Verification Report  
**Modul:** Owner Admin → Finance → Payment Testing Studio  
**Integratsiya:** TezCheck Payment Gateway (Official API v1)  
**Sana:** 2026-11-24  
**Holat:** TASDIQLANGAN (PASSED — 23/23 acceptance tests, 90/90 regression tests)

---

## 1. LOYIHA VA VAZIFA MAQSADI

Selloi.uz platformasi uchun platforma egasiga (Platform Owner) va superadminlarga haqiqiy **TezCheck** to‘lov shlyuzi orqali 1 000 dan 10 000 so‘mgacha bo‘lgan kichik diagnostik to‘lovlarni xavfsiz amalga oshirish, to‘lov oqimini (bill creation, checkout redirect, webhook handling, status sync) tekshirish imkoniyatini beruvchi **Payment Testing Studio** to‘liq ishga tushirildi va sinovdan o‘tkazildi.

Asosiy talab va cheklovlar:
- **Haqiqiy TezCheck integratsiyasi:** Rasmiy hujjatlar (`https://tezcheck.uz/`, `https://tezcheck.uz/api-docs`) va `.env` dagi live/test ma'lumotlari asosida to‘liq sozlandi.
- **Qat'iy tranzaksiya izolyatsiyasi:** Sinov to‘lovlari hech qachon START, PRO, ULTRA tariflarini faollashtirmaydi, mijoz obunalarini uzaytirmaydi yoki o‘zgartirmaydi, do‘kon/tenant funksiyalarini ochmaydi.
- **Miqdor chegarasi:** Faqat butun sonli 1 000 UZS dan 10 000 UZS gacha bo‘lgan summalar qabul qilinadi.
- **Xavfsizlik:** Faqat platforma egasiga ruxsat beriladi, kartalar ma'lumotlari saqlanmaydi, replay hujumlaridan himoya va idempotensiya ta'minlangan.

---

## 2. ARXITEKTURA VA KOMPONENTLAR

Payment Testing Studio arxitekturasi quyidagi qatlamlardan tashkil topgan:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SELLOI.UZ OWNER ADMIN DASHBOARD                          │
│          (web/app/components/saas/PaymentTestingStudio.tsx)                 │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ REST API (Bearer Token / Superadmin)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   PAYMENT TESTING ROUTER & ENDPOINTS                        │
│                   (app/routers/payment_testing.py)                          │
│  - POST /api/v1/admin/payment-testing/create                                │
│  - GET  /api/v1/admin/payment-testing/history                               │
│  - GET  /api/v1/admin/payment-testing/status/{invoice_id}                   │
│  - POST /api/v1/admin/payment-testing/sync/{invoice_id}                     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Service Calls
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PAYMENT TESTING SERVICE & ISOLATION                      │
│                  (app/services/payment_testing_service.py)                  │
│  - payment_purpose = "admin_payment_test" (Qat'iy izolyatsiya)              │
│  - UZS -> Tiyin konversiyasi (amount_minor = amount_uzs * 100)              │
│  - Tranzaksiya holatlari: created, pending, paid, failed, cancelled,        │
│    expired, verification_required                                           │
│  - Audit log yozuvlari (AuditLog)                                           │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HMAC-SHA256 Signed API Calls
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     TEZCHECK PAYMENT GATEWAY CLIENT                         │
│                    (app/services/tezcheck_service.py)                       │
│  - X-TezCheck-Timestamp & X-TezCheck-Signature (v1=...)                     │
│  - POST /bills (amount_minor, amount, external_reference, return_url)       │
│  - GET /bills/{bill_id}                                                     │
│  - Webhook Signature & Replay Protection (+/- 300s window)                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. ASOSIY XUSUSIYATLAR VA IMPLEMENTATSIYA

### 3.1. Admin Interfeysi (Frontend)
- **Joylashuvi:** Owner Admin → Finance → Payment Testing Studio (`PaymentTestingStudio.tsx`).
- **Summa tanlash:**
  - Preset tugmalar: `1 000 UZS`, `2 000 UZS`, `3 000 UZS`, `5 000 UZS`, `10 000 UZS`.
  - Manual kiritish maydoni (1 000 dan 10 000 gacha oraliqda, kasr sonlar va manfiy qiymatlar bloklangan).
- **Muhit tanlash:** `sandbox` (simulyatsiya) va `live` (haqiqiy to‘lov shlyuzi).
- **Jonli to‘lov tasdig‘i:** `live` rejim tanlanganda qizil ogohlantirish banneri va `I understand this will initiate a REAL charge` tasdiqlovchi checkbox majburiy qilingan.
- **TezCheck Checkout havolasi:** Hisob-faktura yaratilgach, foydalanuvchiga to‘lovni amalga oshirish uchun `TezCheck Checkout` havolasi (`_blank`) taqdim etiladi.
- **Sinovlar tarixi (History & Audit Trail):**
  - Sana, invoice_id, provider_bill_id, summa, valyuta, muhit (sandbox/live), holat nishonlari (`created`, `pending`, `paid`, `failed`, `cancelled`, `expired`, `verification_required`).
  - Filtrlash: holat, muhit, sana oralig‘i bo‘yicha.
  - Jonli yangilash (`Sync Status`) tugmasi.

### 3.2. Summa va Valyuta Tekshiruvi
- **Valyuta:** Qat'iy `UZS`. Boshqa valyutalardagi to‘lovlar rad etiladi yoki `verification_required` holatiga o‘tkaziladi.
- **Tiyin hisob-kitobi:** TezCheck minor birliklarda (tiyin) hisob-kitob qiladi:
  $$\text{amount\_minor} = \text{amount\_uzs} \times 100$$
  Masalan: $1\,000\text{ UZS} \rightarrow 100\,000\text{ tiyin}$.
- **Summa nomuvofiqligi himoyasi:** Agar provayder qaytargan summa yoki vebhook summasi boshlang‘ich hisoblangan summadan farq qilsa, to‘lov hech qachon `paid` bo‘lmaydi — avtomatik ravishda `verification_required` statusiga o‘tkaziladi va audit xabari qayd etiladi.

### 3.3. Qat'iy Tranzaksiya Izolyatsiyasi (Zero Subscription Leakage)
- Sinov to‘lovi jadvalda `payment_purpose = "admin_payment_test"` belgisi bilan saqlanadi.
- To‘lov muvaffaqiyatli (`paid`) yakunlanganda:
  - START, PRO, ULTRA tariflari faollashtirilmaydi.
  - Mega Discount imtiyozlari qo‘shilmaydi.
  - Yangi subscription yaratilmaydi va mavjud subscription muddati o‘zgartirilmaydi.
  - Tenant/do‘kon funksiyalari ochilmaydi.
  - Barcha jarayon faqat `PaymentInvoice` va `AuditLog` doirasida saqlanadi.

---

## 4. TEST NATIJALARI

### 4.1. Acceptance Tests (23/23 PASSED)
`tests/test_payment_testing_studio.py` fayli orqali quyidagi 23 ta qat'iy stsenariy tekshirildi:

| # | Test nomi | Holat | Tavsifi |
|---|---|---|---|
| 01 | `test_01_amount_1000_uzs_accepted` | PASSED | 1 000 UZS qabul qilinadi |
| 02 | `test_02_amount_10000_uzs_accepted` | PASSED | 10 000 UZS qabul qilinadi |
| 03 | `test_03_amount_999_uzs_rejected` | PASSED | 999 UZS rad etiladi (min chegara) |
| 04 | `test_04_amount_10001_uzs_rejected` | PASSED | 10 001 UZS rad etiladi (max chegara) |
| 05 | `test_05_decimal_amount_rejected` | PASSED | Kasr sonlar (1500.50 UZS) rad etiladi |
| 06 | `test_06_correct_uzs_to_tiyin_conversion` | PASSED | UZS -> tiyin (x100) to‘g‘ri hisoblanadi |
| 07 | `test_07_correct_tezcheck_bill_creation_request` | PASSED | TezCheck ga yuborilgan JSON va imzolar to‘liq mos |
| 08 | `test_08_provider_api_authentication_failure_handled_safely` | PASSED | API xatoliklari xavfsiz ushlanadi, crash bo‘lmaydi |
| 09 | `test_09_duplicate_invoice_request_handled_idempotently` | PASSED | Idempotency kaliti bo‘yicha takroriy so‘rov bir xil hisob qaytaradi |
| 10 | `test_10_invalid_webhook_signature_rejected` | PASSED | Noto‘g‘ri imzo bilan kelgan webhook rad etiladi |
| 11 | `test_11_duplicate_webhook_handled_idempotently` | PASSED | Takroriy webhook hisobni buzmaydi |
| 12 | `test_12_incorrect_payment_amount_rejected` | PASSED | Summasi o‘zgargan to‘lov `verification_required` bo‘ladi |
| 13 | `test_13_incorrect_currency_rejected` | PASSED | UZS bo‘lmagan valyuta `verification_required` bo‘ladi |
| 14 | `test_14_unauthorized_user_denied` | PASSED | Begona foydalanuvchi/oddiy admin to‘xtatiladi (403) |
| 15 | `test_15_successful_test_payment_does_not_activate_start` | PASSED | START tarifi faollashmaydi |
| 16 | `test_16_successful_test_payment_does_not_activate_pro` | PASSED | PRO tarifi faollashmaydi |
| 17 | `test_17_successful_test_payment_does_not_activate_ultra` | PASSED | ULTRA tarifi faollashmaydi |
| 18 | `test_18_successful_test_payment_does_not_create_subscriptions` | PASSED | Obuna jadvaliga hech qanday yozuv kiritilmaydi |
| 19 | `test_19_pending_payment_does_not_activate_entitlements` | PASSED | Pending holatida hech qanday huquq ochilmaydi |
| 20 | `test_20_failed_payment_does_not_activate_entitlements` | PASSED | Bekor bo‘lgan to‘lov hech qanday huquq ochilmaydi |
| 21 | `test_21_live_payment_requires_explicit_confirmation` | PASSED | Live to‘lov uchun `live_confirmed=True` majburiy |
| 22 | `test_22_sandbox_and_live_transactions_remain_separated` | PASSED | Sandbox va live tranzaksiyalar to‘liq ajratilgan |
| 23 | `test_23_existing_normal_customer_payment_functionality_remains_unchanged` | PASSED | Oddiy mijoz to‘lovlari o‘zgarishsiz ishlaydi |

### 4.2. Regressiya Testlari (90/90 PASSED)
Billing, narxlar dvigateli va to‘lov xavfsizligining barcha to‘plamlari birgalikda muvaffaqiyatli yakunlandi:
- `tests/test_payment_testing_studio.py` (23 test)
- `tests/test_payment_security_remediation.py` (19 test)
- `tests/test_centralized_pricing_engine.py` (23 test)
- `tests/test_subscription_billing_lifecycle.py` (25 test)
**Jami: 90 ta test 100% muvaffaqiyatli o‘tdi.**

### 4.3. Next.js Frontend Build
- `npm --prefix web run build` buyrug‘i 0 xatolik va 0 ogohlantirish bilan yakunlandi.
- Barcha sahifalar, TypeScript tiplari va marshrutlar muvaffaqiyatli kompilyatsiya qilindi.

---

## 5. XULOSA VA KEYINGI QADAMLAR

Payment Testing Studio to‘liq talablarga muvofiq holda topshirildi. Platforma egasi istalgan vaqtda minimal 1 000 UZS to‘lov yaratib, TezCheck to‘lov oynasiga o‘tishi, haqiqiy karta orqali to‘lov oqimini tekshirishi va platformaning to‘lov qobiliyatini xavfsiz sinovdan o‘tkazishi mumkin.
