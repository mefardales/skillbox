---
name: django
description: >
  Django best practices for modern web applications covering project structure,
  models, views, Django REST Framework, database optimization, and testing. Use
  this skill when building or maintaining Django applications.
license: MIT
metadata:
  author: skillbox
  version: "1.0"
  category: backend
  tags: django, python, drf, web, orm
---

# Django Best Practices

## Project Structure

Split settings by environment. Organize apps by domain, not by technical role.

```
myproject/
  config/
    __init__.py
    settings/
      __init__.py
      base.py          # shared settings
      development.py   # DJANGO_SETTINGS_MODULE=config.settings.development
      production.py
      test.py
    urls.py
    wsgi.py
    asgi.py
  apps/
    users/
      models.py
      views.py
      serializers.py
      urls.py
      services.py      # business logic lives here, not in views
      selectors.py     # complex query logic
      tests/
        test_models.py
        test_views.py
        test_services.py
    orders/
      ...
    payments/
      ...
  manage.py
  requirements/
    base.txt
    development.txt
    production.txt
```

```python
# config/settings/base.py
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "rest_framework",
    "django_filters",
    "apps.users",
    "apps.orders",
    "apps.payments",
]

AUTH_USER_MODEL = "users.User"  # always define a custom user model from the start
```

```python
# config/settings/development.py
from .base import *

DEBUG = True
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "myproject_dev",
        "HOST": "localhost",
        "PORT": "5432",
    }
}
```

Always define a custom user model before the first migration, even if it is identical to the default. Changing it later is extremely painful.

## Models

Use explicit field types. Add `db_index=True` to fields you filter on. Use `TextChoices` for status fields.

```python
# apps/orders/models.py
from django.db import models
from django.conf import settings

class Order(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        CONFIRMED = "confirmed", "Confirmed"
        SHIPPED = "shipped", "Shipped"
        DELIVERED = "delivered", "Delivered"
        CANCELLED = "cancelled", "Cancelled"

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="orders",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["customer", "status"]),
        ]

    def __str__(self):
        return f"Order #{self.pk} - {self.status}"
```

### Custom Managers and QuerySets

Move query logic into custom querysets. Chain them for composability.

```python
class OrderQuerySet(models.QuerySet):
    def active(self):
        return self.exclude(status=Order.Status.CANCELLED)

    def for_customer(self, customer_id):
        return self.filter(customer_id=customer_id)

    def placed_after(self, date):
        return self.filter(created_at__gte=date)

    def with_items(self):
        return self.prefetch_related("items__product")

class Order(models.Model):
    # ... fields ...
    objects = OrderQuerySet.as_manager()

# Usage: composable and readable
orders = (
    Order.objects
    .active()
    .for_customer(user.id)
    .placed_after(last_month)
    .with_items()
)
```

### Signals

Use signals sparingly. They create hidden coupling and make debugging difficult. Prefer explicit service methods.

```python
# BAD: hidden side effect via signal
@receiver(post_save, sender=Order)
def send_order_email(sender, instance, created, **kwargs):
    if created:
        send_confirmation_email(instance)

# GOOD: explicit call in a service
class OrderService:
    def create_order(self, customer, items):
        order = Order.objects.create(customer=customer, total_amount=total)
        OrderItem.objects.bulk_create([...])
        send_confirmation_email(order)  # explicit and visible
        return order
```

## Views: Class-Based vs Function-Based

Use function-based views with `@api_view` for simple endpoints. Use `ViewSet` or `APIView` when you need multiple HTTP methods on the same resource.

```python
# Simple endpoint -- use function-based
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def current_user(request):
    serializer = UserSerializer(request.user)
    return Response(serializer.data)
```

```python
# CRUD resource -- use ViewSet
from rest_framework import viewsets, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend

class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["status"]
    ordering_fields = ["created_at", "total_amount"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return (
            Order.objects
            .filter(customer=self.request.user)
            .select_related("customer")
            .prefetch_related("items__product")
        )

    def perform_create(self, serializer):
        serializer.save(customer=self.request.user)
```

## Django REST Framework Patterns

### Serializers

Use separate serializers for read and write operations. Keep validation logic in the serializer.

```python
# apps/orders/serializers.py
from rest_framework import serializers

class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = OrderItem
        fields = ["id", "product", "product_name", "quantity", "unit_price"]

class OrderReadSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source="customer.get_full_name", read_only=True)

    class Meta:
        model = Order
        fields = ["id", "customer_name", "status", "total_amount", "items", "created_at"]

class OrderWriteSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True)

    class Meta:
        model = Order
        fields = ["items"]

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("Order must have at least one item.")
        return items

    def create(self, validated_data):
        items_data = validated_data.pop("items")
        total = sum(i["quantity"] * i["unit_price"] for i in items_data)
        order = Order.objects.create(total_amount=total, **validated_data)
        OrderItem.objects.bulk_create(
            [OrderItem(order=order, **item) for item in items_data]
        )
        return order
```

### Permissions

Write custom permissions for business rules:

```python
from rest_framework.permissions import BasePermission

class IsOrderOwner(BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.customer == request.user

class OrderViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsOrderOwner]
```

## Database Optimization

### Preventing N+1 Queries

Always use `select_related` for ForeignKey/OneToOne and `prefetch_related` for ManyToMany/reverse FK.

