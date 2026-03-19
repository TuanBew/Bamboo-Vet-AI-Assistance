/**
 * 62 products extracted from samples/Danh_muc_san_pham_FULL.xlsx
 *
 * Unit prices are deterministic — spread across classification-based ranges
 * using the product index within each classification group.
 */

export const PRODUCTS = [
  // --- NHOM SAN PHAM BO TRO, BO SUNG DINH DUONG — TABS (nutritional) ---
  { product_code: 'MEGA-BIO', product_name: 'MEGA-BIO', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'TABS', packaging: 'Quy cách: 1Kg', manufacturer: 'Megavet', unit_price: 180000 },
  { product_code: 'MEGA-VIT', product_name: 'MEGA-VIT', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'TABS', packaging: 'Quy cách: 1Kg', manufacturer: 'Megavet', unit_price: 210000 },
  { product_code: 'MEGA-KC', product_name: 'MEGA-KC', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'TABS', packaging: 'Quy cách: 1Kg', manufacturer: 'Megavet', unit_price: 240000 },
  { product_code: 'MEGA-LIVE', product_name: 'MEGA-LIVE', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'TABS', packaging: 'Quy cách: 1Kg', manufacturer: 'Megavet', unit_price: 270000 },
  { product_code: 'MEGA-REVIVAL-L', product_name: 'MEGA-REVIVAL LIQUID', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'TABS', packaging: 'Chai 1 lít, can 2 lít, 5 lít', manufacturer: 'Megavet', unit_price: 300000 },
  { product_code: 'MEGA-RESPIRE', product_name: 'MEGA-RESPIRE', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'TABS', packaging: 'Chai, lọ 100ml, 500ml, 1 lít', manufacturer: 'Megavet', unit_price: 330000 },
  { product_code: 'MEGA-VILLI', product_name: 'MEGA VILLI SUPPORT L', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'TABS', packaging: 'Chai 1 lít, can 2 lít, 5 lít', manufacturer: 'Megavet', unit_price: 350000 },
  { product_code: 'MEGA-ZYME', product_name: 'MEGA ZYME LIQUID', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'TABS', packaging: 'Chai 1 lít, can 2 lít, 5 lít', manufacturer: 'Megavet', unit_price: 380000 },
  { product_code: 'MEGA-CALPHOS', product_name: 'MEGA CALPHOS', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'TABS', packaging: 'Chai 1 lít', manufacturer: 'Megavet', unit_price: 400000 },
  { product_code: 'MEGA-SELEN-E', product_name: 'MEGA SELEN E LIQUID', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'TABS', packaging: 'Chai 1 lít', manufacturer: 'Megavet', unit_price: 420000 },
  { product_code: 'KETONFIX', product_name: 'KETONFIX', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'TABS', packaging: 'Chai 1 lít', manufacturer: 'Megavet', unit_price: 450000 },
  { product_code: 'MEGA-REVIVAL-P', product_name: 'MEGA-REVIVAL POWDER', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'TABS', packaging: 'Bao, gói 1kg', manufacturer: 'Megavet', unit_price: 200000 },
  { product_code: 'SYNMILK', product_name: 'SYNMILK (MEGA LACTO)', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'TABS', packaging: 'Bao, gói 1kg', manufacturer: 'Megavet', unit_price: 250000 },
  { product_code: 'PREMIX-BO', product_name: 'PREMIX BÒ THỊT (ROCKET BULL)', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'TABS', packaging: 'Bao, gói 1kg', manufacturer: 'Megavet', unit_price: 280000 },
  { product_code: 'TOP-SURE', product_name: 'TOP-SURE', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'TABS', packaging: 'Chai 1 lít', manufacturer: 'TOPCIN', unit_price: 320000 },
  { product_code: 'VITAMINO', product_name: 'VITAMINO', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'TABS', packaging: 'Chai 1 Lít', manufacturer: 'TOPCIN', unit_price: 340000 },
  { product_code: 'TOP-HEPATOL', product_name: 'TOP HEPATOL ORAL', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'TABS', packaging: 'Chai 1 lít', manufacturer: 'TOPCIN', unit_price: 360000 },
  { product_code: 'CALPHOS-PLUS', product_name: 'CALPHOS PLUS', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'TABS', packaging: 'Chai 100ml, 1 lít', manufacturer: 'Khác', unit_price: 290000 },
  { product_code: 'TOP-EGG', product_name: 'TOP-EGG POWDER', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'TABS', packaging: 'Gói 1 kg', manufacturer: 'TOPCIN', unit_price: 310000 },
  { product_code: 'ADE-SOLUTION', product_name: 'ADE SOLUTION', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'TABS', packaging: 'Bao, gói 1kg', manufacturer: 'TOPCIN', unit_price: 260000 },
  { product_code: 'TOP-PHOSRETIC', product_name: 'TOP-PHOSRETIC', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'TABS', packaging: 'Gói 100g, Chai, hộp 1kg', manufacturer: 'Khác', unit_price: 230000 },
  { product_code: 'MERRIVIT-AD3E', product_name: 'MERRIVIT AD3E', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'TABS', packaging: 'Chai 1 lít', manufacturer: 'SUPER DIANA', unit_price: 370000 },
  { product_code: 'MERRI-SEL-E', product_name: 'MERRI Sel + E Liquid', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'TABS', packaging: 'Chai 1 lít', manufacturer: 'SUPER DIANA', unit_price: 390000 },
  { product_code: 'GROBIG-BS', product_name: 'GROBIG BS', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'TABS', packaging: 'Bao 5kg', manufacturer: 'Elanco', unit_price: 480000 },

  // --- Kháng sinh (antibiotics) ---
  { product_code: 'AD-AMICOL', product_name: 'AD AMICOL W.S.P', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'Kháng sinh', packaging: 'Bao, gói 1 kg', manufacturer: 'ADBIOTECH', unit_price: 350000 },
  { product_code: 'AMOX-20', product_name: 'AMOX 20%', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'Kháng sinh', packaging: 'Gói 1kg', manufacturer: 'Sakan', unit_price: 280000 },
  { product_code: 'SAQUINO', product_name: 'SAQUINO', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'Kháng sinh', packaging: 'Chai 1 lít', manufacturer: 'Sakan', unit_price: 420000 },
  { product_code: 'CLAMOXCIN', product_name: 'CLAMOXCIN', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'Kháng sinh', packaging: 'Gói 100g, 1kg; thùng 2kg, 5kg', manufacturer: 'Sakan', unit_price: 480000 },
  { product_code: 'DAINALIN', product_name: 'DAINALIN', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'Kháng sinh', packaging: null, manufacturer: 'Khác', unit_price: 320000 },
  { product_code: 'AD-AMIPHEN', product_name: 'AD.AMIPHEN 300 POWDER', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'Kháng sinh', packaging: 'Gói 100 g, Gói 1 kg', manufacturer: 'AD PHARMA', unit_price: 550000 },
  { product_code: 'DOKSIVIL', product_name: 'DOKSIVIL', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'Kháng sinh', packaging: 'Chai 1kg', manufacturer: 'VILSAN', unit_price: 380000 },
  { product_code: 'CEFTIVIL', product_name: 'CEFTIVIL', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'Kháng sinh', packaging: 'Lọ 100ml', manufacturer: 'VILSAN', unit_price: 620000 },
  { product_code: 'VILACOL', product_name: 'VILACOL', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'Kháng sinh', packaging: 'Chai 100 g, 1 kg', manufacturer: 'VILSAN', unit_price: 450000 },
  { product_code: 'FLORVIL', product_name: 'FLORVIL', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'Kháng sinh', packaging: 'Lọ 100 ml', manufacturer: 'VILSAN', unit_price: 580000 },
  { product_code: 'PRIMAFUL', product_name: 'PRIMAFUL', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'Kháng sinh', packaging: 'Lọ 100 ml', manufacturer: 'VILSAN', unit_price: 520000 },
  { product_code: 'KLAVIL', product_name: 'KLAVIL', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'Kháng sinh', packaging: 'Lọ 100 ml', manufacturer: 'VILSAN', unit_price: 680000 },
  { product_code: 'VILAMOKS-LA', product_name: 'VILAMOKS-LA', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'Kháng sinh', packaging: 'Lọ 100 ml, 250 ml', manufacturer: 'VILSAN', unit_price: 750000 },
  { product_code: 'FLOVIL-20', product_name: 'FLOVIL 20%', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'Kháng sinh', packaging: 'Chai 1 lít', manufacturer: 'VILSAN', unit_price: 500000 },
  { product_code: 'MAKROVIL', product_name: 'MAKROVIL', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'Kháng sinh', packaging: 'Chai 240 ml, 480 ml', manufacturer: 'VILSAN', unit_price: 650000 },
  { product_code: 'LYPECTIN', product_name: 'LYPECTIN', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'Kháng sinh', packaging: 'Lọ 100 ml', manufacturer: 'VILSAN', unit_price: 720000 },
  { product_code: 'FURAVET', product_name: 'FURAVET', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'Kháng sinh', packaging: 'Chai 100 g, 1 kg', manufacturer: 'VILSAN', unit_price: 400000 },

  // --- SP Bổ trợ ---
  { product_code: 'VITAMIN-K', product_name: 'VITAMIN K', product_group: 'Nhóm sản phẩm hỗ trợ phòng và điều trị', classification: 'SP Bổ trợ', packaging: null, manufacturer: 'TOPCIN', unit_price: 150000 },
  { product_code: 'CHYMOCIN', product_name: 'CHYMOCIN', product_group: 'Nhóm sản phẩm hỗ trợ phòng và điều trị', classification: 'SP Bổ trợ', packaging: 'Chai 1 lít', manufacturer: 'TOPCIN', unit_price: 250000 },
  { product_code: 'BROMEN', product_name: 'BROMEN', product_group: 'Nhóm sản phẩm hỗ trợ phòng và điều trị', classification: 'SP Bổ trợ', packaging: 'Chai 1 lít', manufacturer: 'TOPCIN', unit_price: 350000 },

  // --- Hạ sốt - Giảm đau ---
  { product_code: 'PARA-DEXA', product_name: 'PARA-DEXA', product_group: 'Nhóm sản phẩm hỗ trợ phòng và điều trị', classification: 'Hạ sốt - Giảm đau', packaging: 'Gói 1 kg', manufacturer: 'Sakan', unit_price: 150000 },
  { product_code: 'PARADOL-KC', product_name: 'PARADOL K+C', product_group: 'Nhóm sản phẩm hỗ trợ phòng và điều trị', classification: 'Hạ sốt - Giảm đau', packaging: 'Bao, gói 1kg', manufacturer: 'TOPCIN', unit_price: 230000 },
  { product_code: 'SALICYLAT-KC', product_name: 'SALICYLAT KC', product_group: 'Nhóm sản phẩm hỗ trợ phòng và điều trị', classification: 'Hạ sốt - Giảm đau', packaging: 'Gói 1kg', manufacturer: 'VB Pharma', unit_price: 310000 },

  // --- Thuốc sát trùng ---
  { product_code: 'SAGLUXIDE', product_name: 'SAGLUXIDE', product_group: 'Nhóm sản phẩm bột lăn, sát trùng chuồng trại, xử lý CTCN', classification: 'Thuốc sát trùng', packaging: 'Chai 1 lít, can 2 lít, 5 lít', manufacturer: 'Sakan', unit_price: 120000 },
  { product_code: 'UTRACIDE', product_name: 'UTRACIDE 2.0', product_group: 'Nhóm sản phẩm bột lăn, sát trùng chuồng trại, xử lý CTCN', classification: 'Thuốc sát trùng', packaging: 'Chai, can 1 lít', manufacturer: 'TOPCIN', unit_price: 200000 },
  { product_code: 'TC-5PLUS', product_name: 'TC 5PLUS', product_group: 'Nhóm sản phẩm bột lăn, sát trùng chuồng trại, xử lý CTCN', classification: 'Thuốc sát trùng', packaging: 'Chai 1 lít', manufacturer: 'TOPCIN', unit_price: 280000 },

  // --- SP xử lý CTCN ---
  { product_code: 'MEGA-FARMCLEAN', product_name: 'MEGA FARMCLEAN LIQUID', product_group: 'Nhóm sản phẩm bột lăn, sát trùng chuồng trại, xử lý CTCN', classification: 'SP xử lý CTCN', packaging: 'Chai 1 lít, can 2 lít, 5 lít', manufacturer: 'Megavet', unit_price: 130000 },
  { product_code: 'MEGA-GREEN', product_name: 'MEGA GREEN', product_group: 'Nhóm sản phẩm bột lăn, sát trùng chuồng trại, xử lý CTCN', classification: 'SP xử lý CTCN', packaging: 'Gói 1kg', manufacturer: 'Megavet', unit_price: 180000 },

  // --- SP rắc chuồng ---
  { product_code: 'VIDALIX-SWINE', product_name: 'VIDALIX SWINE', product_group: 'Nhóm sản phẩm bột lăn, sát trùng chuồng trại, xử lý CTCN', classification: 'SP rắc chuồng', packaging: 'Gói 1 kg, Bao 5 kg, Bao 25 kg', manufacturer: 'Gold Coin', unit_price: 100000 },
  { product_code: 'VIDALIX-POULTRY', product_name: 'VIDALIX POULTRY', product_group: 'Nhóm sản phẩm bột lăn, sát trùng chuồng trại, xử lý CTCN', classification: 'SP rắc chuồng', packaging: 'Gói 1 kg, Bao 5 kg, Bao 25 kg', manufacturer: 'Gold Coin', unit_price: 120000 },

  // --- Cầu trùng, ký sinh trùng ---
  { product_code: 'COCIS', product_name: 'COCIS', product_group: 'Nhóm sản phẩm điều trị ký sinh trùng, cầu trùng', classification: 'Cầu trùng, ký sinh trùng', packaging: 'Gói 1kg', manufacturer: 'Sakan', unit_price: 200000 },
  { product_code: 'MEGCOX', product_name: 'MEGCOX (SAKACOC5)', product_group: 'Nhóm sản phẩm điều trị ký sinh trùng, cầu trùng', classification: 'Cầu trùng, ký sinh trùng', packaging: 'Chai 100ml, 250ml', manufacturer: 'Sakan', unit_price: 300000 },
  { product_code: 'IVERMECTIN', product_name: 'IVERMECTIN', product_group: 'Nhóm sản phẩm điều trị ký sinh trùng, cầu trùng', classification: 'Cầu trùng, ký sinh trùng', packaging: 'Bao, gói 1 kg', manufacturer: 'TOPCIN', unit_price: 380000 },
  { product_code: 'AD-DICLASOL', product_name: 'AD DICLASOL', product_group: 'Nhóm sản phẩm điều trị ký sinh trùng, cầu trùng', classification: 'Cầu trùng, ký sinh trùng', packaging: 'Chai 1 lít', manufacturer: 'ADBIOTECH', unit_price: 450000 },
  { product_code: 'TRISULFA', product_name: 'TRISULFA', product_group: 'Nhóm sản phẩm điều trị ký sinh trùng, cầu trùng', classification: 'Ký sinh trùng', packaging: 'Bao, gói 1kg', manufacturer: 'Sakan', unit_price: 260000 },
  { product_code: 'LEVAMIN', product_name: 'LEVAMIN', product_group: 'Nhóm sản phẩm điều trị ký sinh trùng, cầu trùng', classification: 'Cầu trùng, ký sinh trùng', packaging: 'Hộp 500 g, 1 kg', manufacturer: 'VILSAN', unit_price: 520000 },
  { product_code: 'AMPROVIL', product_name: 'AMPROVIL', product_group: 'Nhóm sản phẩm điều trị ký sinh trùng, cầu trùng', classification: 'Cầu trùng, ký sinh trùng', packaging: 'Chai 1 lít', manufacturer: 'VILSAN', unit_price: 580000 },

  // --- Thuốc bổ ---
  { product_code: 'KATOVIL', product_name: 'KATOVIL', product_group: 'Nhóm sản phẩm bổ trợ, bổ sung dinh dưỡng', classification: 'Thuốc bổ', packaging: 'Lọ 100 ml', manufacturer: 'VILSAN', unit_price: 280000 },
]
