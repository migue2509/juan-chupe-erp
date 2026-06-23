from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from core.permissions import IsAdminOrReadOnly, IsAdmin, IsOperative
from apps.shifts.models import Shift
from .models import FlavorBag, CupStock, ToppingStock, StockMovement
from .serializers import (
    FlavorBagSerializer, CupStockSerializer, ToppingStockSerializer,
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
          - amount (int, opcional): valor pagado por la compra → crea un Expense de tipo 'supply'.
        """
        from decimal import Decimal
        bag = self.get_object()
        ML_PER_BAG = Decimal('6500')
        bags_qty = request.data.get('bags')
        if bags_qty is not None:
            ml = Decimal(str(bags_qty)) * ML_PER_BAG
        else:
            serializer = StockEntrySerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            ml = serializer.validated_data.get('quantity_ml', 0)
        notes  = request.data.get('notes', '')
        amount = request.data.get('amount')
        bag.add_stock(ml)
        shift = Shift.get_active()
        StockMovement.objects.create(
            movement_type='in', flavor_bag=bag,
            quantity_ml=ml, notes=notes,
            purchase_amount=int(amount) if amount else None,
            created_by=request.user, shift=shift
        )
        # Registrar gasto de compra si viene el monto
        if amount and int(amount) > 0:
            from apps.expenses.models import Expense
            desc = notes or f'Compra bolsa {bag.flavor.name} — {bags_qty or ""} bolsa(s)'
            Expense.objects.create(
                shift=shift, registered_by=request.user,
                category='supply', description=desc,
                amount=int(amount), from_daily_cash=True,
            )
        return Response(FlavorBagSerializer(bag).data)


class CupStockViewSet(viewsets.ModelViewSet):
    serializer_class = CupStockSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        """Auto-crea CupStock para vasos que no lo tengan aún"""
        from apps.products.models import CupSize
        for cup in CupSize.objects.all():
            CupStock.objects.get_or_create(
                cup_size=cup,
                defaults={'min_quantity': cup.min_quantity}
            )
        return CupStock.objects.select_related('cup_size').all()

    @action(detail=True, methods=['post'], url_path='add-stock', permission_classes=[IsAdmin])
    def add_stock(self, request, pk=None):
        cup    = self.get_object()
        qty    = int(request.data.get('quantity_units', 0))
        notes  = request.data.get('notes', '')
        amount = request.data.get('amount')
        cup.add_stock(qty)
        shift = Shift.get_active()
        StockMovement.objects.create(
            movement_type='in', cup_stock=cup,
            quantity_units=qty, notes=notes,
            purchase_amount=int(amount) if amount else None,
            created_by=request.user, shift=shift
        )
        # Registrar gasto de compra si viene el monto
        if amount and int(amount) > 0:
            from apps.expenses.models import Expense
            desc = notes or f'Compra vasos {cup.cup_size.size} — {qty} unidades'
            Expense.objects.create(
                shift=shift, registered_by=request.user,
                category='supply', description=desc,
                amount=int(amount), from_daily_cash=True,
            )
        return Response(CupStockSerializer(cup).data)


class ToppingStockViewSet(viewsets.ModelViewSet):
    serializer_class = ToppingStockSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        """Auto-crea ToppingStock para toppings que no lo tengan aún"""
        from apps.products.models import Topping
        for t in Topping.objects.all():
            ToppingStock.objects.get_or_create(
                topping=t,
                defaults={'min_quantity': t.min_stock}
            )
        return ToppingStock.objects.select_related('topping').all()

    @action(detail=True, methods=['post'], url_path='add-stock', permission_classes=[IsAdmin])
    def add_stock(self, request, pk=None):
        stock = self.get_object()
        qty   = int(request.data.get('quantity_units', 0))
        notes = request.data.get('notes', '')
        stock.add_stock(qty)
        shift = Shift.get_active()
        StockMovement.objects.create(
            movement_type='in', topping_stock=stock,
            quantity_units=qty, notes=notes,
            created_by=request.user, shift=shift
        )
        return Response(ToppingStockSerializer(stock).data)


class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = StockMovement.objects.select_related(
        'flavor_bag__flavor', 'cup_stock__cup_size', 'topping_stock__topping',
        'created_by', 'sale__invoice'
    ).all()
    serializer_class = StockMovementSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ['movement_type', 'shift']
