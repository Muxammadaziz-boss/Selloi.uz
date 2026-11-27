"""Catalog data and search helpers for the public interactive @Selloi_ai_bot live demo."""

from __future__ import annotations

import re
from typing import Any

from app.services.uzbek_nlp import normalize_for_matching

DEMO_PRODUCTS: list[dict[str, Any]] = [
    # Laptops (TZ-001 .. TZ-050)
    {"id": "TZ-001", "category": "laptop", "name": "ASUS ROG Strix G16 2024", "specs": "i9-14900HX | RTX 4080 | 32GB DDR5 | 1TB | 240Hz QHD", "price": 25_900_000, "stock": 3, "warranty": "2 yil"},
    {"id": "TZ-002", "category": "laptop", "name": "Apple MacBook Pro 16\" M4 Max", "specs": "M4 Max | 48GB RAM | 1TB SSD | Liquid Retina XDR | 22hr", "price": 34_500_000, "stock": 2, "warranty": "1 yil"},
    {"id": "TZ-003", "category": "laptop", "name": "Lenovo Legion Pro 7i Gen 9", "specs": "i9-14900HX | RTX 4080 | 32GB DDR5 | 2TB | 240Hz", "price": 23_200_000, "stock": 4, "warranty": "2 yil"},
    {"id": "TZ-004", "category": "laptop", "name": "HP Omen 16 2024", "specs": "Ryzen 9 7945HX | RTX 4070 | 32GB DDR5 | 1TB | 165Hz", "price": 18_700_000, "stock": 5, "warranty": "2 yil"},
    {"id": "TZ-005", "category": "laptop", "name": "Apple MacBook Air 15\" M3", "specs": "M3 | 16GB | 512GB SSD | 15.3\" Liquid Retina | 18hr", "price": 19_800_000, "stock": 6, "warranty": "1 yil"},
    {"id": "TZ-006", "category": "laptop", "name": "ASUS TUF Gaming A16 2024", "specs": "Ryzen 9 7945HX | RTX 4070 Ti | 32GB DDR5 | 1TB | 165Hz", "price": 17_400_000, "stock": 7, "warranty": "2 yil"},
    {"id": "TZ-007", "category": "laptop", "name": "Dell XPS 15 9530", "specs": "i9-13900H | RTX 4070 | 32GB | 1TB | OLED 3.5K", "price": 22_100_000, "stock": 3, "warranty": "2 yil"},
    {"id": "TZ-008", "category": "laptop", "name": "MSI Titan GT77 HX", "specs": "i9-13980HX | RTX 4090 | 64GB DDR5 | 4TB | 4K 144Hz", "price": 38_900_000, "stock": 1, "warranty": "2 yil"},
    {"id": "TZ-009", "category": "laptop", "name": "Lenovo ThinkPad X1 Carbon Gen 12", "specs": "Core Ultra 7 | 32GB LPDDR5 | 1TB | 2.8K OLED", "price": 21_300_000, "stock": 4, "warranty": "3 yil"},
    {"id": "TZ-010", "category": "laptop", "name": "Acer Predator Helios 16 2024", "specs": "i9-14900HX | RTX 4080 | 32GB DDR5 | 2TB | 240Hz Mini-LED", "price": 24_500_000, "stock": 3, "warranty": "2 yil"},
    {"id": "TZ-011", "category": "laptop", "name": "ASUS ROG Zephyrus G14 2024", "specs": "Ryzen 9 8945HS | RTX 4070 | 32GB LPDDR5 | 1TB | 3K OLED", "price": 20_800_000, "stock": 5, "warranty": "2 yil"},
    {"id": "TZ-012", "category": "laptop", "name": "HP Spectre x360 14", "specs": "Core Ultra 7 | 32GB | 1TB | 3K 2-in-1 OLED", "price": 18_200_000, "stock": 4, "warranty": "2 yil"},
    {"id": "TZ-013", "category": "laptop", "name": "Lenovo LOQ 15 Gen 3", "specs": "Ryzen 7 8745H | RTX 4060 | 16GB DDR5 | 512GB | 144Hz", "price": 12_900_000, "stock": 8, "warranty": "2 yil"},
    {"id": "TZ-014", "category": "laptop", "name": "Acer Nitro 17 AN17-71", "specs": "i7-14700HX | RTX 4060 | 16GB DDR5 | 512GB | 165Hz", "price": 13_600_000, "stock": 6, "warranty": "2 yil"},
    {"id": "TZ-015", "category": "laptop", "name": "ASUS VivoBook Pro 16X OLED", "specs": "i9-13980HX | RTX 4060 | 32GB DDR5 | 1TB | 3.2K OLED", "price": 16_800_000, "stock": 4, "warranty": "2 yil"},
    {"id": "TZ-016", "category": "laptop", "name": "Apple MacBook Pro 14\" M4 Pro", "specs": "M4 Pro | 24GB | 512GB SSD | Liquid Retina XDR | 17hr", "price": 26_700_000, "stock": 3, "warranty": "1 yil"},
    {"id": "TZ-017", "category": "laptop", "name": "Razer Blade 16 2024", "specs": "i9-14900HX | RTX 4090 | 32GB DDR5 | 2TB | OLED 4K", "price": 36_200_000, "stock": 2, "warranty": "1 yil"},
    {"id": "TZ-018", "category": "laptop", "name": "Lenovo Legion Slim 5i Gen 9", "specs": "i7-14650HX | RTX 4060 | 16GB DDR5 | 1TB | 165Hz", "price": 14_300_000, "stock": 7, "warranty": "2 yil"},
    {"id": "TZ-019", "category": "laptop", "name": "HP Victus 15 2024", "specs": "Ryzen 7 7745HX | RTX 4060 | 16GB DDR5 | 512GB | 144Hz", "price": 11_800_000, "stock": 10, "warranty": "1 yil"},
    {"id": "TZ-020", "category": "laptop", "name": "ASUS ROG Flow X13 2024", "specs": "Ryzen 9 8945HS | RTX 4060 | 32GB LPDDR5 | 1TB | 165Hz 2-in-1", "price": 19_400_000, "stock": 3, "warranty": "2 yil"},
    {"id": "TZ-021", "category": "laptop", "name": "Dell Inspiron 16 Plus 7640", "specs": "Core Ultra 7 | 32GB | 1TB | 2K 120Hz", "price": 14_900_000, "stock": 5, "warranty": "1 yil"},
    {"id": "TZ-022", "category": "laptop", "name": "Gigabyte AORUS 17X 2024", "specs": "i9-14900HX | RTX 4080 | 32GB DDR5 | 2TB | 240Hz Mini-LED", "price": 27_300_000, "stock": 2, "warranty": "2 yil"},
    {"id": "TZ-023", "category": "laptop", "name": "Microsoft Surface Laptop 6", "specs": "Core Ultra 5 | 16GB | 512GB | 13.5\" PixelSense", "price": 16_100_000, "stock": 4, "warranty": "1 yil"},
    {"id": "TZ-024", "category": "laptop", "name": "Acer Swift X 14 2024", "specs": "Ryzen 7 8845HS | RTX 4070 | 32GB LPDDR5 | 1TB | 2.8K OLED", "price": 17_600_000, "stock": 5, "warranty": "2 yil"},
    {"id": "TZ-025", "category": "laptop", "name": "ASUS TUF Gaming F15 2024", "specs": "i7-13620H | RTX 4060 | 16GB DDR4 | 512GB | 144Hz", "price": 10_900_000, "stock": 9, "warranty": "2 yil"},
    {"id": "TZ-026", "category": "laptop", "name": "HP EliteBook 840 G11", "specs": "Core Ultra 7 | 32GB LPDDR5 | 1TB | 1400p", "price": 19_200_000, "stock": 4, "warranty": "3 yil"},
    {"id": "TZ-027", "category": "laptop", "name": "Lenovo IdeaPad Gaming 3 Gen 8", "specs": "Ryzen 7 7745H | RTX 4060 | 16GB DDR5 | 512GB | 165Hz", "price": 11_400_000, "stock": 8, "warranty": "1 yil"},
    {"id": "TZ-028", "category": "laptop", "name": "MSI Stealth 16 AI Studio", "specs": "Core Ultra 9 | RTX 4080 | 32GB DDR5 | 2TB | 4K OLED", "price": 32_800_000, "stock": 2, "warranty": "2 yil"},
    {"id": "TZ-029", "category": "laptop", "name": "Apple MacBook Air 13\" M3", "specs": "M3 | 8GB | 256GB SSD | 13.6\" Liquid Retina | 18hr", "price": 14_900_000, "stock": 7, "warranty": "1 yil"},
    {"id": "TZ-030", "category": "laptop", "name": "ASUS ROG Strix SCAR 17 2024", "specs": "Ryzen 9 8945HX | RTX 4090 | 64GB DDR5 | 4TB | 240Hz QHD", "price": 42_000_000, "stock": 1, "warranty": "2 yil"},
    {"id": "TZ-031", "category": "laptop", "name": "Lenovo ThinkPad E16 Gen 2", "specs": "Core Ultra 5 | 16GB DDR5 | 512GB | 1920x1200", "price": 10_200_000, "stock": 6, "warranty": "1 yil"},
    {"id": "TZ-032", "category": "laptop", "name": "HP Omen Transcend 14", "specs": "Core Ultra 7 | RTX 4060 | 32GB LPDDR5 | 2TB | 2.8K OLED", "price": 20_400_000, "stock": 3, "warranty": "2 yil"},
    {"id": "TZ-033", "category": "laptop", "name": "Acer Aspire 5 A515-58M", "specs": "i7-13620H | Intel Iris Xe | 16GB DDR5 | 512GB | 1080p", "price": 8_600_000, "stock": 12, "warranty": "1 yil"},
    {"id": "TZ-034", "category": "laptop", "name": "ASUS ZenBook Pro Duo 14 OLED", "specs": "i9-13900H | RTX 4070 | 32GB | 1TB | Dual Screen OLED", "price": 23_800_000, "stock": 2, "warranty": "2 yil"},
    {"id": "TZ-035", "category": "laptop", "name": "Gigabyte G6X 9KG", "specs": "i7-13650HX | RTX 4060 | 16GB DDR5 | 512GB | 165Hz", "price": 13_200_000, "stock": 5, "warranty": "1 yil"},
    {"id": "TZ-036", "category": "laptop", "name": "Lenovo Legion Pro 5i Gen 9", "specs": "i7-14700HX | RTX 4070 Ti | 32GB DDR5 | 1TB | 165Hz", "price": 19_900_000, "stock": 4, "warranty": "2 yil"},
    {"id": "TZ-037", "category": "laptop", "name": "MSI Katana 17 B13V", "specs": "i7-13620H | RTX 4070 | 16GB DDR5 | 1TB | 144Hz", "price": 14_800_000, "stock": 6, "warranty": "2 yil"},
    {"id": "TZ-038", "category": "laptop", "name": "Acer Predator Triton Neo 16", "specs": "Core Ultra 9 | RTX 4070 | 32GB LPDDR5 | 1TB | 3.2K 165Hz", "price": 22_700_000, "stock": 3, "warranty": "2 yil"},
    {"id": "TZ-039", "category": "laptop", "name": "HP Pavilion Gaming 15 2024", "specs": "Ryzen 7 7745H | RTX 4060 | 16GB DDR5 | 512GB | 144Hz", "price": 10_600_000, "stock": 8, "warranty": "1 yil"},
    {"id": "TZ-040", "category": "laptop", "name": "ASUS ROG Strix G18 2024", "specs": "i9-14900HX | RTX 4090 | 32GB DDR5 | 2TB | 240Hz QHD", "price": 33_500_000, "stock": 2, "warranty": "2 yil"},
    {"id": "TZ-041", "category": "laptop", "name": "Dell G16 7630 Gaming", "specs": "i7-13650HX | RTX 4070 | 16GB DDR5 | 1TB | 165Hz", "price": 15_700_000, "stock": 5, "warranty": "1 yil"},
    {"id": "TZ-042", "category": "laptop", "name": "Lenovo Yoga Pro 9i Gen 9", "specs": "Core Ultra 9 | RTX 4070 | 32GB LPDDR5 | 2TB | 3.2K Mini-LED", "price": 25_100_000, "stock": 3, "warranty": "2 yil"},
    {"id": "TZ-043", "category": "laptop", "name": "MSI Vector GP78 HX", "specs": "i9-14900HX | RTX 4090 | 64GB DDR5 | 4TB | 300Hz QHD", "price": 40_200_000, "stock": 1, "warranty": "2 yil"},
    {"id": "TZ-044", "category": "laptop", "name": "Acer Nitro 5 AN515-58", "specs": "i7-12700H | RTX 3060 | 16GB DDR4 | 512GB | 144Hz", "price": 9_800_000, "stock": 10, "warranty": "1 yil"},
    {"id": "TZ-045", "category": "laptop", "name": "Apple MacBook Pro 16\" M4 Pro", "specs": "M4 Pro | 24GB | 512GB SSD | Liquid Retina XDR | 24hr", "price": 30_200_000, "stock": 2, "warranty": "1 yil"},
    {"id": "TZ-046", "category": "laptop", "name": "Razer Blade 15 2024", "specs": "i9-14900HX | RTX 4080 | 32GB DDR5 | 1TB | QHD 240Hz", "price": 31_400_000, "stock": 2, "warranty": "1 yil"},
    {"id": "TZ-047", "category": "laptop", "name": "Lenovo LOQ 16 Gen 2", "specs": "i5-13420H | RTX 4060 | 16GB DDR5 | 512GB | 165Hz", "price": 11_200_000, "stock": 7, "warranty": "2 yil"},
    {"id": "TZ-048", "category": "laptop", "name": "HP Dragonfly G4", "specs": "i7-1365U | Intel Iris Xe | 32GB LPDDR5 | 1TB | 2.5K IPS", "price": 17_900_000, "stock": 4, "warranty": "3 yil"},
    {"id": "TZ-049", "category": "laptop", "name": "ASUS TUF Gaming F17 2024", "specs": "Ryzen 7 7745H | RTX 4070 | 16GB DDR5 | 512GB | 165Hz", "price": 13_900_000, "stock": 6, "warranty": "2 yil"},
    {"id": "TZ-050", "category": "laptop", "name": "Gigabyte AERO 16 OLED 2024", "specs": "i9-13980HX | RTX 4070 | 32GB DDR5 | 2TB | 4K OLED", "price": 28_600_000, "stock": 2, "warranty": "2 yil"},
    # PCs (TZ-051 .. TZ-080)
    {"id": "TZ-051", "category": "pc", "name": "Apex RTX 4090 Ultra Gaming", "specs": "i9-14900K | RTX 4090 24GB | 64GB DDR5 | 4TB Gen5 | 1200W Platinum", "price": 48_000_000, "stock": 1, "warranty": "3 yil"},
    {"id": "TZ-052", "category": "pc", "name": "TechZone RTX 4080 Super Pro", "specs": "Ryzen 9 7950X3D | RTX 4080 Super | 64GB DDR5 | 2TB | 850W Gold", "price": 36_500_000, "stock": 2, "warranty": "3 yil"},
    {"id": "TZ-053", "category": "pc", "name": "Selloi RTX 4070 Ti Super Build", "specs": "i7-14700K | RTX 4070 Ti Super | 32GB DDR5 | 2TB | 750W Gold", "price": 26_800_000, "stock": 3, "warranty": "2 yil"},
    {"id": "TZ-054", "category": "pc", "name": "Budget King RTX 4060 Ti", "specs": "i5-14600K | RTX 4060 Ti 16GB | 32GB DDR5 | 1TB | 650W Gold", "price": 18_200_000, "stock": 5, "warranty": "2 yil"},
    {"id": "TZ-055", "category": "pc", "name": "Apple Mac Studio M4 Max", "specs": "M4 Max | 128GB Unified | 8TB SSD | 6K Thunderbolt", "price": 56_000_000, "stock": 1, "warranty": "1 yil"},
    {"id": "TZ-056", "category": "pc", "name": "Office Pro Core Ultra PC", "specs": "Core Ultra 5 245K | Intel Arc A770 | 32GB DDR5 | 1TB | 550W", "price": 12_400_000, "stock": 6, "warranty": "2 yil"},
    {"id": "TZ-057", "category": "pc", "name": "Ryzen 9X3D RTX 4090 Beast", "specs": "Ryzen 9 7900X3D | RTX 4090 24GB | 32GB DDR5 | 2TB | 1000W Platinum", "price": 44_300_000, "stock": 1, "warranty": "3 yil"},
    {"id": "TZ-058", "category": "pc", "name": "Mid-Range Gamer RTX 4070", "specs": "Ryzen 7 7700X | RTX 4070 12GB | 32GB DDR5 | 1TB | 700W Gold", "price": 21_600_000, "stock": 4, "warranty": "2 yil"},
    {"id": "TZ-059", "category": "pc", "name": "Streamer Pro RTX 4080", "specs": "i9-13900KF | RTX 4080 16GB | 64GB DDR5 | 4TB | 850W Platinum", "price": 34_900_000, "stock": 2, "warranty": "3 yil"},
    {"id": "TZ-060", "category": "pc", "name": "Compact ITX RTX 4070 Super", "specs": "i5-13600K | RTX 4070 Super | 32GB DDR5 | 1TB | 650W ITX", "price": 23_100_000, "stock": 3, "warranty": "2 yil"},
    {"id": "TZ-061", "category": "pc", "name": "Workstation W790 Xeon", "specs": "Xeon W7-3465X | Quadro RTX 6000 Ada 48GB | 256GB ECC | 8TB", "price": 89_000_000, "stock": 1, "warranty": "3 yil"},
    {"id": "TZ-062", "category": "pc", "name": "Creator Pro RX 7900 XTX", "specs": "Ryzen 9 7900X | RX 7900 XTX 24GB | 64GB DDR5 | 4TB | 850W", "price": 31_200_000, "stock": 2, "warranty": "2 yil"},
    {"id": "TZ-063", "category": "pc", "name": "Starter Gaming RX 7700", "specs": "Ryzen 5 7600 | RX 7700 12GB | 16GB DDR5 | 500GB | 550W", "price": 10_800_000, "stock": 8, "warranty": "2 yil"},
    {"id": "TZ-064", "category": "pc", "name": "eSports Pro RTX 4080 Super", "specs": "i9-14900KF | RTX 4080 Super | 32GB DDR5 6000MHz | 2TB | 850W", "price": 38_700_000, "stock": 2, "warranty": "3 yil"},
    {"id": "TZ-065", "category": "pc", "name": "Silent Pro RTX 4070 Ti", "specs": "Ryzen 7 7800X3D | RTX 4070 Ti | 32GB DDR5 | 2TB | 750W Noctua", "price": 27_400_000, "stock": 3, "warranty": "2 yil"},
    {"id": "TZ-066", "category": "pc", "name": "Entry Level RTX 3060", "specs": "i3-14100F | RTX 3060 12GB | 16GB DDR4 | 500GB | 550W", "price": 8_200_000, "stock": 10, "warranty": "1 yil"},
    {"id": "TZ-067", "category": "pc", "name": "4K Gaming Monster RTX 4090", "specs": "Ryzen 9 7950X | RTX 4090 24GB | 128GB DDR5 | 8TB | 1200W Platinum", "price": 54_000_000, "stock": 1, "warranty": "3 yil"},
    {"id": "TZ-068", "category": "pc", "name": "HTPC Mini RTX 4060", "specs": "i5-13400 | RTX 4060 8GB | 32GB DDR5 | 1TB | 450W Fanless", "price": 14_600_000, "stock": 5, "warranty": "2 yil"},
    {"id": "TZ-069", "category": "pc", "name": "VR Ready RTX 4070", "specs": "i7-13700K | RTX 4070 12GB | 32GB DDR5 | 2TB | 750W", "price": 22_300_000, "stock": 4, "warranty": "2 yil"},
    {"id": "TZ-070", "category": "pc", "name": "Render Farm RTX 4000 Ada", "specs": "Threadripper PRO 7965WX | RTX 4000 Ada x2 | 256GB DDR5 | 16TB", "price": 76_000_000, "stock": 1, "warranty": "3 yil"},
    {"id": "TZ-071", "category": "pc", "name": "TechZone Budget PC i5", "specs": "i5-13400 | Intel UHD 730 | 16GB DDR4 | 500GB | 450W", "price": 5_900_000, "stock": 15, "warranty": "1 yil"},
    {"id": "TZ-072", "category": "pc", "name": "Competitive Gamer RX 7800 XT", "specs": "Ryzen 7 7700 | RX 7800 XT 16GB | 32GB DDR5 | 1TB | 650W", "price": 19_800_000, "stock": 4, "warranty": "2 yil"},
    {"id": "TZ-073", "category": "pc", "name": "AI Workstation RTX 6000 Ada", "specs": "i9-14900K | RTX 6000 Ada 48GB | 128GB DDR5 | 8TB | 1000W", "price": 98_000_000, "stock": 1, "warranty": "3 yil"},
    {"id": "TZ-074", "category": "pc", "name": "TechZone All-in-One 27\"", "specs": "i7-13700 | RTX 4060 | 32GB DDR5 | 1TB | 27\" 4K IPS Touch", "price": 16_400_000, "stock": 3, "warranty": "2 yil"},
    {"id": "TZ-075", "category": "pc", "name": "LAN Party Ultra Portable", "specs": "Ryzen 9 7900X | RTX 4080 16GB | 64GB DDR5 | 2TB | 850W ITX", "price": 33_200_000, "stock": 2, "warranty": "2 yil"},
    {"id": "TZ-076", "category": "pc", "name": "Casual Gaming PC Arc A770", "specs": "i5-13500 | Intel Arc A770 16GB | 16GB DDR5 | 500GB | 550W", "price": 8_900_000, "stock": 8, "warranty": "1 yil"},
    {"id": "TZ-077", "category": "pc", "name": "Extreme OC RTX 4090", "specs": "i9-14900KS | RTX 4090 24GB OC | 64GB DDR5 7200MHz | 4TB | 1600W", "price": 58_000_000, "stock": 1, "warranty": "2 yil"},
    {"id": "TZ-078", "category": "pc", "name": "Server Grade EPYC 9354", "specs": "EPYC 9354 | AMD MI300X 192GB | 512GB DDR5 ECC | 32TB RAID", "price": 145_000_000, "stock": 1, "warranty": "5 yil"},
    {"id": "TZ-079", "category": "pc", "name": "TechZone Student PC", "specs": "i3-13100 | Intel UHD 730 | 8GB DDR4 | 256GB SSD | 300W", "price": 3_800_000, "stock": 20, "warranty": "1 yil"},
    {"id": "TZ-080", "category": "pc", "name": "Semi-Pro RTX 4070 Super", "specs": "i7-14700KF | RTX 4070 Super | 32GB DDR5 | 1TB | 750W", "price": 24_900_000, "stock": 3, "warranty": "2 yil"},
    # Monitors (TZ-081 .. TZ-090)
    {"id": "TZ-081", "category": "monitor", "name": "Samsung Odyssey G9 Neo 49\"", "specs": "5120x1440 | QLED Mini-LED | 240Hz | 1ms | HDR2000", "price": 14_200_000, "stock": 2, "warranty": "2 yil"},
    {"id": "TZ-082", "category": "monitor", "name": "LG OLED 27\" 4K 240Hz", "specs": "4K OLED | 240Hz | 0.03ms | 1000nit | G-Sync Ultimate", "price": 16_800_000, "stock": 3, "warranty": "2 yil"},
    {"id": "TZ-083", "category": "monitor", "name": "ASUS ProArt 32\" 4K HDR", "specs": "4K IPS | 120Hz | HDR600 | 100% DCI-P3 | Thunderbolt 4", "price": 10_400_000, "stock": 4, "warranty": "3 yil"},
    {"id": "TZ-084", "category": "monitor", "name": "Dell Alienware AW3423DWF", "specs": "34\" 3440x1440 | OLED | 165Hz | 0.1ms | HDR400", "price": 12_600_000, "stock": 3, "warranty": "3 yil"},
    {"id": "TZ-085", "category": "monitor", "name": "Samsung Odyssey G7 32\"", "specs": "2560x1440 | VA | 240Hz | 1ms | HDR600 | Curved 1000R", "price": 6_800_000, "stock": 5, "warranty": "2 yil"},
    {"id": "TZ-086", "category": "monitor", "name": "LG UltraGear 27\" 1440p 360Hz", "specs": "2560x1440 | IPS Nano | 360Hz | 0.03ms | G-Sync+FreeSync", "price": 7_900_000, "stock": 4, "warranty": "2 yil"},
    {"id": "TZ-087", "category": "monitor", "name": "ASUS ROG Swift Pro PG248QP", "specs": "24.1\" 1080p | TN | 540Hz | 0.2ms | G-Sync | eSports", "price": 8_400_000, "stock": 3, "warranty": "3 yil"},
    {"id": "TZ-088", "category": "monitor", "name": "Acer Predator X45", "specs": "45\" 3440x1440 | OLED | 240Hz | 0.03ms | HDR800 | Curved", "price": 19_200_000, "stock": 2, "warranty": "2 yil"},
    {"id": "TZ-089", "category": "monitor", "name": "BenQ PD3225U 4K Creator", "specs": "32\" 4K IPS | 60Hz | 100% sRGB+DCI-P3 | Thunderbolt 4", "price": 7_200_000, "stock": 5, "warranty": "3 yil"},
    {"id": "TZ-090", "category": "monitor", "name": "MSI MEG 342C QD-OLED", "specs": "34\" 3440x1440 | QD-OLED | 175Hz | 0.03ms | KVM | USB-C 90W", "price": 11_800_000, "stock": 3, "warranty": "2 yil"},
    # Accessories (TZ-091 .. TZ-100)
    {"id": "TZ-091", "category": "accessory", "name": "Logitech G Pro X Superlight 2 DEX", "specs": "Wireless | HERO 2 32K DPI | 95hr | 60g | eSports pro", "price": 1_480_000, "stock": 10, "warranty": "2 yil"},
    {"id": "TZ-092", "category": "accessory", "name": "Logitech MX Master 3S", "specs": "EM scroll | 8000 DPI | Bluetooth | Multi-device | Ergonomic", "price": 890_000, "stock": 15, "warranty": "2 yil"},
    {"id": "TZ-093", "category": "accessory", "name": "Keychron Q3 Pro QMK", "specs": "TKL | Gasket mount | Hot-swap | RGB | Wireless 2.4GHz | CNC", "price": 1_240_000, "stock": 8, "warranty": "1 yil"},
    {"id": "TZ-094", "category": "accessory", "name": "Razer BlackWidow V4 Pro", "specs": "Full-size | Razer Yellow | Per-key RGB | Wrist rest | Wireless", "price": 1_650_000, "stock": 6, "warranty": "2 yil"},
    {"id": "TZ-095", "category": "accessory", "name": "Samsung 990 PRO NVMe 2TB", "specs": "PCIe 4.0 x4 | 7450MB/s read | 6900MB/s write | 5yr warranty", "price": 980_000, "stock": 20, "warranty": "5 yil"},
    {"id": "TZ-096", "category": "accessory", "name": "Corsair Dominator Platinum DDR5 64GB", "specs": "DDR5-6400 | 2x32GB | CAS 32 | XMP 3.0 | AMD EXPO | RGB", "price": 1_380_000, "stock": 12, "warranty": "Umrbod"},
    {"id": "TZ-097", "category": "accessory", "name": "Sony WH-1000XM5", "specs": "ANC | 30hr | Bluetooth 5.3 | LDAC | 8-mic array", "price": 1_190_000, "stock": 8, "warranty": "1 yil"},
    {"id": "TZ-098", "category": "accessory", "name": "HyperX Cloud III Wireless", "specs": "53mm | 70hr | 2.4GHz & BT | DTS | Noise cancel mic", "price": 890_000, "stock": 10, "warranty": "2 yil"},
    {"id": "TZ-099", "category": "accessory", "name": "Razer DeathAdder V3 HyperSpeed", "specs": "Focus Pro 30K | 90hr | 59g | Wireless 2.4GHz", "price": 780_000, "stock": 12, "warranty": "2 yil"},
    {"id": "TZ-100", "category": "accessory", "name": "Elgato Stream Deck XL", "specs": "32 LCD keys | Plugin ecosystem | USB-C | Win/Mac", "price": 1_320_000, "stock": 5, "warranty": "2 yil"},
]

