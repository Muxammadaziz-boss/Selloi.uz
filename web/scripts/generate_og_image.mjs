import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { getLaunchOptions } from "../tests/test_config.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");
const outputPath = path.join(publicDir, "og-image.png");

async function generateOgImage() {
  const browser = await chromium.launch(getLaunchOptions());
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 2,
  });

  const logoSvgPath = path.join(publicDir, "logo.svg");
  const logoSvg = fs.readFileSync(logoSvgPath, "utf-8");

  const html = `
    <!DOCTYPE html>
    <html lang="uz">
    <head>
      <meta charset="UTF-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          width: 1200px;
          height: 630px;
          background: #000000;
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 80px 96px;
          position: relative;
          overflow: hidden;
        }
        .radial-glow {
          position: absolute;
          top: -120px;
          right: -120px;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(37, 99, 235, 0.22) 0%, rgba(15, 23, 42, 0) 70%);
          pointer-events: none;
        }
        .bottom-glow {
          position: absolute;
          bottom: -150px;
          left: 100px;
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, rgba(0, 0, 0, 0) 70%);
          pointer-events: none;
        }
        .grid-pattern {
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
        }
        .header {
          display: flex;
          align-items: center;
          gap: 20px;
          z-index: 1;
        }
        .logo-wrap {
          width: 64px;
          height: 64px;
        }
        .logo-wrap svg {
          width: 100%;
          height: 100%;
        }
        .brand-name {
          font-size: 38px;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: #ffffff;
        }
        .badge {
          background: rgba(37, 99, 235, 0.15);
          border: 1px solid rgba(56, 189, 248, 0.4);
          color: #38bdf8;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 6px 14px;
          border-radius: 9999px;
          display: inline-flex;
          align-items: center;
        }
        .content {
          z-index: 1;
          max-width: 960px;
        }
        .headline {
          font-size: 58px;
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: -0.03em;
          margin-bottom: 24px;
          background: linear-gradient(180deg, #ffffff 40%, #94a3b8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .subtext {
          font-size: 24px;
          line-height: 1.45;
          color: #94a3b8;
          max-width: 820px;
          font-weight: 400;
        }
        .footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 1;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding-top: 28px;
        }
        .features {
          display: flex;
          gap: 32px;
          color: #cbd5e1;
          font-size: 16px;
          font-weight: 500;
        }
        .feature-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .feature-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
        }
        .url {
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.01em;
          color: #38bdf8;
        }
      </style>
    </head>
    <body>
      <div class="radial-glow"></div>
      <div class="bottom-glow"></div>
      <div class="grid-pattern"></div>
      
      <div class="header">
        <div class="logo-wrap">${logoSvg}</div>
        <div class="brand-name">Selloi</div>
        <div class="badge">AI Sales Platform</div>
      </div>

      <div class="content">
        <h1 class="headline">Telegram do'konlari uchun 24/7 ishlovchi AI sotuvchi</h1>
        <p class="subtext">
          O'zbekiston Telegram do'konlarida mijozlar savollariga javob beradi, rasmdagi tovarlarni taniydi va buyurtmalarni avtomatik qabul qiladi.
        </p>
      </div>

      <div class="footer">
        <div class="features">
          <div class="feature-item"><div class="feature-dot"></div> 24/7 Avtomatlashtirish</div>
          <div class="feature-item"><div class="feature-dot"></div> Rasmli Vision Qidiruv</div>
          <div class="feature-item"><div class="feature-dot"></div> O'zbek Tili Integratsiyasi</div>
        </div>
        <div class="url">selloi.uz</div>
      </div>
    </body>
    </html>
  `;

  await page.setContent(html);
  await page.screenshot({ path: outputPath, type: "png" });
  await browser.close();
  console.log(`[SUCCESS] Generated OG Image at: ${outputPath}`);
}

generateOgImage().catch((err) => {
  console.error("Error generating OG image:", err);
  process.exit(1);
});
