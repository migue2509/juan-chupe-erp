from django.db.models import Q
from django.utils import timezone

from apps.sales.models import Sale
from apps.sales.selectors import active_sales
from apps.users.models import User


def pos_sales_for_shift(shift):
    return active_sales(Sale.objects.filter(shift=shift, is_delivery=False)).exclude(
        promotion__category__in=['rappi', 'didi']
    )


def pos_handover_workers(shift):
    """Active operatives with attendance or recorded activity during the shift."""
    start = timezone.localdate(shift.opened_at)
    end = timezone.localdate(shift.closed_at or timezone.now())
    return User.objects.filter(is_active=True, role='operative').filter(
        Q(attendance__shift=shift)
        | Q(sales__shift=shift)
        | Q(expense__shift=shift)
        | Q(work_logs__date__range=(start, end))
    ).distinct().order_by('full_name', 'id')
