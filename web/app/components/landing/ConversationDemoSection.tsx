"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Language } from "@/app/lib/i18n/types";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface Product {
  id: string;
  cat: string;
  name: string;
  specs: string;
  price: number;
  stock: number;
  warranty: string;
  msgId?: number; // real Telegram message ID after posting
}

interface ChatMessage {
  id: number;
  from: "user" | "bot";
  text: string;
  ts: string;
  quoted?: { name: string; text: string };
}

type Tab = "chat" | "channel";
type ChannelFilter = "all" | "laptop" | "pc" | "monitor" | "accessory";

// ─────────────────────────────────────────────
// CATALOG — 100 products (mirrors post_channel_products.py)
// ─────────────────────────────────────────────
const CATALOG: Product[] = [
  // LAPTOPS
  { id:"TZ-001", cat:"💻", name:"ASUS ROG Strix G16 2024", specs:"i9-14900HX | RTX 4080 | 32GB DDR5 | 1TB | 240Hz QHD", price:25_900_000, stock:3, warranty:"2 yil" },
  { id:"TZ-002", cat:"💻", name:"Apple MacBook Pro 16\" M4 Max", specs:"M4 Max | 48GB RAM | 1TB SSD | Liquid Retina XDR | 22hr", price:34_500_000, stock:2, warranty:"1 yil" },
  { id:"TZ-003", cat:"💻", name:"Lenovo Legion Pro 7i Gen 9", specs:"i9-14900HX | RTX 4080 | 32GB DDR5 | 2TB | 240Hz", price:23_200_000, stock:4, warranty:"2 yil" },
  { id:"TZ-004", cat:"💻", name:"HP Omen 16 2024", specs:"Ryzen 9 7945HX | RTX 4070 | 32GB DDR5 | 1TB | 165Hz", price:18_700_000, stock:5, warranty:"2 yil" },
  { id:"TZ-005", cat:"💻", name:"Apple MacBook Air 15\" M3", specs:"M3 | 16GB | 512GB SSD | 15.3\" Liquid Retina | 18hr", price:19_800_000, stock:6, warranty:"1 yil" },
  { id:"TZ-006", cat:"💻", name:"ASUS TUF Gaming A16 2024", specs:"Ryzen 9 7945HX | RTX 4070 Ti | 32GB DDR5 | 1TB | 165Hz", price:17_400_000, stock:7, warranty:"2 yil" },
  { id:"TZ-007", cat:"💻", name:"Dell XPS 15 9530", specs:"i9-13900H | RTX 4070 | 32GB | 1TB | OLED 3.5K", price:22_100_000, stock:3, warranty:"2 yil" },
  { id:"TZ-008", cat:"💻", name:"MSI Titan GT77 HX", specs:"i9-13980HX | RTX 4090 | 64GB DDR5 | 4TB | 4K 144Hz", price:38_900_000, stock:1, warranty:"2 yil" },
  { id:"TZ-009", cat:"💻", name:"Lenovo ThinkPad X1 Carbon Gen 12", specs:"Core Ultra 7 | 32GB LPDDR5 | 1TB | 2.8K OLED", price:21_300_000, stock:4, warranty:"3 yil" },
  { id:"TZ-010", cat:"💻", name:"Acer Predator Helios 16 2024", specs:"i9-14900HX | RTX 4080 | 32GB DDR5 | 2TB | 240Hz Mini-LED", price:24_500_000, stock:3, warranty:"2 yil" },
  { id:"TZ-011", cat:"💻", name:"ASUS ROG Zephyrus G14 2024", specs:"Ryzen 9 8945HS | RTX 4070 | 32GB LPDDR5 | 1TB | 3K OLED", price:20_800_000, stock:5, warranty:"2 yil" },
  { id:"TZ-012", cat:"💻", name:"HP Spectre x360 14", specs:"Core Ultra 7 | 32GB | 1TB | 3K 2-in-1 OLED", price:18_200_000, stock:4, warranty:"2 yil" },
  { id:"TZ-013", cat:"💻", name:"Lenovo LOQ 15 Gen 3", specs:"Ryzen 7 8745H | RTX 4060 | 16GB DDR5 | 512GB | 144Hz", price:12_900_000, stock:8, warranty:"2 yil" },
  { id:"TZ-014", cat:"💻", name:"Acer Nitro 17 AN17-71", specs:"i7-14700HX | RTX 4060 | 16GB DDR5 | 512GB | 165Hz", price:13_600_000, stock:6, warranty:"2 yil" },
  { id:"TZ-015", cat:"💻", name:"ASUS VivoBook Pro 16X OLED", specs:"i9-13980HX | RTX 4060 | 32GB DDR5 | 1TB | 3.2K OLED", price:16_800_000, stock:4, warranty:"2 yil" },
  { id:"TZ-016", cat:"💻", name:"Apple MacBook Pro 14\" M4 Pro", specs:"M4 Pro | 24GB | 512GB SSD | Liquid Retina XDR | 17hr", price:26_700_000, stock:3, warranty:"1 yil" },
  { id:"TZ-017", cat:"💻", name:"Razer Blade 16 2024", specs:"i9-14900HX | RTX 4090 | 32GB DDR5 | 2TB | OLED 4K", price:36_200_000, stock:2, warranty:"1 yil" },
  { id:"TZ-018", cat:"💻", name:"Lenovo Legion Slim 5i Gen 9", specs:"i7-14650HX | RTX 4060 | 16GB DDR5 | 1TB | 165Hz", price:14_300_000, stock:7, warranty:"2 yil" },
  { id:"TZ-019", cat:"💻", name:"HP Victus 15 2024", specs:"Ryzen 7 7745HX | RTX 4060 | 16GB DDR5 | 512GB | 144Hz", price:11_800_000, stock:10, warranty:"1 yil" },
  { id:"TZ-020", cat:"💻", name:"ASUS ROG Flow X13 2024", specs:"Ryzen 9 8945HS | RTX 4060 | 32GB LPDDR5 | 1TB | 165Hz 2-in-1", price:19_400_000, stock:3, warranty:"2 yil" },
  { id:"TZ-021", cat:"💻", name:"Dell Inspiron 16 Plus 7640", specs:"Core Ultra 7 | 32GB | 1TB | 2K 120Hz", price:14_900_000, stock:5, warranty:"1 yil" },
  { id:"TZ-022", cat:"💻", name:"Gigabyte AORUS 17X 2024", specs:"i9-14900HX | RTX 4080 | 32GB DDR5 | 2TB | 240Hz Mini-LED", price:27_300_000, stock:2, warranty:"2 yil" },
  { id:"TZ-023", cat:"💻", name:"Microsoft Surface Laptop 6", specs:"Core Ultra 5 | 16GB | 512GB | 13.5\" PixelSense", price:16_100_000, stock:4, warranty:"1 yil" },
  { id:"TZ-024", cat:"💻", name:"Acer Swift X 14 2024", specs:"Ryzen 7 8845HS | RTX 4070 | 32GB LPDDR5 | 1TB | 2.8K OLED", price:17_600_000, stock:5, warranty:"2 yil" },
  { id:"TZ-025", cat:"💻", name:"ASUS TUF Gaming F15 2024", specs:"i7-13620H | RTX 4060 | 16GB DDR4 | 512GB | 144Hz", price:10_900_000, stock:9, warranty:"2 yil" },
  { id:"TZ-026", cat:"💻", name:"HP EliteBook 840 G11", specs:"Core Ultra 7 | 32GB LPDDR5 | 1TB | 1400p", price:19_200_000, stock:4, warranty:"3 yil" },
  { id:"TZ-027", cat:"💻", name:"Lenovo IdeaPad Gaming 3 Gen 8", specs:"Ryzen 7 7745H | RTX 4060 | 16GB DDR5 | 512GB | 165Hz", price:11_400_000, stock:8, warranty:"1 yil" },
  { id:"TZ-028", cat:"💻", name:"MSI Stealth 16 AI Studio", specs:"Core Ultra 9 | RTX 4080 | 32GB DDR5 | 2TB | 4K OLED", price:32_800_000, stock:2, warranty:"2 yil" },
  { id:"TZ-029", cat:"💻", name:"Apple MacBook Air 13\" M3", specs:"M3 | 8GB | 256GB SSD | 13.6\" Liquid Retina | 18hr", price:14_900_000, stock:7, warranty:"1 yil" },
  { id:"TZ-030", cat:"💻", name:"ASUS ROG Strix SCAR 17 2024", specs:"Ryzen 9 8945HX | RTX 4090 | 64GB DDR5 | 4TB | 240Hz QHD", price:42_000_000, stock:1, warranty:"2 yil" },
  { id:"TZ-031", cat:"💻", name:"Lenovo ThinkPad E16 Gen 2", specs:"Core Ultra 5 | 16GB DDR5 | 512GB | 1920x1200", price:10_200_000, stock:6, warranty:"1 yil" },
  { id:"TZ-032", cat:"💻", name:"HP Omen Transcend 14", specs:"Core Ultra 7 | RTX 4060 | 32GB LPDDR5 | 2TB | 2.8K OLED", price:20_400_000, stock:3, warranty:"2 yil" },
  { id:"TZ-033", cat:"💻", name:"Acer Aspire 5 A515-58M", specs:"i7-13620H | Intel Iris Xe | 16GB DDR5 | 512GB | 1080p", price:8_600_000, stock:12, warranty:"1 yil" },
  { id:"TZ-034", cat:"💻", name:"ASUS ZenBook Pro Duo 14 OLED", specs:"i9-13900H | RTX 4070 | 32GB | 1TB | Dual Screen OLED", price:23_800_000, stock:2, warranty:"2 yil" },
  { id:"TZ-035", cat:"💻", name:"Gigabyte G6X 9KG", specs:"i7-13650HX | RTX 4060 | 16GB DDR5 | 512GB | 165Hz", price:13_200_000, stock:5, warranty:"1 yil" },
  { id:"TZ-036", cat:"💻", name:"Lenovo Legion Pro 5i Gen 9", specs:"i7-14700HX | RTX 4070 Ti | 32GB DDR5 | 1TB | 165Hz", price:19_900_000, stock:4, warranty:"2 yil" },
  { id:"TZ-037", cat:"💻", name:"MSI Katana 17 B13V", specs:"i7-13620H | RTX 4070 | 16GB DDR5 | 1TB | 144Hz", price:14_800_000, stock:6, warranty:"2 yil" },
  { id:"TZ-038", cat:"💻", name:"Acer Predator Triton Neo 16", specs:"Core Ultra 9 | RTX 4070 | 32GB LPDDR5 | 1TB | 3.2K 165Hz", price:22_700_000, stock:3, warranty:"2 yil" },
  { id:"TZ-039", cat:"💻", name:"HP Pavilion Gaming 15 2024", specs:"Ryzen 7 7745H | RTX 4060 | 16GB DDR5 | 512GB | 144Hz", price:10_600_000, stock:8, warranty:"1 yil" },
  { id:"TZ-040", cat:"💻", name:"ASUS ROG Strix G18 2024", specs:"i9-14900HX | RTX 4090 | 32GB DDR5 | 2TB | 240Hz QHD", price:33_500_000, stock:2, warranty:"2 yil" },
  { id:"TZ-041", cat:"💻", name:"Dell G16 7630 Gaming", specs:"i7-13650HX | RTX 4070 | 16GB DDR5 | 1TB | 165Hz", price:15_700_000, stock:5, warranty:"1 yil" },
  { id:"TZ-042", cat:"💻", name:"Lenovo Yoga Pro 9i Gen 9", specs:"Core Ultra 9 | RTX 4070 | 32GB LPDDR5 | 2TB | 3.2K Mini-LED", price:25_100_000, stock:3, warranty:"2 yil" },
  { id:"TZ-043", cat:"💻", name:"MSI Vector GP78 HX", specs:"i9-14900HX | RTX 4090 | 64GB DDR5 | 4TB | 300Hz QHD", price:40_200_000, stock:1, warranty:"2 yil" },
  { id:"TZ-044", cat:"💻", name:"Acer Nitro 5 AN515-58", specs:"i7-12700H | RTX 3060 | 16GB DDR4 | 512GB | 144Hz", price:9_800_000, stock:10, warranty:"1 yil" },
  { id:"TZ-045", cat:"💻", name:"Apple MacBook Pro 16\" M4 Pro", specs:"M4 Pro | 24GB | 512GB SSD | Liquid Retina XDR | 24hr", price:30_200_000, stock:2, warranty:"1 yil" },
  { id:"TZ-046", cat:"💻", name:"Razer Blade 15 2024", specs:"i9-14900HX | RTX 4080 | 32GB DDR5 | 1TB | QHD 240Hz", price:31_400_000, stock:2, warranty:"1 yil" },
  { id:"TZ-047", cat:"💻", name:"Lenovo LOQ 16 Gen 2", specs:"i5-13420H | RTX 4060 | 16GB DDR5 | 512GB | 165Hz", price:11_200_000, stock:7, warranty:"2 yil" },
  { id:"TZ-048", cat:"💻", name:"HP Dragonfly G4", specs:"i7-1365U | Intel Iris Xe | 32GB LPDDR5 | 1TB | 2.5K IPS", price:17_900_000, stock:4, warranty:"3 yil" },
  { id:"TZ-049", cat:"💻", name:"ASUS TUF Gaming F17 2024", specs:"Ryzen 7 7745H | RTX 4070 | 16GB DDR5 | 512GB | 165Hz", price:13_900_000, stock:6, warranty:"2 yil" },
  { id:"TZ-050", cat:"💻", name:"Gigabyte AERO 16 OLED 2024", specs:"i9-13980HX | RTX 4070 | 32GB DDR5 | 2TB | 4K OLED", price:28_600_000, stock:2, warranty:"2 yil" },
  // PCs
  { id:"TZ-051", cat:"🖥️", name:"Apex RTX 4090 Ultra Gaming", specs:"i9-14900K | RTX 4090 24GB | 64GB DDR5 | 4TB Gen5 | 1200W Platinum", price:48_000_000, stock:1, warranty:"3 yil" },
  { id:"TZ-052", cat:"🖥️", name:"TechZone RTX 4080 Super Pro", specs:"Ryzen 9 7950X3D | RTX 4080 Super | 64GB DDR5 | 2TB | 850W Gold", price:36_500_000, stock:2, warranty:"3 yil" },
  { id:"TZ-053", cat:"🖥️", name:"Selloi RTX 4070 Ti Super Build", specs:"i7-14700K | RTX 4070 Ti Super | 32GB DDR5 | 2TB | 750W Gold", price:26_800_000, stock:3, warranty:"2 yil" },
  { id:"TZ-054", cat:"🖥️", name:"Budget King RTX 4060 Ti", specs:"i5-14600K | RTX 4060 Ti 16GB | 32GB DDR5 | 1TB | 650W Gold", price:18_200_000, stock:5, warranty:"2 yil" },
  { id:"TZ-055", cat:"🖥️", name:"Apple Mac Studio M4 Max", specs:"M4 Max | 128GB Unified | 8TB SSD | 6K Thunderbolt", price:56_000_000, stock:1, warranty:"1 yil" },
  { id:"TZ-056", cat:"🖥️", name:"Office Pro Core Ultra PC", specs:"Core Ultra 5 245K | Intel Arc A770 | 32GB DDR5 | 1TB | 550W", price:12_400_000, stock:6, warranty:"2 yil" },
  { id:"TZ-057", cat:"🖥️", name:"Ryzen 9X3D RTX 4090 Beast", specs:"Ryzen 9 7900X3D | RTX 4090 24GB | 32GB DDR5 | 2TB | 1000W Platinum", price:44_300_000, stock:1, warranty:"3 yil" },
  { id:"TZ-058", cat:"🖥️", name:"Mid-Range Gamer RTX 4070", specs:"Ryzen 7 7700X | RTX 4070 12GB | 32GB DDR5 | 1TB | 700W Gold", price:21_600_000, stock:4, warranty:"2 yil" },
  { id:"TZ-059", cat:"🖥️", name:"Streamer Pro RTX 4080", specs:"i9-13900KF | RTX 4080 16GB | 64GB DDR5 | 4TB | 850W Platinum", price:34_900_000, stock:2, warranty:"3 yil" },
  { id:"TZ-060", cat:"🖥️", name:"Compact ITX RTX 4070 Super", specs:"i5-13600K | RTX 4070 Super | 32GB DDR5 | 1TB | 650W ITX", price:23_100_000, stock:3, warranty:"2 yil" },
  { id:"TZ-061", cat:"🖥️", name:"Workstation W790 Xeon", specs:"Xeon W7-3465X | Quadro RTX 6000 Ada 48GB | 256GB ECC | 8TB", price:89_000_000, stock:1, warranty:"3 yil" },
  { id:"TZ-062", cat:"🖥️", name:"Creator Pro RX 7900 XTX", specs:"Ryzen 9 7900X | RX 7900 XTX 24GB | 64GB DDR5 | 4TB | 850W", price:31_200_000, stock:2, warranty:"2 yil" },
  { id:"TZ-063", cat:"🖥️", name:"Starter Gaming RX 7700", specs:"Ryzen 5 7600 | RX 7700 12GB | 16GB DDR5 | 500GB | 550W", price:10_800_000, stock:8, warranty:"2 yil" },
  { id:"TZ-064", cat:"🖥️", name:"eSports Pro RTX 4080 Super", specs:"i9-14900KF | RTX 4080 Super | 32GB DDR5 6000MHz | 2TB | 850W", price:38_700_000, stock:2, warranty:"3 yil" },
  { id:"TZ-065", cat:"🖥️", name:"Silent Pro RTX 4070 Ti", specs:"Ryzen 7 7800X3D | RTX 4070 Ti | 32GB DDR5 | 2TB | 750W Noctua", price:27_400_000, stock:3, warranty:"2 yil" },
  { id:"TZ-066", cat:"🖥️", name:"Entry Level RTX 3060", specs:"i3-14100F | RTX 3060 12GB | 16GB DDR4 | 500GB | 550W", price:8_200_000, stock:10, warranty:"1 yil" },
  { id:"TZ-067", cat:"🖥️", name:"4K Gaming Monster RTX 4090", specs:"Ryzen 9 7950X | RTX 4090 24GB | 128GB DDR5 | 8TB | 1200W Platinum", price:54_000_000, stock:1, warranty:"3 yil" },
  { id:"TZ-068", cat:"🖥️", name:"HTPC Mini RTX 4060", specs:"i5-13400 | RTX 4060 8GB | 32GB DDR5 | 1TB | 450W Fanless", price:14_600_000, stock:5, warranty:"2 yil" },
  { id:"TZ-069", cat:"🖥️", name:"VR Ready RTX 4070", specs:"i7-13700K | RTX 4070 12GB | 32GB DDR5 | 2TB | 750W", price:22_300_000, stock:4, warranty:"2 yil" },
  { id:"TZ-070", cat:"🖥️", name:"Render Farm RTX 4000 Ada", specs:"Threadripper PRO 7965WX | RTX 4000 Ada x2 | 256GB DDR5 | 16TB", price:76_000_000, stock:1, warranty:"3 yil" },
  { id:"TZ-071", cat:"🖥️", name:"TechZone Budget PC i5", specs:"i5-13400 | Intel UHD 730 | 16GB DDR4 | 500GB | 450W", price:5_900_000, stock:15, warranty:"1 yil" },
  { id:"TZ-072", cat:"🖥️", name:"Competitive Gamer RX 7800 XT", specs:"Ryzen 7 7700 | RX 7800 XT 16GB | 32GB DDR5 | 1TB | 650W", price:19_800_000, stock:4, warranty:"2 yil" },
  { id:"TZ-073", cat:"🖥️", name:"AI Workstation RTX 6000 Ada", specs:"i9-14900K | RTX 6000 Ada 48GB | 128GB DDR5 | 8TB | 1000W", price:98_000_000, stock:1, warranty:"3 yil" },
  { id:"TZ-074", cat:"🖥️", name:"TechZone All-in-One 27\"", specs:"i7-13700 | RTX 4060 | 32GB DDR5 | 1TB | 27\" 4K IPS Touch", price:16_400_000, stock:3, warranty:"2 yil" },
  { id:"TZ-075", cat:"🖥️", name:"LAN Party Ultra Portable", specs:"Ryzen 9 7900X | RTX 4080 16GB | 64GB DDR5 | 2TB | 850W ITX", price:33_200_000, stock:2, warranty:"2 yil" },
  { id:"TZ-076", cat:"🖥️", name:"Casual Gaming PC Arc A770", specs:"i5-13500 | Intel Arc A770 16GB | 16GB DDR5 | 500GB | 550W", price:8_900_000, stock:8, warranty:"1 yil" },
  { id:"TZ-077", cat:"🖥️", name:"Extreme OC RTX 4090", specs:"i9-14900KS | RTX 4090 24GB OC | 64GB DDR5 7200MHz | 4TB | 1600W", price:58_000_000, stock:1, warranty:"2 yil" },
  { id:"TZ-078", cat:"🖥️", name:"Server Grade EPYC 9354", specs:"EPYC 9354 | AMD MI300X 192GB | 512GB DDR5 ECC | 32TB RAID", price:145_000_000, stock:1, warranty:"5 yil" },
  { id:"TZ-079", cat:"🖥️", name:"TechZone Student PC", specs:"i3-13100 | Intel UHD 730 | 8GB DDR4 | 256GB SSD | 300W", price:3_800_000, stock:20, warranty:"1 yil" },
  { id:"TZ-080", cat:"🖥️", name:"Semi-Pro RTX 4070 Super", specs:"i7-14700KF | RTX 4070 Super | 32GB DDR5 | 1TB | 750W", price:24_900_000, stock:3, warranty:"2 yil" },
  // Monitors
  { id:"TZ-081", cat:"🖥", name:"Samsung Odyssey G9 Neo 49\"", specs:"5120x1440 | QLED Mini-LED | 240Hz | 1ms | HDR2000", price:14_200_000, stock:2, warranty:"2 yil" },
  { id:"TZ-082", cat:"🖥", name:"LG OLED 27\" 4K 240Hz", specs:"4K OLED | 240Hz | 0.03ms | 1000nit | G-Sync Ultimate", price:16_800_000, stock:3, warranty:"2 yil" },
  { id:"TZ-083", cat:"🖥", name:"ASUS ProArt 32\" 4K HDR", specs:"4K IPS | 120Hz | HDR600 | 100% DCI-P3 | Thunderbolt 4", price:10_400_000, stock:4, warranty:"3 yil" },
  { id:"TZ-084", cat:"🖥", name:"Dell Alienware AW3423DWF", specs:"34\" 3440x1440 | OLED | 165Hz | 0.1ms | HDR400", price:12_600_000, stock:3, warranty:"3 yil" },
  { id:"TZ-085", cat:"🖥", name:"Samsung Odyssey G7 32\"", specs:"2560x1440 | VA | 240Hz | 1ms | HDR600 | Curved 1000R", price:6_800_000, stock:5, warranty:"2 yil" },
  { id:"TZ-086", cat:"🖥", name:"LG UltraGear 27\" 1440p 360Hz", specs:"2560x1440 | IPS Nano | 360Hz | 0.03ms | G-Sync+FreeSync", price:7_900_000, stock:4, warranty:"2 yil" },
  { id:"TZ-087", cat:"🖥", name:"ASUS ROG Swift Pro PG248QP", specs:"24.1\" 1080p | TN | 540Hz | 0.2ms | G-Sync | eSports", price:8_400_000, stock:3, warranty:"3 yil" },
  { id:"TZ-088", cat:"🖥", name:"Acer Predator X45", specs:"45\" 3440x1440 | OLED | 240Hz | 0.03ms | HDR800 | Curved", price:19_200_000, stock:2, warranty:"2 yil" },
  { id:"TZ-089", cat:"🖥", name:"BenQ PD3225U 4K Creator", specs:"32\" 4K IPS | 60Hz | 100% sRGB+DCI-P3 | Thunderbolt 4", price:7_200_000, stock:5, warranty:"3 yil" },
  { id:"TZ-090", cat:"🖥", name:"MSI MEG 342C QD-OLED", specs:"34\" 3440x1440 | QD-OLED | 175Hz | 0.03ms | KVM | USB-C 90W", price:11_800_000, stock:3, warranty:"2 yil" },
  // Accessories
  { id:"TZ-091", cat:"🖱️", name:"Logitech G Pro X Superlight 2 DEX", specs:"Wireless | HERO 2 32K DPI | 95hr | 60g | eSports pro", price:1_480_000, stock:10, warranty:"2 yil" },
  { id:"TZ-092", cat:"🖱️", name:"Logitech MX Master 3S", specs:"EM scroll | 8000 DPI | Bluetooth | Multi-device | Ergonomic", price:890_000, stock:15, warranty:"2 yil" },
  { id:"TZ-093", cat:"⌨️", name:"Keychron Q3 Pro QMK", specs:"TKL | Gasket mount | Hot-swap | RGB | Wireless 2.4GHz | CNC", price:1_240_000, stock:8, warranty:"1 yil" },
  { id:"TZ-094", cat:"⌨️", name:"Razer BlackWidow V4 Pro", specs:"Full-size | Razer Yellow | Per-key RGB | Wrist rest | Wireless", price:1_650_000, stock:6, warranty:"2 yil" },
  { id:"TZ-095", cat:"💾", name:"Samsung 990 PRO NVMe 2TB", specs:"PCIe 4.0 x4 | 7450MB/s read | 6900MB/s write | 5yr warranty", price:980_000, stock:20, warranty:"5 yil" },
  { id:"TZ-096", cat:"💾", name:"Corsair Dominator Platinum DDR5 64GB", specs:"DDR5-6400 | 2x32GB | CAS 32 | XMP 3.0 | AMD EXPO | RGB", price:1_380_000, stock:12, warranty:"Umrbod" },
  { id:"TZ-097", cat:"🎧", name:"Sony WH-1000XM5", specs:"ANC | 30hr | Bluetooth 5.3 | LDAC | 8-mic array", price:1_190_000, stock:8, warranty:"1 yil" },
  { id:"TZ-098", cat:"🎧", name:"HyperX Cloud III Wireless", specs:"53mm | 70hr | 2.4GHz & BT | DTS | Noise cancel mic", price:890_000, stock:10, warranty:"2 yil" },
  { id:"TZ-099", cat:"🖱️", name:"Razer DeathAdder V3 HyperSpeed", specs:"Focus Pro 30K | 90hr | 59g | Wireless 2.4GHz", price:780_000, stock:12, warranty:"2 yil" },
  { id:"TZ-100", cat:"💡", name:"Elgato Stream Deck XL", specs:"32 LCD keys | Plugin ecosystem | USB-C | Win/Mac", price:1_320_000, stock:5, warranty:"2 yil" },
];

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function fmtPrice(n: number) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " so'm";
}
function fmtCount(n: number) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
function hashProductSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
function now() {
  return new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
}

