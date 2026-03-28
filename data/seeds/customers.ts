/**
 * ~450 customer rows with type distribution:
 * TH (Tap hoa): 126 (28%), GSO (Bach hoa): 153 (34%), PHA (Nha thuoc): 63 (14%),
 * SPS (Me & Be): 54 (12%), BTS (My pham): 40 (9%),
 * OTHER (Khac): 5 (~1%), PLT (Phu lieu toc): 5 (~1%), WMO (Cho): 4 (~1%)
 *
 * Total: 450 customers
 * HCMC ~25%, Ha Noi ~15%, Da Nang ~8%, long tail for others
 * 70% geo-located
 */

interface Customer {
  customer_code: string
  customer_name: string
  customer_type: string
  province: string
  district: string
  is_active: boolean
  is_mapped: boolean
  is_geo_located: boolean
}

// Province weights for geographic clustering: HCMC ~25%, Ha Noi ~15%, Da Nang ~8%
const PROVINCE_WEIGHTS: Array<{ name: string; weight: number }> = [
  { name: 'Ho Chi Minh', weight: 25 },
  { name: 'Ha Noi', weight: 15 },
  { name: 'Da Nang', weight: 8 },
  { name: 'Hai Phong', weight: 6 },
  { name: 'Can Tho', weight: 6 },
  { name: 'Binh Duong', weight: 6 },
  { name: 'Dong Nai', weight: 5 },
  { name: 'Bac Ninh', weight: 4 },
  { name: 'Quang Ninh', weight: 4 },
  { name: 'Nghe An', weight: 4 },
  { name: 'Thanh Hoa', weight: 4 },
  { name: 'Khanh Hoa', weight: 4 },
  { name: 'Lam Dong', weight: 3 },
  { name: 'Thua Thien Hue', weight: 3 },
  { name: 'Long An', weight: 3 },
]

const PROVINCES = PROVINCE_WEIGHTS.map(p => p.name)

const DISTRICTS_BY_PROVINCE: Record<string, string[]> = {
  'Ha Noi': ['Ba Dinh', 'Hoan Kiem', 'Dong Da', 'Cau Giay', 'Thanh Xuan', 'Ha Dong', 'Long Bien', 'Nam Tu Liem'],
  'Ho Chi Minh': ['Quan 1', 'Quan 3', 'Quan 7', 'Binh Thanh', 'Go Vap', 'Phu Nhuan', 'Thu Duc', 'Tan Binh'],
  'Da Nang': ['Hai Chau', 'Thanh Khe', 'Son Tra', 'Ngu Hanh Son', 'Cam Le'],
  'Hai Phong': ['Hong Bang', 'Le Chan', 'Ngo Quyen', 'Kien An'],
  'Can Tho': ['Ninh Kieu', 'Cai Rang', 'Binh Thuy', 'O Mon'],
  'Binh Duong': ['Thu Dau Mot', 'Di An', 'Thuan An', 'Ben Cat'],
  'Dong Nai': ['Bien Hoa', 'Long Thanh', 'Nhon Trach', 'Trang Bom'],
  'Bac Ninh': ['Bac Ninh', 'Tu Son', 'Tien Du', 'Yen Phong'],
  'Quang Ninh': ['Ha Long', 'Cam Pha', 'Uong Bi', 'Mong Cai'],
  'Nghe An': ['Vinh', 'Cua Lo', 'Thai Hoa'],
  'Thanh Hoa': ['Thanh Hoa', 'Bim Son', 'Sam Son'],
  'Khanh Hoa': ['Nha Trang', 'Cam Ranh', 'Ninh Hoa'],
  'Lam Dong': ['Da Lat', 'Bao Loc'],
  'Thua Thien Hue': ['Hue', 'Huong Thuy'],
  'Long An': ['Tan An', 'Kien Tuong', 'Ben Luc'],
}

// Vietnamese name components for store names
const FIRST_NAMES = [
  'Minh', 'Thanh', 'Hoang', 'Phuong', 'Hai', 'Lan', 'Hoa', 'Thu',
  'Duc', 'Binh', 'Anh', 'Tuan', 'Hung', 'Long', 'Ngoc', 'Quang',
  'Trung', 'Phuc', 'Dat', 'Khanh', 'Vinh', 'Trang', 'Linh', 'Huy',
  'Son', 'Tam', 'Dung', 'Nam', 'Cuong', 'Thao',
]

const LAST_NAMES = [
  'Anh', 'Binh', 'Chi', 'Dung', 'Em', 'Gia', 'Hien', 'Khoa',
  'Lam', 'My', 'Nhi', 'Oanh', 'Phat', 'Quy', 'Sen', 'Tien',
]

const TYPE_LABELS: Record<string, string> = {
  TH: 'Tap hoa',
  GSO: 'Bach hoa',
  PHA: 'Nha thuoc',
  SPS: 'Me Be',
  BTS: 'My pham',
  OTHER: 'Cua hang',
  PLT: 'Phu lieu toc',
  WMO: 'Cho',
}

// Deterministic hash
function detHash(seed: number): number {
  let x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

function generateCustomers(): Customer[] {
  const typeDistribution: Array<{ type: string; count: number }> = [
    { type: 'TH', count: 126 },   // 28%
    { type: 'GSO', count: 153 },  // 34%
    { type: 'PHA', count: 63 },   // 14%
    { type: 'SPS', count: 54 },   // 12%
    { type: 'BTS', count: 40 },   // 9%
    { type: 'OTHER', count: 5 },  // ~1%
    { type: 'PLT', count: 5 },    // ~1%
    { type: 'WMO', count: 4 },    // ~1%
  ]

  const customers: Customer[] = []
  let globalIdx = 0

  for (const { type, count } of typeDistribution) {
    for (let i = 0; i < count; i++) {
      const code = `KH-${type}-${String(i + 1).padStart(3, '0')}`
      const firstName = FIRST_NAMES[globalIdx % FIRST_NAMES.length]
      const lastName = LAST_NAMES[(globalIdx * 7 + 3) % LAST_NAMES.length]
      const name = `${TYPE_LABELS[type]} ${firstName} ${lastName}`

      // Weighted province selection using deterministic hash
      const provHash = detHash(globalIdx * 10 + 7)
      let cumWeight = 0
      const totalWeight = PROVINCE_WEIGHTS.reduce((s, p) => s + p.weight, 0)
      let province = PROVINCES[0]
      for (const pw of PROVINCE_WEIGHTS) {
        cumWeight += pw.weight
        if (provHash < cumWeight / totalWeight) {
          province = pw.name
          break
        }
      }
      const districts = DISTRICTS_BY_PROVINCE[province]
      const district = districts[(globalIdx * 3 + 1) % districts.length]

      const h1 = detHash(globalIdx * 10 + 1)
      const h2 = detHash(globalIdx * 10 + 2)
      const h3 = detHash(globalIdx * 10 + 3)

      customers.push({
        customer_code: code,
        customer_name: name,
        customer_type: type,
        province,
        district,
        is_active: h1 < 0.85,    // ~85% active
        is_mapped: h2 < 0.60,    // ~60% mapped
        is_geo_located: h3 < 0.70, // ~70% geo-located
      })

      globalIdx++
    }
  }

  return customers
}

export const CUSTOMERS = generateCustomers()
