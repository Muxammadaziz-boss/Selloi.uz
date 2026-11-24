export interface NavItem {
  label: string;
  href: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Imkoniyatlar", href: "#imkoniyatlar" },
  { label: "Qanday ishlaydi?", href: "#sotuv-jarayoni" },
  { label: "Boshlash", href: "#boshlash" },
  { label: "Tariflar", href: "#tariflar" },
  { label: "FAQ", href: "#faq" },
  { label: "API", href: "/docs" },
];

export interface TrustMetric {
  value: string;
  label: string;
  sublabel: string;
}

export const TRUST_METRICS: TrustMetric[] = [
  {
    value: "24/7",
    label: "To‘xtovsiz ishlash",
    sublabel: "Kechayu kunduz javob",
  },
  {
    value: "3 ta til",
    label: "Ko‘p tilli muloqot",
    sublabel: "O‘zbek, rus, ingliz",
  },
  {
    value: "99%",
    label: "Aniqlik darajasi",
    sublabel: "So‘rovlarni to‘g‘ri anglash",
  },
  {
    value: "< 2 daqiqa",
    label: "Tezkor sozlash",
    sublabel: "Kod yozmasdan ulash",
  },
];

export interface BentoFeature {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  size: "large" | "medium" | "compact";
  iconName: "chat" | "vision" | "sync" | "orders" | "payments" | "analytics";
  tag?: string;
  bullets?: string[];
}

export const BENTO_FEATURES: BentoFeature[] = [
  {
    id: "ai-chat",
    eyebrow: "TABIIY TILDA MULOQOT",
    title: "AI Chat — O‘zbek tilida erkin va muloyim muloqot",
    description:
      "Mijozlaringiz bilan o‘zbek (lotin va kirill), rus hamda ingliz tillarida haqiqiy professional sotuvchidek gaplashadi. Do‘koningiz uslubiga mos ohangda javob beradi.",
    size: "large",
    iconName: "chat",
    tag: "Multi-Language LLM",
    bullets: [
      "O‘zbek lotin va kirill yozuvlarini 100% tushunadi",
      "Shevalar va qisqartmalarni to‘g‘ri anglaydi",
      "Xushmuomala va sotuvga yo‘naltirilgan skriptlar",
    ],
  },
  {
    id: "ai-vision",
    eyebrow: "MULTIMODAL AI VISION",
    title: "AI Vision — Rasm va fotosuratlardan mahsulot tanish",
    description:
      "Mijoz Instagram, bozor yoki ko‘chada ko‘rgan kiyim yoki mahsulot rasmini botga yuborsa, AI fotosuratni tahlil qilib, katalogingizdan o‘xshash yoki aynan o‘sha tovarlarni topib beradi.",
    size: "large",
    iconName: "vision",
    tag: "Computer Vision",
    bullets: [
      "Kiyim, poyabzal, elektronika va aksessuarlarni taniydi",
      "Rang, o‘lcham va modelini avtomatik ajratadi",
      "Bir soniyada ombordagi qoldiq va narxni ko‘rsatadi",
    ],
  },
  {
    id: "telegram-sync",
    eyebrow: "REAL VAQTDA SINXRONIZATSIYA",
    title: "Telegram Sync",
    description:
      "Telegram kanalingizdagi postlar va mahsulot fotosuratlarini avtomatik o‘qib, AI xotirasiga kiritadi.",
    size: "medium",
    iconName: "sync",
    tag: "Auto-Catalog",
    bullets: ["Kanal postlarini avtomatik import", "Narx o‘zgarganda darhol yangilash"],
  },
  {
    id: "smart-orders",
    eyebrow: "AVTOMATIK BUYURTMA",
    title: "Smart Orders",
    description:
      "Mijozdan ism, telefon raqami va yetkazib berish manzilini yig‘adi, buyurtmani shakllantiradi va admin panelga uzatadi.",
    size: "medium",
    iconName: "orders",
    tag: "CRM & Funnel",
    bullets: ["Xaridor ma'lumotlarini saralash", "Yetkazib berish manzili va geolokatsiya"],
  },
  {
    id: "payments",
    eyebrow: "TO‘LOV INTEGRATSIYALARI",
    title: "Click & Payme",
    description:
      "Click, Payme va bank kartalari orqali xavfsiz to‘lov havolalarini avtomatik generatsiya qiladi.",
    size: "compact",
    iconName: "payments",
    tag: "Instant Pay",
  },
  {
    id: "analytics",
    eyebrow: "BIZNES TAHLILI",
    title: "Jonli Analitika",
    description:
      "Kunlik qabul qilingan so‘rovlar, savdo hajmi, eng ko‘p qidirilgan mahsulotlar va konversiya statistikasi.",
    size: "compact",
    iconName: "analytics",
    tag: "Real-time Metrics",
  },
];

