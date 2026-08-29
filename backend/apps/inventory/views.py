from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from decimal import Decimal, InvalidOperation
from core.permissions import IsAdminOrReadOnly, IsAdmin, IsOperative
from apps.shifts.models import Shift
from .models import FlavorBag, CupStock, ToppingStock, StockMovement
from .serializers import (
    FlavorBagSerializer, CupStockSerializer, ToppingStockSerializer,
    StockMovementSerializer, StockEntrySerializer
)


class StockValidationMixin:
    def _positive_decimal(self, value, label):
        try:
            amount = Decimal(str(value))
        except (InvalidOperation, ValueError, TypeError):
            raise ValidationError({'detail': f'{label} debe ser un numero valido.'})
        if amount <= 0:
            raise ValidationError({'detail': f'{label} debe ser mayor a 0.'})
        return amount

    def _positive_int(self, value, label):
        try:
            amount = int(value)
        except (ValueError, TypeError):
            raise ValidationError({'detail': f'{label} debe ser un numero entero valido.'})
        if amount <= 0:
            raise ValidationError({'detail': f'{label} debe ser mayor a 0.'})
        return amount

    def _adjust_decimal(self, value, label):
        try:
            return Decimal(str(value))
        except (InvalidOperation, ValueError, TypeError):
            raise ValidationError({'detail': f'{label} debe ser un numero valido.'})

    def _adjust_int(self, value, label):
        try:
            return int(value)
        except (ValueError, TypeError):
            raise ValidationError({'detail': f'{label} debe ser un numero entero valido.'})

    def _optional_purchase_amount(self, value):
        if value in (None, ''):
            return None
        amount = self._adjust_int(value, 'El valor de compra')
        if amount < 0:
            raise ValidationError({'detail': 'El valor de compra no puede ser negativo.'})
        return amount

    def _bool_value(self, value, default=True):
        if value in (None, ''):
            return default
        if isinstance(value, bool):
            return value
        normalized = str(value).strip().lower()
        if normalized in {'true', '1', 'yes', 'si'}:
            return True
        if normalized in {'false', '0', 'no'}:
            return False
        raise ValidationError({'detail': 'from_daily_cash debe ser verdadero o falso.'})


