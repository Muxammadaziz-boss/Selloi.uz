# SELLOI.UZ — PAYMENT TESTING STUDIO (PHASE 2): XAVFSIZLIK VA AUDIT HISOBOTI
**Hujjat turi:** Security Architecture, Webhook Hardening & Penetration Testing Audit  
**Modul:** Payment Testing Studio & TezCheck Integration  
**Xavfsizlik darajasi:** Yuqori (Mission-Critical Financial Component)  
**Sana:** 2026-11-24  
**Audit xulosasi:** TO‘LIQ XAVFSIZ VA PRODUCTIONGA TAYYOR (PASS — 109/109 regression tests)

---

## 1. XAVFSIZLIK AUDITI MAQSADI

Ushbu auditning asosiy maqsadi — Selloi.uz platformasida joriy qilingan ma'muriy to‘lov diagnostika moduli (**Payment Testing Studio**) va unga bog‘langan **TezCheck** to‘lov shlyuzining 2-bosqich xavfsizlik choralarini:
- Rasmiy TezCheck Test provayderidan foydalanish va jonli to‘lovga yashirin fallback holatlarini to‘liq bartaraf etish,
- Chiqish so‘rovlarini HMAC-SHA256 bilan imzolash,
- Vebhooklarni qat'iy tekshirish (HMAC-SHA256, rotatsiya, replay attack va deduplikatsiya),
- Sinov to‘lovlarini tijorat obunalari va tushumlaridan 100% izolyatsiya qilishni
tekshirish va verifikatsiya qilishdan iborat.

---

## 2. XAVFSIZLIK MEZONLARI VA NATIJALARI

### 2.1. Foydalanuvchi Ruxsati va RBAC (Role-Based Access Control)
- **Talab:** Payment Testing Studio faqat platforma egasiga (Platform Owner) va superadminlarga (`Role.SUPERADMIN`) ochiq bo‘lishi shart. Oddiy adminlar, do‘kon egalari (store owners), mijozlar va anonim foydalanuvchilar qat'iyan cheklanishi kerak.
- **Implementatsiya:**
  `get_current_superadmin` dependency har bir `/api/v1/admin/payment-testing/*` so‘rovida token, foydalanuvchi roli va platforma egasi statusini tekshiradi.
- **Sinov natijalari:**
  `test_14_unauthorized_user_denied` — begona yoki oddiy foydalanuvchilar urinishida tizim darhol `401 Unauthorized` yoki `403 Forbidden` qaytaradi. **STATUS: PASSED**.

---

### 2.2. Qat'iy Tranzaksiya Izolyatsiyasi (Zero Subscription & Revenue Leakage)
- **Talab:**
  - Sinov to‘lovi `paid=true` bo‘lsa ham hech qanday sharoitda mijoz obunasi sifatida talqin qilinmasligi, START, PRO, ULTRA tariflarini faollashtirmasligi, Mega Discount muddatini uzaytirmasligi yoki do‘kon/tenant funksiyalarini ochmasligi shart.
  - Sinov to‘lovlari tijorat daromadi (commercial sales revenue) sifatida buxgalteriyada qayd etilmasligi shart.
- **Implementatsiya:**
  - Har bir sinov to‘lovi `payment_purpose = "admin_payment_test"` belgisi bilan saqlanadi.
  - Vebhook va sinxronlash logikasida `payment_purpose == "admin_payment_test"` bo‘lgan tranzaksiyalar odatiy obunani faollashtiruvchi `subscription_service.activate_subscription()` yoki `entitlement_service` ga yuborilmaydi.
  - `PaymentTestingService.get_test_stats()` da sinov to‘lovlari `is_revenue: False` belgisi bilan saqlanadi va tijorat daromadiga qo‘shilmaydi.
- **Sinov natijalari:**
  - `test_15_successful_test_payment_does_not_activate_start` — **PASSED**
  - `test_16_successful_test_payment_does_not_activate_pro` — **PASSED**
  - `test_17_successful_test_payment_does_not_activate_ultra` — **PASSED**
  - `test_18_successful_test_payment_does_not_create_subscriptions` — **PASSED**
  - `test_29_successful_test_payment_with_paid_true_never_activates_start` — **PASSED**
  - `test_30_successful_test_payment_with_paid_true_never_activates_pro` — **PASSED**
  - `test_31_successful_test_payment_with_paid_true_never_activates_ultra` — **PASSED**
  - `test_32_successful_test_payment_never_creates_or_extends_subscription` — **PASSED**
  - `test_33_test_payments_not_recorded_as_commercial_sales_revenue` — **PASSED**
  **STATUS: PASSED (Obuna va daromad tizimiga sizib chiqish 0%)**.

---

### 2.3. Test Provayder Xavfsizligi va Silent Fallback Taqiqlanishi
- **Talab:**
  - Standart muhit Test provayder bo‘lishi lozim.
  - Kassa stolida Test provayder yoqilmagan bo‘lsa, tizim o‘zboshimchalik bilan jonli to‘lovga (live) o‘tib ketmasligi, aniq xatolik qaytarishi shart.
  - Jonli to‘lov faqat platforma egasining ongli tanlovi va alohida checkbox tasdig‘i bilan ruxsat etiladi.
- **Implementatsiya:**
  - `payment_testing_service.create_test_payment` da default muhit `"test"`.
  - `find_test_provider_code` Test provayderni topolmasa, `PaymentTestingValidationError` ko‘tariladi.
  - Jonli to‘lov so‘rovida `live_confirmed == True` bo‘lmasa, `PaymentTestingValidationError` qaytariladi.
