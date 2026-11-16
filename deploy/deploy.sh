#!/usr/bin/env bash
# ==============================================================================
# Telegram AI Agent & SaaS E-Commerce Platform — Production Deployment Script
# ==============================================================================

set -e

echo "🚀 [1/5] Tizim tekshirilmoqda..."

# Docker o'rnatilganligini tekshirish
if ! command -v docker &> /dev/null; then
    echo "⚠️ Docker topilmadi. Docker o'rnatilmoqda..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

# .env mavjudligini tekshirish
if [ ! -f ".env" ]; then
    echo "❌ Xato: .env fayli topilmadi!"
    echo "Iltimos, avval 'cp .env.example .env' qilib, parametrlarni to'ldiring."
    exit 1
fi

echo "📦 [2/5] Docker konteynerlar qurilmoqda va ishga tushirilmoqda..."
docker compose down || true
docker compose up -d --build

echo "⏳ [3/5] Ma'lumotlar bazasi tayyor bo'lishi kutilmoqda..."
sleep 6

echo "🗄️ [4/5] Ma'lumotlar bazasi migratsiyalari tekshirilmoqda..."
docker compose exec api alembic upgrade head || true

echo "🤖 [5/5] Telegram Webhook o'rnatilmoqda..."
docker compose exec api python 1-telegram-bot/scripts/set_webhook.py || true

echo ""
echo "=================================================================="
echo "🎉 TABRIKLAYMIZ! Loyiha muvaffaqiyatli serverda ishga tushdi!"
echo "=================================================================="
echo "• Backend API:        http://localhost:8000"
echo "• Admin Dashboard:    http://localhost:3000"
echo "• Public Do'kon:      http://localhost:8000/shop/"
echo "• Docker holati:      'docker compose ps'"
echo "=================================================================="