export interface DemoScenario {
  id: string;
  tabLabel: string;
  icon: string;
  userMessage: string;
  userHasImage?: boolean;
  userImageDesc?: string;
  aiResponse: string;
  hasOrderCard?: boolean;
  orderData?: {
    title: string;
    item: string;
    price: string;
    size: string;
    status: string;
  };
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: "consultation",
    tabLabel: "1. Mahsulot maslahati",
    icon: "💬",
    userMessage: "Assalomu alaykum! Erkaklar uchun issiq qishki xudi bormi? Qora rangda L razmer.",
    aiResponse:
      "Va alaykum assalom! Ha, albatta. Bizda 100% paxtali, ichi nafas oluvchi issiq 'Oversize Black Hoodie' modeli mavjud. Hozirda L razmer omborda bor. Narxi 240,000 so‘m. Buyurtma berish uchun telefon raqamingizni qoldirasizmi? 🛍️",
  },
  {
    id: "vision-search",
    tabLabel: "2. Rasm orqali qidirish",
    icon: "📸",
    userMessage: "Mana shu rasmdagi poyabzaldan bormi sizlarda?",
    userHasImage: true,
    userImageDesc: "Qora charm krossovka surati",
    aiResponse:
      "Fotosurat tahlil qilindi! 🔍 Katalogimizdagi 'Urban Classic Leather Sneakers' modeliga 98% mos keldi. Hozirda 41, 42, 43 o‘lchamlari mavjud. Narxi 380,000 so‘m. Yetkazib berish butun O‘zbekiston bo‘ylab bepul!",
  },
  {
    id: "instant-order",
    tabLabel: "3. Buyurtma shakllantirish",
    icon: "⚡",
    userMessage: "Ha, 42 razmeridan 1 dona olaman. Toshkent, Chilonzor 7-mavzega yetkazib bering.",
    aiResponse:
      "Ajoyib tanlov! Buyurtmangiz qabul qilindi. Operatorimiz tez orada tasdiqlash uchun bog‘lanadi. To‘lovni Click yoki mahsulot yetib borganda naqd qilish mumkin.",
    hasOrderCard: true,
    orderData: {
      title: "Yangi buyurtma #2048",
      item: "Urban Classic Sneakers (42 o‘lcham)",
      price: "380,000 so‘m",
      size: "Manzil: Toshkent sh., Chilonzor 7-kvartal",
      status: "Tasdiqlash kutilmoqda",
    },
  },
];

export interface TestimonialItem {
  id: string;
  quote: string;
  author: string;
  role: string;
  channel: string;
  stats: string;
}

