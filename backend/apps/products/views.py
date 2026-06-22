from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from core.permissions import IsAdminOrReadOnly, IsOperative
from .models import Flavor, CupSize, Product, Topping
from .serializers import FlavorSerializer, CupSizeSerializer, ProductSerializer, ToppingSerializer


class FlavorViewSet(viewsets.ModelViewSet):
    queryset = Flavor.objects.all()
    serializer_class = FlavorSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ['category', 'is_active']

    @action(detail=False, methods=['get'], url_path='active')
    def active(self, request):
        flavors = Flavor.objects.filter(is_active=True)
        return Response(FlavorSerializer(flavors, many=True).data)

    def perform_create(self, serializer):
        """Auto-crea la FlavorBag asociada al crear un sabor"""
        from apps.inventory.models import FlavorBag
        flavor = serializer.save()
        min_stock = self.request.data.get('min_stock_ml', 500)
        bag_cat = flavor.category  # mismo valor en ambos modelos
        FlavorBag.objects.get_or_create(
            flavor=flavor,
            defaults={'category': bag_cat, 'min_stock_ml': min_stock}
        )


class CupSizeViewSet(viewsets.ModelViewSet):
    """Devuelve todos los vasos para admin; filtrar is_active en frontend si necesario"""
    queryset = CupSize.objects.all().order_by('price')
    serializer_class = CupSizeSerializer
    permission_classes = [IsAdminOrReadOnly]

    def perform_create(self, serializer):
        """Auto-crea CupStock al crear un vaso"""
        from apps.inventory.models import CupStock
        cup = serializer.save()
        CupStock.objects.get_or_create(
            cup_size=cup,
            defaults={'min_quantity': cup.min_quantity}
        )


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ['product_type', 'is_active']


class ToppingViewSet(viewsets.ModelViewSet):
    queryset = Topping.objects.all()
    serializer_class = ToppingSerializer
    permission_classes = [IsAdminOrReadOnly]

    def perform_create(self, serializer):
        """Auto-crea ToppingStock al crear un topping"""
        from apps.inventory.models import ToppingStock
        topping = serializer.save()
        ToppingStock.objects.get_or_create(
            topping=topping,
            defaults={'min_quantity': topping.min_stock}
        )
