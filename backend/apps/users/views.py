from rest_framework import viewsets, status
from django.db.models.deletion import ProtectedError
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView
from core.permissions import IsAdmin
from .models import User
from .serializers import (
    UserSerializer, UserCreateSerializer,
    ChangePasswordSerializer, CustomTokenObtainPairSerializer
)


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('full_name')
    permission_classes = [IsAdmin]

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    @action(detail=False, methods=['post'], url_path='change-password')
    def change_password(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = User.objects.get(id=serializer.validated_data['user_id'])
            user.set_password(serializer.validated_data['new_password'])
            user.save()
            return Response({'detail': 'Contraseña actualizada correctamente.'})
        except User.DoesNotExist:
            return Response({'detail': 'Usuario no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['get'], url_path='operatives')
    def operatives(self, request):
        """Vendedoras activas para selección en POS"""
        users = User.objects.filter(role='operative', is_active=True)
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user == request.user:
            return Response(
                {'detail': 'No puedes eliminar tu propia cuenta.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        # Snapshot del nombre en todas las ventas antes de eliminar
        user.sales.all().update(seller_name=user.full_name)
        try:
            user.delete()
        except ProtectedError:
            return Response(
                {'detail': f'No se puede eliminar a "{user.full_name}" porque tiene jornadas registradas. Desactívalo en su lugar.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['patch'], url_path='toggle-active')
    def toggle_active(self, request, pk=None):
        user = self.get_object()
        user.is_active = not user.is_active
        user.save()
        return Response({'is_active': user.is_active})
