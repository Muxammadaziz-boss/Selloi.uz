"""Knowledge Retriever (RAG) for matching customer queries to catalog products."""

from typing import Any, Dict, List
import re


class KnowledgeRetriever:
    """Retrieves relevant products from store catalog based on semantic & keyword matching."""

    def __init__(self, products_cache: List[Dict[str, Any]] | None = None) -> None:
        self.products = products_cache or []

    def update_catalog(self, products: List[Dict[str, Any]]) -> None:
        self.products = products

    def search(self, query: str, limit: int = 4) -> List[Dict[str, Any]]:
        """Search products using weighted token matching."""
        if not query or not self.products:
            return []

        tokens = [t.lower() for t in re.findall(r"\w+", query) if len(t) > 2]
        if not tokens:
            return self.products[:limit]

        scored_products = []
        for p in self.products:
            score = 0
            title = str(p.get("title", "")).lower()
            desc = str(p.get("description", "")).lower()
            category = str(p.get("category", "")).lower()

            for token in tokens:
                if token in title:
                    score += 5
                if token in category:
                    score += 3
                if token in desc:
                    score += 1

            if score > 0:
                scored_products.append((score, p))

        scored_products.sort(key=lambda x: x[0], reverse=True)
        return [p for _, p in scored_products[:limit]]

    def format_context_for_llm(self, relevant_products: List[Dict[str, Any]]) -> str:
        """Format retrieved products into structured context text for prompt injection."""
        if not relevant_products:
            return "Do'konda ushbu so'rov bo'yicha tovar topilmadi."

        lines = ["DO'KON KATALOGIDAGI MOS MAHSULOTLAR:"]
        for idx, p in enumerate(relevant_products, start=1):
            title = p.get("title", "Nomsiz tovar")
            price = p.get("price", 0)
            stock = p.get("stock", 0)
            status = "Mavjud" if stock > 0 else "Tugagan"
            desc = p.get("description", "")[:120]
            lines.append(
                f"{idx}. {title} | Narxi: {price:,} so'm | Holati: {status} ({stock} ta) | Tavsif: {desc}"
            )
        return "\n".join(lines)


knowledge_retriever = KnowledgeRetriever()
