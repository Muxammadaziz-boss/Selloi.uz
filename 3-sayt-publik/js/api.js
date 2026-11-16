/**
 * Public Storefront API Client.
 * Connects to the backend REST API endpoints.
 */

const API_BASE = window.location.origin.includes(":3000") 
  ? "http://127.0.0.1:8000/api/v1" 
  : "/api/v1";

export async function fetchProducts() {
  try {
    const res = await fetch(`${API_BASE}/products`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : (data.items || []);
  } catch (err) {
    console.warn("API dan tovarlar olinmadi, lokal kesh yoki demo ma'lumotlar ishlatilmoqda:", err);
    return getFallbackProducts();
  }
}

export async function submitOrder(orderData) {
  try {
    const res = await fetch(`${API_BASE}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderData),
    });
    return await res.json();
  } catch (err) {
    console.error("Buyurtma yuborishda xatolik:", err);
    throw err;
  }
}

function getFallbackProducts() {
  return [
    {
      id: 1,
      title: "Apple iPhone 15 Pro Max 256GB Natural Titanium",
      category: "Smartfonlar",
      price: 14500000,
      stock: 7,
      description: "Apple A17 Pro kuchli protsessori, titan rom, 48MP professional kamera va 120Hz Super Retina XDR ekran.",
      image_url: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600&auto=format&fit=crop&q=60",
    },
    {
      id: 2,
      title: "Apple MacBook Air 13 M3 16GB / 512GB Space Gray",
      category: "Noutbuklar",
      price: 16200000,
      stock: 4,
      description: "Yengil va ingichka noutbuk, M3 chipli yuqori unumdorlik, 18 soatgacha batareya quvvati.",
      image_url: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&auto=format&fit=crop&q=60",
    },
    {
      id: 3,
      title: "Sony PlayStation 5 Slim 1TB Digital Edition",
      category: "O'yin pristavkalari",
      price: 6800000,
      stock: 8,
      description: "Yangi ixcham korpus, 4K 120Hz o'yinlar, ultra tezkor SSD va DualSense haptik boshqaruv.",
      image_url: "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=600&auto=format&fit=crop&q=60",
    },
    {
      id: 4,
      title: "Apple AirPods Pro 2 (USB-C MagSafe)",
      category: "Aksessuarlar",
      price: 3100000,
      stock: 15,
      description: "2 barobar samarali shovqinni to'sish (ANC), moslashuvchan audio va USB-C zaryadlash qutisi.",
      image_url: "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=600&auto=format&fit=crop&q=60",
    },
    {
      id: 5,
      title: "Samsung Galaxy S24 Ultra 12GB / 512GB Titanium Black",
      category: "Smartfonlar",
      price: 13900000,
      stock: 5,
      description: "Galaxy AI imkoniyatlari, 200MP kamera, o'rnatilgan S-Pen va yorqin Dynamic AMOLED 2X ekran.",
      image_url: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=600&auto=format&fit=crop&q=60",
    },
    {
      id: 6,
      title: "Apple Watch Series 9 45mm Midnight Aluminum",
      category: "Aqlli soatlar",
      price: 4900000,
      stock: 9,
      description: "S9 SiP yangi avlod protsessori, ikki marta teginish jesti (Double Tap) va yorqin doimiy ekran.",
      image_url: "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600&auto=format&fit=crop&q=60",
    },
  ];
}
