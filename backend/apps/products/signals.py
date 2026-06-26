"""
Señales de productos:
- Cuando cambia el precio de un CupSize, desactiva las promociones activas
  vinculadas a ese vaso para evitar precios desincronizados.
"""
from django.db.models.signals import pre_save
from django.dispatch import receiver


@receiver(pre_save, sender='products.CupSize')
def desactivar_promos_si_cambia_precio(sender, instance, **kwargs):
    if not instance.pk:
        return  # objeto nuevo, no tiene promos aún
    try:
        viejo = sender.objects.get(pk=instance.pk)
    except sender.DoesNotExist:
        return
    if viejo.price != instance.price:
        # Precio cambió — desactivar promos activas de este vaso
        from apps.promotions.models import Promotion
        afectadas = Promotion.objects.filter(cup_size=instance, is_active=True)
        count = afectadas.count()
        if count:
            afectadas.update(is_active=False)
            # Log para que el admin sepa qué pasó
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(
                f'CupSize "{instance.size}" cambió precio de '
                f'${viejo.price:,.0f} → ${instance.price:,.0f}. '
                f'{count} promoción(es) desactivada(s) automáticamente.'
            )
