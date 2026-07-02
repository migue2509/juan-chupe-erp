from rest_framework import viewsets
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from core.permissions import IsAdmin, IsAdminOrReadOnly
from .models import TransferMethod
from .serializers import TransferMethodSerializer


class TransferMethodViewSet(viewsets.ModelViewSet):
    queryset           = TransferMethod.objects.all()
    serializer_class   = TransferMethodSerializer
    permission_classes = [IsAdminOrReadOnly]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx
