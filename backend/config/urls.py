from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.users.urls')),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/shifts/', include('apps.shifts.urls')),
    path('api/products/', include('apps.products.urls')),
    path('api/inventory/', include('apps.inventory.urls')),
    path('api/sales/', include('apps.sales.urls')),
    path('api/billing/', include('apps.billing.urls')),
    path('api/promotions/', include('apps.promotions.urls')),
    path('api/expenses/', include('apps.expenses.urls')),
    path('api/purchases/', include('apps.purchases.urls')),
    path('api/deliveries/', include('apps.deliveries.urls')),
    path('api/cash/', include('apps.cash.urls')),
    path('api/attendance/', include('apps.attendance.urls')),
    path('api/reports/', include('apps.reports.urls')),
    path('api/payroll/', include('apps.payroll.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
