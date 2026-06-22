from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DeliveryViewSet, DomiciliarioViewSet

router = DefaultRouter()
router.register(r'domiciliarios', DomiciliarioViewSet, basename='domiciliarios')
router.register(r'', DeliveryViewSet, basename='deliveries')

urlpatterns = [path('', include(router.urls))]
