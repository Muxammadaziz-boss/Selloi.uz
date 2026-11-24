import { Language } from "@/app/lib/i18n/types";

export interface SelloiPlanItem {
  code: string;
  name: string;
  badge?: string;
  isPopular?: boolean;
  description: string;
  priceMonthlyUsd: number;
  priceMonthlyUzs: string;
  priceYearlyUsd: number;
  priceYearlyUzs: string;
  promoBadge: string;
  features: string[];
}

export interface SelloiTariflarTranslations {
  tag: string;
  title: string;
  desc: string;
  billingMonthly: string;
  billingYearly: string;
  yearlyDiscountBadge: string;
  trialBadge: string;
  ctaSelect: string;
  popularBadge: string;
  perMonth: string;
  perYear: string;
  cta: string;
  note: string;
  plans: SelloiPlanItem[];
}

export interface SelloiDemoQuickPrompt {
  id: "stock" | "delivery" | "photo" | "order";
  label: string;
  userText: string;
  botReply: string;
}

export interface SelloiTelegramUiTranslations {
  searchSidebarPlaceholder: string;
  botTitle: string;
  botOnlineSub: string;
  botTypingStatus: string;
  botAnalyzingStatus: string;
  channelTitle: string;
  channelHandle: string;
  channelSubs: string;
  channelSidebarPreview: string;
  pinnedText: string;
  todayLabel: string;
  switchToChannelBtn: string;
  switchToChatBtn: string;
  channelSearchPlaceholder: string;
  catAll: string;
  catLaptop: string;
  catPc: string;
  catMonitor: string;
  catAccessory: string;
  inStockLabel: string;
  warrantyLabel: string;
  installmentSuffix: string;
  askAiButton: string;
  orderButton: string;
  deliveryInfoButton: string;
  otherOptionsButton: string;
  emptySearchText: string;
  sidebarHint: string;
  shownCountLabel: string;
  quoteChannelLabel: string;
  deliveryReplyText: string;
  photoVisionPrompt: string;
  photoVisionReply: string;
  matchedHeaderText: string;
  matchedBudgetText: string;
  askProductPromptPrefix: string;
  orderConfirmedPrefix: string;
  chatPreviewFallback: string;
}

export interface SelloiTranslations {
  nav: {
    boshSahifa: string;
    selloiHaqida: string;
    sinabKorish: string;
    tariflar: string;
    aloqa: string;
    kirish: string;
    kabinet: string;
  };
  hero: {
    title1: string;
    title2: string;
    subtitle: string;
    cta: string;
    windowTitle: string;
  };
  imkoniyatlar: {
    tag: string;
    titleLine1: string;
    titleLine2: string;
    subtitleLine1: string;
    subtitleLine2: string;
    card1Tag: string;
    card1TitleLine1: string;
    card1TitleLine2: string;
    card1DescLine1: string;
    card1DescLine2: string;
    card1UserLabel: string;
    card1UserMsg: string;
    card1BotLabel: string;
    card1BotMsgLine1: string;
    card1BotMsgLine2: string;
    card2Tag: string;
    card2Title: string;
    card2DescLine1: string;
    card2DescLine2: string;
    card3Tag: string;
    card3Title: string;
    card3DescLine1: string;
    card3DescLine2: string;
  };
  qandayIshlaydi: {
    tag: string;
    title: string;
    step1Num: string;
    step1Title: string;
    step1DescLine1: string;
    step1DescLine2: string;
    step2Num: string;
    step2Title: string;
    step2DescLine1: string;
    step2DescLine2: string;
    step3Num: string;
    step3Title: string;
    step3DescLine1: string;
    step3DescLine2: string;
  };
  suhbatNamunasi: {
    tag: string;
    titleLine1: string;
    titleLine2: string;
    descLine1: string;
    descLine2: string;
    descLine3: string;
    cta: string;
    cardTitle: string;
    cardSub: string;
    userMsg: string;
    botMsgLine1: string;
    botMsgLine2: string;
    disclaimer: string;
    placeholder: string;
    liveBadge: string;
    step1UserText: string;
    step2BotText: string;
    step3UserCaption: string;
    step4BotRecognition: string;
    orderBadge: string;
    orderProduct: string;
    orderPrice: string;
    orderStatus: string;
    typingIndicator: string;
    analyzingIndicator: string;
    photoLabel: string;
    uploadingPhotoText: string;
    orderChipLabel: string;
    orderProductLabel: string;
    orderPriceLabel: string;
    sendAriaLabel: string;
    fallbackReply: string;
    quickPrompts: SelloiDemoQuickPrompt[];
    tg: SelloiTelegramUiTranslations;
  };
  tariflar: SelloiTariflarTranslations;
  faq: {
    tag: string;
    titleLine1: string;
    titleLine2: string;
    descLine1: string;
    descLine2: string;
    contact: string;
    items: {
      id: string;
      question: string;
      answer: string;
      nodeId: string;
    }[];
  };
  finalCta: {
    tag: string;
    titleLine1: string;
    titleLine2: string;
    desc: string;
    cta: string;
    note: string;
  };
  footer: {
    taglineLine1: string;
    taglineLine2: string;
    col1Title: string;
    col1Link1: string;
    col1Link2: string;
    col2Title: string;
    col2Link1: string;
    col2Link2: string;
    col3Title: string;
    col3Link1: string;
    col3Link2: string;
    copy: string;
    langName: string;
  };
  modal: {
    title: string;
    label: string;
    placeholder: string;
    cancel: string;
    submit: string;
    loading: string;
    errorDefault: string;
  };
}