// Simple keyword AI response
function aiReply(input: string, products: Product[]): string {
  const q = input.toLowerCase();

  // Budget detection
  const budgetMatch = q.match(/(\d[\d\s]*)\s*(mln|million|million|so'm|uzs)?/);
  const budget = budgetMatch ? parseInt(budgetMatch[1].replace(/\s/g, "")) * (budgetMatch[2]?.startsWith("mln") ? 1_000_000 : 1) : null;

  if (budget && budget > 100_000) {
    const matches = products.filter(p => p.price <= budget * 1.1 && p.price >= budget * 0.5);
    if (matches.length > 0) {
      const top = matches.sort((a, b) => b.price - a.price).slice(0, 3);
      return `💰 Sizning budjetingizga mos ${matches.length} ta mahsulot toptildi!\n\nTop tavsiyalar:\n${top.map((p, i) => `${i + 1}. ${p.name}\n   ${fmtPrice(p.price)} | ${p.specs.split("|")[0].trim()}`).join("\n\n")}\n\nBatafsil ma'lumot uchun mahsulot kartasidagi "🤖 AI maslahat" tugmasini bosing!`;
    }
  }

  if (q.includes("macbook") || q.includes("mac")) {
    const macs = products.filter(p => p.name.toLowerCase().includes("mac"));
    return `🍎 Bizda ${macs.length} ta Apple mahsuloti mavjud!\n\n${macs.slice(0, 3).map(p => `• ${p.name} — ${fmtPrice(p.price)}`).join("\n")}\n\nApple M-chip seriyasi eng yaxshi ishlash/batareya nisbatiga ega.`;
  }

  if (q.includes("gaming") || q.includes("geyming") || q.includes("o'yin")) {
    const gaming = products.filter(p => p.name.toLowerCase().includes("gaming") || p.name.includes("RTX") || p.name.includes("Legion") || p.name.includes("ROG"));
    return `🎮 Gaming kompyuterlar uchun ${gaming.length} ta variant bor!\n\nBudjetga qarab maslahat:\n• ${fmtPrice(10_000_000)} gacha: RTX 3060-4060 li modellar\n• ${fmtPrice(20_000_000)} gacha: RTX 4070 Ti, Legion Pro\n• ${fmtPrice(35_000_000)}+: RTX 4090, ROG Strix seriyasi`;
  }

  if (q.includes("arzon") || q.includes("budget") || q.includes("uchebu")) {
    const cheap = products.filter(p => p.price < 10_000_000).sort((a, b) => a.price - b.price);
    return `💚 Arzon modellar (10 mln so'm gacha):\n\n${cheap.slice(0, 4).map(p => `• ${p.name}\n  ${fmtPrice(p.price)} — ${p.specs.split("|")[0].trim()}`).join("\n\n")}`;
  }

  if (q.includes("nasiya") || q.includes("bo'lib") || q.includes("kredit")) {
    return `💳 Nasiya imkoniyatlari:\n\n12 oyga bo'lib to'lash — 0% ustama!\n\nMisol: ${fmtPrice(20_000_000)} narxli mahsulot\n• 12 oy: ${fmtPrice(Math.round(20_000_000 / 12))}/oy\n• 24 oy: ${fmtPrice(Math.round(20_000_000 / 24))}/oy\n\nBarcha modellar uchun nasiya mavjud. Admin bilan bog'laning! 👆`;
  }

  if (q.includes("kafolat") || q.includes("warranty")) {
    return `🛡️ Kafolat siyosatimiz:\n\n• Noutbuklar: 1-2 yil rasmiy kafolat\n• Gaming PClar: 2-3 yil kafolat\n• Monitorlar: 2-3 yil\n• Apple mahsulotlari: 1 yil rasmiy\n\nKafolat davomida bepul ta'mir yoki almashtirish!`;
  }

  // Default - suggest browsing
  const popular = products.filter(p => p.stock <= 3 && p.stock > 0).slice(0, 3);
  return `🤖 Selloi AI sizga yordam beradi!\n\nKanalda 100 ta mahsulot mavjud. Qidirish uchun:\n• Model nomi yozing (masalan: "MacBook", "RTX 4090")\n• Budjetingizni yozing (masalan: "15 mln")\n• Kategoriya so'rang ("gaming", "arzon", "nasiya")\n\n🔥 Ommabop mahsulotlar:\n${popular.map(p => `• ${p.name} — ${fmtPrice(p.price)}`).join("\n")}`;
}

// ─────────────────────────────────────────────
// CHANNEL FILTER CATEGORIES
// ─────────────────────────────────────────────
const FILTERS: { key: ChannelFilter; label: string }[] = [
  { key: "all", label: "Hammasi" },
  { key: "laptop", label: "💻 Noutbuk" },
  { key: "pc", label: "🖥️ Gaming PC" },
  { key: "monitor", label: "🖥 Monitor" },
  { key: "accessory", label: "🖱️ Aksessuar" },
];

function matchFilter(p: Product, f: ChannelFilter) {
  if (f === "all") return true;
  if (f === "laptop") return p.id <= "TZ-050";
  if (f === "pc") return p.id >= "TZ-051" && p.id <= "TZ-080";
  if (f === "monitor") return p.id >= "TZ-081" && p.id <= "TZ-090";
  if (f === "accessory") return p.id >= "TZ-091";
  return true;
}

// ─────────────────────────────────────────────
// SUBCOMPONENTS
// ─────────────────────────────────────────────

// Real Telegram double-tick SVG
const TgTick = ({ read }: { read?: boolean }) => (
  <svg width="15" height="11" viewBox="0 0 15 11" fill="none" style={{ display: "inline" }}>
    <path d="M1 5.5L4.5 9L9 1" stroke={read ? "#4FC3F7" : "#8899A6"} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5 5.5L8.5 9L13 1" stroke={read ? "#4FC3F7" : "#8899A6"} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Verified badge
const TgVerified = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ display:"inline", marginLeft:2, verticalAlign:"middle" }}>
    <circle cx="7" cy="7" r="7" fill="#2AABEE"/>
    <path d="M4 7L6 9L10 5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Channel post card
function ChannelPost({ p, onAsk, onOrder }: { p: Product; onAsk: (p: Product) => void; onOrder: (p: Product) => void }) {
  const seed = hashProductSeed(p.id);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState((seed % 80) + 10);
  const views = (seed % 2000) + 100;

  return (
    <div className="tg-channel-post">
      {/* Channel header */}
      <div className="tg-post-channel-header">
        <div className="tg-post-avatar">🛒</div>
        <div className="tg-post-channel-info">
          <span className="tg-post-channel-name">Test - Pc <TgVerified /></span>
          <span className="tg-post-channel-sub">@Test_pcssss</span>
        </div>
        <span className="tg-post-id">{p.id}</span>
      </div>

      {/* Product body */}
      <div className="tg-post-body">
        <div className="tg-post-category">{p.cat} {p.id >= "TZ-051" && p.id <= "TZ-080" ? "Gaming PC" : p.id >= "TZ-081" && p.id <= "TZ-090" ? "Monitor" : p.id >= "TZ-091" ? "Aksessuar" : "Noutbuk"}</div>
        <div className="tg-post-divider">━━━━━━━━━━━━━━━━</div>
        <div className="tg-post-title">{p.name}</div>
        <div className="tg-post-specs">{p.specs}</div>
        <div className="tg-post-divider">━━━━━━━━━━━━━━━━</div>
        <div className="tg-post-price">💰 {fmtPrice(p.price)}</div>
        <div className="tg-post-meta-row">
          <span>🛡️ {p.warranty}</span>
          <span className={p.stock <= 2 ? "tg-low-stock" : ""}>
            {p.stock <= 0 ? "❌ Tugagan" : p.stock <= 2 ? `⚠️ ${p.stock} dona` : `✅ ${p.stock} dona`}
          </span>
        </div>
      </div>

      {/* Inline buttons */}
      <div className="tg-inline-buttons">
        <button className="tg-inline-btn tg-btn-order" onClick={() => onOrder(p)}>
          🛒 Buyurtma berish
        </button>
        <button className="tg-inline-btn tg-btn-ai" onClick={() => onAsk(p)}>
          🤖 AI maslahat
        </button>
      </div>
      <div className="tg-inline-buttons">
        <button className="tg-inline-btn tg-btn-admin">
          📞 Admin bilan bog'lanish
        </button>
        <button className="tg-inline-btn tg-btn-credit" onClick={() => onAsk({ ...p, name: p.name + " (nasiya hisob)" })}>
          💳 Nasiya hisoblash
        </button>
      </div>

      {/* Footer */}
      <div className="tg-post-footer">
        <button
          className={`tg-reaction-btn${liked ? " tg-reaction-active" : ""}`}
          onClick={() => { setLiked(l => !l); setLikes(n => liked ? n - 1 : n + 1); }}
        >
          ❤️ {likes}
        </button>
        <span className="tg-post-views">👁 {fmtCount(views)}</span>
      </div>
    </div>
  );
}

// Chat message bubble
function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.from === "user";
  return (
    <div className={`tg-bubble-wrap${isUser ? " tg-bubble-wrap-out" : ""}`}>
      {!isUser && <div className="tg-bubble-avatar">🤖</div>}
      <div className={`tg-bubble${isUser ? " tg-bubble-out" : " tg-bubble-in"}`}>
        {!isUser && <div className="tg-bubble-name">Selloi AI</div>}
        {msg.quoted && (
          <div className="tg-quote">
            <div className="tg-quote-name">📦 {msg.quoted.name}</div>
            <div className="tg-quote-text">{msg.quoted.text}</div>
          </div>
        )}
        <div className="tg-bubble-text">{msg.text}</div>
        <div className="tg-bubble-meta">
          {msg.ts}{isUser && <>&nbsp;<TgTick read /></>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export function ConversationDemoSection({ language }: { language?: Language }) {
  const [tab, setTab] = useState<Tab>("channel");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [channelSearch, setChannelSearch] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      from: "bot",
      text: "Salom! 👋 Men Selloi AI — @Test_pcssss kanalidagi 100 ta kompyuter va noutbuklar bo'yicha maslahat beraman.\n\nKanaldan mahsulot tanlang yoki xabar yozing! 🤖",
      ts: "12:00",
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [quotedProduct, setQuotedProduct] = useState<Product | null>(null);
  const [orderProduct, setOrderProduct] = useState<Product | null>(null);
  const messagesBoxRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(100);

  const filteredProducts = useMemo(() => {
    let list = CATALOG.filter(p => matchFilter(p, channelFilter));
    if (channelSearch.trim()) {
      const q = channelSearch.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.specs.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      );
    }
    return list;
  }, [channelFilter, channelSearch]);

  useEffect(() => {
    if (messagesBoxRef.current) {
      messagesBoxRef.current.scrollTo({
        top: messagesBoxRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, typing]);

  const sendMessage = useCallback((text: string, quoted?: Product) => {
    if (!text.trim()) return;
    const userMsg: ChatMessage = {
      id: ++idRef.current,
      from: "user",
      text,
      ts: now(),
      quoted: quoted ? { name: quoted.name, text: `${fmtPrice(quoted.price)} | ${quoted.specs.split("|")[0].trim()}` } : undefined,
    };
    setMessages(m => [...m, userMsg]);
    setInput("");
    setQuotedProduct(null);
    setTyping(true);
    setTab("chat");

    setTimeout(() => {
      const reply = aiReply(text, CATALOG);
      setTyping(false);
      setMessages(m => [...m, { id: ++idRef.current, from: "bot", text: reply, ts: now() }]);
    }, 900 + Math.random() * 600);
  }, []);

  const handleAsk = useCallback((p: Product) => {
    setQuotedProduct(p);
    setTab("chat");
  }, []);

  const handleOrder = useCallback((p: Product) => {
    setOrderProduct(p);
    const orderText = `🛒 BUYURTMA\n━━━━━━━━━━━━━━━━\n📦 ${p.name}\n💰 ${fmtPrice(p.price)}\n🛡️ Kafolat: ${p.warranty}\n✅ Mavjud: ${p.stock} dona\n━━━━━━━━━━━━━━━━\nBuyurtmangiz qabul qilindi! Admin tez orada bog'lanadi. 📞`;
    setMessages(m => [...m, {
      id: ++idRef.current,
      from: "bot",
      text: orderText,
      ts: now(),
      quoted: { name: "Buyurtma tasdiqlandi ✅", text: p.name },
    }]);
    setTab("chat");
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quotedProduct) {
      sendMessage(input || `${quotedProduct.name} haqida batafsil ma'lumot bering`, quotedProduct);
    } else {
      sendMessage(input);
    }
  };

  const QUICK_PROMPTS = [
    "MacBook tavsiya bering", "Gaming PC 20 mln", "RTX 4090 narxi", "Nasiya imkoniyati",
  ];

  return (
    <section className="tg-demo-section selloi-reveal-item" id="suhbat-namunasi">
      {/* Section label */}
      <div className="tg-demo-label">
        <span className="tg-demo-badge">📱 LIVE SINOV</span>
        <h2 className="tg-demo-title">@Test_pcssss kanalini sinab ko'ring</h2>
        <p className="tg-demo-desc">100 ta haqiqiy mahsulot — Telegram uslubida. AI bilan muloqot qiling.</p>
      </div>

      {/* Telegram Window */}
      <div className="tg-window">
        {/* Title bar */}
        <div className="tg-titlebar">
          <div className="tg-titlebar-dots">
            <span className="tg-dot tg-dot-red" />
            <span className="tg-dot tg-dot-yellow" />
            <span className="tg-dot tg-dot-green" />
          </div>
          <div className="tg-titlebar-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#2AABEE" style={{ marginRight: 6 }}>
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.247l-2.03 9.566c-.148.658-.537.818-1.088.508l-3.019-2.225-1.457 1.401c-.161.161-.296.296-.608.296l.217-3.075 5.59-5.049c.243-.217-.053-.337-.376-.12l-6.907 4.349-2.976-.929c-.647-.203-.661-.647.135-.958l11.618-4.479c.539-.195 1.01.12.901.715z"/>
            </svg>
            Telegram
          </div>
          <div />
        </div>

        {/* App shell */}
        <div className="tg-app">
          {/* Sidebar */}
          <div className="tg-sidebar">
            {/* Search */}
            <div className="tg-sidebar-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8899A6" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input placeholder="Qidirish" className="tg-sidebar-search-input" readOnly value="" onChange={() => {}} />
            </div>

            {/* Chat list */}
            <div className="tg-chat-list">
              {/* Selloi AI Bot */}
              <button
                className={`tg-chat-item${tab === "chat" ? " tg-chat-item-active" : ""}`}
                onClick={() => setTab("chat")}
              >
                <div className="tg-chat-avatar tg-avatar-bot">🤖</div>
                <div className="tg-chat-info">
                  <div className="tg-chat-name">Selloi AI Bot<TgVerified /></div>
                  <div className="tg-chat-preview">
                    {messages[messages.length - 1]?.text.split("\n")[0].slice(0, 32)}...
                  </div>
                </div>
                <div className="tg-chat-time">
                  <div className="tg-chat-ts">{messages[messages.length - 1]?.ts || "12:00"}</div>
                  {typing && <div className="tg-unread-badge">●</div>}
                </div>
              </button>

              {/* TechZone Channel */}
              <button
                className={`tg-chat-item${tab === "channel" ? " tg-chat-item-active" : ""}`}
                onClick={() => setTab("channel")}
              >
                <div className="tg-chat-avatar tg-avatar-channel">🛒</div>
                <div className="tg-chat-info">
                  <div className="tg-chat-name">Test - Pc<TgVerified /></div>
                  <div className="tg-chat-preview">@Test_pcssss • 100 ta mahsulot</div>
                </div>
                <div className="tg-chat-time">
                  <div className="tg-chat-ts">Hozir</div>
                  <div className="tg-unread-badge">100</div>
                </div>
              </button>
            </div>
          </div>

          {/* Main pane */}
          <div className="tg-main">
            {tab === "channel" ? (
              <>
                {/* Channel header */}
                <div className="tg-chat-header">
                  <div className="tg-chat-avatar tg-avatar-channel" style={{ width: 36, height: 36, fontSize: 18 }}>🛒</div>
                  <div className="tg-chat-header-info">
                    <div className="tg-chat-header-name">Test - Pc <TgVerified /></div>
                    <div className="tg-chat-header-sub">@Test_pcssss • 100 ta mahsulot</div>
                  </div>
                  <div className="tg-chat-header-actions">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8899A6" strokeWidth="2">
                      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                  </div>
                </div>

                {/* Channel search + filter */}
                <div className="tg-channel-toolbar">
                  <input
                    className="tg-channel-search"
                    placeholder="🔍 Model yoki kod qidiring..."
                    value={channelSearch}
                    onChange={e => setChannelSearch(e.target.value)}
                  />
                  <div className="tg-filter-tabs">
                    {FILTERS.map(f => (
                      <button
                        key={f.key}
                        className={`tg-filter-tab${channelFilter === f.key ? " tg-filter-tab-active" : ""}`}
                        onClick={() => setChannelFilter(f.key)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Posts feed */}
                <div className="tg-feed">
                  {filteredProducts.length === 0 ? (
                    <div className="tg-feed-empty">Mahsulot topilmadi 🔍</div>
                  ) : (
                    filteredProducts.map(p => (
                      <ChannelPost key={p.id} p={p} onAsk={handleAsk} onOrder={handleOrder} />
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Chat header */}
                <div className="tg-chat-header">
                  <div className="tg-chat-avatar tg-avatar-bot" style={{ width: 36, height: 36, fontSize: 18 }}>🤖</div>
                  <div className="tg-chat-header-info">
                    <div className="tg-chat-header-name">Selloi AI <TgVerified /></div>
                    <div className="tg-chat-header-sub">
                      {typing ? <><span className="tg-typing-dot" /><span className="tg-typing-dot" /><span className="tg-typing-dot" /> yozmoqda...</> : "bot • onlayn"}
                    </div>
                  </div>
                  <button className="tg-channel-link-btn" onClick={() => setTab("channel")}>
                    📺 Kanal
                  </button>
                </div>

                {/* Wallpaper + messages */}
                <div className="tg-messages-area">
                  <div className="tg-wallpaper" />
                  <div className="tg-messages" ref={messagesBoxRef}>
                    {messages.map(m => <ChatBubble key={m.id} msg={m} />)}
                    {typing && (
                      <div className="tg-bubble-wrap">
                        <div className="tg-bubble-avatar">🤖</div>
                        <div className="tg-bubble tg-bubble-in tg-typing-indicator">
                          <span className="tg-typing-dot" /><span className="tg-typing-dot" /><span className="tg-typing-dot" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick prompts */}
                <div className="tg-quick-prompts">
                  {QUICK_PROMPTS.map(q => (
                    <button key={q} className="tg-quick-btn" onClick={() => sendMessage(q)}>
                      {q}
                    </button>
                  ))}
                </div>

                {/* Quoted product */}
                {quotedProduct && (
                  <div className="tg-compose-quote">
                    <div className="tg-compose-quote-bar" />
                    <div className="tg-compose-quote-content">
                      <div className="tg-compose-quote-name">📦 {quotedProduct.name}</div>
                      <div className="tg-compose-quote-price">{fmtPrice(quotedProduct.price)}</div>
                    </div>
                    <button className="tg-compose-quote-close" onClick={() => setQuotedProduct(null)}>✕</button>
                  </div>
                )}

                {/* Compose bar */}
                <form className="tg-compose" onSubmit={handleSubmit}>
                  <button type="button" className="tg-compose-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8899A6" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
                    </svg>
                  </button>
                  <input
                    className="tg-compose-input"
                    placeholder="Xabar yozing..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                  />
                  <button type="button" className="tg-compose-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8899A6" strokeWidth="2">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                    </svg>
                  </button>
                  <button type="submit" className="tg-send-btn" disabled={!input.trim() && !quotedProduct}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                      <path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z"/>
                    </svg>
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      <p className="tg-demo-note">
        ⚡ Bu faqat saytdagi ko'rsatma — haqiqiy Telegram kanalingizga xuddi shunday ulaysiz
      </p>
    </section>
  );
}

export default ConversationDemoSection;
