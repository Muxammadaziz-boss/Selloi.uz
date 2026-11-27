import { Language } from "@/app/lib/i18n/types";

export interface NavItem {
  label: string;
  href: string;
}

export const NAV_ITEMS_BY_LANG: Record<Language, NavItem[]> = {
  uz: [
    { label: "Imkoniyatlar", href: "#imkoniyatlar" },
    { label: "Qanday ishlaydi?", href: "#sotuv-jarayoni" },
    { label: "Boshlash", href: "#boshlash" },
    { label: "Tariflar", href: "#tariflar" },
    { label: "FAQ", href: "#faq" },
    { label: "API", href: "/docs" },
  ],
  ru: [
    { label: "Возможности", href: "#imkoniyatlar" },
    { label: "Как это работает?", href: "#sotuv-jarayoni" },
    { label: "Начать", href: "#boshlash" },
    { label: "Тарифы", href: "#tariflar" },
    { label: "FAQ", href: "#faq" },
    { label: "API", href: "/docs" },
  ],
  en: [
    { label: "Features", href: "#imkoniyatlar" },
    { label: "How It Works", href: "#sotuv-jarayoni" },
    { label: "Get Started", href: "#boshlash" },
    { label: "Pricing", href: "#tariflar" },
    { label: "FAQ", href: "#faq" },
    { label: "API", href: "/docs" },
  ],
};

export const NAV_ITEMS: NavItem[] = NAV_ITEMS_BY_LANG.uz;

export interface TrustMetric {
  value: string;
  label: string;
  sublabel: string;
}

export const TRUST_METRICS_BY_LANG: Record<Language, TrustMetric[]> = {
  uz: [
    { value: "24/7", label: "To‘xtovsiz ishlash", sublabel: "Kechayu kunduz javob" },
    { value: "3 ta til", label: "Ko‘p tilli muloqot", sublabel: "O‘zbek, rus, ingliz" },
    { value: "99%", label: "Aniqlik darajasi", sublabel: "So‘rovlarni to‘g‘ri anglash" },
    { value: "< 2 daqiqa", label: "Tezkor sozlash", sublabel: "Kod yozmasdan ulash" },
  ],
  ru: [
    { value: "24/7", label: "Круглосуточная работа", sublabel: "Ответы днем и ночью" },
    { value: "3 языка", label: "Мультиязычность", sublabel: "Узбекский, русский, английский" },
    { value: "99%", label: "Точность ответов", sublabel: "Понимание запросов клиентов" },
    { value: "< 2 мин", label: "Быстрый старт", sublabel: "Подключение без кода" },
  ],
  en: [
    { value: "24/7", label: "Non-Stop Uptime", sublabel: "Day & night instant responses" },
    { value: "3 Languages", label: "Multilingual AI", sublabel: "Uzbek, Russian, English" },
    { value: "99%", label: "Accuracy Rate", sublabel: "Intent understanding" },
    { value: "< 2 mins", label: "Instant Setup", sublabel: "No-code connection" },
  ],
};

export const TRUST_METRICS: TrustMetric[] = TRUST_METRICS_BY_LANG.uz;

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

