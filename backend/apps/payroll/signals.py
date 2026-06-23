from django.contrib.auth.signals import user_logged_in
from django.dispatch import receiver
from django.utils import timezone


@receiver(user_logged_in)
def log_work_day(sender, request, user, **kwargs):
    """Crea un WorkLog cuando una empleada inicia sesión (uno por día)."""
    if user.role not in ('operative', 'seller'):
        return  # Solo registra operativas/vendedoras, no admins

    today = timezone.localdate()
    wage = 0
    try:
        wage = user.schedule.wage_for_day(today)
    except Exception:
        pass

    try:
        from apps.payroll.models import WorkLog
        WorkLog.objects.get_or_create(
            user=user,
            date=today,
            defaults={'wage_earned': wage},
        )
    except Exception:
        pass
