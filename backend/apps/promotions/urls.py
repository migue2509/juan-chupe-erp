from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PromotionViewSet

router = DefaultRouter()
router.register(r'', PromotionViewSet, basename='promotions')

urlpatterns = [path('', include(router.urls))]
