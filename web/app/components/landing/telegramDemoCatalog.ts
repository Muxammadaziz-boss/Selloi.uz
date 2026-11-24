import { Language } from "@/app/lib/i18n/types";

export type ComputerCategory = "laptop" | "pc" | "monitor" | "accessory";

export interface TelegramComputerProduct {
  id: number;
  code: string;
  category: ComputerCategory;
  brand: string;
  name: string;
  specs: string;
  priceUzs: number;
  stock: number;
  warrantyMonths: number;
  views: string;
  reactions: {
    fire: number;
    thumbs: number;
  };
  tag?: string;
}

const RAW_LAPTOPS: Array<
  [string, string, string, number, number, number, string?]
> = [
  ["ASUS", "ASUS ROG Strix G16 G614J", "i7-14650HX • RTX 4070 8GB • 16GB DDR5 • 1TB SSD • 16\" 240Hz", 18900000, 5, 24, "TOP"],
  ["Apple", "MacBook Pro 14 M3 Pro", "M3 Pro 11-core • 18GB Unified • 512GB SSD • 14.2\" XDR 120Hz", 24500000, 4, 12, "HIT"],
  ["Apple", "MacBook Air 13 M3", "Apple M3 8-core • 16GB RAM • 512GB SSD • 13.6\" Liquid Retina", 15800000, 9, 12, "NEW"],
  ["Apple", "MacBook Air 15 M3", "Apple M3 • 16GB RAM • 512GB SSD • Midnight • 15.3\" Retina", 17900000, 6, 12],
  ["Lenovo", "Lenovo Legion Pro 5 16IRX9", "i9-14900HX • RTX 4070 8GB • 32GB DDR5 • 1TB SSD • 240Hz", 21200000, 3, 24, "PRO"],
  ["Lenovo", "Lenovo Legion Slim 5 16", "Ryzen 7 8845HS • RTX 4060 8GB • 16GB DDR5 • 1TB SSD • 165Hz", 15400000, 7, 12],
  ["Lenovo", "Lenovo LOQ 15IAX9", "i5-12450HX • RTX 4050 6GB • 16GB DDR5 • 512GB SSD • 144Hz", 9850000, 12, 12, "HIT"],
  ["HP", "HP Victus 16-r1000", "i7-14700HX • RTX 4060 8GB • 16GB DDR5 • 1TB SSD • 165Hz", 13600000, 8, 12],
  ["HP", "HP Victus 15-fb", "Ryzen 5 7535HS • RTX 2050 4GB • 16GB RAM • 512GB SSD • 144Hz", 8400000, 11, 12],
  ["HP", "HP Omen 16-wf", "i7-13700HX • RTX 4070 8GB • 32GB DDR5 • 1TB SSD • QHD 240Hz", 19400000, 4, 24],
  ["ASUS", "ASUS TUF Gaming A15", "Ryzen 7 7735HS • RTX 4060 8GB • 16GB DDR5 • 512GB SSD • 144Hz", 12900000, 9, 12, "TOP"],
  ["ASUS", "ASUS TUF Gaming F15", "i7-13620H • RTX 4050 6GB • 16GB RAM • 512GB SSD • 144Hz", 11400000, 10, 12],
  ["ASUS", "ASUS ROG Zephyrus G16 OLED", "Core Ultra 9 185H • RTX 4080 12GB • 32GB • 1TB • OLED 240Hz", 31500000, 2, 24, "ULTRA"],
  ["ASUS", "ASUS Zenbook 14 OLED", "Core Ultra 7 155H • 16GB LPDDR5X • 1TB SSD • 3K OLED 120Hz", 14200000, 6, 12],
  ["ASUS", "ASUS Vivobook 16X", "i5-13500H • RTX 3050 4GB • 16GB RAM • 512GB SSD • 16\" IPS", 9200000, 14, 12],
  ["Acer", "Acer Nitro V 15", "i5-13420H • RTX 4050 6GB • 16GB DDR5 • 512GB SSD • 144Hz", 9600000, 13, 12, "TOP"],
  ["Acer", "Acer Predator Helios Neo 16", "i7-14700HX • RTX 4070 8GB • 16GB DDR5 • 1TB SSD • 165Hz", 18300000, 5, 24],
  ["Acer", "Acer Aspire 5 A515", "i5-1335U • 16GB DDR4 • 512GB NVMe • 15.6\" FHD IPS", 6350000, 18, 12],
  ["Acer", "Acer Swift Go 14 OLED", "Core Ultra 5 125H • 16GB • 512GB SSD • 2.8K OLED 90Hz", 10900000, 7, 12],
  ["MSI", "MSI Katana 15 B13V", "i7-13620H • RTX 4060 8GB • 16GB DDR5 • 1TB SSD • 144Hz", 13800000, 6, 12],
  ["MSI", "MSI Thin 15 B12U", "i5-12450H • RTX 3050 4GB • 16GB • 512GB SSD • 144Hz", 8150000, 15, 12],
  ["MSI", "MSI Raider GE78 HX", "i9-14900HX • RTX 4090 16GB • 64GB DDR5 • 2TB SSD • 240Hz", 42900000, 2, 24, "FLAGSHIP"],
  ["MSI", "MSI Cyborg 15 A13V", "i5-13420H • RTX 4050 6GB • 16GB DDR5 • 512GB SSD • 144Hz", 9950000, 9, 12],
  ["Dell", "Dell XPS 14 9440 OLED", "Core Ultra 7 155H • RTX 4050 • 32GB • 1TB • 3.2K OLED Touch", 25800000, 3, 24],
  ["Dell", "Dell Inspiron 15 3530", "i5-1335U • 16GB RAM • 512GB SSD • 15.6\" FHD 120Hz", 6600000, 16, 12],
  ["Dell", "Dell Latitude 5540 Pro", "i7-1365U vPro • 16GB DDR5 • 512GB NVMe • Corporate Slate", 12400000, 8, 24],
  ["Lenovo", "ThinkPad X1 Carbon Gen 12", "Core Ultra 7 155U • 32GB LPDDR5X • 1TB SSD • 14\" 2.8K OLED", 23600000, 4, 24, "BIZNES"],
  ["Lenovo", "Lenovo IdeaPad Slim 5 16", "Ryzen 7 7730U • 16GB RAM • 512GB SSD • 16\" WUXGA IPS", 7450000, 12, 12],
  ["Lenovo", "Lenovo IdeaPad Slim 3 15", "i3-1315U • 8GB RAM • 512GB SSD • 15.6\" FHD Anti-Glare", 4850000, 22, 12],
  ["HP", "HP Envy x360 14 OLED", "Ryzen 7 8840HS • 16GB • 1TB SSD • 2.8K OLED Touch 360", 13900000, 5, 12],
  ["HP", "HP Pavilion 15-eg", "i5-1335U • 16GB RAM • 512GB NVMe • 15.6\" FHD IPS", 6950000, 14, 12],
  ["HP", "HP 250 G10 Office", "i5-1334U • 8GB RAM • 512GB SSD • 15.6\" FHD", 5400000, 20, 12],
  ["Gigabyte", "Gigabyte AORUS 16X", "i7-14650HX • RTX 4070 8GB • 16GB DDR5 • 1TB SSD • 165Hz", 18100000, 4, 24],
  ["Huawei", "Huawei MateBook D 16 2024", "i5-13420H • 16GB RAM • 1TB NVMe • 16\" FullView Gray", 8800000, 9, 12],
  ["Apple", "MacBook Pro 16 M3 Max", "M3 Max 16-core • 48GB Unified • 1TB SSD • Space Black", 44200000, 2, 12, "STUDIO"],
];

const RAW_PCS: Array<
  [string, string, string, number, number, number, string?]
> = [
  ["TechZone", "TechZone Apex RTX 4090", "i9-14900K • RTX 4090 24GB • 64GB DDR5 • 2TB Gen5 • 360mm AIO", 51800000, 2, 36, "ULTRA"],
  ["TechZone", "TechZone Titan 4080 Super", "Ryzen 9 7950X3D • RTX 4080 Super • 64GB DDR5 • 2TB NVMe", 36900000, 3, 36, "PRO"],
  ["TechZone", "TechZone CyberForge 4070 Ti", "Ryzen 7 7800X3D • RTX 4070 Ti Super • 32GB DDR5 • 1TB SSD", 24600000, 5, 24, "HIT"],
  ["TechZone", "TechZone Valkyrie 4070", "i7-14700K • RTX 4070 12GB • 32GB DDR5 • 1TB Gen4 • Z790", 20400000, 6, 24],
  ["TechZone", "TechZone Phantom RTX 4060 Ti", "i5-14600KF • RTX 4060 Ti 16GB • 32GB DDR5 • 1TB SSD", 15900000, 8, 24, "TOP"],
  ["TechZone", "TechZone Pulse RTX 4060", "i5-14400F • RTX 4060 8GB • 16GB DDR5 • 1TB NVMe", 11800000, 12, 24, "HIT"],
  ["TechZone", "TechZone Ryzen Strike 7700XT", "Ryzen 5 7600X • RX 7700 XT 12GB • 32GB DDR5 • 1TB SSD", 14700000, 6, 24],
  ["TechZone", "TechZone Aurora White Edition", "i7-14700KF • RTX 4070 Super White • 32GB RGB • 1TB SSD", 22300000, 4, 24, "WHITE"],
  ["TechZone", "TechZone Starter RTX 3060", "i5-12400F • RTX 3060 12GB • 16GB DDR4 • 512GB NVMe", 8950000, 15, 24],
  ["TechZone", "TechZone Budget Esports 1660S", "i3-13100F • GTX 1660 Super • 16GB DDR4 • 512GB SSD", 6750000, 19, 12],
  ["TechZone", "TechZone Render Studio 64", "Ryzen 9 7900X • RTX 4070 Ti • 64GB DDR5 • 2TB + 4TB HDD", 27400000, 3, 36],
  ["TechZone", "TechZone Blender & Unreal Node", "i9-14900KS • RTX 4090 24GB • 128GB DDR5 • 4TB RAID NVMe", 58500000, 1, 36],
  ["TechZone", "TechZone AI Inference Box", "Threadripper 7960X • 2x RTX 4090 • 128GB ECC • 4TB Gen5", 94000000, 1, 36, "AI LAB"],
  ["TechZone", "TechZone Compact ITX Terra", "Ryzen 7 7800X3D • RTX 4070 Super • 32GB • 2TB SSD • Mini-ITX", 23100000, 3, 24],
  ["TechZone", "TechZone CS2 Pro 360FPS", "Ryzen 7 7800X3D • RTX 4060 Ti • 32GB DDR5 6000MHz • 1TB", 17400000, 7, 24],
  ["TechZone", "TechZone Streamer Dual-Cam", "i7-14700F • RTX 4070 • 32GB DDR5 • Elgato Ready • 2TB SSD", 20900000, 4, 24],
  ["Apple", "Apple Mac Studio M2 Max", "M2 Max 12-core • 32GB Unified • 512GB SSD • 10Gb Ethernet", 27900000, 3, 12],
  ["Apple", "Apple Mac mini M2 Pro", "M2 Pro 10-core • 16GB • 512GB SSD • Thunderbolt 4", 16200000, 6, 12],
  ["TechZone", "TechZone Office Pro i5", "i5-13400 • UHD 730 • 16GB DDR4 • 512GB NVMe • Silent Case", 5450000, 21, 12],
  ["TechZone", "TechZone Office Lite i3", "i3-12100 • 8GB DDR4 • 256GB NVMe • Compact MicroATX", 3950000, 25, 12],
  ["TechZone", "TechZone Accounting Dual-SSD", "i5-14400 • 32GB DDR4 • 1TB NVMe • 500W Bronze PSU", 6850000, 14, 12],
  ["TechZone", "TechZone 1440p Ultra Build", "Ryzen 5 7500F • RTX 4070 12GB • 32GB DDR5 • 1TB SSD", 16400000, 8, 24],
  ["TechZone", "TechZone Frost Glass 4070S", "i7-13700KF • RTX 4070 Super • 32GB RGB • LCD Liquid Cooler", 23800000, 4, 24],
  ["ASUS", "ASUS ROG NUC 970 Mini PC", "Core Ultra 9 185H • RTX 4070 • 32GB DDR5 • 1TB SSD • 2.5L", 28200000, 2, 24],
  ["TechZone", "TechZone CyberCafe Pack Edition", "i5-13400F • RTX 4060 • 16GB DDR5 • 1TB SSD • Mesh Airflow", 11200000, 18, 24],
];

