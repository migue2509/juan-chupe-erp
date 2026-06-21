from django.urls import path
from .views import DailySummaryView, WeeklyReportView, MonthlyReportView, InventoryStatusView

urlpatterns = [
    path('daily/', DailySummaryView.as_view(), name='daily-report'),
    path('weekly/', WeeklyReportView.as_view(), name='weekly-report'),
    path('monthly/', MonthlyReportView.as_view(), name='monthly-report'),
    path('inventory/', InventoryStatusView.as_view(), name='inventory-status'),
]
