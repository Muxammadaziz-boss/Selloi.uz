import { Language } from "@/app/lib/i18n/types";

export interface LandingContent {
  header: {
    loginBtn: string;
    dashboardBtn: string;
    createStoreBtn: string;
    startBtn: string;
    languageLabel: string;
  };
  hero: {
    badge: string;
    headlinePrefix: string;
    headlineHighlight: string;
    description: string;
    primaryCta: string;
    secondaryCta: string;
    trust1: string;
    trust2: string;
    trust3: string;
    floatingCard1Msg: string;
    floatingCard2Title: string;
    floatingCard2Sub: string;
    floatingCard3Title: string;
    floatingCard3Sub: string;
    floatingCard3Status: string;
    floatingCard4: string;
    scrollIndicator: string;
  };
  storytelling: {
    badge: string;
    headingPrefix: string;
    headingHighlight: string;
    subtitle: string;
    tab1: string;
    tab2: string;
    tab3: string;
    stage1Title: string;
    stage1Sub: string;
    stage1UserMsg: string;
    stage1AiMsg: string;
    stage1Footer: string;
    stage1Latency: string;
    stage2Title: string;
    stage2Sub: string;
    stage2Result: string;
    stage2Product: string;
    stage2Color: string;
    stage2Stock: string;
    stage2Found: string;
    stage2Footer: string;
    stage2Accuracy: string;
    stage3Title: string;
    stage3Sub: string;
    stage3Order: string;
    stage3Status: string;
    stage3ItemLabel: string;
    stage3CustomerLabel: string;
    stage3AddressLabel: string;
    stage3PaymentLabel: string;
    stage3Footer: string;
  };
  features: {
    badge: string;
    headingPrefix: string;
    headingHighlight: string;
    subtitle: string;
    chatTitle: string;
    chatSubtitle: string;
    chatDescription: string;
    chatTone: string;
    chatLiveBadge: string;
    visionTitle: string;
    visionSubtitle: string;
    visionDescription: string;
    visionFooter: string;
    syncTitle: string;
    syncSubtitle: string;
    syncPost: string;
    syncProduct: string;
    syncFooter: string;
    crmTitle: string;
    crmSubtitle: string;
    crmStatus: string;
    crmFooter: string;
    payTitle: string;
    paySubtitle: string;
    payFooter: string;
  };
  demo: {
    badge: string;
    headingPrefix: string;
    headingHighlight: string;
    subtitle: string;
    liveBadge: string;
    onlineStatus: string;
    typingStatus: string;
    autoReplyBadge: string;
    inputPlaceholder: string;
  };
  howItWorks: {
    badge: string;
    headingPrefix: string;
    headingHighlight: string;
    subtitle: string;
  };
  socialProof: {
    partnerLabel: string;
    badge: string;
    headingPrefix: string;
    headingHighlight: string;
    subtitle: string;
  };
  pricing: {
    badge: string;
    headingPrefix: string;
    headingHighlight: string;
    subtitle: string;
    monthly: string;
    annual: string;
    annualGift: string;
    recommended: string;
    compareOpen: string;
    compareClose: string;
    thFeature: string;
  };
  faq: {
    badge: string;
    headingPrefix: string;
    headingHighlight: string;
    subtitle: string;
    supportTitle: string;
    supportDesc: string;
    supportBtn: string;
  };
  finalCta: {
    badge: string;
    headingPrefix: string;
    headingHighlight: string;
    subtitle: string;
    primaryCta: string;
    trust1: string;
    trust2: string;
    trust3: string;
  };
  footer: {
    slogan: string;
    statusBadge: string;
    colNav: string;
    colIntegrations: string;
    colSupport: string;
    colLegal: string;
    supportChat: string;
    supportTech: string;
    privacy: string;
    terms: string;
    offer: string;
    rights: string;
    madeIn: string;
  };
  loginModal: {
    title: string;
    label: string;
    placeholder: string;
    cancel: string;
    submit: string;
    loading: string;
    errorDefault: string;
  };
  mobileSticky: {
    trial: string;
    start: string;
  };
}

