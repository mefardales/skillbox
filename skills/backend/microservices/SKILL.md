---
name: microservices
description: >
  Microservices architecture patterns including service decomposition, inter-service
  communication, distributed transactions, and observability. Use this skill when
  designing, building, or troubleshooting distributed backend systems.
license: MIT
metadata:
  author: skillbox
  version: "1.0"
  category: backend
  tags: microservices, distributed, architecture, messaging, grpc
---

# Microservices Architecture Patterns

## When to Use Microservices

Do not start with microservices. Start with a modular monolith and extract services only when you have a clear need: independent scaling, independent deployment by separate teams, or different technology requirements. Premature decomposition creates a distributed monolith, which has all the complexity of microservices with none of the benefits.

## Service Decomposition

Decompose along bounded contexts from Domain-Driven Design. Each service owns a single business capability and its data.

```
order-service/       # Owns: orders, order items, order status
payment-service/     # Owns: payments, refunds, payment methods
inventory-service/   # Owns: stock levels, reservations, warehouses
notification-service/ # Owns: email/SMS/push delivery, templates
```

A service should be owned by one team. If two teams need to change the same service frequently, the boundary is wrong.

## Project Structure Per Service

```
order-service/
  src/
    api/           # HTTP/gRPC handlers
    domain/        # Business logic, entities, value objects
    repository/    # Data access
    events/        # Event publishers and consumers
    clients/       # Outbound calls to other services
  tests/
  Dockerfile
  docker-compose.yml
  openapi.yaml     # or proto/ for gRPC
```

## Synchronous Communication: REST and gRPC

Use REST for public-facing APIs and simple service-to-service calls. Use gRPC for internal, performance-sensitive communication.

gRPC service definition:

```protobuf
syntax = "proto3";
package inventory;

service InventoryService {
  rpc CheckStock(StockRequest) returns (StockResponse);
  rpc ReserveItems(ReserveRequest) returns (ReserveResponse);
}

message StockRequest {
  string product_id = 1;
}

message StockResponse {
  string product_id = 1;
  int32 available = 2;
}
```

Always set timeouts on synchronous calls. Never let a service wait indefinitely:

```python
import grpc

channel = grpc.insecure_channel("inventory-service:50051")
stub = InventoryServiceStub(channel)

try:
    response = stub.CheckStock(
        StockRequest(product_id="SKU-123"),
        timeout=2.0  # seconds -- always set this
    )
except grpc.RpcError as e:
    if e.code() == grpc.StatusCode.DEADLINE_EXCEEDED:
        # handle timeout
        pass
```

## Asynchronous Communication: Message Brokers

Use async messaging for operations that do not need an immediate response. This decouples services and improves resilience.

**RabbitMQ** -- use for task queues and routing:

```python
import pika

connection = pika.BlockingConnection(pika.ConnectionParameters("rabbitmq"))
channel = connection.channel()

channel.exchange_declare(exchange="orders", exchange_type="topic", durable=True)
channel.queue_declare(queue="notification.order_placed", durable=True)
channel.queue_bind(
    queue="notification.order_placed",
    exchange="orders",
    routing_key="order.placed"
)

# Publisher (order-service)
channel.basic_publish(
    exchange="orders",
    routing_key="order.placed",
    body=json.dumps({"order_id": 42, "customer_id": 7}),
    properties=pika.BasicProperties(
        delivery_mode=2,  # persistent
        content_type="application/json",
    ),
)

# Consumer (notification-service)
def on_order_placed(ch, method, properties, body):
    event = json.loads(body)
    send_confirmation_email(event["order_id"])
    ch.basic_ack(delivery_tag=method.delivery_tag)

channel.basic_consume(queue="notification.order_placed", on_message_callback=on_order_placed)
```

**Kafka** -- use for event streaming and event sourcing:

```python
from confluent_kafka import Producer, Consumer

# Producer (order-service)
producer = Producer({"bootstrap.servers": "kafka:9092"})
producer.produce(
    topic="order-events",
    key=str(order_id).encode(),  # partition by order ID for ordering
    value=json.dumps({"type": "OrderPlaced", "order_id": 42}).encode(),
)
producer.flush()

# Consumer (inventory-service)
consumer = Consumer({
    "bootstrap.servers": "kafka:9092",
    "group.id": "inventory-service",
    "auto.offset.reset": "earliest",
    "enable.auto.commit": False,
})
consumer.subscribe(["order-events"])

while True:
    msg = consumer.poll(1.0)
    if msg is None:
        continue
    event = json.loads(msg.value())
    if event["type"] == "OrderPlaced":
        reserve_stock(event["order_id"])
    consumer.commit(msg)
```

Use Kafka when you need event replay, multiple consumers per event, or high throughput. Use RabbitMQ when you need flexible routing, priority queues, or simpler operations.

## Circuit Breaker Pattern

Prevent cascading failures by stopping calls to a failing service. Use a circuit breaker that tracks failure rates and opens the circuit when a threshold is reached.

