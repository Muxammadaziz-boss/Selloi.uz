"""Interactive CLI tester for 2-telegram-user-chat module."""

import asyncio
import os
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.ai_agent import sales_ai_agent
from services.human_handover import handover_service
from services.knowledge_retriever import knowledge_retriever

# Mock catalog for testing
MOCK_PRODUCTS = [
    {
        "id": 1,
        "title": "iPhone 15 Pro Max 256GB Natural Titanium",
        "category": "Smartfonlar",
        "price": 14500000,
        "stock": 5,
        "description": "Apple A17 Pro chip, titan korpus, 48MP kamera, 120Hz ekran.",
    },
    {
        "id": 2,
        "title": "MacBook Air 13 M3 16GB / 512GB",
        "category": "Noutbuklar",
        "price": 16200000,
        "stock": 3,
        "description": "Apple M3 chip, 18 soat batareya, Space Gray rang.",
    },
    {
        "id": 3,
        "title": "AirPods Pro 2 USB-C",
        "category": "Aksessuarlar",
        "price": 3100000,
        "stock": 10,
        "description": "Faol shovqinni bekor qilish, moslashuvchan audio, USB-C qutisi.",
    },
]


async def interactive_test():
    print("=" * 60)
    print("🤖 TELEGRAM USER CHAT AI TESTER (O'zbek tili)")
    print("Mavjud tovarlar: iPhone 15 Pro Max, MacBook Air M3, AirPods Pro 2")
    print("Chiqish uchun 'exit' yoki 'chiqish' deb yozing.")
    print("=" * 60)

    knowledge_retriever.update_catalog(MOCK_PRODUCTS)
    history = []

    while True:
        try:
            user_msg = input("\n👤 Mijoz: ").strip()
            if not user_msg:
                continue
            if user_msg.lower() in ("exit", "chiqish", "quit"):
                print("Test yakunlandi.")
                break

            # 1. Check human handover
            should_handover, reason = handover_service.should_escalate_to_human(user_msg)
            if should_handover:
                print(f"\n👨‍💼 [OPERATORGA YO'NALTIRILDI]: {reason}")
                continue

            # 2. AI response
            print("⏳ AI o'ylamoqda...")
            reply = await sales_ai_agent.generate_response(
                user_message=user_msg,
                history=history,
                catalog_products=MOCK_PRODUCTS,
            )
            print(f"\n🤖 AI: {reply}")

            history.append({"role": "user", "text": user_msg})
            history.append({"role": "model", "text": reply})

        except KeyboardInterrupt:
            print("\nTest to'xtatildi.")
            break


if __name__ == "__main__":
    asyncio.run(interactive_test())
