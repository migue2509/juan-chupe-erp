from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WorkdayScheduleViewSet, WorkLogViewSet, WagePaymentViewSet

router = DefaultRouter()
router.register(r'schedules', WorkdayScheduleViewSet, basename='schedules')
router.register(r'logs',      WorkLogViewSet,          basename='worklogs')
router.register(r'payments',  WagePaymentViewSet,      basename='payments')

urlpatterns = [path('', include(router.urls))]
