/**
 * ~200 customer rows with type distribution:
 * TH (Tap hoa): 56 (28%), GSO (Bach hoa): 68 (34%), PHA (Nha thuoc): 28 (14%),
 * SPS (Me & Be): 24 (12%), BTS (My pham): 18 (9%),
 * OTHER (Khac): 2 (~1%), PLT (Phu lieu toc): 2 (~1%), WMO (Cho): 2 (~1%)
 *
 * Total: 200 customers
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

const PROVINCES = [
  'Ha Noi', 'Ho Chi Minh', 'Da Nang', 'Hai Phong', 'Can Tho',
  'Binh Duong', 'Dong Nai', 'Bac Ninh', 'Quang Ninh', 'Nghe An',
  'Thanh Hoa', 'Khanh Hoa', 'Lam Dong', 'Thua Thien Hue', 'Long An',
]

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
    { type: 'TH', count: 56 },
    { type: 'GSO', count: 68 },
    { type: 'PHA', count: 28 },
    { type: 'SPS', count: 24 },
    { type: 'BTS', count: 18 },
    { type: 'OTHER', count: 2 },
    { type: 'PLT', count: 2 },
    { type: 'WMO', count: 2 },
  ]

  const customers: Customer[] = []
  let globalIdx = 0

  for (const { type, count } of typeDistribution) {
    for (let i = 0; i < count; i++) {
      const code = `KH-${type}-${String(i + 1).padStart(3, '0')}`
      const firstName = FIRST_NAMES[globalIdx % FIRST_NAMES.length]
      const lastName = LAST_NAMES[(globalIdx * 7 + 3) % LAST_NAMES.length]
      const name = `${TYPE_LABELS[type]} ${firstName} ${lastName}`

      const provinceIdx = globalIdx % PROVINCES.length
      const province = PROVINCES[provinceIdx]
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
        is_geo_located: h3 < 0.45, // ~45% geo-located
      })

      globalIdx++
    }
  }

  return customers
}

export const CUSTOMERS = generateCustomers()