export const TESTIMONIALS: TestimonialItem[] = [
  {
    id: "test-1",
    quote:
      "Kechasi soat 01:00 dan 06:00 gacha kelgan xaridorlar ilgari ertalabgacha javob kutib boshqa do‘konga o‘tib ketardi. Selloi ulanishi bilan kechki savdo 40% ga oshdi.",
    author: "[TO‘LDIRING: Do‘kon egasi ismi]",
    role: "Telegram kiyim do‘koni asoschisi",
    channel: "@[TO‘LDIRING_KANAL]",
    stats: "+40% kechki savdo o‘sishi",
  },
  {
    id: "test-2",
    quote:
      "Mijozlar rasm yuborib 'shu bormi' deb so‘raganda, menejerlarimiz rasmni ombordan qidirishga 15 daqiqa sarflardi. AI Vision bu ishni 2 soniyada hal qilib beryapti.",
    author: "[TO‘LDIRING: Menejer ismi]",
    role: "Poyabzal va aksessuarlar savdosi",
    channel: "@[TO‘LDIRING_KANAL]",
    stats: "2 soniyada mahsulot topish",
  },
  {
    id: "test-3",
    quote:
      "Selloi platformasining eng katta yutug‘i — o‘zbek tilini jonli va tushunib gaplashishi. Mijozlarimiz bot bilan emas, tirik maslahatchi bilan suhbatlashayotgandek his qiladi.",
    author: "[TO‘LDIRING: Do‘kon egasi ismi]",
    role: "Kosmetika & Parfyumeriya do‘koni",
    channel: "@[TO‘LDIRING_KANAL]",
    stats: "99% ijobiy mijoz munosabati",
  },
];

export const PARTNER_LOGOS = [
  { name: "[TO‘LDIRING: Do‘kon 1]", label: "ModaUz Store" },
  { name: "[TO‘LDIRING: Do‘kon 2]", label: "TechZone Gadgets" },
  { name: "[TO‘LDIRING: Do‘kon 3]", label: "BeautyTrend Cosmetics" },
  { name: "[TO‘LDIRING: Do‘kon 4]", label: "Sneakers Hub Uz" },
  { name: "[TO‘LDIRING: Do‘kon 5]", label: "HomeStyle Textile" },
];

export interface AdvancedPricingPlan {
  id: string;
  name: string;
  tagline: string;
  monthlyPrice: string;
  annualPrice: string;
  priceNote: string;
  isPopular?: boolean;
  trialBadge: string;
  features: { name: string; included: boolean }[];
  ctaLabel: string;
}

export const ADVANCED_PRICING_PLANS: AdvancedPricingPlan[] = [
  {
    id: "start",
    name: "START",
    tagline: "Kichik do‘konlar va yangi boshlagan tadbirkorlar uchun.",
    monthlyPrice: "[NARX]",
    annualPrice: "[NARX]",
    priceNote: "so‘m / oyiga",
    trialBadge: "7 kunlik sinov",
    features: [
      { name: "AI Chat (asosiy model, o‘zbek va rus tillari)", included: true },
      { name: "Telegram Bot integratsiyasi", included: true },
      { name: "1 ta Telegram kanal sinxronizatsiyasi", included: true },
      { name: "Buyurtmalar boshqaruvi (CRM)", included: true },
      { name: "Asosiy savdo statistikasi", included: true },
      { name: "AI Vision (rasmni tanish)", included: false },
      { name: "Click va Payme to‘lov integratsiyasi", included: false },
      { name: "Jamoa a'zolari (bir nechta admin)", included: false },
    ],
    ctaLabel: "7 kun sinab ko‘rish →",
  },
  {
    id: "pro",
    name: "PRO",
    tagline: "Tez o‘sayotgan Telegram do‘konlar va faol savdo uchun.",
    monthlyPrice: "[NARX]",
    annualPrice: "[NARX]",
    priceNote: "so‘m / oyiga",
    isPopular: true,
    trialBadge: "7 kunlik sinov",
    features: [
      { name: "AI Chat (eng aqlli model, o‘zbek, rus, ingliz)", included: true },
      { name: "Telegram Bot + Web App integratsiyasi", included: true },
      { name: "Cheksiz Telegram kanal sinxronizatsiyasi", included: true },
      { name: "AI Vision (rasm va fotosuratdan tovar tanish)", included: true },
      { name: "Click va Payme to‘lov integratsiyasi", included: true },
      { name: "Kengaytirilgan konversiya va mijozlar analitikasi", included: true },
      { name: "Ustuvor texnik qo‘llab-quvvatlash 24/7", included: true },
      { name: "Maxsus do‘kon so‘zlashuv ohangi (tone of voice)", included: true },
    ],
    ctaLabel: "7 kun sinab ko‘rish →",
  },
  {
    id: "ultra",
    name: "ULTRA",
    tagline: "Katta chakana tarmoqlar, brendlar va korporativ jamoalar uchun.",
    monthlyPrice: "Kelishuv asosida",
    annualPrice: "Kelishuv asosida",
    priceNote: "maxsus taklif",
    trialBadge: "Individual yondashuv",
    features: [
      { name: "Barcha PRO imkoniyatlari to‘liq hajmda", included: true },
      { name: "Cheksiz xabarlar va mahsulotlar hajmi", included: true },
      { name: "Jamoa (multi-agent & admin) boshqaruvi", included: true },
      { name: "1C, Moysklad va maxsus ERP integratsiyalari", included: true },
      { name: "Alohida server va xavfsiz ma'lumotlar bazasi", included: true },
      { name: "Shaxsiy muhandis va SLA kafolati", included: true },
      { name: "Maxsus AI model tayyorlash (fine-tuning)", included: true },
      { name: "Cheksiz API kirish huquqi", included: true },
    ],
    ctaLabel: "Aloqaga chiqish",
  },
];

