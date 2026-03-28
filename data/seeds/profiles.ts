/**
 * Deterministic profile generator for Bamboo Vet seed data.
 *
 * Produces 132 profiles (130 non-admin + 2 admin) spread across
 * Vietnamese provinces with realistic geographic coordinates.
 *
 * Deterministic: same output on every run.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProfileSeed {
  id: string
  full_name: string
  email: string
  is_admin: boolean
  province: string
  district: string
  ward: string
  region: string
  latitude: number
  longitude: number
  clinic_type: string
  facility_code: string
  staff_code: string
  created_at: string
}

// ---------------------------------------------------------------------------
// Deterministic hash (same pattern as customers.ts)
// ---------------------------------------------------------------------------

function detHash(seed: number): number {
  let x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

function deterministicHash(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

// ---------------------------------------------------------------------------
// UUID helper
// ---------------------------------------------------------------------------

function profileUuid(index: number): string {
  const hex = index.toString(16).padStart(4, '0')
  // p0a20001-2b3c-4d5e-9f6a-XXXXXXXXXXXX
  return `p0a20001-2b3c-4d5e-9f6a-${hex.padStart(12, '0')}`
}

// ---------------------------------------------------------------------------
// Vietnamese name pools
// ---------------------------------------------------------------------------

const FAMILY_NAMES = [
  'Nguyen', 'Tran', 'Le', 'Pham', 'Hoang', 'Huynh', 'Phan', 'Vu',
  'Vo', 'Dang', 'Bui', 'Do', 'Ho', 'Ngo', 'Duong', 'Ly',
  'Ha', 'Truong', 'Luu', 'Luong', 'Trinh', 'Dinh', 'Mai', 'Cao',
  'Lam', 'Doan', 'Ta', 'Chau', 'Quach', 'Dam', 'Nghiem', 'Khuat',
  'Kieu', 'Giap', 'Bach', 'Mac', 'Ton', 'Tong', 'Vuong', 'Thach',
  'Phung', 'Tieu', 'Sa', 'Uong', 'Trieu', 'Cung', 'Van', 'Mach',
  'Au', 'Lac',
]

const MIDDLE_NAMES = [
  'Van', 'Thi', 'Huu', 'Ngoc', 'Quoc', 'Duy', 'Anh', 'Minh',
  'Hong', 'Dinh', 'Thanh', 'Xuan', 'Duc', 'Quang', 'Hoang', 'Thi',
]

const GIVEN_NAMES = [
  'An', 'Binh', 'Chi', 'Diem', 'Giang', 'Hoa', 'Hung', 'Khanh',
  'Lam', 'Long', 'Minh', 'Nam', 'Nhi', 'Oanh', 'Phuc', 'Quyen',
  'Sang', 'Tam', 'Trinh', 'Uyen', 'Vinh', 'Yen', 'Cuong', 'Dat',
  'Dung', 'Ha', 'Hien', 'Khoa', 'Lan', 'Son',
]

// ---------------------------------------------------------------------------
// Province/District/Ward data with coordinates
// ---------------------------------------------------------------------------

interface ProvinceData {
  name: string
  region: string
  districts: { name: string; ward: string; latCenter: number; lngCenter: number }[]
  count: number // how many profiles assigned to this province
}

const PROVINCES: ProvinceData[] = [
  {
    name: 'Ha Noi', region: 'Bac', count: 20,
    districts: [
      { name: 'Thanh Xuan', ward: 'Khuong Trung', latCenter: 21.0010, lngCenter: 105.8150 },
      { name: 'Dong Da', ward: 'Kham Thien', latCenter: 21.0200, lngCenter: 105.8350 },
      { name: 'Hoang Mai', ward: 'Dinh Cong', latCenter: 20.9850, lngCenter: 105.8500 },
      { name: 'Cau Giay', ward: 'Dich Vong', latCenter: 21.0350, lngCenter: 105.7900 },
      { name: 'Ha Dong', ward: 'Mo Lao', latCenter: 20.9700, lngCenter: 105.7800 },
      { name: 'Long Bien', ward: 'Ngoc Lam', latCenter: 21.0450, lngCenter: 105.8700 },
    ],
  },
  {
    name: 'TP. Ho Chi Minh', region: 'Nam', count: 25,
    districts: [
      { name: 'Binh Thanh', ward: 'Phuong 25', latCenter: 10.8000, lngCenter: 106.6950 },
      { name: 'Tan Phu', ward: 'Son Ky', latCenter: 10.7950, lngCenter: 106.6300 },
      { name: 'Thu Duc', ward: 'Linh Chieu', latCenter: 10.8500, lngCenter: 106.7700 },
      { name: 'Quan 1', ward: 'Ben Nghe', latCenter: 10.7750, lngCenter: 106.7000 },
      { name: 'Quan 7', ward: 'Tan Phong', latCenter: 10.7350, lngCenter: 106.7300 },
      { name: 'Go Vap', ward: 'Phuong 1', latCenter: 10.8380, lngCenter: 106.6550 },
      { name: 'Phu Nhuan', ward: 'Phuong 2', latCenter: 10.8000, lngCenter: 106.6800 },
    ],
  },
  {
    name: 'Da Nang', region: 'Trung', count: 10,
    districts: [
      { name: 'Lien Chieu', ward: 'Hoa Minh', latCenter: 16.0750, lngCenter: 108.1500 },
      { name: 'Hai Chau', ward: 'Thach Thang', latCenter: 16.0600, lngCenter: 108.2200 },
      { name: 'Son Tra', ward: 'An Hai Bac', latCenter: 16.0900, lngCenter: 108.2400 },
    ],
  },
  {
    name: 'Binh Duong', region: 'Nam', count: 8,
    districts: [
      { name: 'Thu Dau Mot', ward: 'Phu Hoa', latCenter: 11.0100, lngCenter: 106.6500 },
      { name: 'Di An', ward: 'Dong Hoa', latCenter: 10.8950, lngCenter: 106.7700 },
      { name: 'Thuan An', ward: 'Lai Thieu', latCenter: 10.9300, lngCenter: 106.7100 },
    ],
  },
  {
    name: 'Dong Nai', region: 'Nam', count: 7,
    districts: [
      { name: 'Bien Hoa', ward: 'Trung Dung', latCenter: 10.9600, lngCenter: 106.8500 },
      { name: 'Long Thanh', ward: 'Long Thanh', latCenter: 10.7900, lngCenter: 106.9200 },
    ],
  },
  {
    name: 'Hai Phong', region: 'Bac', count: 6,
    districts: [
      { name: 'Le Chan', ward: 'An Bien', latCenter: 20.8450, lngCenter: 106.6800 },
      { name: 'Hong Bang', ward: 'Hoang Van Thu', latCenter: 20.8600, lngCenter: 106.6700 },
    ],
  },
  {
    name: 'Can Tho', region: 'Nam', count: 5,
    districts: [
      { name: 'Ninh Kieu', ward: 'An Hoa', latCenter: 10.0350, lngCenter: 105.7750 },
      { name: 'Cai Rang', ward: 'Le Binh', latCenter: 10.0100, lngCenter: 105.7600 },
    ],
  },
  // Long tail provinces (~49 users across 20+ provinces)
  {
    name: 'Nghe An', region: 'Trung', count: 4,
    districts: [
      { name: 'Vinh', ward: 'Cua Nam', latCenter: 18.6750, lngCenter: 105.6750 },
    ],
  },
  {
    name: 'Lam Dong', region: 'Trung', count: 4,
    districts: [
      { name: 'Da Lat', ward: 'Phuong 1', latCenter: 11.9400, lngCenter: 108.4350 },
    ],
  },
  {
    name: 'Thua Thien Hue', region: 'Trung', count: 4,
    districts: [
      { name: 'Hue', ward: 'Phu Hoi', latCenter: 16.4650, lngCenter: 107.5900 },
    ],
  },
  {
    name: 'Thai Nguyen', region: 'Bac', count: 3,
    districts: [
      { name: 'Song Cong', ward: 'Phuc Ha', latCenter: 21.4800, lngCenter: 105.8500 },
    ],
  },
  {
    name: 'Khanh Hoa', region: 'Trung', count: 3,
    districts: [
      { name: 'Nha Trang', ward: 'Loc Tho', latCenter: 12.2350, lngCenter: 109.1950 },
    ],
  },
  {
    name: 'Thanh Hoa', region: 'Bac', count: 3,
    districts: [
      { name: 'Thanh Hoa', ward: 'Dong Son', latCenter: 19.8000, lngCenter: 105.7700 },
    ],
  },
  {
    name: 'Quang Ninh', region: 'Bac', count: 3,
    districts: [
      { name: 'Ha Long', ward: 'Bach Dang', latCenter: 20.9550, lngCenter: 107.0800 },
    ],
  },
  {
    name: 'Bac Ninh', region: 'Bac', count: 2,
    districts: [
      { name: 'Bac Ninh', ward: 'Dai Phuc', latCenter: 21.1850, lngCenter: 106.0750 },
    ],
  },
  {
    name: 'Long An', region: 'Nam', count: 2,
    districts: [
      { name: 'Tan An', ward: 'Phuong 1', latCenter: 10.5350, lngCenter: 106.4100 },
    ],
  },
  {
    name: 'Gia Lai', region: 'Trung', count: 2,
    districts: [
      { name: 'Pleiku', ward: 'Hoa Lu', latCenter: 13.9830, lngCenter: 107.9910 },
    ],
  },
  {
    name: 'Dak Lak', region: 'Trung', count: 2,
    districts: [
      { name: 'Buon Ma Thuot', ward: 'Tan An', latCenter: 12.6800, lngCenter: 108.0500 },
    ],
  },
  {
    name: 'An Giang', region: 'Nam', count: 2,
    districts: [
      { name: 'Long Xuyen', ward: 'My Binh', latCenter: 10.3870, lngCenter: 105.4350 },
    ],
  },
  {
    name: 'Ben Tre', region: 'Nam', count: 2,
    districts: [
      { name: 'Ben Tre', ward: 'Phuong 4', latCenter: 10.2410, lngCenter: 106.3750 },
    ],
  },
  {
    name: 'Binh Dinh', region: 'Trung', count: 2,
    districts: [
      { name: 'Quy Nhon', ward: 'Tran Phu', latCenter: 13.7700, lngCenter: 109.2200 },
    ],
  },
  {
    name: 'Vinh Long', region: 'Nam', count: 2,
    districts: [
      { name: 'Vinh Long', ward: 'Phuong 1', latCenter: 10.2540, lngCenter: 105.9720 },
    ],
  },
  {
    name: 'Phu Tho', region: 'Bac', count: 2,
    districts: [
      { name: 'Viet Tri', ward: 'Tien Cat', latCenter: 21.3230, lngCenter: 105.4020 },
    ],
  },
  {
    name: 'Tay Ninh', region: 'Nam', count: 2,
    districts: [
      { name: 'Tay Ninh', ward: 'Phuong 1', latCenter: 11.3100, lngCenter: 106.1000 },
    ],
  },
  {
    name: 'Ha Tinh', region: 'Trung', count: 2,
    districts: [
      { name: 'Ha Tinh', ward: 'Bac Ha', latCenter: 18.3420, lngCenter: 105.9050 },
    ],
  },
  {
    name: 'Nam Dinh', region: 'Bac', count: 1,
    districts: [
      { name: 'Nam Dinh', ward: 'Quang Trung', latCenter: 20.4340, lngCenter: 106.1770 },
    ],
  },
  {
    name: 'Ninh Binh', region: 'Bac', count: 1,
    districts: [
      { name: 'Ninh Binh', ward: 'Dong Thanh', latCenter: 20.2540, lngCenter: 105.9750 },
    ],
  },
  {
    name: 'Quang Nam', region: 'Trung', count: 1,
    districts: [
      { name: 'Tam Ky', ward: 'Phuoc Hoa', latCenter: 15.5740, lngCenter: 108.4740 },
    ],
  },
]

// ---------------------------------------------------------------------------
// Clinic type distribution
// ---------------------------------------------------------------------------

const CLINIC_TYPES = [
  { type: 'Phong kham', weight: 40 },
  { type: 'Nha thuoc', weight: 30 },
  { type: 'Trai chan nuoi', weight: 20 },
  { type: 'My pham', weight: 7 },
  { type: 'Khac', weight: 3 },
]

function pickClinicType(idx: number): string {
  const h = detHash(idx * 31 + 7) * 100
  let cum = 0
  for (const ct of CLINIC_TYPES) {
    cum += ct.weight
    if (h < cum) return ct.type
  }
  return 'Khac'
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export function generateProfiles(): ProfileSeed[] {
  const profiles: ProfileSeed[] = []
  let globalIdx = 1

  // Generate non-admin profiles distributed across provinces
  for (const prov of PROVINCES) {
    for (let i = 0; i < prov.count; i++) {
      const dist = prov.districts[i % prov.districts.length]
      const familyIdx = deterministicHash(`family-${globalIdx}`) % FAMILY_NAMES.length
      const middleIdx = deterministicHash(`middle-${globalIdx}`) % MIDDLE_NAMES.length
      const givenIdx = deterministicHash(`given-${globalIdx}`) % GIVEN_NAMES.length

      const fullName = `${FAMILY_NAMES[familyIdx]} ${MIDDLE_NAMES[middleIdx]} ${GIVEN_NAMES[givenIdx]}`
      const emailName = `${GIVEN_NAMES[givenIdx].toLowerCase()}.${FAMILY_NAMES[familyIdx].toLowerCase()}${String(globalIdx).padStart(2, '0')}`

      // Deterministic lat/lng jitter within ~0.02 degrees of center
      const latJitter = (detHash(globalIdx * 13 + 1) - 0.5) * 0.04
      const lngJitter = (detHash(globalIdx * 13 + 2) - 0.5) * 0.04

      // Created at: spread across Jan 2024 - Dec 2025 (24 months)
      const monthOffset = deterministicHash(`created-${globalIdx}`) % 24
      const dayOffset = deterministicHash(`day-${globalIdx}`) % 28
      const hourOffset = deterministicHash(`hour-${globalIdx}`) % 24
      const minOffset = deterministicHash(`min-${globalIdx}`) % 60
      const year = 2024 + Math.floor(monthOffset / 12)
      const month = (monthOffset % 12) + 1
      const day = dayOffset + 1
      const createdAt = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hourOffset).padStart(2, '0')}:${String(minOffset).padStart(2, '0')}:00Z`

      profiles.push({
        id: profileUuid(globalIdx),
        full_name: fullName,
        email: `${emailName}@example.com`,
        is_admin: false,
        province: prov.name,
        district: dist.name,
        ward: dist.ward,
        region: prov.region,
        latitude: parseFloat((dist.latCenter + latJitter).toFixed(6)),
        longitude: parseFloat((dist.lngCenter + lngJitter).toFixed(6)),
        clinic_type: pickClinicType(globalIdx),
        facility_code: `FAC-${String(globalIdx).padStart(4, '0')}`,
        staff_code: `STF-${String(globalIdx).padStart(4, '0')}`,
        created_at: createdAt,
      })

      globalIdx++
    }
  }

  // 2 admin profiles
  profiles.push({
    id: profileUuid(globalIdx),
    full_name: 'Nguyen Van Admin',
    email: 'admin.nguyen@bamboovet.vn',
    is_admin: true,
    province: 'Ha Noi',
    district: 'Thanh Xuan',
    ward: 'Khuong Trung',
    region: 'Bac',
    latitude: 20.9945,
    longitude: 105.8142,
    clinic_type: 'Phong kham',
    facility_code: `FAC-${String(globalIdx).padStart(4, '0')}`,
    staff_code: `STF-${String(globalIdx).padStart(4, '0')}`,
    created_at: '2024-01-05T08:00:00Z',
  })
  globalIdx++

  profiles.push({
    id: profileUuid(globalIdx),
    full_name: 'Tran Thi Admin',
    email: 'admin.tran@bamboovet.vn',
    is_admin: true,
    province: 'TP. Ho Chi Minh',
    district: 'Binh Thanh',
    ward: 'Phuong 25',
    region: 'Nam',
    latitude: 10.8042,
    longitude: 106.6951,
    clinic_type: 'Phong kham',
    facility_code: `FAC-${String(globalIdx).padStart(4, '0')}`,
    staff_code: `STF-${String(globalIdx).padStart(4, '0')}`,
    created_at: '2024-01-10T09:00:00Z',
  })

  return profiles
}
