from decimal import Decimal

OZ_TO_ML = Decimal('29.5735')

def oz_to_ml(oz: float) -> Decimal:
    """Convierte onzas a mililitros (1 oz = 29.5735 ml)"""
    return Decimal(str(oz)) * OZ_TO_ML

def distribute_ml(total_ml: Decimal, num_flavors: int) -> Decimal:
    """Distribuye ml proporcionalmente entre sabores"""
    if num_flavors <= 0:
        return Decimal('0')
    return total_ml / Decimal(str(num_flavors))

CUP_SIZES_OZ = {
    '8oz': 8,
    '12oz': 12,
    '16oz': 16,
    '24oz': 24,
}

def cup_ml(size_key: str) -> Decimal:
    oz = CUP_SIZES_OZ.get(size_key, 0)
    return oz_to_ml(oz)