```python
# BAD: N+1 queries
orders = Order.objects.all()
for order in orders:
    print(order.customer.email)     # hits DB for each order
    for item in order.items.all():  # hits DB for each order
        print(item.product.name)    # hits DB for each item

# GOOD: 3 queries total
orders = (
    Order.objects
    .select_related("customer")
    .prefetch_related("items__product")
)
```

Install `django-debug-toolbar` in development and monitor the SQL panel. Every page should execute a predictable number of queries.

### Migration Best Practices

Make migrations backward-compatible. Follow a deploy-then-migrate-then-cleanup process for destructive changes.

```python
# Adding a field: safe, backward-compatible
# migrations/0005_add_tracking_number.py
class Migration(migrations.Migration):
    operations = [
        migrations.AddField(
            model_name="order",
            name="tracking_number",
            field=models.CharField(max_length=100, null=True, blank=True),
        ),
    ]

# Renaming a field: do it in steps
# Step 1: Add new field (deploy)
# Step 2: Backfill data (management command)
# Step 3: Update code to use new field (deploy)
# Step 4: Remove old field (deploy)
```

Do not use `RunPython` in migrations for large data backfills. Use management commands instead so you can monitor progress and restart if needed.

## Authentication

Use `django-allauth` for social auth and email verification. Use `djangorestframework-simplejwt` for API token auth.

```python
# config/settings/base.py
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.CursorPagination",
    "PAGE_SIZE": 20,
}

from datetime import timedelta
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}
```

```python
# config/urls.py
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path("api/token/", TokenObtainPairView.as_view()),
    path("api/token/refresh/", TokenRefreshView.as_view()),
    path("api/v1/", include("apps.orders.urls")),
]
```

## Celery Task Patterns

Use Celery for background work. Keep tasks small, idempotent, and retriable.

```python
# apps/orders/tasks.py
from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)

@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,  # acknowledge after completion, not before
)
def send_order_confirmation(self, order_id):
    try:
        order = Order.objects.select_related("customer").get(id=order_id)
        send_email(
            to=order.customer.email,
            template="order_confirmation",
            context={"order": order},
        )
    except Order.DoesNotExist:
        logger.warning(f"Order {order_id} not found, skipping.")
        return  # do not retry, order was deleted
    except EmailServiceError as exc:
        raise self.retry(exc=exc)

# Call from service layer -- pass IDs, not objects
class OrderService:
    def create_order(self, customer, items):
        order = self._build_order(customer, items)
        send_order_confirmation.delay(order.id)  # pass ID, not the object
        return order
```

Always pass serializable arguments (IDs, strings, numbers) to tasks, never Django model instances.

## Testing with pytest-django

```python
# apps/orders/tests/test_services.py
import pytest
from decimal import Decimal
from apps.orders.services import OrderService

@pytest.fixture
def user(db):
    from apps.users.models import User
    return User.objects.create_user(email="test@example.com", password="testpass123")

@pytest.fixture
def product(db):
    from apps.inventory.models import Product
    return Product.objects.create(name="Widget", price=Decimal("29.99"), stock=100)

@pytest.fixture
def order_service():
    return OrderService()

class TestOrderService:
    def test_create_order_calculates_total(self, user, product, order_service):
        order = order_service.create_order(
            customer=user,
            items=[{"product": product, "quantity": 3}],
        )
        assert order.total_amount == Decimal("89.97")
        assert order.items.count() == 1

    def test_create_order_rejects_empty_items(self, user, order_service):
        with pytest.raises(ValueError, match="at least one item"):
            order_service.create_order(customer=user, items=[])
```

```python
# apps/orders/tests/test_views.py
import pytest
from rest_framework.test import APIClient

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def authenticated_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client

class TestOrderAPI:
    def test_list_orders_returns_only_own_orders(self, authenticated_client, user):
        # create orders for user and another user...
        response = authenticated_client.get("/api/v1/orders/")
        assert response.status_code == 200
        assert all(o["customer_name"] for o in response.data["results"])

    def test_unauthenticated_returns_401(self, api_client):
        response = api_client.get("/api/v1/orders/")
        assert response.status_code == 401
```

## Security

```python
# config/settings/production.py
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
X_FRAME_OPTIONS = "DENY"
```

Do not disable CSRF protection. If you need CSRF exemption for API endpoints using token auth, DRF handles this automatically for `TokenAuthentication` and `JWTAuthentication`.

Never use `.raw()` or `extra()` with user input. Use parameterized queries:

```python
# BAD: SQL injection risk
User.objects.raw(f"SELECT * FROM users WHERE email = '{email}'")

# GOOD: parameterized
User.objects.raw("SELECT * FROM users WHERE email = %s", [email])

# BEST: use the ORM
User.objects.filter(email=email)
```

## Common Pitfalls

1. **Fat views.** Do not put business logic in views. Views handle HTTP; services handle business rules.
2. **Not using `select_related`/`prefetch_related`.** Every queryset that accesses related objects must preload them. Use django-debug-toolbar to catch N+1 queries.
3. **Forgetting to set `AUTH_USER_MODEL`.** Set it before the first migration. Changing it after is extremely difficult.
4. **Passing model instances to Celery tasks.** The object may change or be deleted before the task runs. Pass IDs and re-fetch.
5. **Running data migrations in schema migrations.** Large data migrations block deployments. Use management commands.
6. **Not setting `on_delete` deliberately.** Think about what should happen when a related object is deleted: `PROTECT`, `CASCADE`, `SET_NULL`, or `RESTRICT`.