class FlavorBagViewSet(StockValidationMixin, viewsets.ModelViewSet):
    queryset = FlavorBag.objects.select_related('flavor').filter(flavor__is_active=True).order_by('id')
    serializer_class = FlavorBagSerializer
    permission_classes = [IsAdminOrReadOnly]

    @action(detail=False, methods=['get'], url_path='alerts')
    def alerts(self, request):
        from django.db.models import F
        low_bags = FlavorBag.objects.select_related('flavor').filter(
            stock_ml__lte=F('min_stock_ml')
        )
        low_cups = CupStock.objects.select_related('cup_size').filter(
            quantity__lte=F('min_quantity'), min_quantity__gt=0
        )
        low_toppings = ToppingStock.objects.select_related('topping').filter(
            min_quantity__gt=0, quantity__lte=F('min_quantity')
        )

        alerts = []
        for b in low_bags:
            alerts.append({
                'id':    f'bag-{b.id}',
                'type':  'bag',
                'name':  b.flavor.name,
                'emoji': b.flavor.emoji or '🍓',
                'stock': f'{b.stock_ml:.0f} ml',
                'min':   f'{b.min_stock_ml:.0f} ml',
            })
        for c in low_cups:
            alerts.append({
                'id':    f'cup-{c.id}',
                'type':  'cup',
                'name':  f'Vasos {c.cup_size.size}',
                'emoji': '🥤',
                'stock': str(c.quantity),
                'min':   str(c.min_quantity),
            })
        for t in low_toppings:
            alerts.append({
                'id':    f'topping-{t.id}',
                'type':  'topping',
                'name':  t.topping.name,
                'emoji': '🍬',
                'stock': str(t.quantity),
                'min':   str(t.min_quantity),
            })
        return Response(alerts)

    @action(detail=True, methods=['post'], url_path='add-stock', permission_classes=[IsAdmin])
    def add_stock(self, request, pk=None):
        bag = self.get_object()
        ML_PER_BAG = Decimal('6500')
        bags_qty = request.data.get('bags')
        if bags_qty is not None:
            bags_qty = self._positive_decimal(bags_qty, 'La cantidad de bolsas')
            ml = bags_qty * ML_PER_BAG
        else:
            serializer = StockEntrySerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            ml = serializer.validated_data['quantity_ml']
        notes           = request.data.get('notes', '')
        amount          = self._optional_purchase_amount(request.data.get('amount'))
        from_daily_cash = self._bool_value(request.data.get('from_daily_cash', True))
        payment_method  = request.data.get('payment_method', 'cash')
        bag.add_stock(ml)
        shift = Shift.get_active()
        StockMovement.objects.create(
            movement_type='in', flavor_bag=bag,
            quantity_ml=ml, notes=notes,
            purchase_amount=amount,
            created_by=request.user, shift=shift
        )
        if amount and amount > 0:
            from apps.expenses.models import Expense
            desc = notes or f'Compra bolsa {bag.flavor.name} — {bags_qty or ""} bolsa(s)'
            Expense.objects.create(
                shift=shift, registered_by=request.user,
                category='supply', description=desc,
                amount=amount,
                from_daily_cash=from_daily_cash,
                payment_method=payment_method if from_daily_cash else 'cash',
            )
        return Response(FlavorBagSerializer(bag).data)

    @action(detail=True, methods=['post'], url_path='adjust', permission_classes=[IsAdmin])
    def adjust(self, request, pk=None):
        """Ajuste manual de stock. delta_ml positivo = agregar, negativo = reducir."""
        bag = self.get_object()
        delta_ml = self._adjust_decimal(request.data.get('delta_ml', 0), 'El ajuste')
        notes    = request.data.get('notes', '').strip()
        if not notes:
            return Response({'detail': 'El motivo del ajuste es obligatorio.'}, status=status.HTTP_400_BAD_REQUEST)
        if delta_ml == 0:
            return Response({'detail': 'El delta no puede ser 0.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            if delta_ml > 0:
                bag.add_stock(delta_ml)
            else:
                bag.consume(abs(delta_ml))
        except ValueError as exc:
            raise ValidationError({'detail': str(exc)})
        shift = Shift.get_active()
        StockMovement.objects.create(
            movement_type='adjustment', flavor_bag=bag,
            quantity_ml=delta_ml, notes=f'Ajuste manual: {notes}',
            created_by=request.user, shift=shift
        )
        return Response(FlavorBagSerializer(bag).data)


class CupStockViewSet(StockValidationMixin, viewsets.ModelViewSet):
    serializer_class = CupStockSerializer
    permission_classes = [IsAdminOrReadOnly]
    queryset = CupStock.objects.select_related('cup_size').filter(cup_size__is_active=True).order_by('id')

    @action(detail=True, methods=['post'], url_path='add-stock', permission_classes=[IsAdmin])
    def add_stock(self, request, pk=None):
        cup             = self.get_object()
        qty             = self._positive_int(request.data.get('quantity_units', 0), 'La cantidad de vasos')
        notes           = request.data.get('notes', '')
        amount          = self._optional_purchase_amount(request.data.get('amount'))
        from_daily_cash = self._bool_value(request.data.get('from_daily_cash', True))
        payment_method  = request.data.get('payment_method', 'cash')
        cup.add_stock(qty)
        shift = Shift.get_active()
        StockMovement.objects.create(
            movement_type='in', cup_stock=cup,
            quantity_units=qty, notes=notes,
            purchase_amount=amount,
            created_by=request.user, shift=shift
        )
        if amount and amount > 0:
            from apps.expenses.models import Expense
            desc = notes or f'Compra vasos {cup.cup_size.size} — {qty} unidades'
            Expense.objects.create(
                shift=shift, registered_by=request.user,
                category='supply', description=desc,
                amount=amount,
                from_daily_cash=from_daily_cash,
                payment_method=payment_method if from_daily_cash else 'cash',
            )
        return Response(CupStockSerializer(cup).data)

    @action(detail=True, methods=['post'], url_path='adjust', permission_classes=[IsAdmin])
    def adjust(self, request, pk=None):
        """Ajuste manual. delta positivo = agregar, negativo = reducir."""
        cup   = self.get_object()
        delta = self._adjust_int(request.data.get('delta', 0), 'El ajuste')
        notes = request.data.get('notes', '').strip()
        if not notes:
            return Response({'detail': 'El motivo del ajuste es obligatorio.'}, status=status.HTTP_400_BAD_REQUEST)
        if delta == 0:
            return Response({'detail': 'El delta no puede ser 0.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            if delta > 0:
                cup.add_stock(delta)
            else:
                cup.consume(abs(delta))
        except ValueError as exc:
            raise ValidationError({'detail': str(exc)})
        shift = Shift.get_active()
        StockMovement.objects.create(
            movement_type='adjustment', cup_stock=cup,
            quantity_units=delta, notes=f'Ajuste manual: {notes}',
            created_by=request.user, shift=shift
        )
        return Response(CupStockSerializer(cup).data)


class ToppingStockViewSet(StockValidationMixin, viewsets.ModelViewSet):
    serializer_class = ToppingStockSerializer
    permission_classes = [IsAdminOrReadOnly]
    queryset = ToppingStock.objects.select_related('topping').filter(topping__is_active=True).order_by('id')

    @action(detail=True, methods=['post'], url_path='add-stock', permission_classes=[IsAdmin])
    def add_stock(self, request, pk=None):
        stock = self.get_object()
        qty   = self._positive_int(request.data.get('quantity_units', 0), 'La cantidad de toppings')
        notes = request.data.get('notes', '')
        stock.add_stock(qty)
        shift = Shift.get_active()
        StockMovement.objects.create(
            movement_type='in', topping_stock=stock,
            quantity_units=qty, notes=notes,
            created_by=request.user, shift=shift
        )
        return Response(ToppingStockSerializer(stock).data)

    @action(detail=True, methods=['post'], url_path='adjust', permission_classes=[IsAdmin])
    def adjust(self, request, pk=None):
        """Ajuste manual. delta positivo = agregar, negativo = reducir."""
        stock = self.get_object()
        delta = self._adjust_int(request.data.get('delta', 0), 'El ajuste')
        notes = request.data.get('notes', '').strip()
        if not notes:
            return Response({'detail': 'El motivo del ajuste es obligatorio.'}, status=status.HTTP_400_BAD_REQUEST)
        if delta == 0:
            return Response({'detail': 'El delta no puede ser 0.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            if delta > 0:
                stock.add_stock(delta)
            else:
                stock.consume(abs(delta))
        except ValueError as exc:
            raise ValidationError({'detail': str(exc)})
        shift = Shift.get_active()
        StockMovement.objects.create(
            movement_type='adjustment', topping_stock=stock,
            quantity_units=delta, notes=f'Ajuste manual: {notes}',
            created_by=request.user, shift=shift
        )
        return Response(ToppingStockSerializer(stock).data)


class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = StockMovement.objects.select_related(
        'flavor_bag__flavor', 'cup_stock__cup_size', 'topping_stock__topping',
        'created_by', 'sale__invoice'
    ).order_by('-id')
    serializer_class = StockMovementSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ['movement_type', 'shift']
