from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CashAuditViewSet

router = DefaultRouter()
router.register(r'', CashAuditViewSet, basename='cash-audit')
urlpatterns = [path('', include(router.urls))]
