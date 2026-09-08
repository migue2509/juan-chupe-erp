def get_close_audit_status(shift):
    """Return cash-audit readiness details required before closing a shift."""
    existing_channels = set(shift.cash_audits.values_list('channel', flat=True))

    from apps.sales.models import Sale
    from apps.sales.selectors import active_sales

    has_delivery_sales = active_sales(
        Sale.objects.filter(shift=shift, is_delivery=True)
    ).exists()

    required = ['pos']
    if has_delivery_sales:
        required.append('delivery')

    missing = [channel for channel in required if channel not in existing_channels]

    return {
        'has_pos_audit': 'pos' in existing_channels,
        'has_delivery_audit': 'delivery' in existing_channels,
        'requires_delivery_audit': has_delivery_sales,
        'missing_audits': missing,
        'is_ready': not missing,
    }


def get_missing_close_audits(shift):
    """Return required cash-audit channels that are still missing before close."""
    return get_close_audit_status(shift)['missing_audits']