const RAW_MONITORS: Array<
  [string, string, string, number, number, number, string?]
> = [
  ["LG", "LG UltraGear 27GS95QE OLED", "27\" QHD OLED • 240Hz • 0.03ms • HDMI 2.1 • Anti-Glare", 11400000, 5, 24, "OLED"],
  ["Samsung", "Samsung Odyssey G7 G70B", "28\" 4K UHD IPS • 144Hz • 1ms • Smart Tizen • DisplayHDR 400", 6950000, 8, 12],
  ["Samsung", "Samsung Odyssey OLED G8", "34\" Ultrawide QD-OLED • 175Hz • 0.03ms • USB-C 65W", 14200000, 4, 24, "OLED"],
  ["Samsung", "Samsung Odyssey OLED G9", "49\" Dual QHD DQHD • 240Hz • 0.03ms • Neo Quantum Pro", 19800000, 2, 24, "FLAGSHIP"],
  ["ASUS", "ASUS ROG Swift PG27AQDM", "27\" 1440p OLED • 240Hz • 0.03ms • Custom Heatsink", 12100000, 4, 24],
  ["ASUS", "ASUS TUF Gaming VG27AQ3A", "27\" QHD Fast IPS • 180Hz • 1ms • G-Sync Compatible", 3650000, 14, 24, "TOP"],
  ["ASUS", "ASUS TUF Gaming VG249Q3A", "23.8\" FHD Fast IPS • 180Hz • 1ms • FreeSync Premium", 2350000, 19, 12],
  ["ASUS", "ASUS ProArt PA279CRV", "27\" 4K UHD IPS • 99% DCI-P3 • USB-C 96W • Calman Verified", 6450000, 6, 24, "DESIGN"],
  ["BenQ", "BenQ ZOWIE XL2566K", "24.5\" FHD TN DyAc+ • 360Hz • Esports Tournament Spec", 7900000, 5, 24, "ESPORTS"],
  ["MSI", "MSI MAG 274QRF QD E2", "27\" QHD Quantum Dot IPS • 180Hz • 1ms • KVM Switch", 4450000, 9, 24],
  ["MSI", "MSI G274F Gaming", "27\" FHD Rapid IPS • 180Hz • 1ms • 134% sRGB", 2650000, 16, 12],
  ["Dell", "Dell UltraSharp U2723QE", "27\" 4K IPS Black • 2000:1 • USB-C 90W Hub • Daisy Chain", 7600000, 7, 36, "PRO"],
  ["Dell", "Dell Alienware AW2725DF", "27\" QHD QD-OLED • 360Hz • 0.03ms • TrueBlack 400", 12900000, 3, 36],
  ["Xiaomi", "Xiaomi Curved G34WQi", "34\" WQHD 1500R • 180Hz • 1ms • 95% DCI-P3", 4150000, 12, 12, "HIT"],
  ["Xiaomi", "Xiaomi Monitor A27i", "27\" FHD IPS • 100Hz • HDR10 • Narrow Bezels • 99% sRGB", 1790000, 24, 12],
  ["Gigabyte", "Gigabyte M27Q X", "27\" QHD SS IPS • 240Hz • 1ms • Built-in KVM Switch", 5250000, 8, 24],
  ["AOC", "AOC 24G4X Gaming", "23.8\" FHD Fast IPS • 180Hz • 0.5ms MPRT • Pivot Stand", 2150000, 17, 12],
  ["LG", "LG UltraWide 34WR55QC", "34\" WQHD Curved • 100Hz • USB-C 65W • PBP Multitask", 4850000, 7, 12],
  ["Lenovo", "Lenovo Legion R27q-30", "27\" QHD IPS • 180Hz • 0.5ms • DisplayHDR 400", 3550000, 11, 24],
  ["Apple", "Apple Studio Display 27", "27\" 5K Retina 600 nits • A13 Bionic • 12MP Camera • Glass", 22400000, 2, 12],
];

