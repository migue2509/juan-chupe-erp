from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView
from core.permissions import IsAdmin, IsOperative
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
    filterset_fields = ['role', 'is_active']

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

    @action(detail=False, methods=['get'], url_path='operatives', permission_classes=[IsOperative])
    def operatives(self, request):
        """Vendedoras activas para selección en POS"""
        users = User.objects.filter(role='operative', is_active=True)
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='upload-avatar', permission_classes=[IsOperative])
    def upload_avatar(self, request, pk=None):
        user = self.get_object()
        # Solo el propio usuario o un admin puede cambiar el avatar
        if not request.user.is_admin and request.user.id != user.id:
            return Response({'detail': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        if 'avatar' not in request.FILES:
            return Response({'detail': 'No se encontró imagen.'}, status=status.HTTP_400_BAD_REQUEST)
        if user.avatar:
            user.avatar.delete(save=False)
        user.avatar = request.FILES['avatar']
        user.save()
        serializer = UserSerializer(user, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='remove-avatar', permission_classes=[IsOperative])
    def remove_avatar(self, request, pk=None):
        user = self.get_object()
        if not request.user.is_admin and request.user.id != user.id:
            return Response({'detail': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        if user.avatar:
            user.avatar.delete(save=False)
            user.avatar = None
            user.save()
        serializer = UserSerializer(user, context={'request': request})
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        return Response(
            {'detail': 'La eliminación de usuarios no está permitida. Usa desactivar en su lugar.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )

    @action(detail=True, methods=['patch'], url_path='toggle-active')
    def toggle_active(self, request, pk=None):
        user = self.get_object()
        if user == request.user and user.is_active:
            return Response(
                {'detail': 'No puedes desactivar tu propia cuenta.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        user.is_active = not user.is_active
        user.save()
        return Response({'is_active': user.is_active})
