from rest_framework.permissions import BasePermission


class WorkSchedulePermission(BasePermission):
    """
    Bloquea el acceso a la API si la empleada (operative) intenta usarla
    en un día que no le corresponde trabajar.
    Los administradores siempre tienen acceso.
    Si la empleada no tiene horario configurado, se permite el acceso.
    """
    message = 'Tu cuenta no está habilitada hoy. Habla con tu administrador.'

    def has_permission(self, request, view):
        user = request.user
        if not user.is_authenticated:
            return True  # Deja que IsAuthenticated lo rechace
        if user.role != 'operative':
            return True  # Admins y otros roles pasan
        try:
            from django.utils import timezone
            return user.schedule.is_work_day(timezone.localdate())
        except Exception:
            return True  # Sin horario → acceso permitido


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
        return request.user.is_authenticated and request.user.role in ('admin', 'operative')

class IsDelivery(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ('admin', 'delivery')