const RAW_ACCESSORIES: Array<
  [string, string, string, number, number, number, string?]
> = [
  ["Logitech", "Logitech G Pro X Superlight 2", "HERO 2 32K DPI • 60g Ultra-Light • LIGHTFORCE • USB-C", 1850000, 18, 24, "TOP"],
  ["Logitech", "Logitech MX Master 3S", "8000 DPI Darkfield • Quiet Click • MagSpeed • Multi-Device", 1290000, 22, 12, "HIT"],
  ["Keychron", "Keychron Q1 Pro QMK/VIA", "Aluminum CNC 75% • Wireless • Hot-Swap • Gateron Banana", 2490000, 9, 12, "PRO"],
  ["Keychron", "Keychron K2 Pro RGB", "75% Mechanical • Bluetooth 5.1 + USB-C • PBT Keycaps", 1420000, 14, 12],
  ["Razer", "Razer BlackWidow V4 Pro", "Green/Yellow Switches • Command Dial • Magnetic Wrist Rest", 2750000, 6, 24],
  ["Razer", "Razer Viper V3 Pro", "54g Symmetrical • Focus Pro 35K Gen-2 • 8KHz Dongle Included", 1980000, 11, 24],
  ["HyperX", "HyperX Cloud III Wireless", "DTS Headphone:X • 120h Battery • 53mm Angled Drivers", 1890000, 13, 24],
  ["SteelSeries", "SteelSeries Arctis Nova Pro", "Wireless Active Noise Cancelling • Dual Battery Hot-Swap", 4250000, 5, 24],
  ["Sony", "Sony WH-1000XM5 Matte Black", "8-Mic ANC • 30h Battery • LDAC • Multipoint Bluetooth", 4100000, 10, 12],
  ["Samsung", "Samsung 990 PRO 2TB NVMe", "PCIe 4.0 x4 • 7450MB/s Read • Smart Thermal Controller", 2390000, 20, 36, "SSD"],
  ["Kingston", "Kingston FURY Beast 32GB DDR5", "2x16GB Kit • 6000MT/s CL30 • Intel XMP 3.0 & AMD EXPO", 1590000, 17, 36],
  ["ASUS", "ASUS ROG Azoth 75% Custom", "OLED Status Display • Gasket Mount • Pre-Lubed NX Red", 3150000, 6, 24],
  ["Elgato", "Elgato Stream Deck MK.2", "15 Customizable LCD Keys • Macro Automation • USB-C", 2050000, 8, 24],
  ["Wacom", "Wacom Intuos Pro Medium", "8192 Pressure Levels • Pro Pen 2 • Bluetooth Graphics Pad", 4650000, 4, 24],
  ["TP-Link", "TP-Link Archer AXE75 Wi-Fi 6E", "Tri-Band AXE5400 • 6GHz Band • 1.7GHz Quad-Core", 1950000, 11, 24],
  ["APC", "APC Back-UPS 1200VA AVR", "650W Output • 4 Schuko Outlets • Automatic Voltage Reg", 2150000, 9, 24],
  ["Cooler Master", "Cooler Master V850 Gold V2", "850W Full Modular • 80 PLUS Gold • ATX 3.0 12VHPWR", 1890000, 12, 36],
  ["Noctua", "Noctua NH-D15 chromax.black", "Dual Tower CPU Cooler • Twin NF-A15 PWM Fans • AM5/LGA1700", 1450000, 8, 36],
  ["Fifine", "Fifine AM8 XLR/USB Studio Mic", "Dynamic Cardioid • RGB Mute • Headphone Monitor Jack", 790000, 23, 12],
  ["Logitech", "Logitech Brio 4K Stream", "Ultra HD 4K 30fps / 1080p 60fps • HDR • Windows Hello", 2290000, 7, 24],
];

