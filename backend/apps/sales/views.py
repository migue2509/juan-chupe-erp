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
                cup_size = CupSize.objects.get(id=item_data['cup_size_id'])
                topping = None
                if item_data.get('topping_id'):
                    try:
                        topping = Topping.objects.get(id=item_data['topping_id'])
                    except Topping.DoesNotExist:
                        pass

                unit_price = item_data['unit_price']
                if promotion:
                    unit_price = promotion.unit_price

                sale_item = SaleItem.objects.create(
                    sale=sale,
                    cup_size=cup_size,
                    topping=topping,
                    unit_price=unit_price,
                    quantity=item_data.get('quantity', 1),
                )

                flavors = Flavor.objects.filter(id__in=item_data['flavor_ids'])
                num_flavors = flavors.count()
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