_PRODUCTS_BY_ID = {item["id"]: item for item in DEMO_PRODUCTS}


def fmt_uzs(price: int | float) -> str:
    return f"{int(round(price)):,}".replace(",", " ") + " so'm"


def get_demo_product(product_id: str | None) -> dict[str, Any] | None:
    if not product_id:
        return None
    return _PRODUCTS_BY_ID.get(product_id.strip().upper())


def extract_budget_uzs(text: str) -> int | None:
    norm = normalize_for_matching(text)
    mln_match = re.search(r"(\d+(?:[.,]\d+)?)\s*(?:mln|million|млн|m\b)", norm)
    if mln_match:
        val = float(mln_match.group(1).replace(",", "."))
        return int(val * 1_000_000)
    raw_match = re.search(r"(\d[\d\s]{5,})\s*(?:som|sum|uzs|сум)?", norm)
    if raw_match:
        digits = re.sub(r"\s+", "", raw_match.group(1))
        if digits.isdigit():
            val_int = int(digits)
            if 500_000 <= val_int <= 250_000_000:
                return val_int
    return None


def search_demo_catalog(
    query: str,
    *,
    product_id: str | None = None,
    limit: int = 5,
) -> list[dict[str, Any]]:
    """Search the 100-item TechZone catalog using normalized tokens and optional budget."""
    pinned = get_demo_product(product_id)
    norm_q = normalize_for_matching(query or "")
    tokens = [tok for tok in re.findall(r"[a-z0-9]{2,}", norm_q) if tok not in {"nima", "bor", "narxi", "qancha", "bormi", "kerak"}]
    budget = extract_budget_uzs(query or "")

    want_cheap = any(w in norm_q for w in ("arzon", "byudjet", "budget", "deshev", "cheap"))
    want_gaming = any(w in norm_q for w in ("gaming", "geym", "oyin", "igrov", "rtx", "fps"))
    want_laptop = any(w in norm_q for w in ("noutbuk", "nootbuk", "laptop", "macbook", "ultrabu"))
    want_pc = any(w in norm_q for w in ("kompyuter", "pc", "sistemnik", "sborka", "desktop"))
    want_monitor = any(w in norm_q for w in ("monitor", "ekran", "oled", "hz"))
    want_accessory = any(w in norm_q for w in ("sichqon", "klaviatura", "quloqchin", "ssd", "mouse", "keyboard", "aksessuar"))

    scored: list[tuple[float, dict[str, Any]]] = []
    for item in DEMO_PRODUCTS:
        if pinned and item["id"] == pinned["id"]:
            continue
        haystack = normalize_for_matching(f"{item['id']} {item['name']} {item['specs']} {item['category']}")
        score = 0.0
        for tok in tokens:
            if tok in haystack:
                score += 4.0 if tok in item["name"].lower() else 2.5
        if want_laptop and item["category"] == "laptop":
            score += 2.0
        if want_pc and item["category"] == "pc":
            score += 2.0
        if want_monitor and item["category"] == "monitor":
            score += 2.0
        if want_accessory and item["category"] == "accessory":
            score += 2.0
        if want_gaming and ("rtx" in haystack or "gaming" in haystack or "legion" in haystack or "rog" in haystack):
            score += 2.0
        if budget is not None:
            price = item["price"]
            if price <= budget * 1.08 and price >= budget * 0.45:
                closeness = 1.0 - min(1.0, abs(price - budget) / max(budget, 1))
                score += 3.0 + closeness * 2.0
            elif price > budget * 1.35:
                score -= 2.5
        if want_cheap and item["price"] <= 12_000_000:
            score += 2.5 - (item["price"] / 12_000_000)

        if score > 0:
            scored.append((score, item))

    scored.sort(key=lambda pair: (-pair[0], pair[1]["price"]))
    results: list[dict[str, Any]] = []
    if pinned:
        results.append(pinned)
    for _, item in scored:
        if len(results) >= limit:
            break
        results.append(item)

    if not results:
        if budget is not None:
            near = sorted(DEMO_PRODUCTS, key=lambda p: abs(p["price"] - budget))[:limit]
            results.extend(near)
        else:
            results.extend(DEMO_PRODUCTS[:limit])
    return results[:limit]


