#!/usr/bin/env bash
# ==============================================================================
# Telegram AI Seller — Server Environment & Docker Setup Script
# Run directly on VPS: bash deploy/setup_server.sh
# ==============================================================================

set -e

echo "🚀 [1/5] Server konfiguratsiyasi boshlanmoqda..."
cd /home/ubuntu/projects/Telegram_Ai_Seller

# 1. Swap yaratish (agar mavjud bo'lmasa, OOM xatolarining oldini oladi)
SWAP_EXISTS=$(free -m | awk '/Swap:/ {print $2}')
if [ "$SWAP_EXISTS" -eq 0 ]; then
    echo "💾 [2/5] 2GB Swap xotirasi yaratilmoqda..."
    sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "✅ Swap xotira faollashtirildi!"
else
    echo "✅ Swap allaqachon mavjud (${SWAP_EXISTS}MB)."
fi

# 2. Docker va Docker Compose o'rnatish
echo "🐳 [3/5] Docker va Docker Compose tekshirilmoqda..."
if ! command -v docker &> /dev/null; then
    echo "Docker o'rnatilmoqda..."
    sudo apt update -y
    sudo apt install -y docker.io docker-compose-v2
    sudo systemctl enable --now docker
    sudo usermod -aG docker ubuntu
    echo "✅ Docker muvaffaqiyatli o'rnatildi!"
else
    echo "✅ Docker allaqachon o'rnatilgan: $(docker --version)"
fi

# 3. .env va web/.env fayllarini yaratish
echo "⚙️ [4/5] .env va maxfiy kalitlar sozlanmoqda..."
cat << 'EOF' > .env
APP_ENV=production
APP_NAME=AI Sales Assistant
API_HOST=0.0.0.0
API_PORT=8000
DATABASE_URL=postgresql+asyncpg://postgres.ganlawuubihxinuwjvez:mux%40mm%40d%40z1z@aws-1-eu-west-3.pooler.supabase.com:5432/postgres
REDIS_URL=redis://redis:6379/0
TELEGRAM_BOT_TOKEN=8205996263:AAFc5amoaLK-2dONqekWNoiRIISXPAQ5K2k
TELEGRAM_WEBHOOK_SECRET=tg_secret_webhook_token_2026_xyz
PUBLIC_WEBHOOK_URL=http://129.146.163.171:8000
TELEGRAM_PUBLIC_CHANNEL=
TELEGRAM_ADMIN_CHAT_ID=6990611858
ADMIN_TELEGRAM_ID=6990611858
ALLOWED_ORIGINS=*
AI_PROVIDER=gemini
GEMINI_API_KEY=AQ.Ab8RN6JN9MfTFrGnAB0sQuE3F0vsPTjFx8xl03NU3t7xMyDCrw
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
ADMIN_API_TOKEN=super_secret_admin_token_2026_xyz
INTERNAL_INGEST_TOKEN=internal_ingest_token_secret_2026_abc
TELEGRAM_API_ID=21888757
TELEGRAM_API_HASH=5b839954e8ac566c8598ad56aaae9cc4
TELEGRAM_PHONE=+998917914881
STORAGE_DIR=./storage
JWT_SECRET=super_secret_jwt_key_change_in_production_2026
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440
EOF

cat << 'EOF' > web/.env
BACKEND_URL=http://localhost:8000
ADMIN_API_TOKEN=super_secret_admin_token_2026_xyz
DASHBOARD_PASSWORD=mux@mm@d@z1z
SESSION_SECRET=session_signing_secret_key_random_2026_abc
JWT_SECRET=super_secret_jwt_key_change_in_production_2026
EOF

cp web/.env 4-admin-dashboard/.env
chmod 600 .env web/.env 4-admin-dashboard/.env
mkdir -p storage/channel_images data logs

echo "✅ [5/5] Tizim tekshiruvi:"
free -m
echo ""
echo "=================================================================="
echo "🎉 SERVER TO'LIQ TAYYOR! Endi loyihani ishga tushirish mumkin:"
echo "   docker compose up -d --build"
echo "=================================================================="
