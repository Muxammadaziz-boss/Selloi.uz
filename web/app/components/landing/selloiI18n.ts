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
      titleLine1: "Oddiy savoldan",
      titleLine2: "tayyor buyurtmagacha.",
      descLine1: "Mijozingiz bilan tabiiy muloqot. Mahsulot haqida",
      descLine2: "javob, tanlovda yordam va buyurtmani qabul qilish —",
      descLine3: "barchasi bir suhbatda.",
      cta: "7 kun sinab ko‘rish →",
      cardTitle: "Selloi",
      cardSub: "Suhbatdan namuna",
      userMsg: "Assalomu alaykum! Yetkazib berish bormi?",
      botMsgLine1: "Va alaykum assalom! Qaysi manzilga",
      botMsgLine2: "buyurtma bermoqchisiz?",
      disclaimer: "Suhbatdan namuna. O‘zingiz savol yozib yoki tugmalardan tanlab jonli sinab ko‘ring.",
      placeholder: "Xabaringizni yozing va Enter bosing…",
      liveBadge: "Jonli demo",
      step1UserText: "Assalomu alaykum! Shu krossovkadan 42-razmeri bormi?",
      step2BotText: "Va alaykum assalom! Ha, qora va oq ranglarda 42-razmer mavjud. Qaysi rang ma’qul?",
      step3UserCaption: "Mana shu oq ranglisidan 1 juft olmoqchiman.",
      step4BotRecognition: "Fotosurat tahlil qilindi: Nike Air Force (Oq, 42-razmer) omborda bor ✅ Narxi: 380 000 so‘m.",
      orderBadge: "Buyurtma #4821 rasmiylashtirildi 🎉",
      orderProduct: "Mahsulot: Nike Air Force (Oq, 42)",
      orderPrice: "Jami: 380 000 so‘m",
      orderStatus: "Holati: Qabul qilindi • Yetkazib berishga yuborildi ⚡",
      typingIndicator: "Selloi javob yozmoqda...",
      analyzingIndicator: "Selloi fotosuratni tahlil qilmoqda...",
      photoLabel: "📷 Fotosurat",
      uploadingPhotoText: "📷 Rasm yuklanmoqda...",
      orderChipLabel: "Avtomatik",
      orderProductLabel: "Tovarlar:",
      orderPriceLabel: "Narxi:",
      sendAriaLabel: "Xabar yuborish",
      fallbackReply: "Tushundim! Omborimizda 38–44 razmerdagi Nike Air Force (380 000 so‘m) mavjud. Razmer yoki manzilingizni aytsangiz, darhol rasmiylashtiramiz.",
      quickPrompts: [
        {
          id: "stock",
          label: "👟 42-razmer?",
          userText: "Nike Air Force 42-razmer qolganmi va narxi qancha?",
          botReply: "Ha, Nike Air Force 42-razmeri oq va qora ranglarda omborda bor ✅ Narxi: 380 000 so‘m.",
        },
        {
          id: "delivery",
          label: "🚚 Yetkazish",
          userText: "Toshkent bo‘ylab yetkazib berish necha pul?",
          botReply: "Toshkent shahri bo‘ylab yetkazib berish 25 000 so‘m (2 soat ichida). Viloyatlarga BTS pochta orqali yuboramiz ⚡",
        },
        {
          id: "photo",
          label: "📷 Rasm orqali",
          userText: "Mana shu rasmdagi krossovkani qarab bering.",
          botReply: "Fotosurat tahlil qilindi: Nike Air Force (Oq, 42-razmer) omborda bor ✅ Narxi: 380 000 so‘m.",
        },
        {
          id: "order",
          label: "🛒 Buyurtma",
          userText: "Oq ranglisidan 42-razmer 1 juft buyurtma qilaman!",
          botReply: "Ajoyib tanlov! Buyurtmangiz darhol avtomatik rasmiylashtirildi 👇",
        },
      ],
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
      titleLine1: "От простого вопроса",
      titleLine2: "до готового заказа.",
      descLine1: "Естественный диалог с клиентом. Ответы о товарах,",
      descLine2: "помощь с выбором и прием заказов —",
      descLine3: "все в одной беседе.",
      cta: "Попробовать 7 дней →",
      cardTitle: "Selloi",
      cardSub: "Пример диалога",
      userMsg: "Здравствуйте! Есть ли доставка?",
      botMsgLine1: "Здравствуйте! По какому адресу",
      botMsgLine2: "хотите оформить доставку?",
      disclaimer: "Пример диалога. Задайте вопрос или выберите кнопку ниже, чтобы протестировать.",
      placeholder: "Напишите сообщение и нажмите Enter…",
      liveBadge: "Онлайн демо",
      step1UserText: "Здравствуйте! Есть ли эта модель в 42 размере?",
      step2BotText: "Здравствуйте! Да, 42 размер в наличии в черном и белом цветах. Какой цвет вам ближе?",
      step3UserCaption: "Мне нужна вот эта белая пара, 1 шт.",
      step4BotRecognition: "Фото распознано: Nike Air Force (Белые, 42 размер) в наличии ✅ Цена: 380 000 сум.",
      orderBadge: "Заказ #4821 успешно оформлен 🎉",
      orderProduct: "Товар: Nike Air Force (Белые, 42)",
      orderPrice: "Итого: 380 000 сум",
      orderStatus: "Статус: Принят • Отправлен на доставку ⚡",
      typingIndicator: "Selloi печатает...",
      analyzingIndicator: "Selloi анализирует фото...",
      photoLabel: "📷 Фотография",
      uploadingPhotoText: "📷 Загрузка фото...",
      orderChipLabel: "Автомат",
      orderProductLabel: "Товар:",
      orderPriceLabel: "Цена:",
      sendAriaLabel: "Отправить сообщение",
      fallbackReply: "Понял вас! В наличии кроссовки Nike Air Force (38–44 размер, 380 000 сум). Укажите размер или адрес доставки для оформления.",
      quickPrompts: [
        {
          id: "stock",
          label: "👟 42 размер?",
          userText: "Есть ли Nike Air Force 42 размера и какая цена?",
          botReply: "Да, Nike Air Force 42 размера есть в белом и черном цветах ✅ Цена: 380 000 сум.",
        },
        {
          id: "delivery",
          label: "🚚 Доставка",
          userText: "Сколько стоит доставка по Ташкенту?",
          botReply: "Доставка по Ташкенту — 25 000 сум за 2 часа. В регионы отправляем службой BTS ⚡",
        },
        {
          id: "photo",
          label: "📷 По фото",
          userText: "Проверьте наличие модели с этого фото.",
          botReply: "Фото распознано: Nike Air Force (Белые, 42 размер) в наличии ✅ Цена: 380 000 сум.",
        },
        {
          id: "order",
          label: "🛒 Заказать",
          userText: "Хочу заказать белую пару 42 размера!",
          botReply: "Отличный выбор! Заказ автоматически сформирован 👇",
        },
      ],
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
      titleLine1: "From a simple question",
      titleLine2: "to a completed order.",
      descLine1: "Natural conversation with your customer. Product guidance,",
      descLine2: "recommendations, and order checkout —",
      descLine3: "all in one conversation.",
      cta: "Try 7 Days →",
      cardTitle: "Selloi",
      cardSub: "Sample Conversation",
      userMsg: "Hello! Do you have delivery available?",
      botMsgLine1: "Hello! What destination address",
      botMsgLine2: "should we deliver to?",
      disclaimer: "Sample conversation. Type a question or click a quick prompt below to test live.",
      placeholder: "Type your message and press Enter…",
      liveBadge: "Live Demo",
      step1UserText: "Hello! Do you have size 42 in stock for this sneaker?",
      step2BotText: "Hello! Yes, size 42 is currently in stock in both black and white. Which one do you prefer?",
      step3UserCaption: "I'd like 1 pair of this white one please.",
      step4BotRecognition: "Photo analyzed: Nike Air Force (White, size 42) in stock ✅ Price: 380,000 UZS.",
      orderBadge: "Order #4821 Confirmed 🎉",
      orderProduct: "Product: Nike Air Force (White, 42)",
      orderPrice: "Total: 380,000 UZS",
      orderStatus: "Status: Processed • Dispatched for delivery ⚡",
      typingIndicator: "Selloi is typing...",
      analyzingIndicator: "Selloi is analyzing photo...",
      photoLabel: "📷 Photo",
      uploadingPhotoText: "📷 Uploading photo...",
      orderChipLabel: "Automatic",
      orderProductLabel: "Items:",
      orderPriceLabel: "Price:",
      sendAriaLabel: "Send message",
      fallbackReply: "Got it! We have Nike Air Force (sizes 38–44, 380,000 UZS) ready in stock. Tell me your size or address and I'll place your order right away.",
      quickPrompts: [
        {
          id: "stock",
          label: "👟 Size 42?",
          userText: "Do you have Nike Air Force in size 42 and how much is it?",
          botReply: "Yes! Nike Air Force size 42 is in stock in black and white ✅ Price: 380,000 UZS.",
        },
        {
          id: "delivery",
          label: "🚚 Delivery",
          userText: "How fast is delivery across Tashkent?",
          botReply: "Tashkent city delivery is 25,000 UZS within 2 hours. Nationwide shipping via BTS express ⚡",
        },
        {
          id: "photo",
          label: "📷 By photo",
          userText: "Can you check this sneaker from the photo?",
          botReply: "Photo analyzed: Nike Air Force (White, size 42) in stock ✅ Price: 380,000 UZS.",
        },
        {
          id: "order",
          label: "🛒 Order now",
          userText: "Order 1 pair of the white size 42 please!",
          botReply: "Awesome choice! Your order has been created automatically 👇",
        },
      ],
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
