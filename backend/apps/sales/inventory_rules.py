def automatic_topping_requirement(promotion, categories, quantity, cup_size=None):
    """Return the topping category and bags required for sold containers."""
    if promotion and promotion.topping_bags_per_unit:
        return promotion.topping_category, promotion.topping_bags_per_unit * quantity
    if cup_size and cup_size.topping_bags_per_unit:
        return cup_size.topping_category, cup_size.topping_bags_per_unit * quantity
    if len(categories) == 1:
        return next(iter(categories)), quantity
    return None, 0