export const SELLOI_I18N: Record<Language, SelloiTranslations> = {
  uz: {
    nav: {
      boshSahifa: "Bosh sahifa",
      selloiHaqida: "Selloi haqida",
      sinabKorish: "Sinab ko’rish",
      tariflar: "Tariflar",
      aloqa: "Aloqa",
      kirish: "Kirish",
      kabinet: "Kabinet",
    },
    hero: {
      title1: "Selloi: Do'koningiz uchun",
      title2: "24/7 onlayn sotuvchi!",
      subtitle:
        "Mijozlar savollariga soniyalar ichida aniq javob beradi, fotosuratdagi tovarlarni taniydi va buyurtmalarni avtomatik qabul qiladi. Tun-u kun, dam olish kunlarisiz!",
      cta: "7 kun sinab ko‘rish →",
      windowTitle: "Selloi.uz",
    },
    imkoniyatlar: {
      tag: "SELLOI IMKONIYATLARI",
      titleLine1: "Siz biznesni o‘stiring.",
      titleLine2: "Savdoni Selloi davom ettiradi.",
      subtitleLine1: "Har bir savol — yangi savdo imkoniyati.",
      subtitleLine2: "Birorta murojaatni javobsiz qoldirmang.",
      card1Tag: "01 / TEZKOR MULOQOT",
      card1TitleLine1: "Savollar ko‘p.",
      card1TitleLine2: "Javob esa doim tayyor.",
      card1DescLine1: "Mijoz kutmaydi. Selloi mahsulot haqidagi savollarga",
      card1DescLine2: "soniyalar ichida aniq javob beradi.",
      card1UserLabel: "MIJOZ",
      card1UserMsg: "Bu modelning qora rangi bormi?",
      card1BotLabel: "Selloi",
      card1BotMsgLine1: "Ha, qora rangi mavjud. Buyurtma",
      card1BotMsgLine2: "berishingizga yordam beraymi?",
      card2Tag: "02 / RASMDAN MAHSULOTGA",
      card2Title: "Mijoz rasm yuboradi. Selloi taniydi.",
      card2DescLine1: "Fotosuratdagi tovarni aniqlab, suhbatni",
      card2DescLine2: "buyurtma sari davom ettiradi.",
      card3Tag: "03 / TUN-U KUN SAVDO",
      card3Title: "Do‘kon yopiladi. Savdo to‘xtamaydi.",
      card3DescLine1: "Buyurtmalarni avtomatik qabul qiladi.",
      card3DescLine2: "Kechasi ham, dam olish kunlarida ham.",
    },
    qandayIshlaydi: {
      tag: "QANDAY ISHLAYDI?",
      title: "Murakkab texnologiya. Oddiy boshlanish.",
      step1Num: "01",
      step1Title: "Do‘koningizni tanishtiring",
      step1DescLine1: "Mahsulotlaringiz va do‘koningiz haqidagi",
      step1DescLine2: "ma’lumotlarni tayyorlang.",
      step2Num: "02",
      step2Title: "Selloiga yo‘l ko‘rsating",
      step2DescLine1: "Mijozlar eng ko‘p beradigan savollar",
      step2DescLine2: "va javoblarni bir joyga jamlang.",
      step3Num: "03",
      step3Title: "Suhbatni Selloi davom ettirsin",
      step3DescLine1: "Mijozlar bilan muloqotni yengillashtiring,",
      step3DescLine2: "o‘zingiz esa biznesga e’tibor qarating.",
    },
    suhbatNamunasi: {
      tag: "SUHBATDAN NAMUNA",
      titleLine1: "Telegram kanal va AI sotuvchi",
      titleLine2: "bitta jonli tizimda.",
      descLine1: "Mijoz Telegram kanalingizdagi 100 ta kompyuter mahsulotidan",
      descLine2: "birini tanlaydi yoki xabar yozadi — Selloi esa Telegram",
      descLine3: "chatida soniyalar ichida maslahat berib buyurtma oladi.",
      cta: "7 kun sinab ko‘rish →",
      cardTitle: "Selloi AI",
      cardSub: "Suhbatdan namuna",
      userMsg: "Assalomu alaykum! Yetkazib berish bormi?",
      botMsgLine1: "Va alaykum assalom! Qaysi kompyuter modeli",
      botMsgLine2: "yoki byudjet bo‘yicha yordam kerak?",
      disclaimer: "Haqiqiy Telegram ko‘rinishi. Xabar yozing yoki TechZone UZ kanalidagi 100 ta kompyuterdan birini tanlab sinab ko‘ring.",
      placeholder: "Xabar yozing…",
      liveBadge: "Telegram Live",
      step1UserText: "Assalomu alaykum! ASUS ROG Strix G16 RTX 4070 bormi? Narxi qancha?",
      step2BotText: "Va alaykum assalom! Ha, ASUS ROG Strix G16 (TZ-001) omborda 5 dona bor. Narxi: 18 900 000 so‘m. 12 oyga muddatli to‘lov ham mavjud.",
      step3UserCaption: "Mana shu modelni 12 oyga bo‘lib to‘lasak bo‘ladimi?",
      step4BotRecognition: "Fotosurat tahlil qilindi: TZ-001 • ASUS ROG Strix G16 (i7-14650HX, RTX 4070, 16GB/1TB) — omborda bor ✅ 24 oy kafolat bilan!",
      orderBadge: "Buyurtma #TZ-4821 rasmiylashtirildi",
      orderProduct: "ASUS ROG Strix G16 G614J (TZ-001)",
      orderPrice: "18 900 000 so‘m",
      orderStatus: "Qabul qilindi • Kuryer 2 soatda yetkazadi ⚡",
      typingIndicator: "yozmoqda...",
      analyzingIndicator: "fotosurat tahlil qilinmoqda...",
      photoLabel: "Fotosurat",
      uploadingPhotoText: "📎 Rasm biriktirilmoqda...",
      orderChipLabel: "Telegram Bot",
      orderProductLabel: "Mahsulot:",
      orderPriceLabel: "Narxi:",
      sendAriaLabel: "Telegram xabar yuborish",
      fallbackReply: "Tushundim! @techzone_uz kanalimizda 100 ta kompyuter mahsuloti bor (noutbuklar 4.85 mln so‘mdan, RTX 4060/4070/4090 PC va 240Hz monitorlar). Byudjet yoki model nomini yozing!",
      quickPrompts: [
        {
          id: "stock",
          label: "💻 10 mln gacha",
          userText: "10 million so‘mgacha o‘yin va ish uchun qaysi noutbuklar bor?",
          botReply: "10 mln gacha eng zo‘r variantlarimiz:",
        },
        {
          id: "delivery",
          label: "🎮 RTX 4070 PC",
          userText: "RTX 4070 bilan gaming kompyuter sborkalari bormi?",
          botReply: "Ha, RTX 4070 va 4070 Ti asosidagi tayyor sborkalar omborda bor:",
        },
        {
          id: "photo",
          label: "📎 Rasm yuborish",
          userText: "Mana shu kompyuter rasmini tekshirib bering, narxi qancha?",
          botReply: "Rasm aniqlandi: TZ-037 • TechZone CyberForge 4070 Ti (Ryzen 7 7800X3D, 32GB DDR5) — 24 600 000 so‘m ✅",
        },
        {
          id: "order",
          label: "🛒 Buyurtma",
          userText: "ASUS ROG Strix G16 (TZ-001) modelini buyurtma qilmoqchiman!",
          botReply: "Ajoyib tanlov! Buyurtmangiz darhol avtomatik rasmiylashtirildi 👇",
        },
      ],
      tg: {
        searchSidebarPlaceholder: "Qidirish",
        botTitle: "Selloi AI",
        botOnlineSub: "bot • 24/7 onlayn",
        botTypingStatus: "yozmoqda...",
        botAnalyzingStatus: "fotosurat tahlil qilinmoqda...",
        channelTitle: "TechZone UZ",
        channelHandle: "@techzone_uz",
        channelSubs: "24 840 obunachi • 100 ta mahsulot",
        channelSidebarPreview: "📢 100 ta kompyuter katalogi",
        pinnedText: "TechZone UZ (100 ta kompyuter) AI bazasiga ulangan",
        todayLabel: "Bugun",
        switchToChannelBtn: "📢 100 ta mahsulot",
        switchToChatBtn: "💬 AI Chat",
        channelSearchPlaceholder: "100 ta mahsulotdan qidirish (ASUS, RTX, MacBook)...",
        catAll: "Barchasi (100)",
        catLaptop: "💻 Noutbuklar (35)",
        catPc: "🖥️ Gaming PC (25)",
        catMonitor: "🖥 Monitorlar (20)",
        catAccessory: "⌨️ Aksessuar (20)",
        inStockLabel: "Omborda",
        warrantyLabel: "oy kafolat",
        installmentSuffix: "so‘m/oy (12 oy)",
        askAiButton: "🤖 AI bilan so‘rash",
        orderButton: "🛒 Buyurtma",
        deliveryInfoButton: "🚚 Yetkazish shartlari",
        otherOptionsButton: "📢 Boshqa 100 ta model",
        emptySearchText: "So‘rovingiz bo‘yicha mahsulot topilmadi. Boshqa model yoki brend nomini yozib ko‘ring.",
        sidebarHint: "Kanaldagi istalgan mahsulotni bosing - AI soniyada javob beradi",
        shownCountLabel: "Ko‘rsatilmoqda",
        quoteChannelLabel: "TechZone UZ • Kanal",
        deliveryReplyText: "Toshkent bo‘ylab tezkor kuryer 2 soatda bepul (5 mln+ buyurtmada). Viloyatlarga BTS / Fargo orqali 1 kunda sug‘urtalangan yetkazish! Rasmiy kafolat va chek beriladi ⚡",
        photoVisionPrompt: "Mana shu kompyuterni rasmdan tekshirib bering, narxi qancha?",
        photoVisionReply: "AI Vision orqali aniqlandi: TZ-037 • TechZone CyberForge (RTX 4070 Ti, Ryzen 7 7800X3D) — omborda 5 dona, 24 600 000 so‘m ✅",
        matchedHeaderText: "Katalogimizdagi (100 ta mahsulotdan) sizga eng mos modellar:",
        matchedBudgetText: "Byudjetingiz bo‘yicha eng optimal takliflar:",
        askProductPromptPrefix: "Shu mahsulot haqida batafsil ma’lumot bering va omborda bormi?",
        orderConfirmedPrefix: "Tabriklaymiz! Buyurtmangiz muvaffaqiyatli rasmiylashtirildi 👇",
        chatPreviewFallback: "100 ta kompyuter bo‘yicha 24/7 maslahat",
      },
    },
    tariflar: {
      tag: "TARIFLAR",
      title: "Biznesingizga mos tarifni tanlang.",
      desc: "Do'koningiz hajmiga mos tarif rejasini tanlang. Yillik to'lovda 17% gacha tejang.",
      billingMonthly: "Oylik to'lov",
      billingYearly: "Yillik to'lov",
      yearlyDiscountBadge: "-17% chegirma",
      trialBadge: "7 kunlik Mega Chegirma",
      ctaSelect: "Tanlash",
      popularBadge: "ENG OMMABOP",
      perMonth: "/ oy",
      perYear: "/ yil",
      cta: "7 kun sinab ko‘rish →",
      note: "Do‘koningiz uchun. O‘sishingiz uchun.",
      plans: [
        {
          code: "start",
          name: "START",
          description: "Kichik biznes va yakka tartibdagi tadbirkorlar uchun qulay boshlang'ich yechim.",
          priceMonthlyUsd: 19,
          priceMonthlyUzs: "244 000",
          priceYearlyUsd: 190,
          priceYearlyUzs: "2 440 000",
          promoBadge: "7 kunlik sinov: 13 000 so'm",
          features: [
            "1 ta Telegram Bot / Profil",
            "1 ta Kanal yoki Guruh",
            "1 000 ta AI xabar / oy",
            "100 ta mahsulot sig'imi",
            "2 ta operator / jamoa a'zosi",
            "24/7 Avtomatik AI javoblar",
            "Do'kon bilimlari bazasi",
          ],
        },
        {
          code: "pro",
          name: "PRO",
          isPopular: true,
          badge: "ENG OMMABOP",
          description: "Faol savdo qiluvchi va kengayayotgan bizneslar uchun to'liq quvvat.",
          priceMonthlyUsd: 39,
          priceMonthlyUzs: "499 000",
          priceYearlyUsd: 390,
          priceYearlyUzs: "4 990 000",
          promoBadge: "7 kunlik sinov: 26 000 so'm",
          features: [
            "3 ta Telegram Bot + WebApp",
            "5 ta Kanal yoki Guruh",
            "7 500 ta AI xabar / oy",
            "1 000 ta mahsulot sig'imi",
            "10 ta operator / jamoa a'zosi",
            "AI Vision + Kengaytirilgan RAG qidiruv",
            "Batafsil analitika va eksport",
            "Ustuvor texnik qo'llab-quvvatlash",
          ],
        },
        {
          code: "ultra",
          name: "ULTRA",
          description: "Katta brendlar, tarmoq do'konlar va yirik savdo markazlari uchun.",
          priceMonthlyUsd: 79,
          priceMonthlyUzs: "999 000",
          priceYearlyUsd: 790,
          priceYearlyUzs: "9 990 000",
          promoBadge: "7 kunlik sinov: 39 000 so'm",
          features: [
            "10 ta Telegram Bot / Profil",
            "20 ta Kanal yoki Guruh",
            "30 000 ta AI xabar / oy",
            "10 000 ta mahsulot sig'imi",
            "50 ta operator / cheksiz jamoa",
            "Maxsus o'qitilgan AI model",
            "REST API va Webhooks integratsiyasi",
            "24/7 Shaxsiy menejer va SLA",
          ],
        },
      ],
    },
    faq: {
      tag: "SAVOL-JAVOB",
      titleLine1: "Savolingiz",
      titleLine2: "bormi?",
      descLine1: "Boshlashdan oldin bilish",
      descLine2: "foydali bo‘lgan javoblar.",
      contact: "Jamoa bilan bog‘lanish →",
      items: [
        {
          id: "q1",
          question: "Selloi nima qiladi?",
          answer:
            "Selloi — do‘koningizning onlayn sotuvchisi. U savollarga javob beradi, fotosuratdagi tovarlarni taniydi va buyurtmalarni avtomatik qabul qiladi.",
          nodeId: "182:415",
        },
        {
          id: "q2",
          question: "Avval sinab ko‘rsam bo‘ladimi?",
          answer:
            "Ha, 7 kunlik sinov davrida (START: 13 000 so'm, PRO: 26 000 so'm, ULTRA: 39 000 so'm) barcha imkoniyatlarni to‘liq sinab ko‘rishingiz mumkin.",
          nodeId: "182:420",
        },
        {
          id: "q3",
          question: "Selloi dam olish kunlari ham ishlaydimi?",
          answer:
            "Ha, Selloi 24/7 rejimida uzluksiz ishlaydi va dam olish kunlarisiz xizmat ko‘rsatadi.",
          nodeId: "182:424",
        },
        {
          id: "q4",
          question: "Rasm orqali mahsulotni taniy oladimi?",
          answer:
            "Ha, mijoz yuborgan fotosuratni AI orqali aniqlab, do‘koningizdagi tovarlar bilan moslashtiradi va buyurtma berishga yordam beradi.",
          nodeId: "182:428",
        },
      ],
    },
    finalCta: {
      tag: "KEYINGI BUYURTMANI O‘TKAZIB YUBORMANG",
      titleLine1: "Mijozlaringiz kutmasin.",
      titleLine2: "Selloi bilan bugunoq boshlang.",
      desc: "Do‘koningizga tun-u kun ishlaydigan yordamchi qo‘shing.",
      cta: "7 kun sinab ko‘rish →",
      note: "7 kun davomida imkoniyatlarni o‘zingiz baholang.",
    },
    footer: {
      taglineLine1: "Do‘koningiz uchun",
      taglineLine2: "24/7 onlayn sotuvchi.",
      col1Title: "TANISHING",
      col1Link1: "Selloi haqida",
      col1Link2: "Imkoniyatlar",
      col2Title: "BOSHLANG",
      col2Link1: "Sinab ko‘rish",
      col2Link2: "Tariflar",
      col3Title: "ALOQA",
      col3Link1: "Biz bilan bog‘lanish",
      col3Link2: "selloi.uz",
      copy: "© Selloi. Barcha huquqlar himoyalangan.",
      langName: "O‘zbekcha",
    },
    modal: {
      title: "Boshqaruv paneliga kirish",
      label: "Admin paroli",
      placeholder: "••••••••••••",
      cancel: "Bekor qilish",
      submit: "Kirish",
      loading: "Kirilmoqda...",
      errorDefault: "Parol noto‘g‘ri",
    },
  },
  ru: {
    nav: {
      boshSahifa: "Главная",
      selloiHaqida: "О Selloi",
      sinabKorish: "Попробовать",
      tariflar: "Тарифы",
      aloqa: "Контакты",
      kirish: "Вход",
      kabinet: "Кабинет",
    },
    hero: {
      title1: "Selloi: 24/7 онлайн AI-продавец",
      title2: "для вашего магазина!",
      subtitle:
        "Отвечает на вопросы клиентов за секунды, распознает товары по фото и автоматически принимает заказы. Круглосуточно, без выходных!",
      cta: "Попробовать 7 дней →",
      windowTitle: "Selloi.uz",
    },
    imkoniyatlar: {
      tag: "ВОЗМОЖНОСТИ SELLOI",
      titleLine1: "Развивайте ваш бизнес.",
      titleLine2: "Продажи продолжит Selloi.",
      subtitleLine1: "Каждый вопрос — новая продажа.",
      subtitleLine2: "Ни одно обращение не останется без ответа.",
      card1Tag: "01 / БЫСТРОЕ ОБЩЕНИЕ",
      card1TitleLine1: "Вопросов много.",
      card1TitleLine2: "Ответ всегда готов.",
      card1DescLine1: "Клиент не ждет. Selloi отвечает на вопросы о товаре",
      card1DescLine2: "за считанные секунды.",
      card1UserLabel: "КЛИЕНТ",
      card1UserMsg: "Есть эта модель в черном цвете?",
      card1BotLabel: "Selloi",
      card1BotMsgLine1: "Да, черный цвет в наличии. Помочь",
      card1BotMsgLine2: "оформить заказ?",
      card2Tag: "02 / ОТ ФОТО К ТОВАРУ",
      card2Title: "Клиент шлет фото. Selloi распознает.",
      card2DescLine1: "Определяет товар на фотографии и ведет",
      card2DescLine2: "диалог прямо к покупке.",
      card3Tag: "03 / ПРОДАЖИ 24/7",
      card3Title: "Магазин закрыт. Продажи продолжаются.",
      card3DescLine1: "Автоматически принимает заказы.",
      card3DescLine2: "И ночью, и в выходные дни.",
    },
    qandayIshlaydi: {
      tag: "КАК ЭТО РАБОТАЕТ?",
      title: "Сложные технологии. Простой старт.",
      step1Num: "01",
      step1Title: "Подключите ваш магазин",
      step1DescLine1: "Подготовьте информацию о ваших товарах",
      step1DescLine2: "и условиях магазина.",
      step2Num: "02",
      step2Title: "Обучите Selloi",
      step2DescLine1: "Соберите популярные вопросы клиентов",
      step2DescLine2: "и ответы в одном месте.",
      step3Num: "03",
      step3Title: "Доверьте общение Selloi",
      step3DescLine1: "Упростите диалог с покупателями,",
      step3DescLine2: "а сами сфокусируйтесь на бизнесе.",
    },
    suhbatNamunasi: {
      tag: "ПРИМЕР ДИАЛОГА",
      titleLine1: "Telegram-канал и AI-продавец",
      titleLine2: "в одной живой системе.",
      descLine1: "Покупатель выбирает любой из 100 компьютеров в Telegram-канале",
      descLine2: "или пишет вопрос — а Selloi за секунды консультирует",
      descLine3: "прямо в чате Telegram и автоматически оформляет заказ.",
      cta: "Попробовать 7 дней →",
      cardTitle: "Selloi AI",
      cardSub: "Пример диалога",
      userMsg: "Здравствуйте! Есть ли доставка?",
      botMsgLine1: "Здравствуйте! Какой компьютер или",
      botMsgLine2: "бюджет вас интересует?",
      disclaimer: "Настоящий интерфейс Telegram. Напишите вопрос или выберите компьютер из 100 товаров в канале TechZone UZ.",
      placeholder: "Написать сообщение…",
      liveBadge: "Telegram Live",
      step1UserText: "Здравствуйте! Есть ASUS ROG Strix G16 RTX 4070? Какая цена?",
      step2BotText: "Здравствуйте! Да, ASUS ROG Strix G16 (TZ-001) в наличии (5 шт.). Цена: 18 900 000 сум. Доступна рассрочка на 12 мес.",
      step3UserCaption: "Можно уточнить по фото характеристики и рассрочку?",
      step4BotRecognition: "Фото распознано: TZ-001 • ASUS ROG Strix G16 (i7-14650HX, RTX 4070, 16GB/1TB) в наличии ✅ Гарантия 24 мес!",
      orderBadge: "Заказ #TZ-4821 оформлен",
      orderProduct: "ASUS ROG Strix G16 G614J (TZ-001)",
      orderPrice: "18 900 000 сум",
      orderStatus: "Принят • Доставка курьером за 2 часа ⚡",
      typingIndicator: "печатает...",
      analyzingIndicator: "анализирует фото...",
      photoLabel: "Фотография",
      uploadingPhotoText: "📎 Прикрепление фото...",
      orderChipLabel: "Telegram Bot",
      orderProductLabel: "Товар:",
      orderPriceLabel: "Цена:",
      sendAriaLabel: "Отправить в Telegram",
      fallbackReply: "Понял вас! В канале @techzone_uz представлено 100 компьютеров (ноутбуки от 4.85 млн сум, ПК с RTX 4060/4070/4090 и мониторы 240Hz). Укажите модель или бюджет!",
      quickPrompts: [
        {
          id: "stock",
          label: "💻 До 10 млн",
          userText: "Какие ноутбуки для игр и работы есть до 10 млн сум?",
          botReply: "Лучшие ноутбуки до 10 млн в нашем каталоге:",
        },
        {
          id: "delivery",
          label: "🎮 ПК RTX 4070",
          userText: "Какие игровые ПК на RTX 4070 есть в наличии?",
          botReply: "Да, готовые сборки на базе RTX 4070 и 4070 Ti есть на складе:",
        },
        {
          id: "photo",
          label: "📎 По фото",
          userText: "Проверьте эту сборку по фото и подскажите цену.",
          botReply: "Фото распознано: TZ-037 • TechZone CyberForge 4070 Ti (Ryzen 7 7800X3D, 32GB DDR5) — 24 600 000 сум ✅",
        },
        {
          id: "order",
          label: "🛒 Заказать",
          userText: "Оформите заказ на ASUS ROG Strix G16 (TZ-001)!",
          botReply: "Отличный выбор! Заказ автоматически сформирован 👇",
        },
      ],
      tg: {
        searchSidebarPlaceholder: "Поиск",
        botTitle: "Selloi AI",
        botOnlineSub: "бот • онлайн 24/7",
        botTypingStatus: "печатает...",
        botAnalyzingStatus: "анализирует фото...",
        channelTitle: "TechZone UZ",
        channelHandle: "@techzone_uz",
        channelSubs: "24 840 подписчиков • 100 товаров",
        channelSidebarPreview: "📢 100 компьютерных товаров",
        pinnedText: "Канал TechZone UZ (100 товаров) подключен к AI",
        todayLabel: "Сегодня",
        switchToChannelBtn: "📢 100 товаров",
        switchToChatBtn: "💬 AI Чат",
        channelSearchPlaceholder: "Поиск по 100 товарам (ASUS, RTX, MacBook)...",
        catAll: "Все (100)",
        catLaptop: "💻 Ноутбуки (35)",
        catPc: "🖥️ Игровые ПК (25)",
        catMonitor: "🖥 Мониторы (20)",
        catAccessory: "⌨️ Аксессуары (20)",
        inStockLabel: "В наличии",
        warrantyLabel: "мес. гарантии",
        installmentSuffix: "сум/мес (12 мес.)",
        askAiButton: "🤖 Спросить AI",
        orderButton: "🛒 Заказать",
        deliveryInfoButton: "🚚 Условия доставки",
        otherOptionsButton: "📢 Все 100 товаров",
        emptySearchText: "По вашему запросу ничего не найдено. Попробуйте другой бренд или модель.",
        sidebarHint: "Нажмите на любой товар в канале — AI ответит мгновенно",
        shownCountLabel: "Показано",
        quoteChannelLabel: "TechZone UZ • Канал",
        deliveryReplyText: "Быстрая доставка по Ташкенту за 2 часа бесплатно (от 5 млн сум). В регионы отправляем службой BTS / Fargo за 1 день со страховкой ⚡",
        photoVisionPrompt: "Проверьте этот компьютер по фото и подскажите цену.",
        photoVisionReply: "Распознано через AI Vision: TZ-037 • TechZone CyberForge (RTX 4070 Ti, Ryzen 7 7800X3D) — 5 шт. в наличии, 24 600 000 сум ✅",
        matchedHeaderText: "Самые подходящие модели из 100 товаров в каталоге:",
        matchedBudgetText: "Оптимальные варианты под ваш бюджет:",
        askProductPromptPrefix: "Расскажите подробнее об этой модели и наличии на складе?",
        orderConfirmedPrefix: "Отлично! Ваш заказ успешно оформлен 👇",
        chatPreviewFallback: "Консультация 24/7 по 100 моделям ПК",
      },
    },
    tariflar: {
      tag: "ТАРИФЫ",
      title: "Выберите подходящий тариф.",
      desc: "Выберите тарифный план для масштаба вашего бизнеса. Экономьте до 17% при годовой оплате.",
      billingMonthly: "Ежемесячно",
      billingYearly: "Ежегодно",
      yearlyDiscountBadge: "Скидка -17%",
      trialBadge: "7 дней Мега-скидка",
      ctaSelect: "Выбрать",
      popularBadge: "ПОПУЛЯРНЫЙ",
      perMonth: "/ мес",
      perYear: "/ год",
      cta: "Попробовать 7 дней →",
      note: "Для вашего магазина. Для вашего роста.",
      plans: [
        {
          code: "start",
          name: "START",
          description: "Для малого бизнеса и индивидуальных предпринимателей.",
          priceMonthlyUsd: 19,
          priceMonthlyUzs: "244 000",
          priceYearlyUsd: 190,
          priceYearlyUzs: "2 440 000",
          promoBadge: "7 дней тест: 13 000 сум",
          features: [
            "1 Telegram-бот / профиль",
            "1 канал или группа",
            "1 000 AI-сообщений / мес",
            "До 100 товаров в каталоге",
            "2 оператора в команде",
            "Круглосуточные AI-ответы 24/7",
            "Базовая база знаний магазина",
          ],
        },
        {
          code: "pro",
          name: "PRO",
          isPopular: true,
          badge: "ПОПУЛЯРНЫЙ",
          description: "Полный набор возможностей для активных продаж.",
          priceMonthlyUsd: 39,
          priceMonthlyUzs: "499 000",
          priceYearlyUsd: 390,
          priceYearlyUzs: "4 990 000",
          promoBadge: "7 дней тест: 26 000 сум",
          features: [
            "3 Telegram-бота + WebApp",
            "5 каналов или групп",
            "7 500 AI-сообщений / мес",
            "До 1 000 товаров в каталоге",
            "10 операторов в команде",
            "AI Vision + расширенный RAG-поиск",
            "Детальная аналитика и экспорт",
            "Приоритетная поддержка",
          ],
        },
        {
          code: "ultra",
          name: "ULTRA",
          description: "Для крупных брендов, ритейлеров и агентств.",
          priceMonthlyUsd: 79,
          priceMonthlyUzs: "999 000",
          priceYearlyUsd: 790,
          priceYearlyUzs: "9 990 000",
          promoBadge: "7 дней тест: 39 000 сум",
          features: [
            "10 Telegram-ботов / профилей",
            "20 каналов или групп",
            "30 000 AI-сообщений / мес",
            "До 10 000 товаров в каталоге",
            "50 операторов / без ограничений",
            "Индивидуальная настройка AI-модели",
            "Интеграция по REST API и Webhooks",
            "Персональный менеджер 24/7 и SLA",
          ],
        },
      ],
    },
    faq: {
      tag: "ВОПРОСЫ И ОТВЕТЫ",
      titleLine1: "Есть",
      titleLine2: "вопросы?",
      descLine1: "Полезные ответы",
      descLine2: "перед началом работы.",
      contact: "Связаться с командой →",
      items: [
        {
          id: "q1",
          question: "Что делает Selloi?",
          answer:
            "Selloi — онлайн-продавец для вашего магазина. Он отвечает на вопросы, распознает товары по фото и автоматически оформляет заказы.",
          nodeId: "182:415",
        },
        {
          id: "q2",
          question: "Можно ли сначала протестировать?",
          answer:
            "Да, вы можете протестировать все возможности платформы по 7-дневной промо-цене (START: 13 000 сум, PRO: 26 000 сум, ULTRA: 39 000 сум).",
          nodeId: "182:420",
        },
        {
          id: "q3",
          question: "Работает ли Selloi в выходные?",
          answer:
            "Да, Selloi работает непрерывно 24/7 без выходных и праздников.",
          nodeId: "182:424",
        },
        {
          id: "q4",
          question: "Распознает ли товар по фото?",
          answer:
            "Да, нейросеть анализирует присланную фотографию, находит нужный товар в каталоге и помогает оформить заказ.",
          nodeId: "182:428",
        },
      ],
    },
    finalCta: {
      tag: "НЕ УПУСКАЙТЕ СЛЕДУЮЩИЙ ЗАКАЗ",
      titleLine1: "Не заставляйте клиентов ждать.",
      titleLine2: "Начните с Selloi уже сегодня.",
      desc: "Подключите круглосуточного помощника к вашему магазину.",
      cta: "Попробовать 7 дней →",
      note: "Оцените все возможности в течение 7 дней.",
    },
    footer: {
      taglineLine1: "Для вашего магазина",
      taglineLine2: "24/7 онлайн продавец.",
      col1Title: "ЗНАКОМСТВО",
      col1Link1: "О Selloi",
      col1Link2: "Возможности",
      col2Title: "НАЧАТЬ",
      col2Link1: "Попробовать",
      col2Link2: "Тарифы",
      col3Title: "КОНТАКТЫ",
      col3Link1: "Связаться с нами",
      col3Link2: "selloi.uz",
      copy: "© Selloi. Все права защищены.",
      langName: "Русский",
    },
    modal: {
      title: "Вход в панель управления",
      label: "Пароль администратора",
      placeholder: "••••••••••••",
      cancel: "Отмена",
      submit: "Войти",
      loading: "Проверка...",
      errorDefault: "Неверный пароль",
    },
  },
  en: {
    nav: {
      boshSahifa: "Home",
      selloiHaqida: "About Selloi",
      sinabKorish: "Try 7 Days",
      tariflar: "Pricing",
      aloqa: "Contact",
      kirish: "Sign In",
      kabinet: "Dashboard",
    },
    hero: {
      title1: "Selloi: 24/7 AI Sales Assistant",
      title2: "For Your Online Store!",
      subtitle:
        "Responds to customers within seconds, recognizes products from photos, and captures orders automatically. 24/7, zero days off!",
      cta: "Try 7 Days →",
      windowTitle: "Selloi.uz",
    },
    imkoniyatlar: {
      tag: "SELLOI CAPABILITIES",
      titleLine1: "Grow your business.",
      titleLine2: "Selloi handles the sales.",
      subtitleLine1: "Every question is a sales opportunity.",
      subtitleLine2: "Never leave any customer waiting.",
      card1Tag: "01 / INSTANT REPLIES",
      card1TitleLine1: "Lots of questions.",
      card1TitleLine2: "Answers always ready.",
      card1DescLine1: "Shoppers don't wait. Selloi delivers accurate",
      card1DescLine2: "answers to product inquiries in seconds.",
      card1UserLabel: "CUSTOMER",
      card1UserMsg: "Is this model available in black?",
      card1BotLabel: "Selloi",
      card1BotMsgLine1: "Yes, black is in stock! Would you like",
      card1BotMsgLine2: "help placing your order?",
      card2Tag: "02 / FROM PHOTO TO PRODUCT",
      card2Title: "Customer sends a photo. Selloi recognizes it.",
      card2DescLine1: "Identifies items directly from photos and",
      card2DescLine2: "seamlessly guides the dialogue to checkout.",
      card3Tag: "03 / 24/7 ROUND-THE-CLOCK",
      card3Title: "Store closes. Sales never stop.",
      card3DescLine1: "Automatically accepts orders even at night",
      card3DescLine2: "and throughout the weekends.",
    },
    qandayIshlaydi: {
      tag: "HOW IT WORKS",
      title: "Advanced technology. Simple beginning.",
      step1Num: "01",
      step1Title: "Introduce your store",
      step1DescLine1: "Prepare your product catalog",
      step1DescLine2: "and store details.",
      step2Num: "02",
      step2Title: "Guide Selloi",
      step2DescLine1: "Gather your most common customer FAQs",
      step2DescLine2: "and answers in one place.",
      step3Num: "03",
      step3Title: "Let Selloi take the conversation",
      step3DescLine1: "Streamline customer interactions,",
      step3DescLine2: "and focus your time on growing the business.",
    },
    suhbatNamunasi: {
      tag: "SAMPLE CONVERSATION",
      titleLine1: "Telegram channel & AI seller",
      titleLine2: "in one live experience.",
      descLine1: "Customers browse 100 computer products directly in your Telegram",
      descLine2: "channel or type any question — Selloi answers in seconds inside",
      descLine3: "Telegram chat and completes the order automatically.",
      cta: "Try 7 Days →",
      cardTitle: "Selloi AI",
      cardSub: "Sample Conversation",
      userMsg: "Hello! Do you have delivery available?",
      botMsgLine1: "Hello! Which PC model or budget",
      botMsgLine2: "are you looking for today?",
      disclaimer: "Authentic Telegram preview. Send a message or pick any of the 100 computers in @techzone_uz channel.",
      placeholder: "Write a message…",
      liveBadge: "Telegram Live",
      step1UserText: "Hello! Is ASUS ROG Strix G16 RTX 4070 in stock? What is the price?",
      step2BotText: "Hello! Yes, ASUS ROG Strix G16 (TZ-001) is in stock (5 units). Price: 18,900,000 UZS. 12-month installment is also available.",
      step3UserCaption: "Can you verify this build photo and 12-month plan?",
      step4BotRecognition: "Photo analyzed: TZ-001 • ASUS ROG Strix G16 (i7-14650HX, RTX 4070, 16GB/1TB) in stock ✅ 24-mo warranty included!",
      orderBadge: "Order #TZ-4821 Confirmed",
      orderProduct: "ASUS ROG Strix G16 G614J (TZ-001)",
      orderPrice: "18,900,000 UZS",
      orderStatus: "Processed • Courier delivery within 2h ⚡",
      typingIndicator: "typing...",
      analyzingIndicator: "analyzing photo...",
      photoLabel: "Photo",
      uploadingPhotoText: "📎 Attaching photo...",
      orderChipLabel: "Telegram Bot",
      orderProductLabel: "Product:",
      orderPriceLabel: "Price:",
      sendAriaLabel: "Send Telegram message",
      fallbackReply: "Got it! Our @techzone_uz channel lists 100 computer items (laptops from 4.85M UZS, RTX 4060/4070/4090 desktops, 240Hz monitors). Ask by model or budget!",
      quickPrompts: [
        {
          id: "stock",
          label: "💻 Under 10M",
          userText: "Which laptops for work and gaming are under 10 million UZS?",
          botReply: "Here are our best-value laptops under 10M UZS:",
        },
        {
          id: "delivery",
          label: "🎮 RTX 4070 PC",
          userText: "Do you have prebuilt gaming PCs with RTX 4070 in stock?",
          botReply: "Yes! Here are our RTX 4070 / 4070 Ti builds ready in stock:",
        },
        {
          id: "photo",
          label: "📎 Send photo",
          userText: "Could you identify this gaming rig from the photo and share the price?",
          botReply: "Recognized via AI Vision: TZ-037 • TechZone CyberForge 4070 Ti (Ryzen 7 7800X3D, 32GB DDR5) — 24,600,000 UZS ✅",
        },
        {
          id: "order",
          label: "🛒 Order now",
          userText: "Order ASUS ROG Strix G16 (TZ-001) please!",
          botReply: "Great choice! Your order has been processed automatically 👇",
        },
      ],
      tg: {
        searchSidebarPlaceholder: "Search",
        botTitle: "Selloi AI",
        botOnlineSub: "bot • 24/7 online",
        botTypingStatus: "typing...",
        botAnalyzingStatus: "analyzing photo...",
        channelTitle: "TechZone UZ",
        channelHandle: "@techzone_uz",
        channelSubs: "24,840 subscribers • 100 products",
        channelSidebarPreview: "📢 100 computer products",
        pinnedText: "TechZone UZ (100 computers) synced to AI Catalog",
        todayLabel: "Today",
        switchToChannelBtn: "📢 100 Products",
        switchToChatBtn: "💬 AI Chat",
        channelSearchPlaceholder: "Search 100 products (ASUS, RTX, MacBook)...",
        catAll: "All (100)",
        catLaptop: "💻 Laptops (35)",
        catPc: "🖥️ Gaming PCs (25)",
        catMonitor: "🖥 Monitors (20)",
        catAccessory: "⌨️ Accessories (20)",
        inStockLabel: "In stock",
        warrantyLabel: "mo warranty",
        installmentSuffix: "UZS/mo (12 mo)",
        askAiButton: "🤖 Ask AI Seller",
        orderButton: "🛒 Order",
        deliveryInfoButton: "🚚 Delivery info",
        otherOptionsButton: "📢 Browse 100 items",
        emptySearchText: "No computer items matched your query. Try another brand or GPU model.",
        sidebarHint: "Click any product in the channel for instant AI consultation",
        shownCountLabel: "Showing",
        quoteChannelLabel: "TechZone UZ • Channel",
        deliveryReplyText: "Express Tashkent courier delivery in 2 hours (free over 5M UZS). Nationwide insured shipping via BTS / Fargo within 1 day ⚡",
        photoVisionPrompt: "Can you analyze this PC photo and give me the price?",
        photoVisionReply: "AI Vision match: TZ-037 • TechZone CyberForge (RTX 4070 Ti, Ryzen 7 7800X3D) — 5 units in stock, 24,600,000 UZS ✅",
        matchedHeaderText: "Top matching computer models from our 100-item catalog:",
        matchedBudgetText: "Best options matching your budget:",
        askProductPromptPrefix: "Please share full specs, stock status, and installment details for this item.",
        orderConfirmedPrefix: "Congratulations! Your order has been confirmed automatically 👇",
        chatPreviewFallback: "24/7 sales assistant across 100 PCs",
      },
    },
    tariflar: {
      tag: "PRICING PLANS",
      title: "Choose the plan that fits your business.",
      desc: "Select the tier designed for your store volume. Save up to 17% with annual billing.",
      billingMonthly: "Monthly",
      billingYearly: "Yearly",
      yearlyDiscountBadge: "Save 17%",
      trialBadge: "7-day Mega Discount",
      ctaSelect: "Choose Plan",
      popularBadge: "MOST POPULAR",
      perMonth: "/ mo",
      perYear: "/ yr",
      cta: "Try 7 Days →",
      note: "For your store. For your growth.",
      plans: [
        {
          code: "start",
          name: "START",
          description: "Ideal for small shops and solo entrepreneurs starting out.",
          priceMonthlyUsd: 19,
          priceMonthlyUzs: "244,000",
          priceYearlyUsd: 190,
          priceYearlyUzs: "2,440,000",
          promoBadge: "7-day trial: 13,000 UZS",
          features: [
            "1 Telegram Bot / Profile",
            "1 Channel or Group",
            "1,000 AI messages / mo",
            "100 products catalog capacity",
            "2 operator seats",
            "24/7 Automated AI replies",
            "Store knowledge base",
          ],
        },
        {
          code: "pro",
          name: "PRO",
          isPopular: true,
          badge: "MOST POPULAR",
          description: "Complete toolset for high-volume multichannel retail.",
          priceMonthlyUsd: 39,
          priceMonthlyUzs: "499,000",
          priceYearlyUsd: 390,
          priceYearlyUzs: "4,990,000",
          promoBadge: "7-day trial: 26,000 UZS",
          features: [
            "3 Telegram Bots + WebApp",
            "5 Channels or Groups",
            "7,500 AI messages / mo",
            "1,000 products catalog capacity",
            "10 operator seats",
            "AI Vision + Advanced RAG retrieval",
            "Full analytics suite & data export",
            "Priority technical support",
          ],
        },
        {
          code: "ultra",
          name: "ULTRA",
          description: "For enterprise brands, retail chains and agencies.",
          priceMonthlyUsd: 79,
          priceMonthlyUzs: "999,000",
          priceYearlyUsd: 790,
          priceYearlyUzs: "9,990,000",
          promoBadge: "7-day trial: 39,000 UZS",
          features: [
            "10 Telegram Bots / Profiles",
            "20 Channels or Groups",
            "30,000 AI messages / mo",
            "10,000 products catalog capacity",
            "50 operator seats / unlimited team",
            "Custom fine-tuned AI model & persona",
            "REST API & Webhooks access",
            "24/7 Dedicated account manager & SLA",
          ],
        },
      ],
    },
    faq: {
      tag: "FREQUENTLY ASKED QUESTIONS",
      titleLine1: "Have",
      titleLine2: "questions?",
      descLine1: "Helpful answers to know",
      descLine2: "before getting started.",
      contact: "Contact team →",
      items: [
        {
          id: "q1",
          question: "What does Selloi do?",
          answer:
            "Selloi is an online sales assistant for your store. It answers questions, recognizes products from photos, and automatically collects orders.",
          nodeId: "182:415",
        },
        {
          id: "q2",
          question: "Can I try it before paying?",
          answer:
            "Yes! You can explore all capabilities with our 7-day promotional trial (START: 13,000 UZS, PRO: 26,000 UZS, ULTRA: 39,000 UZS).",
          nodeId: "182:420",
        },
        {
          id: "q3",
          question: "Does Selloi work on weekends?",
          answer:
            "Yes, Selloi operates 24/7 without interruption or days off.",
          nodeId: "182:424",
        },
        {
          id: "q4",
          question: "Can it identify products from photos?",
          answer:
            "Yes, computer vision identifies the item from user photos and matches it with your store catalog to assist checkout.",
          nodeId: "182:428",
        },
      ],
    },
    finalCta: {
      tag: "DON'T MISS YOUR NEXT SALE",
      titleLine1: "Keep your customers moving.",
      titleLine2: "Start with Selloi today.",
      desc: "Add a 24/7 intelligent sales assistant to your store.",
      cta: "Try 7 Days →",
      note: "Experience all features with a 7-day introductory trial.",
    },
    footer: {
      taglineLine1: "For your store",
      taglineLine2: "24/7 online sales AI.",
      col1Title: "EXPLORE",
      col1Link1: "About Selloi",
      col1Link2: "Features",
      col2Title: "GET STARTED",
      col2Link1: "Try 7 Days",
      col2Link2: "Pricing",
      col3Title: "CONTACT",
      col3Link1: "Contact Support",
      col3Link2: "selloi.uz",
      copy: "© Selloi. All rights reserved.",
      langName: "English",
    },
    modal: {
      title: "Dashboard Login",
      label: "Enter platform password:",
      placeholder: "••••••••••••",
      cancel: "Cancel",
      submit: "Sign In",
      loading: "Verifying...",
      errorDefault: "Invalid password",
    },
  },
};
