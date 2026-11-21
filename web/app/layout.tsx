import type { Metadata } from "next";
import { Quicksand } from "next/font/google";
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
    default: "Selloi: Telegram do'konlari uchun AI sotuvchi",
    template: "%s | Selloi",
  },
  description:
    "Selloi: O'zbekiston Telegram do'konlari uchun 24/7 ishlaydigan sun'iy intellekt sotuvchisi. Mijozlarga o'zbek tilida javob beradi, mahsulotlarni taniydi va buyurtmalarni qabul qiladi.",
  applicationName: "Selloi",
  keywords: [
    "Selloi",
    "Selloi.uz",
    "Selloi AI",
    "Selloi Telegram AI",
    "Selloi AI sotuvchi",
    "Telegram do'kon",
    "Telegram bot sotuvchi",
    "Telegram avtomatlashtirish",
    "O'zbekiston AI sotuvchi",
  ],
  authors: [{ name: "Selloi" }],
  creator: "Selloi",
  publisher: "Selloi",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/logo.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
    ],
    shortcut: "/favicon.ico",
  },
  openGraph: {
    title: "Selloi: Telegram do'konlari uchun AI sotuvchi",
    description: "Telegram do'koningizda mijozlarga 24/7 xizmat ko'rsatadigan AI sotuvchi.",
    url: "https://selloi.uz/",
    siteName: "Selloi",
    locale: "uz_UZ",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Selloi: Telegram do'konlari uchun AI sotuvchi",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Selloi: Telegram do'konlari uchun AI sotuvchi",
    description: "Telegram do'koningizda mijozlarga 24/7 xizmat ko'rsatadigan AI sotuvchi.",
    images: ["/og-image.png"],
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
      "name": "Selloi",
      "url": "https://selloi.uz",
      "logo": "https://selloi.uz/logo.svg",
      "description":
        "O'zbekiston Telegram do'konlari uchun 24/7 ishlaydigan sun'iy intellekt sotuvchisi va savdoni avtomatlashtirish platformasi.",
      "foundingLocation": "Uzbekistan",
    },
    {
      "@type": "WebSite",
      "@id": "https://selloi.uz/#website",
      "url": "https://selloi.uz",
      "name": "Selloi",
      "publisher": { "@id": "https://selloi.uz/#organization" },
      "inLanguage": "uz",
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://selloi.uz/#software",
      "name": "Selloi",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Cloud, Web, Telegram",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
      },
      "description":
        "Telegram do'konlari uchun AI sotuvchi. Mijozlarga o'zbek tilida 24/7 xizmat ko'rsatish, mahsulot fotosuratlarini tanish va buyurtmalarni avtomatlashtirish.",
      "publisher": { "@id": "https://selloi.uz/#organization" },
    },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uz" data-bs-theme="dark" className="theme-dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <style
          dangerouslySetInnerHTML={{
            __html: `@import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@300..700&display=swap');`,
          }}
        />
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
