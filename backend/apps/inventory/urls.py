from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FlavorBagViewSet, CupStockViewSet, StockMovementViewSet

router = DefaultRouter()
router.register(r'bags', FlavorBagViewSet, basename='flavor-bags')
router.register(r'cups', CupStockViewSet, basename='cup-stock')
router.register(r'movements', StockMovementViewSet, basename='stock-movements')

urlpatterns = [path('', include(router.urls))]
