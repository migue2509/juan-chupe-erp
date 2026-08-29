from django.core.exceptions import ObjectDoesNotExist


def active_sales(queryset):
    """Ventas que cuentan para caja, jornadas y reportes."""
    return queryset.exclude(invoice__voided=True).exclude(
        is_delivery=True,
        delivery__status='cancelled',
    )


def is_active_sale(sale):
    try:
        if sale.invoice.voided:
            return False
    except ObjectDoesNotExist:
        pass

    if sale.is_delivery:
        try:
            if sale.delivery.status == 'cancelled':
                return False
        except ObjectDoesNotExist:
            pass

    return True
