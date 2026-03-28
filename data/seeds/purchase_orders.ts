/**
 * ~140 purchase orders spanning Jan 2024 - Mar 2026 (27 months).
 *
 * Order codes: CTT000001 through CTT000140+ (sequential).
 * Supplier distribution includes all 10 suppliers (NPP001-NPP010).
 * total_amount and total_promo_qty are computed from items at seed time.
 */

function generateOrders() {
  const orders: Array<{
    order_code: string
    order_date: string
    supplier_code: string
    total_amount: number
    total_promo_qty: number
  }> = []

  // Monthly volume: 2024 early = 3, late 2024 = 4, 2025 = 5-6, 2026 = 7-8
  function ordersPerMonth(year: number, month: number): number {
    if (year === 2024 && month <= 4) return 3
    if (year === 2024 && month <= 8) return 4
    if (year === 2024) return 4
    if (year === 2025 && month <= 3) return 5
    if (year === 2025 && month <= 6) return 5
    if (year === 2025 && month <= 9) return 6
    if (year === 2025) return 6
    // 2026
    if (month === 1) return 8
    if (month === 2) return 8
    return 7
  }

  // Supplier assignment: deterministic rotation across all 10 suppliers
  const supplierPattern = [
    'NPP001', 'NPP003', 'NPP001', 'NPP003',
    'NPP002', 'NPP006', 'NPP001', 'NPP008',
    'NPP003', 'NPP004', 'NPP007', 'NPP003',
    'NPP005', 'NPP009', 'NPP001', 'NPP010',
    'NPP003', 'NPP006', 'NPP002', 'NPP008',
  ]

  let orderIndex = 0

  for (let year = 2024; year <= 2026; year++) {
    const maxMonth = year === 2026 ? 3 : 12
    for (let month = 1; month <= maxMonth; month++) {
      const count = ordersPerMonth(year, month)
      for (let i = 0; i < count; i++) {
        // Deterministic date: use (month * 7 + orderIndex) to pick day
        const daysInMonth = new Date(year, month, 0).getDate()
        const day = 1 + ((month * 7 + orderIndex * 3) % daysInMonth)
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

        const supplierCode = supplierPattern[orderIndex % supplierPattern.length]

        orders.push({
          order_code: `CTT${String(orderIndex + 1).padStart(6, '0')}`,
          order_date: dateStr,
          supplier_code: supplierCode,
          total_amount: 0,    // Computed from items
          total_promo_qty: 0, // Computed from items
        })

        orderIndex++
      }
    }
  }

  return orders
}

export const PURCHASE_ORDERS = generateOrders()
