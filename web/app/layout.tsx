import type { Metadata } from "next";
import "@tabler/core/dist/css/tabler.min.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://selloi.uz"),
  title: {
    default: "Selloi — Telegram do‘konlari uchun AI sotuvchi",
    template: "%s | Selloi",
  },
  description:
    "Selloi — O‘zbekiston Telegram do‘konlari uchun 24/7 ishlaydigan sun’iy intellekt sotuvchisi. Mijozlarga o‘zbek tilida javob beradi, mahsulotlarni taniydi va buyurtmalarni qabul qiladi.",
  applicationName: "Selloi",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Selloi — Telegram do‘konlari uchun AI sotuvchi",
    description: "Telegram do‘koningizda mijozlarga 24/7 xizmat ko‘rsatadigan AI sotuvchi.",
    url: "https://selloi.uz/",
    siteName: "Selloi",
    locale: "uz_UZ",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Selloi — Telegram do‘konlari uchun AI sotuvchi",
    description: "Telegram do‘koningizda mijozlarga 24/7 xizmat ko‘rsatadigan AI sotuvchi.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uz" data-bs-theme="dark" className="theme-dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var savedTheme = localStorage.getItem('ai_sales_theme') || 'dark';
                  var savedFont = localStorage.getItem('ai_sales_app_font') || 'olline';
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
      <body className="theme-dark" style={{ backgroundColor: "#0c0d12", color: "#f8fafc" }} suppressHydrationWarning>{children}</body>
    </html>
  );
}
