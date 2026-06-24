from rest_framework import serializers
from .models import TransferMethod


class TransferMethodSerializer(serializers.ModelSerializer):
    provider_label = serializers.CharField(source='get_provider_display', read_only=True)
    qr_image_url   = serializers.SerializerMethodField()

    class Meta:
        model  = TransferMethod
        fields = [
            'id', 'provider', 'provider_label', 'display_name',
            'account_number', 'qr_image', 'qr_image_url', 'is_active', 'order',
        ]

    def get_qr_image_url(self, obj):
        request = self.context.get('request')
        if obj.qr_image and request:
            return request.build_absolute_uri(obj.qr_image.url)
        return None