export const DEMO_SCENARIOS_BY_LANG: Record<Language, DemoScenario[]> = {
  uz: [
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
  ],
  ru: [
    {
      id: "consultation",
      tabLabel: "1. Консультация по товару",
      icon: "💬",
      userMessage: "Здравствуйте! Есть ли в наличии мужской теплый худи? Черный цвет, размер L.",
      aiResponse:
        "Здравствуйте! Да, конечно. У нас в наличии модель 'Oversize Black Hoodie' из 100% хлопка с начесом. Размер L на складе. Цена 240,000 сум. Оформим заказ с бесплатной доставкой? 🛍️",
    },
    {
      id: "vision-search",
      tabLabel: "2. Поиск по фото",
      icon: "📸",
      userMessage: "Есть ли у вас кроссовки как на этом фото?",
      userHasImage: true,
      userImageDesc: "Фото черных кожаных кроссовок",
      aiResponse:
        "Фотография распознана! 🔍 Модель в нашем каталоге 'Urban Classic Leather Sneakers' совпадает на 98%. Доступны размеры 41, 42, 43. Цена 380,000 сум. Бесплатная доставка по всему Узбекистану!",
    },
    {
      id: "instant-order",
      tabLabel: "3. Оформление заказа",
      icon: "⚡",
      userMessage: "Да, беру 42 размер 1 пару. Доставка в Ташкент, Чиланзар 7.",
      aiResponse:
        "Отличный выбор! Заказ оформлен. Наш менеджер свяжется для подтверждения. Оплата через Click или наличными при получении.",
      hasOrderCard: true,
      orderData: {
        title: "Новый заказ #2048",
        item: "Urban Classic Sneakers (размер 42)",
        price: "380,000 сум",
        size: "Адрес: г. Ташкент, Чиланзар 7",
        status: "Ожидает подтверждения",
      },
    },
  ],
  en: [
    {
      id: "consultation",
      tabLabel: "1. Product Consultation",
      icon: "💬",
      userMessage: "Hello! Do you have a warm men's winter hoodie in black, size L?",
      aiResponse:
        "Hello! Yes, absolutely. We have the 100% premium cotton 'Oversize Black Hoodie' in stock in size L. Price is 240,000 UZS. Would you like to proceed with an order? 🛍️",
    },
    {
      id: "vision-search",
      tabLabel: "2. Search by Image",
      icon: "📸",
      userMessage: "Do you have the sneakers shown in this photo?",
      userHasImage: true,
      userImageDesc: "Photo of black leather sneakers",
      aiResponse:
        "Photo analyzed! 🔍 98% match found in your catalog: 'Urban Classic Leather Sneakers'. Sizes 41, 42, 43 currently available. Price is 380,000 UZS with free nationwide delivery!",
    },
    {
      id: "instant-order",
      tabLabel: "3. Instant Order",
      icon: "⚡",
      userMessage: "Yes, I'll take 1 pair in size 42. Deliver to Tashkent, Chilonzor 7.",
      aiResponse:
        "Great choice! Your order is registered. Our team will contact you shortly to confirm dispatch. Payment via Click or cash upon arrival.",
      hasOrderCard: true,
      orderData: {
        title: "New Order #2048",
        item: "Urban Classic Sneakers (Size 42)",
        price: "380,000 UZS",
        size: "Address: Tashkent, Chilonzor 7",
        status: "Pending confirmation",
      },
    },
  ],
};

export const DEMO_SCENARIOS = DEMO_SCENARIOS_BY_LANG.uz;

export interface HowItWorksStep {
  step: string;
  title: string;
  description: string;
  badge: string;
  icon: string;
}

export const HOW_IT_WORKS_BY_LANG: Record<Language, HowItWorksStep[]> = {
  uz: [
    {
      step: "01",
      title: "Ro‘yxatdan o‘ting",
      description: "1 daqiqada do‘kon hisobingizni oching va qulay boshqaruv paneliga kiring.",
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
      title: "AI sotuvchini faollashtiring",
      description: "AI sotuvchingiz mijozlaringiz bilan kechayu kunduz professional muloqotni boshlaydi.",
      icon: "bot",
      badge: "24/7 faol",
    },
  ],
  ru: [
    {
      step: "01",
      title: "Зарегистрируйтесь",
      description: "Создайте аккаунт магазина за 1 минуту и получите доступ к панели управления.",
      icon: "user-plus",
      badge: "1 минута",
    },
    {
      step: "02",
      title: "Подключите Telegram",
      description: "Укажите токен бота и привяжите канал. Каталог товаров сформируется автоматически.",
      icon: "send",
      badge: "Авто-синхронизация",
    },
    {
      step: "03",
      title: "Активируйте ИИ-продавца",
      description: "Ваш AI-ассистент начнет консультировать покупателей и продавать 24/7.",
      icon: "bot",
      badge: "24/7 онлайн",
    },
  ],
  en: [
    {
      step: "01",
      title: "Register Your Account",
      description: "Set up your store workspace in under a minute and access your dashboard.",
      icon: "user-plus",
      badge: "1 minute",
    },
    {
      step: "02",
      title: "Connect Telegram",
      description: "Paste your Telegram bot token and channel link. Inventory syncs automatically.",
      icon: "send",
      badge: "Auto-synchronization",
    },
    {
      step: "03",
      title: "Activate AI Seller",
      description: "Your AI sales agent immediately begins consulting clients and processing orders 24/7.",
      icon: "bot",
      badge: "24/7 active",
    },
  ],
};

