/**
 * Purchase order line items covering all 90 products.
 *
 * Each order has 3-10 items (varies by order index).
 * Products rotate to ensure every product appears at least once.
 * ~30% of items have promo_qty > 0 (1-3 units).
 * Unit prices match the product catalog.
 */

import { PRODUCTS } from './products'
import { PURCHASE_ORDERS } from './purchase_orders'

function generateItems() {
  const items: Array<{
    order_code: string
    product_code: string
    quantity: number
    promo_qty: number
    unit_price: number
  }> = []

  const productCount = PRODUCTS.length
  let globalProductPointer = 0 // Rotates through all products

  // Build price lookup
  const priceMap = new Map(PRODUCTS.map(p => [p.product_code, p.unit_price]))

  // Track which products have been used
  const usedProducts = new Set<string>()

  for (let oi = 0; oi < PURCHASE_ORDERS.length; oi++) {
    const order = PURCHASE_ORDERS[oi]
    const itemCount = 3 + (oi % 8) // 3-10 items per order
    const orderItems = new Set<string>() // Avoid duplicate products within same order

    for (let ii = 0; ii < itemCount; ii++) {
      // Pick product: rotate through catalog, skip if already in this order
      let attempts = 0
      let productIdx = (globalProductPointer + ii) % productCount
      while (orderItems.has(PRODUCTS[productIdx].product_code) && attempts < productCount) {
        productIdx = (productIdx + 1) % productCount
        attempts++
      }
      if (attempts >= productCount) continue // All products used in this order

      const product = PRODUCTS[productIdx]
      orderItems.add(product.product_code)
      usedProducts.add(product.product_code)

      // Deterministic quantity: 5-50 based on position
      const quantity = 5 + ((oi * 7 + ii * 13) % 46)

      // Promo: ~30% of items get 1-3 promo units
      const hasPromo = ((oi * 3 + ii * 5) % 10) < 3
      const promo_qty = hasPromo ? 1 + ((oi + ii) % 3) : 0

      items.push({
        order_code: order.order_code,
        product_code: product.product_code,
        quantity,
        promo_qty,
        unit_price: product.unit_price,
      })
    }

    globalProductPointer = (globalProductPointer + itemCount) % productCount
  }

  // Ensure all products appear at least once -- add missing ones to the last few orders
  const missingProducts = PRODUCTS.filter(p => !usedProducts.has(p.product_code))
  if (missingProducts.length > 0) {
    const lastOrders = PURCHASE_ORDERS.slice(-missingProducts.length)
    for (let i = 0; i < missingProducts.length; i++) {
      const order = lastOrders[i % lastOrders.length]
      const product = missingProducts[i]
      items.push({
        order_code: order.order_code,
        product_code: product.product_code,
        quantity: 10 + (i * 5),
        promo_qty: i % 3 === 0 ? 1 : 0,
        unit_price: product.unit_price,
      })
    }
  }

  // Compute totals for each order
  const orderTotals = new Map<string, { total_amount: number; total_promo_qty: number }>()
  for (const item of items) {
    const existing = orderTotals.get(item.order_code) || { total_amount: 0, total_promo_qty: 0 }
    existing.total_amount += item.quantity * item.unit_price
    existing.total_promo_qty += item.promo_qty
    orderTotals.set(item.order_code, existing)
  }

  // Update PURCHASE_ORDERS with computed totals
  for (const order of PURCHASE_ORDERS) {
    const totals = orderTotals.get(order.order_code)
    if (totals) {
      order.total_amount = totals.total_amount
      order.total_promo_qty = totals.total_promo_qty
    }
  }

  return items
}

export const PURCHASE_ORDER_ITEMS = generateItems()