function buildCatalog(): TelegramComputerProduct[] {
  const all: Array<{
    category: ComputerCategory;
    rows: Array<[string, string, string, number, number, number, string?]>;
  }> = [
    { category: "laptop", rows: RAW_LAPTOPS },
    { category: "pc", rows: RAW_PCS },
    { category: "monitor", rows: RAW_MONITORS },
    { category: "accessory", rows: RAW_ACCESSORIES },
  ];

  const catalog: TelegramComputerProduct[] = [];
  let seq = 1;

  for (const group of all) {
    for (const [brand, name, specs, priceUzs, stock, warrantyMonths, tag] of group.rows) {
      const padded = String(seq).padStart(3, "0");
      const viewNumeric = (1.1 + ((seq * 17) % 38) / 10).toFixed(1);
      catalog.push({
        id: seq,
        code: `TZ-${padded}`,
        category: group.category,
        brand,
        name,
        specs,
        priceUzs,
        stock,
        warrantyMonths,
        views: `${viewNumeric}K`,
        reactions: {
          fire: 14 + ((seq * 7) % 58),
          thumbs: 8 + ((seq * 5) % 34),
        },
        tag,
      });
      seq++;
    }
  }

  return catalog;
}

export const TELEGRAM_COMPUTER_CATALOG: TelegramComputerProduct[] = buildCatalog();