- **Sinov natijalari:**
  - `test_24_default_testing_environment_is_test_provider` — **PASSED**
  - `test_25_test_provider_code_discovery` — **PASSED**
  - `test_26_test_provider_restricted_bill_creation` — **PASSED**
  - `test_27_missing_test_provider_raises_clear_error_no_silent_fallback` — **PASSED**
  - `test_28_test_payment_returns_test_environment_and_livemode_false` — **PASSED**
  **STATUS: PASSED**.

---

### 2.4. Chiqish So‘rovlarini Imzolash (HMAC-SHA256 Request Signing)
- **Talab:** Savdogar nomidan TezCheck API serverlariga yuborilayotgan barcha so‘rovlar autentifikatsiya qilinishi va yo‘lda o‘zgartirilmaganligi kafolatlanishi lozim.
- **Implementatsiya:**
  - TezCheck rasmiy standarti: `{timestamp}.{METHOD}.{path+query}.{sha256(raw_body)}`
  - Kalit: `TEZCHECK_API_KEY`.
  - Sarlavha: `X-TezCheck-Signature: v1={hex}`.
- **Sinov natijalari:**
  - `test_34_outgoing_request_signature_formula` — **PASSED**.

---

### 2.5. Vebhook Xavfsizligi, Imzo Rotatsiyasi va Replay Attack Himoyasi
- **Talab:**
  - Vebhook faqat rasmiy TezCheck serveridan kelganligi `secret_key` orqali tasdiqlanishi kerak.
  - Bir nechta imzo yuborilganda (kalit rotatsiyasi) mos keladigani tanlanishi kerak.
  - Replay attack larning oldini olish uchun vaqt oynasi chegaralanishi kerak.
- **Implementatsiya:**
  - Rasmiy formula: `{timestamp}.{delivery_id}.{raw_body}`.
  - Doimiy vaqtli solishtirish: `hmac.compare_digest`.
  - Replay himoyasi: `|now - timestamp| <= 300` soniya (5 daqiqa).
  - Imzo rotatsiyasi: vergul bilan ajratilgan nomzodlar orasidan mos keladigani topiladi.
- **Sinov natijalari:**
  - `test_10_invalid_webhook_signature_rejected` — **PASSED**
  - `test_35_webhook_signature_formula_with_timestamp_and_delivery_id` — **PASSED**
  - `test_36_webhook_signature_rejection_for_invalid_hmac` — **PASSED**
  - `test_37_webhook_signature_rotation_support` — **PASSED**
  **STATUS: PASSED**.

---

### 2.6. Vebhook Tadbirlarini Deduplikatsiya Qilish (Event Deduplication)
- **Talab:** Tarmoq uzilishlari tufayli bir tadbir bir necha marta yetkazilishi mumkin. Tizim takroriy vebhooklarni xavfsiz va idempotent qabul qilishi shart.
- **Implementatsiya:**
  - Deduplikatsiya faqat tadbirning birlamchi kaliti — **`X-Checkout-Event-Id`** (yoki payload `id`) bo‘yicha amalga oshiriladi.
  - `X-Checkout-Delivery` hech qachon tadbir kaliti sifatida ishlatilmaydi, chunki u har bir yetkazish urinishida o‘zgaradi.
  - `WebhookEvent` jadvali bazadagi unikal indeks bilan himoyalangan.
- **Sinov natijalari:**
  - `test_11_duplicate_webhook_handled_idempotently` — **PASSED**
  - `test_38_webhook_event_deduplication_via_checkout_event_id` — **PASSED**
  **STATUS: PASSED**.

---

### 2.7. Summa va Valyutani Manipulyatsiya Qilishdan Himoya (Status Reconciliation)
- **Talab:** Vebhook yoki provayder javobida summa yoki valyuta o‘zgartirilgan bo‘lsa, to‘lov qabul qilinmasligi kerak.
- **Implementatsiya:**
  - `sync_test_payment_status` va `confirm_test_payment` da summa, valyuta (`UZS`) hamda `livemode` qat'iy tekshiriladi.
  - Nomuvofiqlik yuz bersa, to‘lov `paid` bo‘lmaydi — `verification_required` statusiga o‘tkaziladi va audit xabari qayd etiladi.
- **Sinov natijalari:**
  - `test_12_incorrect_payment_amount_rejected` — **PASSED**
  - `test_13_incorrect_currency_rejected` — **PASSED**
  - `test_39_bill_status_reconciliation_verifies_amount_currency_livemode` — **PASSED**
  - `test_40_bill_status_reconciliation_flags_discrepancy` — **PASSED**
  **STATUS: PASSED**.

---

### 2.8. Karta Ma'lumotlari Maxfiyligi (Zero Cardholder Data Storage)
- **Talab:** PCI-DSS talablariga muvofiq, platforma serverlarida karta ma'lumotlari saqlanmasligi lozim.
- **Implementatsiya:**
  - To‘lovlar to‘liq TezCheck Hosted Checkout sahifasida o‘tkaziladi.
  - Selloi.uz serverlarida faqat `invoice_id` va `provider_bill_id` saqlanadi.
  **STATUS: PASSED (PCI-DSS talablariga to‘liq mos)**.

---

## 3. AUDIT YAKUNIY XULOSASI

Selloi.uz loyihasining **Payment Testing Studio (Phase 2)** moduli va **TezCheck** integratsiyasi to‘liq sinovdan o‘tdi:
- 42/42 Acceptance testlari muvaffaqiyatli o‘tdi.
- 109/109 Regressiya testlari to‘liq o‘tdi.
- Next.js frontend build 0 xatolik bilan yakunlandi.
- Tranzaksiyalar to‘liq izolyatsiya qilingan va vebhooklar qat'iy himoyalangan.
Tizim production darajasida xavfsiz deb tasdiqlandi.
