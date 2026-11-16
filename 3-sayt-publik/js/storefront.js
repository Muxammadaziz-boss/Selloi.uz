/**
 * Storefront Interactive Controller & Telegram WebApp Integration.
 */

import { fetchProducts, submitOrder } from "./api.js";

class StorefrontApp {
  constructor() {
    this.products = [];
    this.cart = JSON.parse(localStorage.getItem("store_cart") || "[]");
    this.activeCategory = "all";
    this.searchQuery = "";
    this.isTgWebApp = false;

    this.initTelegramWebApp();
    this.bindEvents();
    this.loadCatalog();
  }

  initTelegramWebApp() {
    if (window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      document.body.classList.add("tg-theme");
      this.isTgWebApp = true;

      // Update TG Main Button on cart change
      tg.MainButton.setText("Savatni ochish");
      tg.MainButton.onClick(() => {
        window.location.href = "cart.html";
      });
    }
  }

  updateTgButton() {
    if (this.isTgWebApp && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      const count = this.cart.reduce((sum, item) => sum + item.quantity, 0);
      if (count > 0) {
        const total = this.getCartTotal();
        tg.MainButton.setText(`Savat (${count}) — ${total.toLocaleString()} so'm`);
        tg.MainButton.show();
      } else {
        tg.MainButton.hide();
      }
    }
  }

  saveCart() {
    localStorage.setItem("store_cart", JSON.stringify(this.cart));
    this.renderCartBadge();
    this.updateTgButton();
  }

  renderCartBadge() {
    const badge = document.getElementById("cartBadge");
    if (badge) {
      const count = this.cart.reduce((sum, item) => sum + item.quantity, 0);
      badge.textContent = count;
      badge.style.display = count > 0 ? "flex" : "none";
    }
  }

  getCartTotal() {
    return this.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  async loadCatalog() {
    const grid = document.getElementById("productsGrid");
    if (!grid) return;

    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-secondary);">Mahsulotlar yuklanmoqda...</div>';
    this.products = await fetchProducts();
    this.renderProducts();
    this.renderCartBadge();
    this.updateTgButton();
  }

  renderProducts() {
    const grid = document.getElementById("productsGrid");
    if (!grid) return;

    const filtered = this.products.filter((p) => {
      const matchesCategory = this.activeCategory === "all" || p.category.toLowerCase() === this.activeCategory.toLowerCase();
      const query = this.searchQuery.toLowerCase();
      const matchesSearch = !query || p.title.toLowerCase().includes(query) || (p.description && p.description.toLowerCase().includes(query));
      return matchesCategory && matchesSearch;
    });

    if (filtered.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 50px; color: var(--text-secondary);">Mos mahsulotlar topilmadi.</div>';
      return;
    }

    grid.innerHTML = filtered.map((p) => `
      <div class="product-card" data-id="${p.id}">
        <div class="product-image">
          <img src="${p.image_url || 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600'}" alt="${p.title}" loading="lazy" />
          <span class="stock-tag ${p.stock > 0 ? 'stock-in' : 'stock-out'}">
            ${p.stock > 0 ? `Mavjud (${p.stock} ta)` : 'Tugagan'}
          </span>
        </div>
        <div class="product-details">
          <div class="product-category">${p.category || 'Elektronika'}</div>
          <h3 class="product-title">${p.title}</h3>
          <p class="product-desc">${p.description || ''}</p>
          <div class="product-footer">
            <div class="product-price">${Number(p.price).toLocaleString()} so'm</div>
            <button class="add-cart-btn" data-add="${p.id}" ${p.stock <= 0 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
              + Savatga
            </button>
          </div>
        </div>
      </div>
    `).join("");
  }

  addToCart(productId) {
    const product = this.products.find((p) => p.id === Number(productId));
    if (!product || product.stock <= 0) return;

    const existing = this.cart.find((item) => item.id === product.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      this.cart.push({
        id: product.id,
        title: product.title,
        price: product.price,
        image_url: product.image_url,
        quantity: 1,
      });
    }

    this.saveCart();
    this.showToast(`"${product.title.slice(0, 24)}..." savatga qo'shildi!`);
  }

  showToast(message) {
    const existingToast = document.querySelector(".store-toast");
    if (existingToast) existingToast.remove();

    const toast = document.createElement("div");
    toast.className = "store-toast";
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--bg-card);
      border: 1px solid var(--accent);
      color: #fff;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5);
      z-index: 1000;
      font-size: 0.88rem;
      animation: fadeIn 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2600);
  }

  bindEvents() {
    // Search input
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.searchQuery = e.target.value.trim();
        this.renderProducts();
      });
    }

    // Category pills
    document.addEventListener("click", (e) => {
      const pill = e.target.closest(".category-pill");
      if (pill) {
        document.querySelectorAll(".category-pill").forEach((el) => el.classList.remove("active"));
        pill.classList.add("active");
        this.activeCategory = pill.dataset.category || "all";
        this.renderProducts();
      }

      // Add to cart buttons
      const addBtn = e.target.closest("[data-add]");
      if (addBtn) {
        const id = addBtn.getAttribute("data-add");
        this.addToCart(id);
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.storefront = new StorefrontApp();
});
