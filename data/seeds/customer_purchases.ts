/**
 * ~600 customer purchase rows
 *
 * Links to customers via customer_code and products via product_code.
 * Purchase dates: 2026-01-01 to 2026-03-15
 * Some customers have multiple purchases (to make purchasing count > active count possible).
 * Some customers have total purchase value > 300,000 VND for the high-value section.
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

function generatePurchases(): CustomerPurchase[] {
  const purchases: CustomerPurchase[] = []

  // Date range: 2026-01-01 to 2026-03-15 (74 days)
  const startDate = new Date('2026-01-01')
  const dayRange = 74

  let seedIdx = 0

  // Give ~70% of active customers at least 1 purchase
  // Some customers get 2-5 purchases for higher coverage
  for (let ci = 0; ci < CUSTOMERS.length; ci++) {
    const customer = CUSTOMERS[ci]

    // Determine number of purchases for this customer
    const h = detHash(ci * 50 + 7)
    let purchaseCount: number

    if (!customer.is_active && h > 0.15) {
      // Inactive customers: 85% get 0 purchases, 15% get 1
      continue
    }

    if (h < 0.15) {
      purchaseCount = 2
    } else if (h < 0.35) {
      purchaseCount = 3
    } else if (h < 0.55) {
      purchaseCount = 4
    } else if (h < 0.75) {
      purchaseCount = 5
    } else {
      purchaseCount = 6 // Heavy buyers
    }

    for (let pi = 0; pi < purchaseCount; pi++) {
      seedIdx++
      const productIdx = Math.floor(detHash(seedIdx * 31 + 11) * PRODUCTS.length)
      const product = PRODUCTS[productIdx]

      const dayOffset = Math.floor(detHash(seedIdx * 17 + 3) * dayRange)
      const purchaseDate = new Date(startDate)
      purchaseDate.setDate(purchaseDate.getDate() + dayOffset)
      const dateStr = purchaseDate.toISOString().split('T')[0]

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

  return purchases
}

export const CUSTOMER_PURCHASES = generatePurchases()