export const HOW_IT_WORKS_STEPS = HOW_IT_WORKS_BY_LANG.uz;

export interface TestimonialItem {
  id: string;
  quote: string;
  author: string;
  role: string;
  channel: string;
  stats: string;
}

export const TESTIMONIALS_BY_LANG: Record<Language, TestimonialItem[]> = {
  uz: [
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
        "Selloi platformasining eng katta yutug'i shundaki, u o'zbek tilida tabiiy va erkin muloqot qiladi. Mijozlarimiz bot bilan emas, tirik maslahatchi bilan suhbatlashayotgandek his qiladi.",
      author: "[TO‘LDIRING: Do‘kon egasi ismi]",
      role: "Kosmetika & Parfyumeriya do‘koni",
      channel: "@[TO‘LDIRING_KANAL]",
      stats: "99% ijobiy mijoz munosabati",
    },
  ],
  ru: [
    {
      id: "test-1",
      quote:
        "Клиенты, которые писали ночью с 01:00 до 06:00, раньше уходили к конкурентам. С подключением Selloi ночные продажи выросли более чем на 40%.",
      author: "[ЗАПОЛНИТЬ: Владелец магазина]",
      role: "Основатель магазина одежды в Telegram",
      channel: "@[КАНАЛ]",
      stats: "+40% ночных продаж",
    },
    {
      id: "test-2",
      quote:
        "Когда клиенты отправляли фото с вопросом 'есть такой?', менеджеры тратили до 15 минут. AI Vision распознает обувь и находит модель за 2 секунды.",
      author: "[ЗАПОЛНИТЬ: Менеджер магазина]",
      role: "Продажи обуви и аксессуаров",
      channel: "@[КАНАЛ]",
      stats: "Поиск товара за 2 секунды",
    },
    {
      id: "test-3",
      quote:
        "Главный плюс Selloi заключается в живом общении на русском и узбекском языках. Клиенты уверены, что общаются с внимательным продавцом, а не с роботом.",
      author: "[ЗАПОЛНИТЬ: Владелец магазина]",
      role: "Магазин косметики и парфюмерии",
      channel: "@[КАНАЛ]",
      stats: "99% довольных клиентов",
    },
  ],
  en: [
    {
      id: "test-1",
      quote:
        "Customers shopping between 1 AM and 6 AM previously bounced before morning. With Selloi responding instantly, our nighttime sales jumped by 40%.",
      author: "[FILL: Store Owner Name]",
      role: "Founder, Telegram Apparel Store",
      channel: "@[STORE_CHANNEL]",
      stats: "+40% night sales growth",
    },
    {
      id: "test-2",
      quote:
        "When buyers sent pictures asking 'do you have this?', managers spent 15 minutes checking stock. AI Vision matches photos to inventory in 2 seconds.",
      author: "[FILL: Store Manager]",
      role: "Footwear & Accessories Retailer",
      channel: "@[STORE_CHANNEL]",
      stats: "2s image search speed",
    },
    {
      id: "test-3",
      quote:
        "Selloi’s greatest strength is its natural, fluent dialogue. Our shoppers genuinely feel they are talking to a skilled in-store sales consultant.",
      author: "[FILL: Store Owner]",
      role: "Cosmetics & Perfumery Boutique",
      channel: "@[STORE_CHANNEL]",
      stats: "99% positive customer rating",
    },
  ],
};

export const TESTIMONIALS = TESTIMONIALS_BY_LANG.uz;

