from rest_framework.routers import DefaultRouter
from .views import TransferMethodViewSet

router = DefaultRouter()
router.register(r'transfer-methods', TransferMethodViewSet, basename='transfer-method')

urlpatterns = router.urls
