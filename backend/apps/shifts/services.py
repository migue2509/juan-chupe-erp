def get_missing_close_audits(shift):
    """Return required cash-audit channels that are still missing before close."""
    existing_channels = set(shift.cash_audits.values_list('channel', flat=True))
    missing = []

    if 'pos' not in existing_channels:
        missing.append('pos')

    from apps.sales.models import Sale
    from apps.sales.selectors import active_sales

    has_delivery_sales = active_sales(
        Sale.objects.filter(shift=shift, is_delivery=True)
    ).exists()
    if has_delivery_sales and 'delivery' not in existing_channels:
        missing.append('delivery')

    return missing