export const PARTNER_LOGOS = [
  { name: "[1]", label: "ModaUz Store" },
  { name: "[2]", label: "TechZone Gadgets" },
  { name: "[3]", label: "BeautyTrend Cosmetics" },
  { name: "[4]", label: "Sneakers Hub Uz" },
  { name: "[5]", label: "HomeStyle Textile" },
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

export const PRICING_PLANS_BY_LANG: Record<Language, AdvancedPricingPlan[]> = {
  uz: [
    {
      id: "start",
      name: "START",
      tagline: "Kichik do‘konlar va yangi boshlagan tadbirkorlar uchun.",
      monthlyPrice: "$19",
      annualPrice: "$190",
      priceNote: "so‘m / oyiga",
      trialBadge: "7 kunlik sinov",
      features: [
        { name: "AI Chat (asosiy model, o‘zbek va rus tillari)", included: true },
        { name: "Umumiy Selloi boti orqali 10 soniyada ulanish", included: true },
        { name: "1 ta Telegram kanal sinxronizatsiyasi", included: true },
        { name: "Buyurtmalar boshqaruvi (CRM)", included: true },
        { name: "Asosiy savdo statistikasi", included: true },
        { name: "Shaxsiy brend Telegram boti (@your_bot)", included: false },
        { name: "Jonli User Chat (shaxsiy akkaunt hisobi)", included: false },
        { name: "AI Vision (rasmni tanish)", included: false },
        { name: "Click va Payme to‘lov integratsiyasi", included: false },
      ],
      ctaLabel: "7 kun sinab ko‘rish →",
    },
    {
      id: "pro",
      name: "PRO",
      tagline: "Tez o‘sayotgan Telegram do‘konlar va faol savdo uchun.",
      monthlyPrice: "$19",
      annualPrice: "$190",
      priceNote: "so‘m / oyiga",
      isPopular: true,
      trialBadge: "7 kunlik sinov",
      features: [
        { name: "AI Chat (eng aqlli model, o‘zbek, rus, ingliz)", included: true },
        { name: "Shaxsiy brend Telegram boti (BotFather orqali)", included: true },
        { name: "Telegram Bot + Web App integratsiyasi", included: true },
        { name: "Cheksiz Telegram kanal sinxronizatsiyasi", included: true },
        { name: "AI Vision (rasm va fotosuratdan tovar tanish)", included: true },
        { name: "Click va Payme to‘lov integratsiyasi", included: true },
        { name: "Kengaytirilgan konversiya va mijozlar analitikasi", included: true },
        { name: "Jonli User Chat (shaxsiy akkaunt)", included: false },
        { name: "Ustuvor texnik qo‘llab-quvvatlash 24/7", included: true },
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
        { name: "Shaxsiy Bot YOKI Insoniy User Chat (Erkin tanlov)", included: true },
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
  ],
  ru: [
    {
      id: "start",
      name: "START",
      tagline: "Для небольших магазинов и начинающих предпринимателей.",
      monthlyPrice: "$19",
      annualPrice: "$190",
      priceNote: "сум / месяц",
      trialBadge: "Попробовать 7 дней",
      features: [
        { name: "AI Чат (базовая модель, узбекский и русский)", included: true },
        { name: "Подключение через официального бота @Selloi_ai_bot за 10 сек", included: true },
        { name: "Синхронизация с 1 каналом", included: true },
        { name: "Управление заказами (CRM)", included: true },
        { name: "Базовая статистика продаж", included: true },
        { name: "Собственный брендовый Telegram-бот", included: false },
        { name: "Живой User Chat (личный аккаунт)", included: false },
        { name: "AI Vision (поиск по фото)", included: false },
        { name: "Оплата через Click и Payme", included: false },
      ],
      ctaLabel: "Попробовать 7 дней",
    },
    {
      id: "pro",
      name: "PRO",
      tagline: "Для растущих Telegram-магазинов и активных продаж.",
      monthlyPrice: "$19",
      annualPrice: "$190",
      priceNote: "сум / месяц",
      isPopular: true,
      trialBadge: "Попробовать 7 дней",
      features: [
        { name: "AI Чат (продвинутая модель: UZ, RU, EN)", included: true },
        { name: "Собственный брендовый Telegram-бот (BotFather)", included: true },
        { name: "Интеграция Telegram Bot + Web App", included: true },
        { name: "Неограниченная синхронизация каналов", included: true },
        { name: "AI Vision (распознавание товаров по фото)", included: true },
        { name: "Платежи через Click и Payme", included: true },
        { name: "Расширенная аналитика и воронка", included: true },
        { name: "Живой User Chat (личный аккаунт)", included: false },
        { name: "Приоритетная техподдержка 24/7", included: true },
      ],
      ctaLabel: "Попробовать 7 дней",
    },
    {
      id: "ultra",
      name: "ULTRA",
      tagline: "Для крупных ритейлеров, сетей и корпоративных брендов.",
      monthlyPrice: "По договоренности",
      annualPrice: "По договоренности",
      priceNote: "индивидуально",
      trialBadge: "Индивидуальный подход",
      features: [
        { name: "Свой бот ИЛИ Живой User Chat (свободный выбор)", included: true },
        { name: "Все возможности PRO без ограничений", included: true },
        { name: "Безлимитные сообщения и товары", included: true },
        { name: "Управление командой и правами доступа", included: true },
        { name: "Интеграция с 1C, МойСклад и ERP", included: true },
        { name: "Выделенный сервер и база данных", included: true },
        { name: "Персональный инженер и SLA 99.9%", included: true },
        { name: "Тонкая настройка модели (Fine-tuning)", included: true },
        { name: "Неограниченный доступ к API", included: true },
      ],
      ctaLabel: "Связаться с нами",
    },
  ],
  en: [
    {
      id: "start",
      name: "START",
      tagline: "For boutique shops and emerging online merchants.",
      monthlyPrice: "$19",
      annualPrice: "$190",
      priceNote: "UZS / mo",
      trialBadge: "7-day trial",
      features: [
        { name: "AI Chat (Core model, Uzbek & Russian)", included: true },
        { name: "Instant 10-second setup via official @Selloi_ai_bot", included: true },
        { name: "1 Telegram Channel catalog sync", included: true },
        { name: "Order management pipeline (CRM)", included: true },
        { name: "Essential sales analytics", included: true },
        { name: "Custom branded Telegram bot (@your_bot)", included: false },
        { name: "Direct Human User Chat (Personal account)", included: false },
        { name: "AI Vision image recognition", included: false },
        { name: "Click & Payme instant checkout", included: false },
      ],
      ctaLabel: "Start 7-Day Trial",
    },
    {
      id: "pro",
      name: "PRO",
      tagline: "For high-volume Telegram brands and scaling sales.",
      monthlyPrice: "$19",
      annualPrice: "$190",
      priceNote: "UZS / mo",
      isPopular: true,
      trialBadge: "7-day trial",
      features: [
        { name: "AI Chat (Premium model: UZ, RU, EN)", included: true },
        { name: "Custom branded Telegram bot (BotFather integration)", included: true },
        { name: "Telegram Bot + Web App integration", included: true },
        { name: "Unlimited Telegram channel catalog sync", included: true },
        { name: "AI Vision 2.0 image recognition", included: true },
        { name: "Click & Payme instant checkout", included: true },
        { name: "Advanced conversion funnels & metrics", included: true },
        { name: "Direct Human User Chat (Personal account)", included: false },
        { name: "24/7 Priority technical support", included: true },
      ],
      ctaLabel: "Start 7-Day Trial",
    },
    {
      id: "ultra",
      name: "ULTRA",
      tagline: "For large retail chains, enterprise brands, and networks.",
      monthlyPrice: "Custom quote",
      annualPrice: "Custom quote",
      priceNote: "enterprise",
      trialBadge: "Dedicated SLA",
      features: [
        { name: "Custom Bot OR Direct Human User Chat (Full Choice)", included: true },
        { name: "All PRO capabilities uncapped", included: true },
        { name: "Unlimited messages and SKU inventory", included: true },
        { name: "Multi-seat role governance and RBAC", included: true },
        { name: "1C, MoySklad, and custom ERP connectors", included: true },
        { name: "Isolated private tenant database", included: true },
        { name: "Dedicated solutions engineer & SLA 99.9%", included: true },
        { name: "Domain-specific AI fine-tuning", included: true },
        { name: "Uncapped REST API throughput", included: true },
      ],
      ctaLabel: "Contact Enterprise",
    },
  ],
};

export const ADVANCED_PRICING_PLANS = PRICING_PLANS_BY_LANG.uz;
export const PRICING_PLANS = ADVANCED_PRICING_PLANS;

export interface ComparisonRow {
  category: string;
  items: {
    name: string;
    start: string | boolean;
    pro: string | boolean;
    ultra: string | boolean;
  }[];
}

export const COMPARISON_BY_LANG: Record<Language, ComparisonRow[]> = {
  uz: [
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
        { name: "Texnik yordam", start: "Standart", pro: "Ustuvor 24/7", ultra: "Shaxsiy menejer" },
        { name: "SLA kafolati (99.9%)", start: false, pro: true, ultra: true },
      ],
    },
  ],
  ru: [
    {
      category: "Возможности AI и Диалога",
      items: [
        { name: "Общение на узбекском (латиница и кириллица)", start: true, pro: true, ultra: true },
        { name: "Ответы на русском и английском языках", start: true, pro: true, ultra: true },
        { name: "AI Vision (поиск товаров по фото)", start: false, pro: true, ultra: true },
        { name: "Настройка тональности бренда (Tone of Voice)", start: false, pro: true, ultra: true },
        { name: "Тонкая донастройка модели (Fine-tuning)", start: false, pro: false, ultra: true },
      ],
    },
    {
      category: "Каналы и Управление Магазином",
      items: [
        { name: "Интеграция с Telegram-ботами", start: "1 бот", pro: "3 бота", ultra: "Безлимит" },
        { name: "Синхронизация Telegram-каналов", start: "1 канал", pro: "5 каналов", ultra: "Безлимит" },
        { name: "Лимит товаров в каталоге", start: "До 500", pro: "До 10,000", ultra: "Безлимит" },
        { name: "Контроль остатков на складе", start: true, pro: true, ultra: true },
      ],
    },
    {
      category: "Платежи и Интеграции",
      items: [
        { name: "Интеграция Click & Payme", start: false, pro: true, ultra: true },
        { name: "Smart CRM таблица заказов", start: true, pro: true, ultra: true },
        { name: "Доступ к REST API", start: false, pro: true, ultra: true },
        { name: "Интеграция с 1C / МойСклад", start: false, pro: false, ultra: true },
      ],
    },
    {
      category: "Поддержка и Сервис",
      items: [
        { name: "Пробный период", start: "7 дней", pro: "7 дней", ultra: "Индивидуально" },
        { name: "Техническая поддержка", start: "Стандарт", pro: "24/7 Приоритет", ultra: "Персональный менеджер" },
        { name: "Гарантия SLA (99.9%)", start: false, pro: true, ultra: true },
      ],
    },
  ],
  en: [
    {
      category: "AI & Conversational Capabilities",
      items: [
        { name: "Natural Uzbek conversation (Latin & Cyrillic)", start: true, pro: true, ultra: true },
        { name: "Russian and English bilingual support", start: true, pro: true, ultra: true },
        { name: "AI Vision (multimodal image recognition)", start: false, pro: true, ultra: true },
        { name: "Custom brand tone-of-voice styling", start: false, pro: true, ultra: true },
        { name: "Domain-specific model fine-tuning", start: false, pro: false, ultra: true },
      ],
    },
    {
      category: "Channel & Store Management",
      items: [
        { name: "Telegram Bot connections", start: "1 bot", pro: "3 bots", ultra: "Unlimited" },
        { name: "Telegram Channel indexing", start: "1 channel", pro: "5 channels", ultra: "Unlimited" },
        { name: "Catalog SKU capacity", start: "Up to 500", pro: "Up to 10,000", ultra: "Unlimited" },
        { name: "Automated inventory stock control", start: true, pro: true, ultra: true },
      ],
    },
    {
      category: "Payments & Integrations",
      items: [
        { name: "Click & Payme instant checkout", start: false, pro: true, ultra: true },
        { name: "Smart CRM order management pipeline", start: true, pro: true, ultra: true },
        { name: "REST API Developer Access", start: false, pro: true, ultra: true },
        { name: "1C / MoySklad ERP connectors", start: false, pro: false, ultra: true },
      ],
    },
    {
      category: "Support & Governance",
      items: [
        { name: "Evaluation trial", start: "7-day trial", pro: "7-day trial", ultra: "Custom" },
        { name: "Technical support", start: "Standard", pro: "24/7 Priority", ultra: "Dedicated account lead" },
        { name: "Guaranteed SLA (99.9%)", start: false, pro: true, ultra: true },
      ],
    },
  ],
};

export const COMPARISON_FEATURES = COMPARISON_BY_LANG.uz;

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export const FAQ_ITEMS_BY_LANG: Record<Language, FAQItem[]> = {
  uz: [
    {
      id: "faq-1",
      question: "Dasturchi yoki IT mutaxassis yollashim shartmi?",
      answer:
        "Mutlaqo yo‘q! Selloi platformasi aynan texnik bilimi bo‘lmagan do‘kon egalari uchun yaratilgan. Boshqaruv panelimizdan Telegram bot tokeningizni kiritasiz va kanalingizni ko‘rsatasiz: tizim qolgan barcha ishlarni 2 daqiqa ichida avtomatik sozlaydi.",
    },
    {
      id: "faq-2",
      question: "AI sotuvchi qaysi tillarni tushunadi va qanday gaplashadi?",
      answer:
        "Selloi AI o‘zbek tilini mukammal biladi: lotin va kirill yozuvlaridagi xabarlarni, so‘zlashuv uslubi va qisqartmalarni erkin tushunadi. Shuningdek, rus va ingliz tillarida ham professional xarid maslahatchisidek erkin muloqot qiladi.",
    },
    {
      id: "faq-3",
      question: "7 kunlik sinov davri qanday ishlaydi?",
      answer:
        "Ro‘yxatdan o‘tgach, 7 kunlik imtiyozli sinov davri (START: 13 000 so‘m, PRO: 26 000 so‘m, ULTRA: 39 000 so‘m) doirasida barcha imkoniyatlar (AI Chat, Vision, Telegram Sync) to‘liq faollashadi. Sinov muddati yakunlangach, oylik yoki yillik obunaga o‘tishingiz mumkin.",
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
        "Albatta! PRO va ULTRA tariflarida Click va Payme to‘lov tizimlari ulanadi. Xaridor buyurtma berishi bilanoq bot unga avtomatik hisob-faktura yuboradi va to‘lov amalga oshishi bilan buyurtmani 'To‘landi' maqomiga o‘tkazadi.",
    },
    {
      id: "faq-7",
      question: "Kechasi kelgan xaridorlar bilan bot qanday ishlaydi?",
      answer:
        "Selloi AI hech qachon uxlamaydi. Tun-u kun, dam olish kunlarisiz soniyalar ichida har bir xaridorni kutib oladi, savollariga to‘liq javob beradi va buyurtmasini qabul qilib, ertalab sizga tayyor ro‘yxat ko‘rinishida taqdim etadi.",
    },
  ],
  ru: [
    {
      id: "faq-1",
      question: "Нужно ли нанимать программиста для настройки?",
      answer:
        "Вовсе нет! Платформа Selloi создана для предпринимателей без технических знаний. В панели управления введите токен вашего Telegram-бота и укажите канал: система автоматически настроит работу за 2 минуты.",
    },
    {
      id: "faq-2",
      question: "Какие языки понимает AI-продавец?",
      answer:
        "Selloi AI свободно владеет узбекским (латиница и кириллица), русским и английским языками. Он понимает разговорный сленг, сокращения и опечатки, общаясь как опытный менеджер продаж.",
    },
    {
      id: "faq-3",
      question: "Как работает 7-дневный пробный период?",
      answer:
        "После регистрации вы можете протестировать все возможности платформы (AI Chat, Vision, Telegram Sync) в течение 7 дней по специальному промо-тарифу (START: 13 000 сум, PRO: 26 000 сум, ULTRA: 39 000 сум). После пробного периода доступно продление на месяц или год.",
    },
    {
      id: "faq-4",
      question: "Как товары из Telegram-канала попадают в память AI?",
      answer:
        "Наша функция Telegram Sync сканирует посты, фотографии, описания и цены в вашем канале, формируя онлайн-каталог. При добавлении нового поста AI мгновенно обновляет свои знания.",
    },
    {
      id: "faq-5",
      question: "Как AI распознает товары по отправленной клиентом фотографии?",
      answer:
        "Используется мультимодальная нейросеть компьютерного зрения (AI Vision 2.0). Она сравнивает крой, цвет и детали на фото с фотографиями в вашем каталоге и за секунду находит точную модель.",
    },
    {
      id: "faq-6",
      question: "Можно ли принимать оплаты через Click и Payme?",
      answer:
        "Конечно! В тарифах PRO и ULTRA интегрируются Click и Payme. Бот формирует счет на оплату, отправляет покупателю ссылку и переводит заказ в статус 'Оплачен' сразу после транзакции.",
    },
    {
      id: "faq-7",
      question: "Как бот обрабатывает ночных клиентов?",
      answer:
        "Selloi AI работает круглосуточно без выходных. Он мгновенно консультирует каждого ночного покупателя, закрывает сделку и сохраняет готовый заказ в CRM.",
    },
  ],
  en: [
    {
      id: "faq-1",
      question: "Do I need developers or technical skills to get started?",
      answer:
        "Not at all! Selloi is built for non-technical business owners. Simply paste your Telegram bot token and connect your store channel in the dashboard: our engine configures everything automatically in under 2 minutes.",
    },
    {
      id: "faq-2",
      question: "Which languages does the AI sales assistant speak?",
      answer:
        "Selloi AI fluently communicates in Uzbek (both Latin and Cyrillic scripts), Russian, and English. It accurately understands dialects, colloquial phrasing, and typos while maintaining a polite, sales-oriented tone.",
    },
    {
      id: "faq-3",
      question: "How does the 7-day trial period work?",
      answer:
        "Upon onboarding, you can evaluate all features (AI Chat, Vision, Telegram Sync) during the introductory 7-day trial (START: 13,000 UZS, PRO: 26,000 UZS, ULTRA: 39,000 UZS). Afterwards, you can seamlessly transition to monthly or yearly subscriptions.",
    },
    {
      id: "faq-4",
      question: "How does the AI index items from my Telegram channel?",
      answer:
        "Our intelligent Telegram Sync engine automatically parses posts, product imagery, pricing, and descriptions from your public or private channel, converting them into an active catalog. When you update a post, AI updates its memory instantly.",
    },
    {
      id: "faq-5",
      question: "How does AI Vision identify products sent by shoppers?",
      answer:
        "Using multimodal computer vision neural networks, Selloi analyzes silhouette, color, texture, and distinctive features against your indexed catalog to match items with over 99% accuracy in under a second.",
    },
    {
      id: "faq-6",
      question: "Can I accept payments via Click and Payme?",
      answer:
        "Absolutely! On PRO and ULTRA plans, Click and Payme gateways are fully integrated. The bot generates secure payment invoices automatically and marks orders as 'Paid' once confirmed.",
    },
    {
      id: "faq-7",
      question: "How does the bot handle nighttime shoppers?",
      answer:
        "Selloi AI operates 24/7/365 without pause. It engages midnight buyers within seconds, answers sizing and stock questions, and captures completed orders for fulfillment in the morning.",
    },
  ],
};

export const FAQ_ITEMS = FAQ_ITEMS_BY_LANG.uz;
