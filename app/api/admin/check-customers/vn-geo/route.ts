import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import {
  getProvinces,
  getDistrictsByProvinceCode,
  getWardsByDistrictCode,
  getDistricts,
} from 'vn-provinces'

// Match DB province_name (e.g. "Hà Nội") to library province code
function findProvinceCode(dbProvinceName: string): string | null {
  const provinces = getProvinces() as Array<{ code: string; name: string }>
  const match = provinces.find(
    (p) =>
      p.name === dbProvinceName ||
      p.name === 'Tỉnh ' + dbProvinceName ||
      p.name === 'Thành phố ' + dbProvinceName
  )
  return match?.code ?? null
}

// Match DB town_name (e.g. "Huyện Ba Vì") to library district code
function findDistrictCode(dbDistrictName: string): string | null {
  const districts = getDistricts() as Array<{ code: string; name: string }>
  const match = districts.find((d) => d.name === dbDistrictName)
  return match?.code ?? null
}

// Strip "Tỉnh " / "Thành phố " prefix → matches DB province_name format
function toShortName(libName: string): string {
  return libName.replace(/^Thành phố /, '').replace(/^Tỉnh /, '')
}

export async function GET(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = request.nextUrl
  const type = searchParams.get('type') // 'provinces' | 'districts' | 'wards'
  const province = searchParams.get('province') ?? ''
  const district = searchParams.get('district') ?? ''

  if (type === 'provinces') {
    const provinces = getProvinces() as Array<{ name: string }>
    return NextResponse.json(provinces.map(p => toShortName(p.name)).sort())
  }

  if (type === 'districts') {
    if (!province) return NextResponse.json([])
    const code = findProvinceCode(province)
    if (!code) return NextResponse.json([])
    const districts = (getDistrictsByProvinceCode(code) ?? []) as Array<{ name: string }>
    // Return names only — these match DB town_name exactly
    return NextResponse.json(districts.map((d) => d.name))
  }

  if (type === 'wards') {
    if (!district) return NextResponse.json([])
    const code = findDistrictCode(district)
    if (!code) return NextResponse.json([])
    const wards = (getWardsByDistrictCode(code) ?? []) as Array<{ name: string }>
    return NextResponse.json(wards.map((w) => w.name))
  }

  return NextResponse.json({ error: 'type must be districts or wards' }, { status: 400 })
}