export interface ComparisonRow {
  category: string;
  items: {
    name: string;
    start: string | boolean;
    pro: string | boolean;
    ultra: string | boolean;
  }[];
}

export const COMPARISON_FEATURES: ComparisonRow[] = [
  {
    category: "AI va Muloqot Imkoniyatlari",
    items: [
      { name: "O‘zbek tilida tabiiy so‘zlashuv (lotin va kirill)", start: true, pro: true, ultra: true },
      { name: "Rus va ingliz tillarida javob berish", start: true, pro: true, ultra: true },
      { name: "AI Vision (rasmdan tovar topish)", start: false, pro: true, ultra: true },
      { name: "Do‘kon xarakteri (tone of voice) moslash", start: false, pro: true, ultra: true },
      { name: "Maxsus model sozlash (Fine-tuning)", start: false, pro: false, ultra: true },
    ],
  },
  {
    category: "Kanal va Do‘kon Boshqaruvi",
    items: [
      { name: "Telegram Bot integratsiyasi", start: "1 ta bot", pro: "3 ta bot", ultra: "Cheksiz" },
      { name: "Telegram Kanal sinxronizatsiyasi", start: "1 ta kanal", pro: "5 ta kanal", ultra: "Cheksiz" },
      { name: "Katalogdagi mahsulotlar chegarasi", start: "500 tagacha", pro: "10,000 tagacha", ultra: "Cheksiz" },
      { name: "Avtomatik zaxira va qoldiq nazorati", start: true, pro: true, ultra: true },
    ],
  },
  {
    category: "To‘lovlar va Integratsiyalar",
    items: [
      { name: "Click & Payme integratsiyasi", start: false, pro: true, ultra: true },
      { name: "Smart CRM buyurtma jadvali", start: true, pro: true, ultra: true },
      { name: "REST API kirish huquqi", start: false, pro: true, ultra: true },
      { name: "1C / Moysklad integratsiyasi", start: false, pro: false, ultra: true },
    ],
  },
  {
    category: "Qo‘llab-quvvatlash va Xizmat",
    items: [
      { name: "Sinov muddati", start: "7 kunlik sinov", pro: "7 kunlik sinov", ultra: "Individual" },
      { name: "Texnik yordam", start: "Standart (ish vaqti)", pro: "Ustuvor 24/7", ultra: "Shaxsiy menejer" },
      { name: "SLA kafolati (99.9%)", start: false, pro: true, ultra: true },
    ],
  },
];

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FAQItem[] = [
  {
    id: "faq-1",
    question: "Dasturchi yoki IT mutaxassis yollashim shartmi?",
    answer:
      "Mutlaqo yo‘q! Selloi platformasi aynan texnik bilimi bo‘lmagan do‘kon egalari uchun yaratilgan. Boshqaruv panelimizdan Telegram bot tokeningizni kiritasiz va kanalingizni ko‘rsatasiz — tizim qolgan barcha ishlarni 2 daqiqa ichida avtomatik sozlaydi.",
  },
  {
    id: "faq-2",
    question: "AI sotuvchi qaysi tillarni tushunadi va qanday gaplashadi?",
    answer:
      "Selloi AI o‘zbek tilini mukammal biladi — lotin va kirill yozuvlaridagi xabarlarni, so‘zlashuv uslubi va qisqartmalarni erkin tushunadi. Shuningdek, rus va ingliz tillarida ham professional xarid maslahatchisidek erkin muloqot qiladi.",
  },
  {
    id: "faq-3",
    question: "7 kunlik sinov muddati qanday ishlaydi?",
    answer:
      "Ha, ro‘yxatdan o‘tgandan so‘ng barcha imkoniyatlar (AI Chat, Vision, Telegram Sync) 7 kun davomida imtiyozli sinov asosida ishlaydi. Bank kartangizni kiritish talab etilmaydi. Sinov muddati tugagach, o‘zingizga mos tarifni tanlab davom ettirishingiz mumkin.",
  },
  {
    id: "faq-4",
    question: "Telegram kanalimdagi tovarlarni qanday qilib AI xotirasiga yuklayman?",
    answer:
      "Bizning aqlli 'Telegram Sync' tizimimiz kanalingizdagi barcha postlar, fotosuratlar, narxlar va tavsiflarni avtomatik skanerlab, do‘kon katalogiga aylantiradi. Kanalingizga yangi tovar qo‘shsangiz yoki narxini o‘zgartirsangiz, AI ham darhol yangilangan ma'lumotni o‘zlashtiradi.",
  },
  {
    id: "faq-5",
    question: "Mijoz fotosurat yuborganida AI uni qanday aniqlaydi?",
    answer:
      "Biz zamonaviy Multimodal AI Vision texnologiyasidan foydalanamiz. Mijoz qidirayotgan kiyim, poyabzal yoki boshqa mahsulot suratini botga yuborsa, tizim tasvirdagi buyumning rangi, bichimi va o‘ziga xos belgilarini sizning katalogingizdagi fotosuratlar bilan solishtirib, aniq moslikni topadi.",
  },
  {
    id: "faq-6",
    question: "Click va Payme orqali to‘lovlarni qabul qilsa bo‘ladimi?",
    answer:
      "Albatta! PRO va ULTRA tariflarida Click va Payme to‘lov tizimlari ulanadi. Xaridor buyurtma berishi bilanoq bot unga avtomatik hisob-faktura (to‘lov havolasi) yuboradi va to‘lov amalga oshishi bilan buyurtmani 'To‘landi' maqomiga o‘tkazadi.",
  },
  {
    id: "faq-7",
    question: "Kechasi kelgan xaridorlar bilan bot qanday ishlaydi?",
    answer:
      "Selloi AI hech qachon uxlamaydi. Tun-u kun, dam olish kunlarisiz soniyalar ichida har bir xaridorni kutib oladi, savollariga to‘liq javob beradi va buyurtmasini qabul qilib, ertalab sizga tayyor ro‘yxat ko‘rinishida taqdim etadi.",
  },
];

export const HOW_IT_WORKS_STEPS = [
  {
    step: "01",
    title: "Ro‘yxatdan o‘ting",
    description: "1 daqiqada o‘z do‘kon hisobingizni oching va qulay boshqaruv paneliga kiring.",
    icon: "user-plus",
    badge: "1 daqiqa",
  },
  {
    step: "02",
    title: "Telegram'ni ulang",
    description: "Bot tokeningizni kiriting va do‘kon kanalingizni ko‘rsating. Katalog avtomatik o‘qiladi.",
    icon: "send",
    badge: "Avtomatik sinxronizatsiya",
  },
  {
    step: "03",
    title: "AI sotuvchini ishga tushiring",
    description: "AI sotuvchingiz mijozlaringiz bilan kechayu kunduz professional muloqotni boshlaydi.",
    icon: "bot",
    badge: "24/7 faol",
  },
];

export const PRICING_PLANS = ADVANCED_PRICING_PLANS;

