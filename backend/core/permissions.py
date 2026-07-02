from rest_framework.permissions import BasePermission


class WorkSchedulePermission(BasePermission):
    """
    Bloquea el acceso a la API si la empleada tiene security_enabled=True
    y hoy no es un día laboral según su horario configurado.
    Por defecto (security_enabled=False) nadie queda bloqueado.
    """
    message = 'Tu cuenta no está habilitada hoy. Habla con tu administrador.'

    def has_permission(self, request, view):
        user = request.user
        if not user.is_authenticated:
            return True
        if user.role in ('admin', 'delivery') or user.is_staff or user.is_superuser:
            return True
        try:
            schedule = user.schedule
            if not schedule.security_enabled:
                return True  # Seguridad no activada → siempre puede entrar
            from django.utils import timezone
            today = timezone.localdate()
            return schedule.is_work_day(today)
        except Exception:
            return True  # Sin horario o error → no bloquear


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'

class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return request.user.is_authenticated
        return request.user.is_authenticated and request.user.role == 'admin'

class IsOperative(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ('admin', 'operative', 'delivery')

class IsDelivery(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ('admin', 'delivery')
