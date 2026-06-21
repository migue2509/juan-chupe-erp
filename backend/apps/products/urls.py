from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FlavorViewSet, CupSizeViewSet, ProductViewSet, ToppingViewSet

router = DefaultRouter()
router.register(r'flavors', FlavorViewSet, basename='flavors')
router.register(r'cup-sizes', CupSizeViewSet, basename='cup-sizes')
router.register(r'products', ProductViewSet, basename='products')
router.register(r'toppings', ToppingViewSet, basename='toppings')

urlpatterns = [path('', include(router.urls))]
