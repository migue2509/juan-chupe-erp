from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from decimal import Decimal
from core.permissions import IsOperative, IsAdmin
from apps.shifts.models import Shift
from apps.products.models import Flavor, CupSize, Topping
from apps.promotions.models import Promotion
from apps.users.models import User
from .models import Sale, SaleItem, SaleItemFlavor
from .serializers import SaleSerializer, SaleCreateSerializer


class SaleViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Sale.objects.prefetch_related('items__saleitems_flavors__flavor', 'items__cup_size').select_related('seller', 'promotion', 'shift').all()
    serializer_class = SaleSerializer
    permission_classes = [IsOperative]
    filterset_fields = ['shift', 'payment_method', 'is_delivery']

    @action(detail=False, methods=['post'], url_path='create-sale')
    def create_sale(self, request):
        shift = Shift.get_active()
        if not shift:
            return Response({'detail': 'No hay jornada activa. El administrador debe abrir el día.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = SaleCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with transaction.atomic():
            # ── Pre-validar stock antes de crear nada ──
            from apps.inventory.models import FlavorBag, CupStock
            for item_data in data['items']:
                qty          = item_data.get('quantity', 1)
                is_topping_only = not item_data.get('cup_size_id')

                if is_topping_only:
                    continue  # Solo-topping: sin stock de vaso ni bolsa que validar

                cup_size = CupSize.objects.get(id=item_data['cup_size_id'])

                # Vasos
                try:
                    cup_stock = CupStock.objects.get(cup_size=cup_size)
                    if cup_stock.quantity < qty:
                        return Response(
                            {'detail': f'Stock insuficiente de vasos {cup_size.size}. '
                                       f'Disponible: {cup_stock.quantity}, necesario: {qty}.'},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                except CupStock.DoesNotExist:
                    return Response(
                        {'detail': f'No hay stock registrado para vasos {cup_size.size}. Registra una entrada en Inventario.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Bolsas de granizado
                flavor_objs  = Flavor.objects.filter(id__in=item_data.get('flavor_ids', []))
                num_flavors  = flavor_objs.count()
                ml_por_sabor = cup_size.ml / Decimal(str(max(num_flavors, 1))) * qty

                for flavor in flavor_objs:
                    try:
                        bag = flavor.bag
                        if bag.stock_ml < ml_por_sabor:
                            return Response(
                                {'detail': f'Stock insuficiente de {flavor.name}. '
                                           f'Disponible: {bag.stock_ml:.0f} ml, necesario: {ml_por_sabor:.0f} ml.'},
                                status=status.HTTP_400_BAD_REQUEST
                            )
                    except FlavorBag.DoesNotExist:
                        return Response(
                            {'detail': f'No hay bolsa registrada para el sabor {flavor.name}.'},
                            status=status.HTTP_400_BAD_REQUEST
                        )

                # Bolsa de topping automática según categoría
                categories = {f.category for f in flavor_objs}
                if categories:
                    primary_cat = next(iter(categories))
                    try:
                        from apps.inventory.models import ToppingStock
                        auto_topping = Topping.objects.get(linked_category=primary_cat, is_active=True)
                        auto_ts = ToppingStock.objects.get(topping=auto_topping)
                        if auto_ts.quantity < qty:
                            return Response(
                                {'detail': f'Stock insuficiente de {auto_topping.name}. '
                                           f'Disponible: {auto_ts.quantity}, necesario: {qty}.'},
                                status=status.HTTP_400_BAD_REQUEST
                            )
                    except Topping.DoesNotExist:
                        pass
                    except Exception:
                        pass

            # Resolve FK
            seller = None
            if data.get('seller_id'):
                try:
                    seller = User.objects.get(id=data['seller_id'])
                except User.DoesNotExist:
                    pass

            promotion = None
            if data.get('promotion_id'):
                try:
                    promotion = Promotion.objects.get(id=data['promotion_id'], is_active=True)
                except Promotion.DoesNotExist:
                    pass

            sale = Sale.objects.create(
                shift=shift,
                seller=seller,
                promotion=promotion,
                payment_method=data['payment_method'],
                cash_received=data.get('cash_received', Decimal('0')),
                transfer_amount=data.get('transfer_amount', Decimal('0')),
                transfer_reference=data.get('transfer_reference', ''),
                is_delivery=data.get('is_delivery', False),
                notes=data.get('notes', ''),
            )

            for item_data in data['items']:
                is_topping_only = not item_data.get('cup_size_id')
                cup_size = None
                if not is_topping_only:
                    cup_size = CupSize.objects.get(id=item_data['cup_size_id'])

                topping = None
                if item_data.get('topping_id'):
                    try:
                        topping = Topping.objects.get(id=item_data['topping_id'])
                    except Topping.DoesNotExist:
                        pass

                unit_price    = item_data['unit_price']
                # Para solo-topping: unit_price ya es el precio del topping, topping_price = 0
                topping_price = (topping.price if topping else Decimal('0')) if not is_topping_only else Decimal('0')

                sale_item = SaleItem.objects.create(
                    sale=sale,
                    cup_size=cup_size,
                    topping=topping,
                    unit_price=unit_price,
                    topping_price=topping_price,
                    quantity=item_data.get('quantity', 1),
                )

                if not is_topping_only:
                    flavors = Flavor.objects.filter(id__in=item_data.get('flavor_ids', []))
                    num_flavors   = flavors.count()
                    ml_per_flavor = cup_size.ml / Decimal(str(max(num_flavors, 1)))
                    for flavor in flavors:
                        SaleItemFlavor.objects.create(
                            sale_item=sale_item,
                            flavor=flavor,
                            ml_consumed=ml_per_flavor * sale_item.quantity
                        )

                # Apply inventory deduction
                sale_item.apply_inventory()

            sale.calculate_total()

            # Auto-create invoice
            from apps.billing.models import Invoice
            Invoice.objects.create(sale=sale, shift=shift)

        return Response(SaleSerializer(sale).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'], url_path='edit', permission_classes=[IsOperative])
    def edit_sale(self, request, pk=None):
        sale = self.get_object()

        with transaction.atomic():
            # ── Campos sin impacto en inventario ──
            simple_fields = ['cash_received', 'transfer_amount',
                             'transfer_reference', 'is_delivery', 'notes']
            for field in simple_fields:
                if field in request.data:
                    setattr(sale, field, request.data[field])

            # ── Método de pago: limpiar montos contrarios automáticamente ──
            if 'payment_method' in request.data:
                sale.payment_method = request.data['payment_method']
                pm = sale.payment_method
                if pm == 'cash':
                    # Solo efectivo: zerear transferencia
                    sale.transfer_amount    = Decimal('0')
                    sale.transfer_reference = ''
                    # Recalcular cambio con el cash_received actual (puede ser > total)
                    sale.change_given = max(Decimal('0'), sale.cash_received - sale.total)
                elif pm == 'transfer':
                    # Solo transferencia: zerear efectivo y cambio
                    sale.cash_received = Decimal('0')
                    sale.change_given  = Decimal('0')
                    if 'transfer_amount' not in request.data:
                        sale.transfer_amount = sale.total
                elif pm == 'mixed':
                    # Mixto: recalcular cambio si hubo ajuste de efectivo
                    sale.change_given = max(
                        Decimal('0'),
                        sale.cash_received - max(Decimal('0'), sale.total - sale.transfer_amount)
                    )

            if 'seller_id' in request.data:
                try:
                    sale.seller = User.objects.get(id=request.data['seller_id'])
                except User.DoesNotExist:
                    sale.seller = None

            # ── Si vienen items nuevos → revertir inventario y reemplazar ──
            if 'items' in request.data:
                items_data = request.data['items']

                # Pre-validar stock (descontando lo que ya se va a devolver)
                from apps.inventory.models import FlavorBag, CupStock
                for item_data in items_data:
                    cup_size = CupSize.objects.get(id=item_data['cup_size_id'])
                    qty      = item_data.get('quantity', 1)
                    flavor_objs  = Flavor.objects.filter(id__in=item_data['flavor_ids'])
                    num_flavors  = flavor_objs.count()
                    ml_por_sabor = cup_size.ml / Decimal(str(max(num_flavors, 1))) * qty

                    # Vasos
                    try:
                        cs = CupStock.objects.get(cup_size=cup_size)
                        if cs.quantity < qty:
                            return Response(
                                {'detail': f'Stock insuficiente de vasos {cup_size.size}. Disponible: {cs.quantity}.'},
                                status=status.HTTP_400_BAD_REQUEST
                            )
                    except CupStock.DoesNotExist:
                        return Response({'detail': f'Sin stock para vasos {cup_size.size}.'}, status=400)

                    for flavor in flavor_objs:
                        try:
                            if flavor.bag.stock_ml < ml_por_sabor:
                                return Response(
                                    {'detail': f'Stock insuficiente de {flavor.name}. '
                                               f'Disponible: {flavor.bag.stock_ml:.0f} ml.'},
                                    status=400
                                )
                        except Exception:
                            return Response({'detail': f'Sin bolsa para {flavor.name}.'}, status=400)

                # Revertir inventario de items actuales
                for item in sale.items.all():
                    item.reverse_inventory()
                sale.items.all().delete()

                # Crear nuevos items
                promo = sale.promotion
                for item_data in items_data:
                    cup_size = CupSize.objects.get(id=item_data['cup_size_id'])
                    topping  = None
                    if item_data.get('topping_id'):
                        try: topping = Topping.objects.get(id=item_data['topping_id'])
                        except: pass
                    unit_price = item_data['unit_price']
                    if promo:
                        unit_price = promo.unit_price
                    sale_item = SaleItem.objects.create(
                        sale=sale, cup_size=cup_size, topping=topping,
                        unit_price=unit_price, quantity=item_data.get('quantity', 1),
                    )
                    flavors = Flavor.objects.filter(id__in=item_data['flavor_ids'])
                    num_flavors  = flavors.count()
                    ml_per_flavor = cup_size.ml / Decimal(str(max(num_flavors, 1)))
                    for flavor in flavors:
                        SaleItemFlavor.objects.create(
                            sale_item=sale_item, flavor=flavor,
                            ml_consumed=ml_per_flavor * sale_item.quantity
                        )
                    sale_item.apply_inventory()

                sale.calculate_total()
            else:
                sale.change_given = max(
                    Decimal('0'),
                    Decimal(str(sale.cash_received)) - sale.total
                )
                sale.save()

        return Response(SaleSerializer(sale).data)

    @action(detail=False, methods=['get'], url_path='today')
    def today(self, request):
        shift = Shift.get_active()
        if not shift:
            return Response({'sales': [], 'total': 0})
        sales = Sale.objects.filter(shift=shift)
        total = sum(s.total for s in sales)
        return Response({
            'sales': SaleSerializer(sales, many=True).data,
            'total': total,
            'count': sales.count()
        })
