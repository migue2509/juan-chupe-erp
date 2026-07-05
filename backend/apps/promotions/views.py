from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from core.permissions import IsAdminOrReadOnly
from .models import Promotion, PromotionItem
from .serializers import PromotionSerializer, PromotionItemSerializer


class PromotionViewSet(viewsets.ModelViewSet):
    queryset = Promotion.objects.prefetch_related('items__cup_size').all()
    serializer_class = PromotionSerializer
    permission_classes = [IsAdminOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'], url_path='active')
    def active(self, request):
        promos = Promotion.objects.filter(is_active=True).prefetch_related('items__cup_size')
        return Response(PromotionSerializer(promos, many=True).data)

    @action(detail=True, methods=['post', 'put'], url_path='items')
    def set_items(self, request, pk=None):
        """Reemplaza todos los ítems de una promo de plataforma."""
        promo = self.get_object()
        promo.items.all().delete()
        items_data = request.data if isinstance(request.data, list) else []
        created = []
        for item in items_data:
            obj = PromotionItem.objects.create(
                promotion=promo,
                cup_size_id=item.get('cup_size'),
                quantity=item.get('quantity', 1),
                custom_name=item.get('custom_name', ''),
            )
            created.append(obj)
        return Response(PromotionItemSerializer(created, many=True).data)

    @action(detail=True, methods=['patch'], url_path='toggle')
    def toggle(self, request, pk=None):
        promo = self.get_object()
        promo.is_active = not promo.is_active
        promo.save()
        return Response({'is_active': promo.is_active})
