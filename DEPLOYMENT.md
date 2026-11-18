# Serverga O'rnatish Bo'yicha To'liq Yo'riqnoma (Production Deployment)

Ushbu yo'riqnoma orqali loyihani istalgan Linux serveriga (Ubuntu 22.04 / 24.04 LTS) 10-15 daqiqa ichida to'liq ishga tushirishingiz mumkin.

---

## 🖥 1. Server Talablari (Tavsiya etiladi)

- **OS:** Ubuntu 22.04 yoki 24.04 LTS (x86_64)
- **RAM:** Kamida 2 GB (tavsiya: 4 GB)
- **CPU:** 2 yadro
- **Disk:** 25-30 GB SSD
- **Provayderlar:** Hetzner, DigitalOcean, Timeweb Cloud, Vultr, Reg.ru yoki istalgan VPS.
- **Domen:** 1 ta domen yoki subdomen (masalan: `myshop.uz`, `api.myshop.uz`). Telegram Webhook va WebApp uchun **HTTPS** shart!

---

## 🚀 2. Serverga Qadamma-Qadam O'rnatish

### 1-QADAM: Serverga ulanish va tizimni yangilash
```bash
ssh root@server_ip_manzili
apt update && apt upgrade -y
apt install -y git curl ufw
```

### 2-QADAM: Git orqali loyihani yuklab olish
```bash
cd /var/www
git clone https://github.com/sizning-repo/telegram-ai-agent.git
cd telegram-ai-agent
```

### 3-QADAM: Muhit o'zgaruvchilarini sozlash (.env)
```bash
cp .env.example .env
cp web/.env.example web/.env
nano .env
```
Faylda quyidagilarni to'ldiring:
- `TELEGRAM_BOT_TOKEN`: BotFather orqali olingan bot tokeni.
- `PUBLIC_WEBHOOK_URL`: Serveringiz domeni (masalan: `https://selloi.uz`).
- `GEMINI_API_KEY`: Google AI Studio orqali olingan API kalit.
- `POSTGRES_PASSWORD`: Xavfsiz kuchli parol.
- `DASHBOARD_PASSWORD`: Admin paneliga kirish paroli.

### 4-QADAM: Avtomatik Docker orqali ishga tushirish
Biz tayyorlagan avtomatik skriptni ishga tushiring:
```bash
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```
Ushbu skript:
1. Docker va Docker Compose mavjudligini tekshiradi va o'rnatadi.
2. PostgreSQL (pgvector), Redis, FastAPI backend va Next.js konteynerlarini quradi.
3. Ma'lumotlar bazasini yangilaydi (`alembic upgrade head`).
4. Telegram Webhookni avtomatik ulaydi.

---

## 🔒 3. Nginx va Bepul SSL (HTTPS) O'rnatish

Telegram faqat xavfsiz **HTTPS** protokoli orqali ishlaydi.

### 1. Nginx va Certbot o'rnatish:
```bash
apt install -y nginx certbot python3-certbot-nginx
```

### 2. Nginx konfiguratsiyasini nusxalash:
```bash
cp deploy/nginx.conf /etc/nginx/sites-available/telegram-ai.conf
# Faylni ochib, your-domain.uz o'rniga o'z domeningizni yozing:
nano /etc/nginx/sites-available/telegram-ai.conf

ln -s /etc/nginx/sites-available/telegram-ai.conf /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### 3. Bepul SSL (Let's Encrypt) sertifikatini olish:
```bash
certbot --nginx -d myshop.uz -d api.myshop.uz -d shop.myshop.uz
```

---

## 🔄 4. Loyihani Keyinchalik Yangilash (Deploy Update)

Kodingizga o'zgartirish kiritganingizda serverda shunchaki:
```bash
cd /var/www/telegram-ai-agent
git pull
docker compose up -d --build
```
Konteynerlar 0 sekund to'xtash bilan (zero downtime) yangilanadi.

---

## 🛠 5. Tekshirish va Monitoring Buyruqlari

- Konteynerlar holatini ko'rish: `docker compose ps`
- Backend loglarini jonli kuzatish: `docker compose logs -f api`
- Admin panel loglarini kuzatish: `docker compose logs -f web`
- Bot ulanishini tekshirish: `docker compose exec api python 1-telegram-bot/scripts/test_bot.py`