export function formatUzs(amount: number, lang: Language): string {
  const spaced = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  if (lang === "ru") return `${spaced} сум`;
  if (lang === "en") return `${spaced} UZS`;
  return `${spaced} so‘m`;
}

function extractBudgetUzs(query: string): number | null {
  const mMillion = query.match(/(\d+(?:[.,]\d+)?)\s*(?:mln|million|млн|m\b)/i);
  if (mMillion) {
    return Math.round(parseFloat(mMillion[1].replace(",", ".")) * 1_000_000);
  }
  const mDollar = query.match(/\$\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(?:usd|dollar|\$)/i);
  if (mDollar) {
    const val = parseFloat((mDollar[1] || mDollar[2]).replace(",", "."));
    return Math.round(val * 12_800);
  }
  return null;
}

function detectCategoryFilter(q: string): ComputerCategory | null {
  if (/(noutbuk|laptop|macbook|ноутбук|ultrabook|zenbook|legion|victus|nitro|vivobook|thinkpad|ideapad|rog strix|zephyrus)/i.test(q)) {
    return "laptop";
  }
  if (/(kompyuter|kompiyuter|sborka|desktop|system|blok|pc\b|компьютер|сборка|системник|workstation|cyberforge)/i.test(q)) {
    return "pc";
  }
  if (/(monitor|ekran|oled|hz\b|curved|монитор|экран|дисплей|ultragear|odyssey)/i.test(q)) {
    return "monitor";
  }
  if (/(klaviatura|sichqoncha|mouse|keyboard|naushnik|headset|ssd|nvme|ram|ddr5|mikrofon|ups|клавиатур|мыш|наушник|аксессуар|accessor|logitech|keychron|razer|hyperx)/i.test(q)) {
    return "accessory";
  }
  return null;
}

export function matchCatalogProducts(
  query: string,
  catalog: TelegramComputerProduct[] = TELEGRAM_COMPUTER_CATALOG
): {
  matches: TelegramComputerProduct[];
  budgetUzs: number | null;
  category: ComputerCategory | null;
} {
  const q = query.trim().toLowerCase();
  const budgetUzs = extractBudgetUzs(q);
  const category = detectCategoryFilter(q);

  const tokens = q
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .filter(
      (tok) =>
        tok.length >= 2 &&
        !/^(va|yoki|bormi|qancha|necha|gacha|uchun|narxi|meng|menga|kerak|olaman|buyurtma|mln|million|млн|до|для|есть|цена|сколько|with|for|the|and|how|much|price)$/i.test(
          tok
        )
    );

  const scored = catalog.map((item) => {
    const hay = `${item.code} ${item.brand} ${item.name} ${item.specs} ${item.category}`.toLowerCase();
    let score = 0;

    if (category && item.category === category) score += 8;
    for (const tok of tokens) {
      if (hay.includes(tok)) {
        score += tok.length >= 4 ? 7 : 4;
      }
    }
    if (/(oyin|o'yin|gaming|game|игр|гейм)/i.test(q) && /(rtx|rx |hz|odyssey|ultragear|superlight|legion|rog|tuf|victus|nitro)/i.test(hay)) {
      score += 5;
    }
    if (/(ofis|office|ish|o'qish|talaba|офис|учеб|работ|arzon|budjet|бюджет|cheap|budget)/i.test(q)) {
      if (item.priceUzs <= 8_500_000) score += 7;
    }
    if (budgetUzs !== null) {
      if (item.priceUzs <= budgetUzs) {
        score += 9;
        // Prefer strong value closest to user budget
        score += Math.round((item.priceUzs / budgetUzs) * 4);
      } else {
        score -= 10;
      }
    }

    return { item, score };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.item.id - b.item.id;
  });

  const positive = scored.filter((s) => s.score > 0).map((s) => s.item);
  if (positive.length > 0) {
    return {
      matches: positive.slice(0, 3),
      budgetUzs,
      category,
    };
  }

  return {
    matches: [catalog[0], catalog[1], catalog[35]],
    budgetUzs,
    category,
  };
}
