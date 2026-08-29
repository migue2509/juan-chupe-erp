export const isPlatformSale = (sale = {}) =>
  sale?.promotion_category === 'rappi' || sale?.promotion_category === 'didi'

export const isActiveSale = (sale, deliveryStatus = sale?.delivery_status) => {
  if (!sale || sale.is_voided) return false
  if (sale.is_delivery && deliveryStatus === 'cancelled') return false
  return true
}

export const salePaidTotal = (sale = {}) =>
  sale?.is_courtesy ? Number(sale.courtesy_paid || 0) : Number(sale?.total || 0)

export const saleCashAmount = (sale = {}) => {
  if (!sale) return 0

  if (sale.is_courtesy) {
    if (sale.payment_method === 'cash') return Number(sale.courtesy_paid || 0)
    if (sale.payment_method === 'mixed') return Number(sale.cash_received || 0)
    return 0
  }

  if (sale.payment_method === 'cash') return Number(sale.total || 0)
  if (sale.payment_method === 'mixed') return Number(sale.cash_received || 0)
  return 0
}

export const saleTransferAmount = (sale = {}) => {
  if (!sale) return 0

  if (sale.is_courtesy) {
    if (sale.payment_method === 'transfer') return Number(sale.courtesy_paid || 0)
    if (sale.payment_method === 'mixed') return Number(sale.transfer_amount || 0)
    return 0
  }

  const transfer = Number(sale.transfer_amount || 0)
  if (sale.payment_method === 'transfer') return transfer || Number(sale.total || 0)
  if (sale.payment_method === 'mixed') return transfer
  return 0
}
