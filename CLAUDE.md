# Juan Chupe Granizados — ERP

## Stack
- **Backend**: Django REST Framework, Python 3.11, SQLite (dev)
- **Frontend**: React + Vite + Tailwind CSS v3
- **Repo**: https://github.com/migue2509/juan-chupe-erp

## Reglas de trabajo
- Después de cada cambio recordar al usuario hacer commit y push:
  ```powershell
  git add <archivos>
  git commit -m "feat/fix/chore: descripcion"
  git push origin main
  ```

## Convención de commits
- `feat(scope):` — nueva funcionalidad
- `fix(scope):` — corrección de bug
- `chore:` — cambios de config, dependencias, migración
- `refactor(scope):` — refactor sin cambio funcional

## Apps Django
- `products` — Flavor, CupSize, Topping
- `inventory` — FlavorBag, CupStock, StockMovement
- `sales` — Sale, SaleItem
- `shifts` — Shift
- `expenses` — Expense
- `billing` — Invoice
- `deliveries` — Delivery
- `attendance` — Attendance
- `promotions` — Promotion
- `reports` — endpoints de reportes
- `users` — CustomUser

## Notas técnicas
- `FlavorBag.related_name = 'bag'` → acceder con `flavor.bag`
- PATCH en serializers usa `extra_kwargs = {'name': {'validators': []}}` para evitar UniqueValidator en updates
- Tailwind v3: no usar valores arbitrarios en `@apply` (ej: `bg-[#hex]`, `scale-[0.98]`)
- `CupSize.size` es texto libre (sin choices)
- 1 bolsa de granizado = 6500 ml al agregar inventario
