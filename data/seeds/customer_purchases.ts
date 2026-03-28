/**
 * ~1,800 customer purchase rows spanning Jan 2024 - Mar 2026 (27 months)
 *
 * Links to customers via customer_code and products via product_code.
 * Seasonal pattern: higher in Q1-Q2, lower in summer, peak again in Q4.
 * Every month has at least 3 purchases; no zero-purchase months.
 */

import { CUSTOMERS } from './customers'
import { PRODUCTS } from './products'

interface CustomerPurchase {
  customer_code: string
  product_code: string
  purchase_date: string
  qty: number
  unit_price: number
  total_value: number
}

// Deterministic hash
function detHash(seed: number): number {
  let x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

// Seasonal multiplier: Q1-Q2 higher, summer lower, Q4 peak
function seasonalMultiplier(month: number): number {
  // month 1-12
  if (month >= 1 && month <= 3) return 1.3   // Q1: post-Tet restocking
  if (month >= 4 && month <= 6) return 1.1   // Q2: spring
  if (month >= 7 && month <= 9) return 0.7   // Summer: low season
  return 1.2                                  // Q4: year-end peak
}

function generatePurchases(): CustomerPurchase[] {
  const purchases: CustomerPurchase[] = []
  const activeCustomers = CUSTOMERS.filter(c => c.is_active)

  let seedIdx = 0

  // Generate purchases across all 27 months: Jan 2024 - Mar 2026
  for (let year = 2024; year <= 2026; year++) {
    const maxMonth = year === 2026 ? 3 : 12
    for (let month = 1; month <= maxMonth; month++) {
      // Base count per month, scaled by growth and season
      let growthFactor = 1.0
      if (year === 2024) growthFactor = 0.7
      if (year === 2025 && month <= 6) growthFactor = 0.9
      if (year === 2025 && month > 6) growthFactor = 1.1
      if (year === 2026) growthFactor = 1.3

      const basePurchasesPerMonth = 65 // ~65 * 27.5 avg months ~ 1,787 total
      const monthTarget = Math.max(3, Math.round(basePurchasesPerMonth * growthFactor * seasonalMultiplier(month)))

      const daysInMonth = new Date(year, month, 0).getDate()

      for (let pi = 0; pi < monthTarget; pi++) {
        seedIdx++

        // Pick customer deterministically
        const custIdx = Math.floor(detHash(seedIdx * 37 + 13) * activeCustomers.length)
        const customer = activeCustomers[custIdx]

        // Pick product deterministically
        const productIdx = Math.floor(detHash(seedIdx * 31 + 11) * PRODUCTS.length)
        const product = PRODUCTS[productIdx]

        // Pick day within month
        const day = 1 + Math.floor(detHash(seedIdx * 17 + 3) * daysInMonth)
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

        // qty: 1-50, skewed toward lower values
        const qtyRaw = detHash(seedIdx * 23 + 5)
        const qty = Math.max(1, Math.floor(qtyRaw * qtyRaw * 50) + 1)

        const unitPrice = product.unit_price
        const totalValue = qty * unitPrice

        purchases.push({
          customer_code: customer.customer_code,
          product_code: product.product_code,
          purchase_date: dateStr,
          qty,
          unit_price: unitPrice,
          total_value: totalValue,
        })
      }
    }
  }

  return purchases
}

export const CUSTOMER_PURCHASES = generatePurchases()
