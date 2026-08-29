from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from decimal import Decimal, InvalidOperation
from core.permissions import IsOperative, IsAdmin
from apps.shifts.models import Shift
from apps.products.models import Flavor, CupSize, Topping
from apps.promotions.models import Promotion
from apps.users.models import User
from .models import Sale, SaleItem, SaleItemFlavor
from .serializers import SaleSerializer, SaleCreateSerializer
from .selectors import is_active_sale


class SaleViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Sale.objects.prefetch_related('items__saleitems_flavors__flavor', 'items__cup_size').select_related('seller', 'promotion', 'shift').all()
    serializer_class = SaleSerializer
    permission_classes = [IsOperative]
    filterset_fields = ['shift', 'payment_method', 'is_delivery']

    def _apply_inventory_or_error(self, sale_item, shift):
        try:
            sale_item.apply_inventory(shift=shift)
        except ValueError as exc:
            raise ValidationError({'detail': str(exc)})
        except ObjectDoesNotExist:
            raise ValidationError({'detail': 'No hay stock registrado para uno de los items de la venta.'})

    def _decimal_or_error(self, value, label):
        try:
            amount = Decimal(str(value or 0))
        except (InvalidOperation, ValueError, TypeError):
            raise ValidationError({'detail': f'{label} debe ser un numero valido.'})
        if amount < 0:
            raise ValidationError({'detail': f'{label} no puede ser negativo.'})
        return amount

    def _positive_int_or_error(self, value, label):
        try:
            amount = int(value)
        except (ValueError, TypeError):
            raise ValidationError({'detail': f'{label} debe ser un numero entero valido.'})
        if amount < 1:
            raise ValidationError({'detail': f'{label} debe ser mayor a 0.'})
        return amount

    def _validate_payment_or_error(self, sale):
        total = Decimal(str(sale.total or 0))
        cash = Decimal(str(sale.cash_received or 0))
        transfer = Decimal(str(sale.transfer_amount or 0))
        courtesy_paid = Decimal(str(sale.courtesy_paid or 0))

        if min(cash, transfer, courtesy_paid) < 0:
            raise ValidationError({'detail': 'Los montos de pago no pueden ser negativos.'})

        if sale.is_courtesy:
            if courtesy_paid > total:
                raise ValidationError({'detail': 'El valor pagado en cortesia no puede superar el total.'})
            return

        if sale.payment_method == 'cash' and cash < total:
            raise ValidationError({'detail': 'El efectivo recibido no alcanza para cubrir el total.'})
        if sale.payment_method == 'transfer' and transfer < total:
            raise ValidationError({'detail': 'El monto de transferencia no alcanza para cubrir el total.'})
        if sale.payment_method == 'mixed':
            if cash <= 0 or transfer <= 0:
                raise ValidationError({'detail': 'El pago mixto debe tener efectivo y transferencia.'})
            if cash + transfer < total:
                raise ValidationError({'detail': 'La suma de efectivo y transferencia no cubre el total.'})

    @action(detail=False, methods=['post'], url_path='create-sale')
    def create_sale(self, request):
        shift = Shift.get_active()
        if not shift:
            return Response({'detail': 'No hay jornada activa. El administrador debe abrir el día.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = SaleCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with transaction.atomic():
            # ── Pre-cargar objetos en bulk (evitar N+1 en validación y creación) ──
            from apps.inventory.models import FlavorBag, CupStock, ToppingStock
            all_cup_ids    = {d['cup_size_id'] for d in data['items'] if d.get('cup_size_id')}
            all_flavor_ids = {fid for d in data['items'] for fid in d.get('flavor_ids', [])}
            all_topping_ids= {d['topping_id'] for d in data['items'] if d.get('topping_id')}
            cup_map    = {c.id: c for c in CupSize.objects.filter(id__in=all_cup_ids, is_active=True)}
            flavor_map = {f.id: f for f in Flavor.objects.select_related('bag').filter(id__in=all_flavor_ids, is_active=True)}
            topping_map= {t.id: t for t in Topping.objects.select_related('stock').filter(id__in=all_topping_ids, is_active=True)}

            # ── Pre-validar stock antes de crear nada ──
            for item_data in data['items']:
                qty = item_data.get('quantity', 1)
                cup_size_id = item_data.get('cup_size_id')
                flavor_ids = item_data.get('flavor_ids', [])
                topping_id = item_data.get('topping_id')
                is_topping_only = not cup_size_id

                if topping_id and topping_id not in topping_map:
                    return Response({'detail': 'Topping no encontrado o inactivo.'}, status=status.HTTP_400_BAD_REQUEST)

                if is_topping_only:
                    topping = topping_map.get(topping_id)
                    if not topping:
                        return Response({'detail': 'Selecciona un topping para venderlo solo.'}, status=status.HTTP_400_BAD_REQUEST)
                    try:
                        topping_stock = topping.stock
                    except ToppingStock.DoesNotExist:
                        return Response({'detail': f'No hay stock registrado para {topping.name}.'}, status=status.HTTP_400_BAD_REQUEST)
                    if topping_stock.quantity < qty:
                        return Response(
                            {'detail': f'Stock insuficiente de {topping.name}. '
                                       f'Disponible: {topping_stock.quantity}, necesario: {qty}.'},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                    continue  # Solo-topping: sin stock de vaso ni bolsa que validar

                cup_size = cup_map.get(cup_size_id)
                if not cup_size:
                    return Response({'detail': f'Tamano de vaso no encontrado o inactivo.'}, status=status.HTTP_400_BAD_REQUEST)

                if not flavor_ids:
                    return Response({'detail': f'El vaso {cup_size.size} necesita al menos un sabor.'}, status=status.HTTP_400_BAD_REQUEST)

                if len(flavor_ids) != len(set(flavor_ids)):
                    return Response({'detail': 'No repitas el mismo sabor en un vaso.'}, status=status.HTTP_400_BAD_REQUEST)

                if any(fid not in flavor_map for fid in flavor_ids):
                    return Response({'detail': 'Uno o mas sabores no existen o estan inactivos.'}, status=status.HTTP_400_BAD_REQUEST)

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
                flavor_objs  = [flavor_map[fid] for fid in flavor_ids]
                num_flavors  = len(flavor_objs)
                ml_por_sabor = cup_size.ml / Decimal(str(max(num_flavors, 1))) * qty

                for flavor in flavor_objs:
                    try:
                        bag = flavor.bag  # ya cargado por select_related
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
                categories = {f.category for f in flavor_objs}  # flavor_objs ya es lista
                if len(categories) == 1:
                    primary_cat = next(iter(categories))
                    try:
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
                    except Topping.MultipleObjectsReturned:
                        return Response({'detail': f'Hay mas de un topping automatico activo para la categoria {primary_cat}.'}, status=status.HTTP_400_BAD_REQUEST)
                    except ToppingStock.DoesNotExist:
                        return Response({'detail': f'No hay stock registrado para {auto_topping.name}.'}, status=status.HTTP_400_BAD_REQUEST)

            # Resolve FK
            seller = None
            if data.get('seller_id'):
                try:
                    seller = User.objects.get(id=data['seller_id'])
                except (User.DoesNotExist, ValueError, TypeError):
                    pass

            promotion = None
            if data.get('promotion_id'):
                try:
                    promotion = Promotion.objects.get(id=data['promotion_id'], is_active=True)
                except Promotion.DoesNotExist:
                    pass

            is_courtesy   = data.get('is_courtesy', False)
            courtesy_paid = Decimal(str(data.get('courtesy_paid', 0) or 0))

            sale = Sale.objects.create(
                shift=shift,
                seller=seller,
                seller_name=seller.full_name if seller else '',
                promotion=promotion,
                payment_method=data['payment_method'],
                cash_received=data.get('cash_received', Decimal('0')),
                transfer_amount=data.get('transfer_amount', Decimal('0')),
                transfer_reference=data.get('transfer_reference', ''),
                is_delivery=data.get('is_delivery', False),
                is_courtesy=is_courtesy,
                courtesy_paid=courtesy_paid,
                notes=data.get('notes', ''),
            )

            for item_data in data['items']:
                is_topping_only = not item_data.get('cup_size_id')
                cup_size = None
                if not is_topping_only:
                    cup_size = cup_map.get(item_data['cup_size_id'])  # ya pre-cargado

                topping = topping_map.get(item_data.get('topping_id')) if item_data.get('topping_id') else None

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
                    flavors = [flavor_map[fid] for fid in item_data.get('flavor_ids', [])]
                    num_flavors   = len(flavors)
                    ml_per_flavor = cup_size.ml / Decimal(str(max(num_flavors, 1)))
                    for flavor in flavors:
                        SaleItemFlavor.objects.create(
                            sale_item=sale_item,
                            flavor=flavor,
                            ml_consumed=ml_per_flavor * sale_item.quantity
                        )

                # Apply inventory deduction (shift ya obtenido arriba, no relanzar query)
                self._apply_inventory_or_error(sale_item, shift)

            sale.calculate_total()
            self._validate_payment_or_error(sale)

            # Auto-gasto por cortesía (no afecta caja)
            if is_courtesy:
                expense_amount = sale.total - courtesy_paid
                if expense_amount > 0:
                    from apps.expenses.models import Expense
                    Expense.objects.create(
                        shift=shift,
                        registered_by=request.user,
                        category='business',
                        origin='delivery' if data.get('is_delivery') else 'pos',
                        description=f'Cortesía #{sale.id}',
                        amount=expense_amount,
                        from_daily_cash=False,
                        notes=data.get('notes', ''),
                    )

            # Auto-create invoice
            from apps.billing.models import Invoice
            Invoice.objects.create(sale=sale, shift=shift)

            # Auto-create Delivery record when is_delivery=True
            if data.get('is_delivery'):
                from apps.deliveries.models import Delivery
                Delivery.objects.create(
                    sale=sale,
                    shift=shift,
                    address=data.get('delivery_address', '').strip() or 'Sin dirección',
                    four_digits=data.get('delivery_client', '').strip(),
                    notes=data.get('delivery_notes', '').strip(),
                    latitude=data.get('delivery_lat'),
                    longitude=data.get('delivery_lng'),
                )

        return Response(SaleSerializer(sale).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'], url_path='edit', permission_classes=[IsOperative])
    def edit_sale(self, request, pk=None):
        sale = self.get_object()

        with transaction.atomic():
            # ── Campos sin impacto en inventario ──
            decimal_labels = {
                'cash_received': 'El efectivo recibido',
                'transfer_amount': 'El monto de transferencia',
            }
            decimal_fields = {'cash_received', 'transfer_amount'}
            simple_fields  = ['cash_received', 'transfer_amount',
                              'transfer_reference', 'is_delivery', 'notes']
            for field in simple_fields:
                if field in request.data:
                    val = request.data[field]
                    if field in decimal_fields:
                        val = self._decimal_or_error(val, decimal_labels[field])
                    setattr(sale, field, val)

            # ── Método de pago: limpiar montos contrarios automáticamente ──
            if 'payment_method' in request.data:
                sale.payment_method = request.data['payment_method']
                pm = sale.payment_method
                if pm not in {choice[0] for choice in Sale.PAYMENT_CHOICES}:
                    raise ValidationError({'detail': 'Metodo de pago invalido.'})
                if pm == 'cash':
                    sale.transfer_amount    = Decimal('0')
                    sale.transfer_reference = ''
                    sale.change_given = max(Decimal('0'), Decimal(str(sale.cash_received)) - sale.total)
                elif pm == 'transfer':
                    sale.cash_received   = Decimal('0')
                    sale.change_given    = Decimal('0')
                    sale.transfer_amount = Decimal(str(sale.transfer_amount or 0)) or sale.total
                elif pm == 'mixed':
                    cash = Decimal(str(sale.cash_received or 0))
                    trf  = Decimal(str(sale.transfer_amount or 0))
                    sale.change_given = max(Decimal('0'), cash - max(Decimal('0'), sale.total - trf))

            if 'seller_id' in request.data:
                seller_id = request.data['seller_id']
                if seller_id:
                    try:
                        sale.seller = User.objects.get(id=seller_id)
                    except (User.DoesNotExist, ValueError, TypeError):
                        sale.seller = None
                else:
                    sale.seller = None

            if 'promotion_id' in request.data:
                promo_id = request.data['promotion_id']
                if promo_id:
                    try:
                        sale.promotion = Promotion.objects.get(id=promo_id, is_active=True)
                    except (Promotion.DoesNotExist, ValueError, TypeError):
                        sale.promotion = None
                else:
                    sale.promotion = None

            if 'is_courtesy' in request.data:
                sale.is_courtesy = bool(request.data['is_courtesy'])
            if 'courtesy_paid' in request.data:
                sale.courtesy_paid = self._decimal_or_error(
                    request.data.get('courtesy_paid'),
                    'El valor pagado en cortesia'
                )

            # ── Si vienen items nuevos → revertir inventario y reemplazar ──
            if 'items' in request.data:
                items_data = request.data['items']

                edit_shift = Shift.get_active()
                for item in sale.items.all():
                    item.reverse_inventory(shift=edit_shift)

                # Pre-validar stock (descontando lo que ya se va a devolver)
                from apps.inventory.models import FlavorBag, CupStock, ToppingStock
                for item_data in items_data:
                    qty = self._positive_int_or_error(item_data.get('quantity', 1), 'La cantidad')
                    if 'unit_price' not in item_data:
                        raise ValidationError({'detail': 'El precio unitario es obligatorio.'})
                    self._decimal_or_error(item_data.get('unit_price'), 'El precio unitario')
                    cup_size_id = item_data.get('cup_size_id')
                    flavor_ids = item_data.get('flavor_ids', [])
                    topping_id = item_data.get('topping_id')
                    is_topping_only = not cup_size_id

                    topping = None
                    if topping_id:
                        try:
                            topping = Topping.objects.get(id=topping_id, is_active=True)
                        except (Topping.DoesNotExist, ValueError, TypeError):
                            raise ValidationError({'detail': 'Topping no encontrado o inactivo.'})

                    if is_topping_only:
                        if not topping:
                            raise ValidationError({'detail': 'Selecciona un topping para venderlo solo.'})
                        try:
                            topping_stock = topping.stock
                        except ToppingStock.DoesNotExist:
                            raise ValidationError({'detail': f'No hay stock registrado para {topping.name}.'})
                        if topping_stock.quantity < qty:
                            raise ValidationError({
                                'detail': f'Stock insuficiente de {topping.name}. '
                                          f'Disponible: {topping_stock.quantity}, necesario: {qty}.'
                            })
                        continue

                    try:
                        cup_size = CupSize.objects.get(id=cup_size_id, is_active=True)
                    except (CupSize.DoesNotExist, ValueError, TypeError):
                        raise ValidationError({'detail': 'Tamano de vaso no encontrado o inactivo.'})

                    if not flavor_ids:
                        raise ValidationError({'detail': f'El vaso {cup_size.size} necesita al menos un sabor.'})
                    if len(flavor_ids) != len(set(flavor_ids)):
                        raise ValidationError({'detail': 'No repitas el mismo sabor en un vaso.'})

                    flavor_objs = list(Flavor.objects.select_related('bag').filter(id__in=flavor_ids, is_active=True))
                    if len(flavor_objs) != len(flavor_ids):
                        raise ValidationError({'detail': 'Uno o mas sabores no existen o estan inactivos.'})

                    num_flavors = len(flavor_objs)
                    ml_por_sabor = cup_size.ml / Decimal(str(max(num_flavors, 1))) * qty

                    # Vasos
                    try:
                        cs = CupStock.objects.get(cup_size=cup_size)
                        if cs.quantity < qty:
                            raise ValidationError({'detail': f'Stock insuficiente de vasos {cup_size.size}. Disponible: {cs.quantity}, necesario: {qty}.'})
                    except CupStock.DoesNotExist:
                        raise ValidationError({'detail': f'Sin stock para vasos {cup_size.size}.'})

                    for flavor in flavor_objs:
                        try:
                            if flavor.bag.stock_ml < ml_por_sabor:
                                raise ValidationError({
                                    'detail': f'Stock insuficiente de {flavor.name}. '
                                              f'Disponible: {flavor.bag.stock_ml:.0f} ml, necesario: {ml_por_sabor:.0f} ml.'
                                })
                        except FlavorBag.DoesNotExist:
                            raise ValidationError({'detail': f'Sin bolsa para {flavor.name}.'})

                    categories = {f.category for f in flavor_objs if f.category}
                    if len(categories) == 1:
                        primary_cat = next(iter(categories))
                        try:
                            auto_topping = Topping.objects.get(linked_category=primary_cat, is_active=True)
                            auto_ts = ToppingStock.objects.get(topping=auto_topping)
                            if auto_ts.quantity < qty:
                                raise ValidationError({
                                    'detail': f'Stock insuficiente de {auto_topping.name}. '
                                              f'Disponible: {auto_ts.quantity}, necesario: {qty}.'
                                })
                        except Topping.DoesNotExist:
                            pass
                        except Topping.MultipleObjectsReturned:
                            raise ValidationError({'detail': f'Hay mas de un topping automatico activo para la categoria {primary_cat}.'})
                        except ToppingStock.DoesNotExist:
                            raise ValidationError({'detail': f'No hay stock registrado para {auto_topping.name}.'})

                sale.items.all().delete()

                # Crear nuevos items (unit_price viene explícito desde el frontend)
                for item_data in items_data:
                    is_topping_only = not item_data.get('cup_size_id')
                    cup_size = None if is_topping_only else CupSize.objects.get(id=item_data['cup_size_id'], is_active=True)
                    topping  = None
                    if item_data.get('topping_id'):
                        topping = Topping.objects.get(id=item_data['topping_id'], is_active=True)
                    unit_price = self._decimal_or_error(item_data.get('unit_price'), 'El precio unitario')
                    quantity = self._positive_int_or_error(item_data.get('quantity', 1), 'La cantidad')
                    topping_price = (topping.price if topping else Decimal('0')) if not is_topping_only else Decimal('0')
                    sale_item = SaleItem.objects.create(
                        sale=sale, cup_size=cup_size, topping=topping,
                        unit_price=unit_price, topping_price=topping_price,
                        quantity=quantity,
                    )
                    if not is_topping_only:
                        flavors = Flavor.objects.filter(id__in=item_data['flavor_ids'], is_active=True)
                        num_flavors  = flavors.count()
                        ml_per_flavor = cup_size.ml / Decimal(str(max(num_flavors, 1)))
                        for flavor in flavors:
                            SaleItemFlavor.objects.create(
                                sale_item=sale_item, flavor=flavor,
                                ml_consumed=ml_per_flavor * sale_item.quantity
                            )
                    self._apply_inventory_or_error(sale_item, edit_shift)

                sale.calculate_total()
                self._validate_payment_or_error(sale)
            else:
                sale.calculate_total()
                self._validate_payment_or_error(sale)

        return Response(SaleSerializer(sale).data)

    @action(detail=False, methods=['get'], url_path='today')
    def today(self, request):
        shift = Shift.get_active()
        if not shift:
            return Response({'sales': [], 'total': 0})
        # Autocorregir ventas huérfanas: is_delivery=True sin registro Delivery
        from apps.deliveries.models import Delivery as DeliveryModel
        orphans = Sale.objects.filter(shift=shift, is_delivery=True, delivery__isnull=True)
        for orphan in orphans:
            DeliveryModel.objects.get_or_create(
                sale=orphan,
                defaults=dict(shift=shift, address='Sin dirección', status='pending')
            )

        # Incluir todas las ventas (incluyendo anuladas) para mostrar estado en dashboard
        sales = Sale.objects.filter(shift=shift).select_related(
            'invoice', 'delivery__delivery_person', 'seller', 'promotion'
        ).prefetch_related(
            'items__saleitems_flavors__flavor',
            'items__cup_size',
            'items__topping',
        )
        # Solo contar en el total las ventas activas
        active_sales = [s for s in sales if is_active_sale(s)]
        total = sum(
            (s.courtesy_paid if s.is_courtesy else s.total)
            for s in active_sales
        )
        return Response({
            'sales': SaleSerializer(sales, many=True).data,
            'total': float(total),
            'count': len(active_sales)
        })
