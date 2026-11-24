import type { Metadata } from "next";
import { Quicksand } from "next/font/google";
import "@tabler/core/dist/css/tabler.min.css";
import "./globals.css";

const quicksand = Quicksand({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-quicksand",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://selloi.uz"),
  title: {
    default: "Selloi.uz — Telegram uchun 24/7 AI sotuvchi",
    template: "%s | Selloi.uz",
  },
  description:
    "Selloi.uz — Telegram do‘koningiz uchun sun’iy intellekt sotuvchi. Mijozlarga avtomatik javob beradi, mahsulotlarni rasmdan taniydi va buyurtmalarni qabul qiladi.",
  applicationName: "Selloi.uz",
  keywords: [
    "Selloi",
    "Selloi.uz",
    "Selloi AI",
    "AI sotuvchi",
    "Telegram AI sotuvchi",
    "Telegram uchun AI sotuvchi",
    "Telegram do‘kon avtomatlashtirish",
    "Sun’iy intellekt sotuvchi",
    "O‘zbekistonda AI sotuvchi",
    "Telegram bot sotuvchi",
    "Telegram do'kon",
    "Telegram CRM",
  ],
  authors: [{ name: "Selloi.uz", url: "https://selloi.uz" }],
  creator: "Selloi.uz",
  publisher: "Selloi.uz",
  alternates: {
    canonical: "https://selloi.uz/",
    languages: {
      "uz": "https://selloi.uz/",
      "x-default": "https://selloi.uz/",
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
  openGraph: {
    title: "Selloi.uz — Telegram uchun 24/7 AI sotuvchi",
    description:
      "Selloi.uz — Telegram do‘koningiz uchun sun’iy intellekt sotuvchi. Mijozlarga avtomatik javob beradi, mahsulotlarni rasmdan taniydi va buyurtmalarni qabul qiladi.",
    url: "https://selloi.uz/",
    siteName: "Selloi.uz",
    locale: "uz_UZ",
    type: "website",
    images: [
      {
        url: "https://selloi.uz/og-image.png",
        width: 1200,
        height: 630,
        alt: "Selloi.uz — Telegram uchun 24/7 AI sotuvchi",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Selloi.uz — Telegram uchun 24/7 AI sotuvchi",
    description:
      "Selloi.uz — Telegram do‘koningiz uchun sun’iy intellekt sotuvchi. Mijozlarga avtomatik javob beradi, mahsulotlarni rasmdan taniydi va buyurtmalarni qabul qiladi.",
    images: ["https://selloi.uz/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://selloi.uz/#organization",
      "name": "Selloi.uz",
      "alternateName": [
        "Selloi",
        "Selloi AI",
        "Selloi Telegram AI",
        "Selloi AI sotuvchi"
      ],
      "url": "https://selloi.uz/",
      "logo": {
        "@type": "ImageObject",
        "@id": "https://selloi.uz/#logo",
        "url": "https://selloi.uz/logo.png",
        "caption": "Selloi.uz",
        "width": 512,
        "height": 512
      },
      "image": "https://selloi.uz/logo.png",
      "description":
        "AI-powered Telegram sales automation platform for businesses in Uzbekistan.",
      "foundingLocation": {
        "@type": "Place",
        "name": "Uzbekistan"
      },
      "areaServed": {
        "@type": "Country",
        "name": "Uzbekistan"
      },
      "sameAs": [
        "https://t.me/Selloi_ai_bot",
        "https://t.me/selloi_bot"
      ],
      "contactPoint": [
        {
          "@type": "ContactPoint",
          "contactType": "customer support",
          "email": "support@selloi.uz",
          "url": "https://t.me/selloi_admin",
          "availableLanguage": ["uz", "ru", "en"]
        }
      ]
    },
    {
      "@type": "WebSite",
      "@id": "https://selloi.uz/#website",
      "url": "https://selloi.uz/",
      "name": "Selloi.uz",
      "alternateName": ["Selloi", "Selloi AI"],
      "publisher": { "@id": "https://selloi.uz/#organization" },
      "inLanguage": ["uz", "ru", "en"]
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://selloi.uz/#software",
      "name": "Selloi.uz",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Cloud, Web, Telegram",
      "description":
        "Selloi.uz — Telegram do‘koningiz uchun sun’iy intellekt sotuvchi platformasi. 24/7 mijozlar savollariga javob berish, mahsulot fotosuratlarini tanish va buyurtmalarni avtomatlashtirish.",
      "offers": [
        {
          "@type": "Offer",
          "name": "START Plan (7 kunlik sinov)",
          "price": "13000",
          "priceCurrency": "UZS",
          "description": "START: 7 kunlik sinov davri uchun 13 000 UZS ($1 ekvivalenti). Sinovdan so'ng oylik (244 000 UZS) va yillik obuna.",
          "availability": "https://schema.org/InStock",
          "url": "https://selloi.uz/#tariflar"
        },
        {
          "@type": "Offer",
          "name": "PRO Plan (7 kunlik sinov)",
          "price": "26000",
          "priceCurrency": "UZS",
          "description": "PRO: 7 kunlik sinov davri uchun 26 000 UZS ($2 ekvivalenti). AI Vision va to'liq avtomatlashtirish. Sinovdan so'ng oylik (499 000 UZS) va yillik obuna.",
          "availability": "https://schema.org/InStock",
          "url": "https://selloi.uz/#tariflar"
        },
        {
          "@type": "Offer",
          "name": "ULTRA Plan (7 kunlik sinov)",
          "price": "39000",
          "priceCurrency": "UZS",
          "description": "ULTRA: 7 kunlik sinov davri uchun 39 000 UZS ($3 ekvivalenti). Korporativ jamoalar va alohida infratuzilma uchun. Sinovdan so'ng oylik (999 000 UZS) va yillik obuna.",
          "availability": "https://schema.org/InStock",
          "url": "https://selloi.uz/#tariflar"
        }
      ],
      "publisher": { "@id": "https://selloi.uz/#organization" }
    }
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uz" data-bs-theme="dark" className="theme-dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd),
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var savedTheme = localStorage.getItem('ai_sales_theme') || 'dark';
                  var savedFont = localStorage.getItem('ai_sales_app_font') || 'quicksand';
                  var savedLang = localStorage.getItem('ai_sales_language') || 'uz';
                  // Root HTML defaults to 'classic' during pre-hydration to prevent unauthorized design flashing.
                  // Elevated designs ('premium', 'ios') are only applied after verified subscription entitlement.
                  document.documentElement.setAttribute('lang', savedLang);
                  document.documentElement.setAttribute('data-theme', savedTheme);
                  document.documentElement.setAttribute('data-bs-theme', savedTheme);
                  document.documentElement.setAttribute('data-font', savedFont);
                  document.documentElement.setAttribute('data-design', 'classic');
                  if (savedTheme === 'light') {
                    document.documentElement.classList.remove('theme-dark');
                    document.documentElement.classList.add('theme-light');
                  } else {
                    document.documentElement.classList.remove('theme-light');
                    document.documentElement.classList.add('theme-dark');
                  }
                } catch(e) {}
                window.addEventListener('error', function(e) {
                  if (e.filename && e.filename.includes('chrome-extension://')) {
                    e.stopImmediatePropagation();
                    e.preventDefault();
                  }
                }, true);

                window.addEventListener('unhandledrejection', function(e) {
                  var stack = (e.reason && (e.reason.stack || e.reason.message)) || '';
                  if (stack.indexOf('chrome-extension://') !== -1) {
                    e.stopImmediatePropagation();
                    e.preventDefault();
                  }
                }, true);

                var origError = console.error;
                console.error = function() {
                  for (var i = 0; i < arguments.length; i++) {
                    var str = String(arguments[i] || '');
                    if (str.indexOf('bis_skin_checked') !== -1 || str.indexOf('chrome-extension://') !== -1) {
                      return;
                    }
                  }
                  origError.apply(console, arguments);
                };
              })();
            `,
          }}
        />
      </head>
      <body className={`theme-dark ${quicksand.variable} ${quicksand.className}`} style={{ backgroundColor: "var(--bg-canvas)", color: "var(--text-primary)", fontFamily: "var(--font-sans)" }} suppressHydrationWarning>{children}</body>
    </html>
  );
}
