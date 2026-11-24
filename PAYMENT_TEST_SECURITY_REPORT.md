# SELLOI.UZ — PAYMENT TESTING STUDIO: XAVFSIZLIK VA AUDIT HISOBOTI
**Hujjat turi:** Security Architecture & Penetration Testing Audit  
**Modul:** Payment Testing Studio & TezCheck Integration  
**Xavfsizlik darajasi:** Yuqori (Mission-Critical Financial Component)  
**Sana:** 2026-11-24  
**Audit xulosasi:** XAVFSIZ VA PRODUCTIONGA TAYYOR (PASS)

---

## 1. XAVFSIZLIK AUDITI MAQSADI

Ushbu auditning asosiy maqsadi — Selloi.uz platformasida joriy qilingan ma'muriy to‘lov diagnostika moduli (**Payment Testing Studio**) va unga bog‘langan **TezCheck** to‘lov shlyuzining xavfsizlik darajasini, kirish huquqlarini cheklashni, tranzaksiyalar izolyatsiyasini hamda moliyaviy ma'lumotlar yaxlitligini tekshirishdan iborat.

---

## 2. XAVFSIZLIK MEZONLARI VA NATIJALARI

### 2.1. Foydalanuvchi Ruxsati va RBAC (Role-Based Access Control)
- **Talab:** Payment Testing Studio faqat platforma egasiga (Platform Owner) va superadminlarga (`Role.SUPERADMIN`) ochiq bo‘lishi shart. Oddiy adminlar, do‘kon egalari (store owners), mijozlar va anonim foydalanuvchilar qat'iyan cheklanishi kerak.
- **Implementatsiya:** 
  `get_current_superadmin` dependency har bir `/api/v1/admin/payment-testing/*` so‘rovida token, foydalanuvchi roli va statusini tekshiradi.
- **Sinov natijasi:** 
  `test_14_unauthorized_user_denied` — ruxsatsiz yoki oddiy foydalanuvchilar so‘rov yuborganida tizim darhol `401 Unauthorized` yoki `403 Forbidden` qaytaradi. **STATUS: PASSED**.

---

### 2.2. Tranzaksiya Izolyatsiyasi (Zero Subscription Leakage)
- **Talab:** Sinov to‘lovi hech qanday sharoitda mijoz obunasi sifatida talqin qilinmasligi, START, PRO, ULTRA tariflarini faollashtirmasligi, Mega Discount muddatini uzaytirmasligi yoki do‘kon/tenant funksiyalarini ochmasligi shart.
- **Implementatsiya:**
  - Har bir sinov to‘lovi uchun `payment_purpose = "admin_payment_test"` o‘rnatiladi.
  - Vebhook va sinxronlash logikasida `payment_purpose == "admin_payment_test"` bo‘lgan tranzaksiyalar odatiy obunani faollashtiruvchi `subscription_service.activate_subscription()` yoki `entitlement_service` ga yuborilmaydi.
  - To‘lov faqat `PaymentInvoice` va `AuditLog` ga qayd etiladi.
- **Sinov natijalari:**
  - `test_15_successful_test_payment_does_not_activate_start` — **PASSED**
  - `test_16_successful_test_payment_does_not_activate_pro` — **PASSED**
  - `test_17_successful_test_payment_does_not_activate_ultra` — **PASSED**
  - `test_18_successful_test_payment_does_not_create_subscriptions` — **PASSED**
  - `test_19_pending_payment_does_not_activate_entitlements` — **PASSED**
  - `test_20_failed_payment_does_not_activate_entitlements` — **PASSED**
  **STATUS: PASSED (Obuna tizimiga sizib chiqish 0%)**.

---

### 2.3. Summa va Qiymatlarni Manipulyatsiya Qilishdan Himoya (Tamper Resistance)
- **Talab:** Hujumchi so‘rovdagi summani o‘zgartirishi, kasr sonlar, manfiy qiymatlar yoki ruxsat etilgan oraliqdan tashqaridagi summalarni yuborishi mumkin emas.
- **Implementatsiya:**
  - Backendda qat'iy Pydantic validatsiyasi: `ge=1000`, `le=10000`, faqat `int`.
  - To‘lov yakunlanishida (webhook yoki sync) hisob summasi va valyuta bazadagi snapshot bilan solishtiriladi. Agar summa yoki valyuta o‘zgargan bo‘lsa, to‘lov `paid` bo‘lmaydi — `verification_required` holatiga o‘tadi va ogohlantirish beriladi.
- **Sinov natijalari:**
  - `test_03_amount_999_uzs_rejected` — **PASSED**
  - `test_04_amount_10001_uzs_rejected` — **PASSED**
  - `test_05_decimal_amount_rejected` — **PASSED**
  - `test_12_incorrect_payment_amount_rejected` — **PASSED**
  - `test_13_incorrect_currency_rejected` — **PASSED**
  **STATUS: PASSED**.

---

### 2.4. Vebhook Xavfsizligi va Replay Hujumlaridan Himoya
- **Talab:** Vebhooklar haqiqiy TezCheck provayderidan kelgan bo‘lishi, soxta yoki qayta takrorlangan so‘rovlar (replay attacks) rad etilishi kerak.
- **Implementatsiya:**
  - `X-TezCheck-Signature` sarlavhasida HMAC-SHA256 imzosi tekshiriladi (`v1=<hash>`).
  - Vaqt oynasi: `|t_current - t_webhook| <= 300` soniya (5 daqiqa). Ushbu oraliqdan tashqaridagi har qanday so‘rov rad etiladi.
  - Idempotency: har bir vebhook voqeasi unikal identifikatori bo‘yicha tekshiriladi.
- **Sinov natijalari:**
  - `test_10_invalid_webhook_signature_rejected` — **PASSED**
  - `test_11_duplicate_webhook_handled_idempotently` — **PASSED**
  **STATUS: PASSED**.

---

### 2.5. Karta Ma'lumotlari Maxfiyligi (Zero Cardholder Data Storage)
- **Talab:** PCI-DSS talablariga muvofiq, Selloi.uz serverlarida mijoz yoki platforma egasining plastik karta raqamlari, CVV kodlari yoki PIN-kodlari saqlanmasligi lozim.
- **Implementatsiya:**
  - Barcha to‘lov jarayonlari TezCheck ning xavfsiz Hosted Checkout sahifasida (`https://pay.tezcheck.uz/checkout/{bill_id}`) amalga oshiriladi.
  - Selloi.uz faqat `invoice_id`, `provider_bill_id`, to‘lov summasi va to‘lov holatini saqlaydi.
  **STATUS: PASSED (To‘liq PCI-DSS muvofiqligi)**.

---

### 2.6. Audit Jurnali (Audit Logging)
- **Talab:** Barcha sinov to‘lovlari, ularning yaratilishi, holatining o‘zgarishi va amalga oshirilgan harakatlar to‘liq audit jurnaliga yozib borilishi kerak.
- **Implementatsiya:**
  - Har bir to‘lov yaratilganda va tasdiqlanganda `AuditLog` jadvaliga `action = "admin_payment_test_created"`, `action = "admin_payment_test_confirmed"` yozuvlari `user_id` va `metadata_json` bilan yoziladi.
  **STATUS: PASSED**.

---

## 3. AUDIT YAKUNIY XULOSASI

Selloi.uz loyihasining **Payment Testing Studio** va **TezCheck** integratsiyasi barcha zamonaviy xavfsizlik talablariga, qat'iy tranzaksiya izolyatsiyasiga va moliyaviy yaxlitlik standartlariga to‘liq javob beradi. Tizim production muhitida xavfsiz foydalanish uchun tasdiqlandi.
