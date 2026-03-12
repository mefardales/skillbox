---
name: api-design
description: >
  REST API design best practices covering resource naming, versioning, pagination,
  error handling, and documentation. Use this skill when designing or reviewing
  HTTP APIs to ensure consistency, usability, and adherence to industry standards.
license: MIT
metadata:
  author: skillbox
  version: "1.0"
  category: backend
  tags: api, rest, design, openapi, http
---

# REST API Design Best Practices

## Resource Naming

Use plural nouns for collection endpoints. Nest resources to express relationships. Do not use verbs in URLs -- HTTP methods already express the action.

```
GET    /users              # list users
POST   /users              # create a user
GET    /users/42            # get user 42
PATCH  /users/42            # partial update user 42
DELETE /users/42            # delete user 42
GET    /users/42/orders     # list orders for user 42
```

Use kebab-case for multi-word resource names:

```
GET /order-items
GET /shipping-addresses
```

Do not use `/getUser`, `/createOrder`, or `/deleteItem`. The HTTP method conveys the action.

## Versioning

Use URL path versioning. It is explicit, easy to route, and easy to deprecate.

```
GET /v1/users
GET /v2/users
```

Do not use header-based versioning (`Accept: application/vnd.api+json;version=2`) unless you have a specific need for content negotiation. URL versioning is simpler to test, cache, and document.

## HTTP Methods and Status Codes

Use methods correctly:

| Method | Purpose | Idempotent | Request Body |
|--------|---------|-----------|--------------|
| GET | Read | Yes | No |
| POST | Create | No | Yes |
| PUT | Full replace | Yes | Yes |
| PATCH | Partial update | No | Yes |
| DELETE | Remove | Yes | No |

Return the right status codes:

```
200 OK              # Successful GET, PUT, PATCH
201 Created         # Successful POST (include Location header)
204 No Content      # Successful DELETE
400 Bad Request     # Validation error
401 Unauthorized    # Missing or invalid authentication
403 Forbidden       # Authenticated but not authorized
404 Not Found       # Resource does not exist
409 Conflict        # Duplicate or state conflict
422 Unprocessable   # Semantically invalid request
429 Too Many Reqs   # Rate limited
500 Internal Error  # Server fault
```

Always return `201` with a `Location` header on resource creation:

```http
POST /v1/users
Content-Type: application/json

{"name": "Alice", "email": "alice@example.com"}

HTTP/1.1 201 Created
Location: /v1/users/73
Content-Type: application/json

{"id": 73, "name": "Alice", "email": "alice@example.com"}
```

## Error Response Format (RFC 7807)

Use the Problem Details standard for all error responses. This gives clients a consistent, machine-readable format.

```json
{
  "type": "https://api.example.com/errors/validation-failed",
  "title": "Validation Failed",
  "status": 400,
  "detail": "The 'email' field is not a valid email address.",
  "instance": "/v1/users",
  "errors": [
    {
      "field": "email",
      "message": "Must be a valid email address",
      "rejected_value": "not-an-email"
    }
  ]
}
```

Set `Content-Type: application/problem+json` on error responses.

## Pagination

Use cursor-based pagination for large or frequently changing datasets. It is more performant and avoids skipped/duplicated items.

```http
GET /v1/orders?limit=20&cursor=eyJpZCI6MTAwfQ

HTTP/1.1 200 OK
{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJpZCI6MTIwfQ",
    "has_more": true
  }
}
```

Use offset-based pagination only when the client needs to jump to arbitrary pages and the dataset is small or stable:

```http
GET /v1/products?page=3&per_page=25

HTTP/1.1 200 OK
{
  "data": [...],
  "pagination": {
    "page": 3,
    "per_page": 25,
    "total": 342,
    "total_pages": 14
  }
}
```

## Filtering and Sorting

Use query parameters for filtering. Use bracket notation for operators:

```
GET /v1/orders?status=shipped&created_at[gte]=2025-01-01
GET /v1/products?category=electronics&price[lte]=500
```

Use a `sort` parameter with `-` prefix for descending:

```
GET /v1/products?sort=-created_at,name
```

## Request/Response Envelope

Wrap collection responses in a `data` key. This allows room for metadata without breaking changes.

```json
{
  "data": [
    {"id": 1, "name": "Widget"},
    {"id": 2, "name": "Gadget"}
  ],
  "pagination": { "next_cursor": "abc123", "has_more": true },
  "meta": { "total_count": 87 }
}
```

For single resource responses, return the object directly (no envelope) unless you need to attach metadata.

## Rate Limiting

Include rate limit headers on every response so clients can self-regulate:

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 1735689600
Retry-After: 30
```

Return `429 Too Many Requests` when the limit is exceeded. Include `Retry-After` with seconds until reset.

## Authentication

Use Bearer tokens in the `Authorization` header for user-facing APIs:

```http
GET /v1/users/me
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

Use API keys in a custom header for service-to-service or developer APIs:

```http
GET /v1/data/export
X-API-Key: sk_live_abc123def456
```

Do not pass tokens or keys in query parameters. They leak into server logs and browser history.

## HATEOAS and Hypermedia

Include links to related actions and resources. This makes APIs discoverable and reduces client coupling to URL structures.

```json
{
  "id": 42,
  "status": "pending",
  "total": 99.95,
  "_links": {
    "self": { "href": "/v1/orders/42" },
    "cancel": { "href": "/v1/orders/42/cancel", "method": "POST" },
    "items": { "href": "/v1/orders/42/items" },
    "customer": { "href": "/v1/users/7" }
  }
}
```

At minimum, include `self` links. Add action links for state transitions the client is allowed to perform.

## API Documentation with OpenAPI

Define your API contract in an OpenAPI 3.1 spec. Generate it from code or write it spec-first.

```yaml
openapi: 3.1.0
info:
  title: Order Service API
  version: 1.0.0
paths:
  /v1/orders:
    get:
      summary: List orders
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [pending, shipped, delivered]
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
            maximum: 100
      responses:
        '200':
          description: A paginated list of orders
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/OrderList'
```

Serve interactive docs using Swagger UI or Redoc. Keep the spec in version control and validate it in CI.

## Common Pitfalls

1. **Using POST for everything.** Use the correct HTTP method. POST is for creation, not fetching or updating.
2. **Returning 200 for errors.** A `200` with `{"success": false}` breaks HTTP semantics. Use proper status codes.
3. **Exposing internal IDs or database structure.** Use UUIDs or opaque identifiers in URLs. Do not expose auto-increment integers if they leak business information.
4. **Inconsistent naming.** Pick one convention (camelCase or snake_case for JSON fields) and enforce it everywhere. snake_case is more common in REST APIs.
5. **No pagination on list endpoints.** Every collection endpoint must support pagination. Unbounded lists will eventually cause outages.
6. **Breaking changes without versioning.** Never remove or rename fields in an existing version. Add new fields, deprecate old ones, and introduce a new version for breaking changes.