```python
import time
from enum import Enum

class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"

class CircuitBreaker:
    def __init__(self, failure_threshold=5, recovery_timeout=30):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.state = CircuitState.CLOSED
        self.last_failure_time = None

    def call(self, func, *args, **kwargs):
        if self.state == CircuitState.OPEN:
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = CircuitState.HALF_OPEN
            else:
                raise CircuitOpenError("Circuit is open, call rejected")

        try:
            result = func(*args, **kwargs)
            if self.state == CircuitState.HALF_OPEN:
                self.state = CircuitState.CLOSED
                self.failure_count = 0
            return result
        except Exception as e:
            self.failure_count += 1
            self.last_failure_time = time.time()
            if self.failure_count >= self.failure_threshold:
                self.state = CircuitState.OPEN
            raise

# Usage
inventory_breaker = CircuitBreaker(failure_threshold=5, recovery_timeout=30)

try:
    stock = inventory_breaker.call(check_stock, product_id="SKU-123")
except CircuitOpenError:
    stock = get_cached_stock(product_id="SKU-123")  # fallback
```

In production, use a library like `pybreaker`, `resilience4j` (Java), or `polly` (.NET) instead of rolling your own.

## Saga Pattern for Distributed Transactions

Do not use distributed transactions (2PC). Use the Saga pattern: a sequence of local transactions where each step publishes an event triggering the next, and each step has a compensating action for rollback.

```
Place Order Saga:
1. order-service:     Create order (status=PENDING)
2. payment-service:   Charge payment
3. inventory-service: Reserve stock
4. order-service:     Confirm order (status=CONFIRMED)

Compensation (if step 3 fails):
3c. payment-service:  Refund payment
2c. order-service:    Cancel order (status=CANCELLED)
```

Orchestrator-based saga (one service coordinates):

```python
class PlaceOrderSaga:
    def __init__(self, order_id):
        self.order_id = order_id
        self.steps_completed = []

    async def execute(self):
        try:
            await self.create_order()
            self.steps_completed.append("create_order")

            await self.charge_payment()
            self.steps_completed.append("charge_payment")

            await self.reserve_stock()
            self.steps_completed.append("reserve_stock")

            await self.confirm_order()
        except Exception as e:
            await self.compensate()
            raise

    async def compensate(self):
        for step in reversed(self.steps_completed):
            if step == "charge_payment":
                await self.refund_payment()
            elif step == "create_order":
                await self.cancel_order()
```

## Service Discovery and Load Balancing

Use DNS-based service discovery in container orchestrators (Kubernetes). Each service registers with a DNS name, and the platform handles routing.

```yaml
# Kubernetes Service (acts as internal load balancer + DNS entry)
apiVersion: v1
kind: Service
metadata:
  name: inventory-service
spec:
  selector:
    app: inventory-service
  ports:
    - port: 80
      targetPort: 8080
```

Other services call `http://inventory-service/v1/stock` and Kubernetes resolves and load-balances the request.

Do not build custom service discovery unless you are not using a container orchestrator.

## API Gateway

Route all external traffic through an API gateway. It handles authentication, rate limiting, and request routing.

```yaml
# Kong or similar gateway configuration
services:
  - name: order-service
    url: http://order-service:8080
    routes:
      - paths: ["/v1/orders"]
        strip_path: false
    plugins:
      - name: rate-limiting
        config:
          minute: 100
      - name: jwt
        config:
          secret_is_base64: false
```

Do not let external clients call internal services directly.

## Distributed Tracing

Propagate a trace ID through all service calls. Use OpenTelemetry for instrumentation.

```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

provider = TracerProvider()
provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint="jaeger:4317")))
trace.set_tracer_provider(provider)
tracer = trace.get_tracer("order-service")

@app.post("/v1/orders")
async def create_order(request):
    with tracer.start_as_current_span("create_order") as span:
        span.set_attribute("order.customer_id", request.customer_id)
        order = await order_repo.create(request)

        with tracer.start_as_current_span("charge_payment"):
            await payment_client.charge(order.id, order.total)

        return order
```

Every service must propagate trace context headers (`traceparent`, `tracestate`) on outbound calls. OpenTelemetry middleware handles this automatically for most frameworks.

## Data Management

Each service owns its database. Do not share databases between services.

```
order-service     -> order_db      (PostgreSQL)
payment-service   -> payment_db    (PostgreSQL)
inventory-service -> inventory_db  (PostgreSQL)
notification-service -> notification_db (MongoDB)
```

If a service needs data from another service, it calls that service's API or consumes its events. Do not query another service's database directly.

## Common Pitfalls

1. **Distributed monolith.** If every request requires synchronous calls to 5 other services, you have a distributed monolith. Use async events to decouple.
2. **Nano-services.** Do not create a service for every database table. A service should represent a business capability, not a CRUD entity.
3. **Shared libraries with business logic.** Shared libraries should contain only infrastructure concerns (logging, tracing, auth). Business logic belongs in services.
4. **No idempotency.** Every message consumer and API endpoint that mutates state must be idempotent. Use idempotency keys.
5. **Ignoring network failures.** Every network call can fail, be slow, or return garbage. Always set timeouts, implement retries with exponential backoff, and use circuit breakers.
