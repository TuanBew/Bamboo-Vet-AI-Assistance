/**
 * ~806 inventory snapshot rows (62 products x 13 weekly snapshots)
 *
 * Dates: 2025-12-22 to 2026-03-16 (every 7 days = 13 weeks)
 * Each row: product_code, snapshot_date, qty, unit_price
 *
 * Qty uses deterministic random walk: base qty varies by product index,
 * with +/- 20% variation per week using a seeded approach.
 */

import { PRODUCTS } from './products'

// 13 weekly snapshot dates
const SNAPSHOT_DATES = [
  '2025-12-22', '2025-12-29', '2026-01-05', '2026-01-12',
  '2026-01-19', '2026-01-26', '2026-02-02', '2026-02-09',
  '2026-02-16', '2026-02-23', '2026-03-02', '2026-03-09',
  '2026-03-16',
]

// Simple deterministic hash for reproducible "random" values
function deterministicValue(seed: number): number {
  let x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x) // 0..1
}

interface InventorySnapshot {
  product_code: string
  snapshot_date: string
  qty: number
  unit_price: number
}

const rows: InventorySnapshot[] = []

for (let pi = 0; pi < PRODUCTS.length; pi++) {
  const product = PRODUCTS[pi]
  // Base qty varies by product index: 50-500 range
  const baseQty = 80 + ((pi * 37 + 13) % 420)

  let currentQty = baseQty
  for (let wi = 0; wi < SNAPSHOT_DATES.length; wi++) {
    // Deterministic variation: +/- 20%
    const variation = deterministicValue(pi * 100 + wi)
    const delta = Math.round(currentQty * 0.4 * (variation - 0.5)) // -20% to +20%
    currentQty = Math.max(5, currentQty + delta)

    rows.push({
      product_code: product.product_code,
      snapshot_date: SNAPSHOT_DATES[wi],
      qty: currentQty,
      unit_price: product.unit_price,
    })
  }
}

export const INVENTORY_SNAPSHOTS = rows
