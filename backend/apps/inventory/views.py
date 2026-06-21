from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from core.permissions import IsAdminOrReadOnly, IsAdmin, IsOperative
from apps.shifts.models import Shift
from .models import FlavorBag, CupStock, StockMovement
from .serializers import (
    FlavorBagSerializer, CupStockSerializer,
    StockMovementSerializer, StockEntrySerializer
)


class FlavorBagViewSet(viewsets.ModelViewSet):
    queryset = FlavorBag.objects.select_related('flavor').all()
    serializer_class = FlavorBagSerializer
    permission_classes = [IsAdminOrReadOnly]

    @action(detail=False, methods=['get'], url_path='alerts')
    def alerts(self, request):
        low = FlavorBag.objects.filter(stock_ml__lte=500)
        return Response(FlavorBagSerializer(low, many=True).data)

    @action(detail=True, methods=['post'], url_path='add-stock', permission_classes=[IsAdmin])
    def add_stock(self, request, pk=None):
        """
        Acepta:
          - bags (int): número de bolsas a agregar. 1 bolsa = 6500 ml.
          - quantity_ml (decimal): ml directos (si no se manda bags).
        """
        from decimal import Decimal
        bag = self.get_object()
        ML_PER_BAG = Decimal('6500')
        bags = request.data.get('bags')
        if bags is not None:
            ml = Decimal(str(bags)) * ML_PER_BAG
        else:
            serializer = StockEntrySerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            ml = serializer.validated_data.get('quantity_ml', 0)
        notes = request.data.get('notes', '')
        bag.add_stock(ml)
        shift = Shift.get_active()
        StockMovement.objects.create(
            movement_type='in', flavor_bag=bag,
            quantity_ml=ml, notes=notes,
            created_by=request.user, shift=shift
        )
        return Response(FlavorBagSerializer(bag).data)


class CupStockViewSet(viewsets.ModelViewSet):
    queryset = CupStock.objects.select_related('cup_size').all()
    serializer_class = CupStockSerializer
    permission_classes = [IsAdminOrReadOnly]

    @action(detail=True, methods=['post'], url_path='add-stock', permission_classes=[IsAdmin])
    def add_stock(self, request, pk=None):
        cup = self.get_object()
        qty = int(request.data.get('quantity_units', 0))
        notes = request.data.get('notes', '')
        cup.add_stock(qty)
        shift = Shift.get_active()
        StockMovement.objects.create(
            movement_type='in', cup_stock=cup,
            quantity_units=qty, notes=notes,
            created_by=request.user, shift=shift
        )
        return Response(CupStockSerializer(cup).data)


class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = StockMovement.objects.select_related('flavor_bag', 'cup_stock', 'created_by').all()
    serializer_class = StockMovementSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ['movement_type', 'shift']
