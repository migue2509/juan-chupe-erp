from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['full_name'] = user.full_name
        token['role'] = user.role
        return token

    def validate(self, attrs):
        data = super().validate(attrs)

        # ── Seguridad: bloquear login en días no laborales (solo operativas) ──
        user = self.user

        # Admins y staff siempre pasan sin importar horario
        if user.role == 'admin' or user.is_staff or user.is_superuser:
            pass
        elif user.role in ('operative', 'seller'):
            try:
                from django.utils import timezone
                schedule = user.schedule
                # Solo bloquea si el admin activó la seguridad de horario
                if schedule.security_enabled:
                    today = timezone.localdate()
                    if not schedule.is_work_day(today):
                        from apps.payroll.models import DAY_LABELS
                        day_label = DAY_LABELS[today.weekday()]
                        raise serializers.ValidationError(
                            f'Tu cuenta no está habilitada los días {day_label}. '
                            f'Habla con tu administrador si crees que es un error.'
                        )
            except serializers.ValidationError:
                raise
            except Exception:
                pass

        # ── Registrar día trabajado al hacer login (operativas y vendedoras) ──
        if user.role in ('operative', 'seller'):
            try:
                from django.utils import timezone
                from apps.payroll.models import WorkLog
                today = timezone.localdate()
                wage = 0
                try:
                    wage = user.schedule.wage_for_day(today)
                except Exception:
                    pass
                WorkLog.objects.get_or_create(
                    user=user, date=today,
                    defaults={'wage_earned': wage}
                )
            except Exception:
                pass

        data['user'] = {
            'id': user.id,
            'username': user.username,
            'full_name': user.full_name,
            'role': user.role,
        }
        return data


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'full_name', 'role', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ['username', 'full_name', 'role', 'password']

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class ChangePasswordSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    new_password = serializers.CharField(min_length=6)