export const LANDING_CONTENT_BY_LANG: Record<Language, LandingContent> = {
  uz: {
    header: {
      loginBtn: "Kirish",
      dashboardBtn: "Boshqaruv paneli",
      createStoreBtn: "Do‘kon ochish",
      startBtn: "Boshlash",
      languageLabel: "Til:",
    },
    hero: {
      badge: "TELEGRAM SAVDOLARI UCHUN AI SOTUVCHI",
      headlinePrefix: "Telegram do‘koningiz uchun",
      headlineHighlight: "24/7 ishlovchi AI sotuvchi.",
      description:
        "Mijozlar savollariga soniyalar ichida aniq javob beradi, fotosuratdagi tovarlarni taniydi va buyurtmalarni avtomatik qabul qiladi. Tun-u kun, operatorlarsiz.",
      primaryCta: "7 kun sinab ko‘rish →",
      secondaryCta: "Imkoniyatlarni ko‘rish",
      trust1: "O‘zbek, rus va ingliz tillarida",
      trust2: "Telegram bot va kanalga ulanadi",
      trust3: "Kredit karta talab etilmaydi",
      floatingCard1Msg: "Qora oversize xudi bormi?",
      floatingCard2Title: "AI Vision tahlili",
      floatingCard2Sub: "Katalogdan topildi",
      floatingCard3Title: "Buyurtma #1042",
      floatingCard3Sub: "Hoodie L • 240,000 so‘m",
      floatingCard3Status: "Qabul qilindi",
      floatingCard4: "Katalog sinxronlandi",
      scrollIndicator: "IMKONIYATLAR",
    },
    storytelling: {
      badge: "SAVDO BOSQICHLARI",
      headingPrefix: "Mijoz murojaatidan tortib",
      headingHighlight: "tayyor buyurtmagacha",
      subtitle:
        "Mijoz bilan birinchi salomlashish, fotosuratni tanish va buyurtma rasmiylashtirish: barchasi soniyalar ichida avtomatik bajariladi.",
      tab1: "01 • Maslahat va suhbat",
      tab2: "02 • Fotosuratdan tovar topish",
      tab3: "03 • Buyurtma rasmiylashtirish",
      stage1Title: "Tabiiy muloqot",
      stage1Sub: "Mijoz bilan erkin suhbat",
      stage1UserMsg: "Assalomu alaykum! Shu naushnikdan bormi, sifati qanaqa?",
      stage1AiMsg:
        "Va alaykum assalom! Ha, 'Pro Wireless ANC' modelimiz omborda bor. 40 soat zaryad ushlaydi, shovqinni 95% to‘sadi. Narxi 320,000 so‘m. 🎧",
      stage1Footer: "O‘zbek (lotin/kirill), rus, ingliz",
      stage1Latency: "Javob: 0.6s",
      stage2Title: "AI Vision",
      stage2Sub: "Fotosurat tahlili va tovar tanish",
      stage2Result: "Tahlil natijasi",
      stage2Product: "Gaming Naushnik",
      stage2Color: "Midnight Black",
      stage2Stock: "12 dona mavjud",
      stage2Found: "Katalogdan topildi",
      stage2Footer: "Kompyuter ko‘rishi texnologiyasi",
      stage2Accuracy: "Tezkor aniqlash",
      stage3Title: "Smart Buyurtma",
      stage3Sub: "Avtomatik rasmiylashtirish",
      stage3Order: "Buyurtma #1043",
      stage3Status: "Tasdiqlandi",
      stage3ItemLabel: "Mahsulot:",
      stage3CustomerLabel: "Mijoz:",
      stage3AddressLabel: "Manzil:",
      stage3PaymentLabel: "To‘lov:",
      stage3Footer: "Avtomatik chek va faktura",
    },
    features: {
      badge: "IMKONIYATLAR",
      headingPrefix: "Telegram savdosi uchun",
      headingHighlight: "mukammal vositalar",
      subtitle:
        "Har bir mijozga darhol javob bering, fotosuratdan tovarlarni toping va to‘lovlarni qabul qiling. Dasturchilarsiz va 24/7 uzluksiz.",
      chatTitle: "AI Suhbat: Ko‘p tilli muloqot",
      chatSubtitle: "Tabiiy tilda aqlli suhbatlashuv",
      chatDescription:
        "O‘zbek tili (lotin va kirill), rus hamda ingliz tillarida haqiqiy xarid maslahatchisidek erkin muloqot qiladi. Shevalar, xatolar va so‘zlashuv uslubini to‘liq tushunadi.",
      chatTone: "✓ Do‘koningiz xarakteriga mos ohang (tone of voice)",
      chatLiveBadge: "Real-vaqt sinov",
      visionTitle: "AI Vision",
      visionSubtitle: "Rasmdan tovar tanish",
      visionDescription:
        "Mijoz yuborgan fotosuratni tahlil qilib, kanalingiz katalogidagi aynan o‘sha modelni 0.8 soniyada topadi.",
      visionFooter: "Kiyim, poyabzal, sumka va gadjetlarni aniq taniydi",
      syncTitle: "Telegram Sync",
      syncSubtitle: "Kanalingizdagi postlar va fotosuratlarni avtomatik o‘qib, AI xotirasiga kiritadi.",
      syncPost: "Kanal posti",
      syncProduct: "Katalog tovari",
      syncFooter: "✓ Post qo‘shilganda darhol yangilanadi",
      crmTitle: "Smart Orders CRM",
      crmSubtitle: "Mijozdan ism, telefon va manzilni yig‘adi, buyurtmani boshqaruv paneliga yuboradi.",
      crmStatus: "Qabul qilindi",
      crmFooter: "Mijozlar bazasi va yetkazib berish nazorati",
      payTitle: "Click & Payme",
      paySubtitle: "Xaridor buyurtma berishi bilan bot to‘lov havolasini yuboradi va statusni yangilaydi.",
      payFooter: "Avtomatik hisob-faktura va chek",
    },
    demo: {
      badge: "INTERAKTIV DEMO",
      headingPrefix: "Selloi AI qanday ishlashini",
      headingHighlight: "o‘zingiz sinab ko‘ring",
      subtitle: "Haqiqiy xaridor vaziyatini tanlang va botning tezkor, muloyim javobini jonli ko‘ring.",
      liveBadge: "Jonli sinov",
      onlineStatus: "24/7 onlayn • Javob: 0.6 soniya",
      typingStatus: "AI javob yozmoqda",
      autoReplyBadge: "Avtomatik javob",
      inputPlaceholder: "Yuqoridagi ssenariylardan birini tanlang yoki o‘z do‘koningizni ulab sinang...",
    },
    howItWorks: {
      badge: "3 ODDIY QADAM",
      headingPrefix: "Selloi bilan boshlash",
      headingHighlight: "juda oson",
      subtitle: "Hech qanday murakkab texnik sozlamalarsiz, 3 ta oddiy qadamda AI sotuvchingizni Telegram do‘koningizga ulang.",
    },
    socialProof: {
      partnerLabel: "Telegram tarmog‘idagi faol do‘konlar va hamkorlar",
      badge: "FIKRLAR VA NATIJALAR",
      headingPrefix: "Do‘kon egalarining",
      headingHighlight: "haqiqiy tajribalari",
      subtitle: "Biznesini avtomatlashtirgan va savdolarini oshirgan tadbirkorlar natijalari.",
    },
    pricing: {
      badge: "TARIFLAR",
      headingPrefix: "Biznesingiz uchun",
      headingHighlight: "mos tarifni tanlang",
      subtitle: "Har qanday hajmda savdo qiluvchi Telegram do‘konlar uchun moslashuvchan narxlar. Barcha tariflarda 7 kunlik sinov!",
      monthly: "Oylik to‘lov",
      annual: "Yillik to‘lov",
      annualGift: "2 oy sovg'a (-17%)",
      recommended: "★ TAVSIYA ETILADI",
      compareOpen: "Barcha tariflarni to‘liq solishtirish",
      compareClose: "Solishtirish jadvalini yopish",
      thFeature: "Imkoniyatlar va funksiyalar",
    },
    faq: {
      badge: "SAVOLLAR & JAVOBLAR",
      headingPrefix: "Ko‘p so‘raladigan",
      headingHighlight: "savollar",
      subtitle: "Telegram do‘koningizni avtomatlashtirish va Selloi platformasi haqida eng ko‘p beriladigan savollarga aniq javoblar.",
      supportTitle: "Boshqa savollaringiz bormi?",
      supportDesc: "Bizning mutaxassislarimiz har doim yordamga tayyor.",
      supportBtn: "Telegramda yozish",
    },
    finalCta: {
      badge: "24/7 AVTOMATIK SAVDO",
      headingPrefix: "Biznesingizni yangi bosqichga",
      headingHighlight: "AI bilan olib chiqing.",
      subtitle: "Kechasi ham, dam olish kunlarida ham barcha xaridorlarga professional xizmat ko‘rsating va buyurtmalarni avtomatik qabul qiling.",
      primaryCta: "7 kunlik sinovni boshlash",
      trust1: "7 kunlik sinov",
      trust2: "2 daqiqada sozlash",
      trust3: "Kredit karta talab etilmaydi",
    },
    footer: {
      slogan: "Telegram do‘konlari uchun sun’iy intellekt sotuvchisi va to‘liq savdo avtomatlashtirish platformasi.",
      statusBadge: "Barcha xizmatlar 24/7 faol",
      colNav: "Navigatsiya",
      colIntegrations: "Integratsiyalar",
      colSupport: "Yordam & Aloqa",
      colLegal: "Huquqiy",
      supportChat: "Telegramda yozish",
      supportTech: "24/7 Texnik ko‘mak",
      privacy: "Maxfiylik siyosati",
      terms: "Foydalanish shartlari",
      offer: "Ommaviy oferta",
      rights: "Barcha huquqlar himoyalangan.",
      madeIn: "O‘zbekistonda yaratilgan",
    },
    loginModal: {
      title: "Boshqaruvga kirish",
      label: "Platforma parolini kiriting:",
      placeholder: "••••••••••••",
      cancel: "Bekor qilish",
      submit: "Kirish",
      loading: "Tekshirilmoqda...",
      errorDefault: "Parol noto‘g‘ri kiritildi",
    },
    mobileSticky: {
      trial: "7 kunlik sinov",
      start: "Boshlash",
    },
  },

  ru: {
    header: {
      loginBtn: "Войти",
      dashboardBtn: "Панель управления",
      createStoreBtn: "Создать магазин",
      startBtn: "Начать",
      languageLabel: "Язык:",
    },
    hero: {
      badge: "AI ДЛЯ ПРОДАЖ В TELEGRAM",
      headlinePrefix: "Для вашего Telegram-магазина:",
      headlineHighlight: "AI продавец, работающий 24/7.",
      description:
        "Отвечает клиентам за секунды, находит товары по фото и оформляет заказы. Круглосуточно, без рутины и потери заявок.",
      primaryCta: "Попробовать 7 дней",
      secondaryCta: "Посмотреть возможности",
      trust1: "На узбекском, русском, английском",
      trust2: "Telegram бот и канал",
      trust3: "Без привязки карты",
      floatingCard1Msg: "Есть ли черный худи оверсайз?",
      floatingCard2Title: "AI Vision анализ",
      floatingCard2Sub: "Товар найден в каталоге",
      floatingCard3Title: "Заказ #1042",
      floatingCard3Sub: "Худи L • 240,000 сум",
      floatingCard3Status: "Оформлен",
      floatingCard4: "Каталог синхронизирован",
      scrollIndicator: "ВОЗМОЖНОСТИ",
    },
    storytelling: {
      badge: "ПРОЦЕСС ПРОДАЖ",
      headingPrefix: "От первого сообщения",
      headingHighlight: "до готового заказа",
      subtitle:
        "Приветствие клиента, распознавание товара по фото и оформление заказа: всё происходит автоматически за считанные секунды.",
      tab1: "01 • Консультация и диалог",
      tab2: "02 • Поиск товара по фото",
      tab3: "03 • Оформление заказа",
      stage1Title: "Живой диалог",
      stage1Sub: "Общение на естественном языке",
      stage1UserMsg: "Здравствуйте! Есть ли в наличии эти наушники, какое качество?",
      stage1AiMsg:
        "Здравствуйте! Да, модель 'Pro Wireless ANC' в наличии на складе. Держит заряд 40 часов, шумоподавление 95%. Цена 320,000 сум. 🎧",
      stage1Footer: "Узбекский, русский, английский",
      stage1Latency: "Ответ: 0.6с",
      stage2Title: "AI Vision",
      stage2Sub: "Анализ и распознавание фото",
      stage2Result: "Результат анализа",
      stage2Product: "Игровые Наушники",
      stage2Color: "Midnight Black",
      stage2Stock: "12 шт. в наличии",
      stage2Found: "Найдено в каталоге",
      stage2Footer: "Технология компьютерного зрения",
      stage2Accuracy: "Быстрое распознавание",
      stage3Title: "Smart Заказ",
      stage3Sub: "Автоматическое оформление",
      stage3Order: "Заказ #1043",
      stage3Status: "Подтвержден",
      stage3ItemLabel: "Товар:",
      stage3CustomerLabel: "Клиент:",
      stage3AddressLabel: "Адрес:",
      stage3PaymentLabel: "Оплата:",
      stage3Footer: "Авто-чек и накладная",
    },
    features: {
      badge: "ВОЗМОЖНОСТИ",
      headingPrefix: "Новый стандарт продаж",
      headingHighlight: "в Telegram",
      subtitle:
        "Мгновенно отвечайте клиентам, находите товары по фото и принимайте оплаты. Без программистов и круглосуточно.",
      chatTitle: "AI Чат: Мультиязычное общение",
      chatSubtitle: "Диалог на естественном языке",
      chatDescription:
        "Свободно консультирует клиентов на узбекском (латиница и кириллица), русском и английском языках. Понимает сленг, сокращения и опечатки.",
      chatTone: "✓ Тональность под стиль вашего бренда (tone of voice)",
      chatLiveBadge: "Тест в реальном времени",
      visionTitle: "AI Vision",
      visionSubtitle: "Поиск товаров по фото",
      visionDescription:
        "Анализирует фотографию, отправленную покупателем, и находит нужную модель в вашем каталоге за 0.8 секунды.",
      visionFooter: "Распознает одежду, обувь, аксессуары и электронику",
      syncTitle: "Telegram Sync",
      syncSubtitle: "Автоматически считывает посты и фото из канала и загружает их в память AI.",
      syncPost: "Пост в канале",
      syncProduct: "Товар в каталоге",
      syncFooter: "✓ Мгновенное обновление при добавлении поста",
      crmTitle: "Smart Orders CRM",
      crmSubtitle: "Собирает имя, телефон и адрес покупателя, формирует заказ и передает в панель управления.",
      crmStatus: "Принят",
      crmFooter: "База клиентов и контроль доставки",
      payTitle: "Click & Payme",
      paySubtitle: "Бот автоматически отправляет ссылку на оплату сразу после оформления заказа.",
      payFooter: "Автоматический чек и статус транзакции",
    },
    demo: {
      badge: "ИНТЕРАКТИВНОЕ ДЕМО",
      headingPrefix: "Протестируйте работу Selloi AI",
      headingHighlight: "прямо сейчас",
      subtitle: "Выберите сценарий покупателя и оцените быстрый и вежливый ответ бота.",
      liveBadge: "Живой тест",
      onlineStatus: "24/7 онлайн • Ответ: 0.6 секунды",
      typingStatus: "AI печатает ответ",
      autoReplyBadge: "Автоматический ответ",
      inputPlaceholder: "Выберите сценарий выше или подключите свой магазин для теста...",
    },
    howItWorks: {
      badge: "3 ПРОСТЫХ ШАГА",
      headingPrefix: "Начать работу с Selloi",
      headingHighlight: "очень просто",
      subtitle: "Без сложных настроек за 3 простых шага подключите ИИ-продавца к вашему Telegram-магазину.",
    },
    socialProof: {
      partnerLabel: "Активные магазины и бренды в Telegram",
      badge: "ОТЗЫВЫ И РЕЗУЛЬТАТЫ",
      headingPrefix: "Реальный опыт",
      headingHighlight: "владельцев магазинов",
      subtitle: "Результаты предпринимателей, автоматизировавших продажи с помощью Selloi.",
    },
    pricing: {
      badge: "ТАРИФЫ",
      headingPrefix: "Выберите подходящий тариф",
      headingHighlight: "для вашего бизнеса",
      subtitle: "Гибкие тарифы для Telegram-магазинов любого масштаба. Во всех тарифах Попробовать 7 днейго пробного периода!",
      monthly: "Ежемесячно",
      annual: "Ежегодно",
      annualGift: "2 месяца в подарок",
      recommended: "★ РЕКОМЕНДУЕТСЯ",
      compareOpen: "Полное сравнение всех тарифов",
      compareClose: "Скрыть таблицу сравнения",
      thFeature: "Возможности и функции",
    },
    faq: {
      badge: "ВОПРОСЫ И ОТВЕТЫ",
      headingPrefix: "Часто задаваемые",
      headingHighlight: "вопросы",
      subtitle: "Точные ответы об автоматизации продаж и платформе Selloi.",
      supportTitle: "Остались вопросы?",
      supportDesc: "Наши специалисты всегда на связи и готовы помочь.",
      supportBtn: "Написать в Telegram",
    },
    finalCta: {
      badge: "АВТОПРОДАЖИ 24/7",
      headingPrefix: "Развивайте свой бизнес",
      headingHighlight: "с помощью AI.",
      subtitle: "Обслуживайте клиентов круглосуточно, закрывайте сделки и принимайте заказы на автомате.",
      primaryCta: "Попробовать 7 дней",
      trust1: "Попробовать 7 дней",
      trust2: "Настройка за 2 мин",
      trust3: "Без привязки карты",
    },
    footer: {
      slogan: "ИИ-продавец и платформа комплексной автоматизации продаж для магазинов в Telegram.",
      statusBadge: "Все сервисы активны 24/7",
      colNav: "Навигация",
      colIntegrations: "Интеграции",
      colSupport: "Помощь и Контакты",
      colLegal: "Правовая информация",
      supportChat: "Написать в Telegram",
      supportTech: "Техподдержка 24/7",
      privacy: "Политика конфиденциальности",
      terms: "Условия использования",
      offer: "Публичная оферта",
      rights: "Все права защищены.",
      madeIn: "Создано в Узбекистане",
    },
    loginModal: {
      title: "Вход в управление",
      label: "Введите пароль платформы:",
      placeholder: "••••••••••••",
      cancel: "Отмена",
      submit: "Войти",
      loading: "Проверка...",
      errorDefault: "Неверный пароль",
    },
    mobileSticky: {
      trial: "Попробовать 7 дней",
      start: "Начать",
    },
  },

  en: {
    header: {
      loginBtn: "Sign In",
      dashboardBtn: "Dashboard",
      createStoreBtn: "Create Store",
      startBtn: "Get Started",
      languageLabel: "Language:",
    },
    hero: {
      badge: "AI SALES ASSISTANT FOR TELEGRAM",
      headlinePrefix: "For your Telegram store:",
      headlineHighlight: "A 24/7 autonomous AI seller.",
      description:
        "Engages buyers instantly, identifies products from photos, and manages checkouts around the clock without human operators.",
      primaryCta: "Start 7-day trial",
      secondaryCta: "Explore Features",
      trust1: "Uzbek, Russian & English",
      trust2: "Telegram Bot & Channel",
      trust3: "No credit card required",
      floatingCard1Msg: "Do you have a black oversize hoodie?",
      floatingCard2Title: "AI Vision Analysis",
      floatingCard2Sub: "Matched in catalog",
      floatingCard3Title: "Order #1042",
      floatingCard3Sub: "Hoodie L • 240,000 UZS",
      floatingCard3Status: "Confirmed",
      floatingCard4: "Catalog synchronized",
      scrollIndicator: "FEATURES",
    },
    storytelling: {
      badge: "SALES WORKFLOW",
      headingPrefix: "From first message",
      headingHighlight: "to closed order",
      subtitle:
        "Greeting customers, recognizing products from photos, and completing checkout: all automated within seconds.",
      tab1: "01 • Natural Dialogue",
      tab2: "02 • Visual Match",
      tab3: "03 • Automated Checkout",
      stage1Title: "Natural Dialogue",
      stage1Sub: "Fluent customer consultation",
      stage1UserMsg: "Hello! Are these headphones in stock, and how is the sound quality?",
      stage1AiMsg:
        "Hello! Yes, 'Pro Wireless ANC' is in stock. It offers 40h battery life and 95% active noise cancellation. Price: 320,000 UZS. 🎧",
      stage1Footer: "Uzbek, Russian & English",
      stage1Latency: "Latency: 0.6s",
      stage2Title: "AI Vision",
      stage2Sub: "Visual product recognition",
      stage2Result: "Analysis Result",
      stage2Product: "Gaming Headphones",
      stage2Color: "Midnight Black",
      stage2Stock: "12 units available",
      stage2Found: "Found in catalog",
      stage2Footer: "Computer vision technology",
      stage2Accuracy: "Fast recognition",
      stage3Title: "Smart Checkout",
      stage3Sub: "Instant automated dispatch",
      stage3Order: "Order #1043",
      stage3Status: "Confirmed",
      stage3ItemLabel: "Item:",
      stage3CustomerLabel: "Customer:",
      stage3AddressLabel: "Address:",
      stage3PaymentLabel: "Payment:",
      stage3Footer: "Automated receipt & invoice",
    },
    features: {
      badge: "FEATURES",
      headingPrefix: "The New Standard for",
      headingHighlight: "Telegram Commerce",
      subtitle:
        "Reply to every customer instantly, identify items from photos, and accept payments. 24/7 without developers.",
      chatTitle: "AI Chat: Multilingual Dialogue",
      chatSubtitle: "Natural conversational selling",
      chatDescription:
        "Fluently engages buyers in Uzbek (Latin and Cyrillic), Russian, and English. Understands slang, shorthand, and typos effortlessly.",
      chatTone: "✓ Styled to match your brand tone of voice",
      chatLiveBadge: "Real-time sandbox",
      visionTitle: "AI Vision",
      visionSubtitle: "Visual catalog search",
      visionDescription:
        "Analyzes shopper photos and matches the exact catalog SKU within 0.8 seconds.",
      visionFooter: "Accurately identifies apparel, footwear, accessories, and gadgets",
      syncTitle: "Telegram Sync",
      syncSubtitle: "Automatically reads channel posts and media into active AI memory.",
      syncPost: "Channel post",
      syncProduct: "Catalog item",
      syncFooter: "✓ Instant refresh when new posts appear",
      crmTitle: "Smart Orders CRM",
      crmSubtitle: "Captures customer details, prepares invoices, and sends orders to your dashboard.",
      crmStatus: "Accepted",
      crmFooter: "Customer directory and delivery logistics tracking",
      payTitle: "Click & Payme",
      paySubtitle: "Generates secure checkout links immediately upon buyer confirmation.",
      payFooter: "Instant invoices and payment verification",
    },
    demo: {
      badge: "INTERACTIVE DEMO",
      headingPrefix: "Try Selloi AI and see",
      headingHighlight: "how it works live",
      subtitle: "Select a real customer scenario and experience the bot’s instant, polite response.",
      liveBadge: "Live sandbox",
      onlineStatus: "24/7 online • Response: 0.6 seconds",
      typingStatus: "AI is generating reply",
      autoReplyBadge: "Automated response",
      inputPlaceholder: "Select a scenario above or test with your own store...",
    },
    howItWorks: {
      badge: "3 SIMPLE STEPS",
      headingPrefix: "Getting started with Selloi is",
      headingHighlight: "exceptionally simple",
      subtitle: "Connect your AI sales assistant to your Telegram store in 3 simple steps without complex code.",
    },
    socialProof: {
      partnerLabel: "Active stores and brands on Telegram",
      badge: "REVIEWS & RESULTS",
      headingPrefix: "Real experiences from",
      headingHighlight: "verified store owners",
      subtitle: "Proven results from retailers scaling sales with automated AI.",
    },
    pricing: {
      badge: "PRICING PLANS",
      headingPrefix: "Choose the right plan",
      headingHighlight: "for your business",
      subtitle: "Flexible pricing for Telegram stores of any size. All plans include a 7-day trial!",
      monthly: "Monthly billing",
      annual: "Annual billing",
      annualGift: "2 months free",
      recommended: "★ RECOMMENDED",
      compareOpen: "Compare all plan features",
      compareClose: "Hide comparison table",
      thFeature: "Features & capabilities",
    },
    faq: {
      badge: "FAQ",
      headingPrefix: "Frequently asked",
      headingHighlight: "questions",
      subtitle: "Clear, actionable answers about automating your Telegram commerce with Selloi.",
      supportTitle: "Have more questions?",
      supportDesc: "Our customer success team is here to assist anytime.",
      supportBtn: "Chat on Telegram",
    },
    finalCta: {
      badge: "24/7 AUTONOMOUS COMMERCE",
      headingPrefix: "Scale your business with",
      headingHighlight: "modern AI.",
      subtitle: "Engage every buyer 24/7, close sales, and accept orders completely automatically.",
      primaryCta: "Start 7-day trial",
      trust1: "7-day trial",
      trust2: "2-minute setup",
      trust3: "No credit card needed",
    },
    footer: {
      slogan: "AI sales assistant and end-to-end commerce automation platform for Telegram stores.",
      statusBadge: "All systems active 24/7",
      colNav: "Navigation",
      colIntegrations: "Integrations",
      colSupport: "Support & Contact",
      colLegal: "Legal",
      supportChat: "Chat on Telegram",
      supportTech: "24/7 Priority Support",
      privacy: "Privacy Policy",
      terms: "Terms of Service",
      offer: "Public Offer",
      rights: "All rights reserved.",
      madeIn: "Crafted in Uzbekistan",
    },
    loginModal: {
      title: "Dashboard Login",
      label: "Enter platform password:",
      placeholder: "••••••••••••",
      cancel: "Cancel",
      submit: "Sign In",
      loading: "Verifying...",
      errorDefault: "Invalid password",
    },
    mobileSticky: {
      trial: "7-day trial",
      start: "Get Started",
    },
  },
};