def build_demo_fallback_reply(
    query: str,
    matches: list[dict[str, Any]],
    language: str = "uz",
) -> str:
    """Clean, natural store consultant reply when external LLM is unavailable."""
    norm = normalize_for_matching(query or "")
    lang = language if language in {"uz", "ru", "en"} else "uz"

    if any(w in norm for w in ("nasiya", "kredit", "rassrochka", "installment", "bolib")):
        ref = matches[0] if matches else DEMO_PRODUCTS[0]
        m12 = fmt_uzs(round(ref["price"] / 12))
        if lang == "ru":
            return (
                f"Рассрочка на 12 месяцев без первоначального взноса доступна на любую модель.\n\n"
                f"Например, {ref['name']} ({fmt_uzs(ref['price'])}):\n"
                f"• на 12 мес: ~{m12.replace('som', 'сум')}/мес\n\n"
                "Нажмите «Заказать» у нужного товара, и заявка сразу уйдет в @Selloi_ai_bot."
            )
        if lang == "en":
            return (
                f"12-month installment plans are available across the catalog.\n\n"
                f"Example for {ref['name']} ({fmt_uzs(ref['price'])}):\n"
                f"• 12 months: ~{m12}/mo\n\n"
                "Click Order on any item to see the live @Selloi_ai_bot reply."
            )
        return (
            f"12 oylik bo'lib to'lash barcha modellar uchun amal qiladi.\n\n"
            f"Masalan, {ref['name']} ({fmt_uzs(ref['price'])}):\n"
            f"• 12 oy: oyiga ~{m12}\n\n"
            "Yoqqan modelda «Buyurtma berish» tugmasini bossangiz, @Selloi_ai_bot shu yerning o'zida tasdiqlaydi."
        )

    if any(w in norm for w in ("kafolat", "garantiya", "warranty")):
        if lang == "ru":
            return (
                "Официальная гарантия на весь каталог:\n"
                "• Ноутбуки и мониторы: 1–3 года\n"
                "• Игровые ПК: 2–3 года\n"
                "• Бесплатная диагностика и сервис в Ташкенте."
            )
        if lang == "en":
            return (
                "Official store warranty covers all 100 items:\n"
                "• Laptops & monitors: 1–3 years\n"
                "• Custom PCs: 2–3 years\n"
                "• Free diagnostics and hardware swap in Tashkent."
            )
        return (
            "Katalogdagi barcha 100 ta mahsulotga rasmiy do'kon kafolati beriladi:\n"
            "• Noutbuk va monitorlar: 1–3 yil\n"
            "• Yig'ilgan gaming PClar: 2–3 yil\n"
            "• Nosozlik chiqsa, Toshkent servis markazida bepul almashtiriladi."
        )

    top = matches[:3]
    lines = []
    for idx, p in enumerate(top, 1):
        first_spec = p["specs"].split("|")[0].strip()
        lines.append(f"{idx}. {p['name']} — {fmt_uzs(p['price'])}\n   {p['specs']} ({p['stock']} dona, {p['warranty']})")
    catalog_text = "\n\n".join(lines)

    if lang == "ru":
        return (
            f"Подобрал подходящие варианты из каталога:\n\n{catalog_text}\n\n"
            "Хотите оформить заказ? Нажмите «Buyurtma berish» или напишите имя и телефон."
        )
    if lang == "en":
        return (
            f"Here are the closest matches from the live catalog:\n\n{catalog_text}\n\n"
            "Want to place an order? Click Order on any card or send your name and phone number."
        )
    return (
        f"Sizning so'rovingizga mos eng yaxshi variantlar:\n\n{catalog_text}\n\n"
        "Buyurtma berish uchun «Buyurtma berish» tugmasini bosing yoki ismingiz va raqamingizni yozing."
    )
