#!/usr/bin/env bash
# ==============================================================================
# Telegram AI Seller — Server Environment & Docker Setup Script
# Run directly on VPS: bash deploy/setup_server.sh
# IMPORTANT: Replace all <CHANGE_ME_...> placeholders after generating files.
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

# 3. .env va web/.env shablonlarini yaratish (mavjud bo'lmasa)
echo "⚙️ [4/5] .env shablonlari tekshirilmoqda..."
if [ ! -f ".env" ]; then
cat << 'EOF' > .env
APP_ENV=production
APP_NAME=AI Sales Assistant
API_HOST=0.0.0.0
API_PORT=8000
POSTGRES_PASSWORD=<CHANGE_ME_STRONG_DB_PASSWORD>
DATABASE_URL=postgresql+asyncpg://sales:<CHANGE_ME_STRONG_DB_PASSWORD>@db:5432/aisales
REDIS_URL=redis://redis:6379/0
TELEGRAM_BOT_TOKEN=<CHANGE_ME_TELEGRAM_BOT_TOKEN>
TELEGRAM_WEBHOOK_SECRET=<CHANGE_ME_OPENSSL_RAND_HEX_24>
PUBLIC_WEBHOOK_URL=https://selloi.uz
TELEGRAM_PUBLIC_CHANNEL=
TELEGRAM_ADMIN_CHAT_ID=<CHANGE_ME_ADMIN_CHAT_ID>
ADMIN_TELEGRAM_ID=<CHANGE_ME_ADMIN_TELEGRAM_ID>
ADMIN_EMAIL=<CHANGE_ME_OWNER_EMAIL>
ALLOWED_ORIGINS=https://selloi.uz
AI_PROVIDER=gemini
GEMINI_API_KEY=<CHANGE_ME_GEMINI_API_KEY>
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
ADMIN_API_TOKEN=<CHANGE_ME_OPENSSL_RAND_HEX_32>
INTERNAL_INGEST_TOKEN=<CHANGE_ME_OPENSSL_RAND_HEX_32>
ENCRYPTION_KEY=<CHANGE_ME_32_BYTE_FERNET_KEY>
STORAGE_DIR=./storage
JWT_SECRET=<CHANGE_ME_OPENSSL_RAND_HEX_32>
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440
EOF
fi

if [ ! -f "web/.env" ]; then
cat << 'EOF' > web/.env
BACKEND_URL=http://api:8000
SESSION_SECRET=<CHANGE_ME_OPENSSL_RAND_HEX_32>
JWT_SECRET=<CHANGE_ME_SAME_JWT_SECRET_AS_BACKEND>
EOF
fi

chmod 600 .env web/.env
mkdir -p storage/channel_images data logs

echo "✅ [5/5] Tizim tekshiruvi:"
free -m
echo ""
echo "=================================================================="
echo "🎉 SERVER TAYYOR! .env va web/.env ichidagi <CHANGE_ME_...> qiymatlarni to'ldirib,"
echo "   so'ng ishga tushiring: docker compose up -d --build"
echo "=================================================================="
