---
name: python-fastapi
description: >
  FastAPI best practices including Pydantic models, async patterns,
  dependency injection, and API design. Use this skill when building
  or maintaining Python APIs with FastAPI. Covers project structure,
  validation, authentication, database integration, and testing.
license: MIT
metadata:
  author: skillbox
  version: "1.0"
  category: backend
  tags: python, fastapi, pydantic, async, api
---

# FastAPI Best Practices

## Project Structure

```
app/
  main.py              # FastAPI app instance, startup/shutdown
  config.py            # Settings using pydantic-settings
  dependencies.py      # Shared dependencies (get_db, get_current_user)
  models/              # SQLAlchemy/ORM models
    user.py
    post.py
  schemas/             # Pydantic request/response models
    user.py
    post.py
  routers/             # Route definitions
    users.py
    posts.py
  services/            # Business logic
    user_service.py
  middleware/
    logging.py
  utils/
    security.py
tests/
  conftest.py
  test_users.py
```

## Pydantic Models

Separate request and response schemas. Never expose your database model directly.

```python
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime

# Base with shared fields
class UserBase(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=100)

# Create request
class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)

# Update request (all fields optional)
class UserUpdate(BaseModel):
    email: EmailStr | None = None
    name: str | None = Field(None, min_length=1, max_length=100)

# Response (no password)
class UserResponse(UserBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
```

- Use `Field()` for validation constraints: `min_length`, `max_length`, `ge`, `le`, `pattern`.
- Use `model_config = ConfigDict(from_attributes=True)` to convert ORM objects to Pydantic models.
- Use `EmailStr`, `HttpUrl`, and other Pydantic types for built-in validation.
- Define a `PaginatedResponse[T]` generic for list endpoints.

## Route Design

```python
from fastapi import APIRouter, Depends, HTTPException, status, Query

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/", response_model=list[UserResponse])
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.get_users(db, skip=skip, limit=limit)

@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    existing = await user_service.get_by_email(db, user_in.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    return await user_service.create_user(db, user_in)
```

- Always specify `response_model` to control serialization and generate accurate OpenAPI docs.
- Set explicit `status_code` for non-200 success responses (201 for creation).
- Use `Query()`, `Path()`, `Body()` for parameter validation and documentation.
- Group related routes with `APIRouter` and register them in `main.py`.

## Dependency Injection

FastAPI's `Depends()` is the primary mechanism for shared logic.

```python
# dependencies.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def get_db():
    async with async_session() as session:
        yield session

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = verify_jwt(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    user = await user_service.get_by_id(db, payload["sub"])
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    return user

async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    return user
```

- Chain dependencies: `require_admin` depends on `get_current_user` which depends on `get_db`.
- Use `yield` in dependencies for setup/teardown (database sessions, temporary resources).
- Dependencies are cached per request by default. Same `Depends(get_db)` returns the same session.

## Async Patterns

- Use `async def` for I/O-bound route handlers (database queries, HTTP calls).
- Use regular `def` for CPU-bound work -- FastAPI runs these in a thread pool automatically.
- Use `httpx.AsyncClient` for outbound HTTP requests, not `requests`.
- Never use blocking I/O (synchronous DB drivers, `time.sleep`) in `async def` functions.

```python
# Correct: async database operations
@router.get("/{user_id}")
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
```

## Error Handling

Use custom exception handlers for consistent error responses.

```python
class AppException(Exception):
    def __init__(self, status_code: int, detail: str, code: str = "ERROR"):
        self.status_code = status_code
        self.detail = detail
        self.code = code

@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"message": exc.detail, "code": exc.code}},
    )
```

- Raise `HTTPException` for standard errors.
- Create custom exception classes for domain-specific errors.
- Never return 500 with internal details in production.

## Configuration

Use `pydantic-settings` for type-safe environment configuration.

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    jwt_expiry_minutes: int = 30
    debug: bool = False
    cors_origins: list[str] = ["http://localhost:3000"]

    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()
```

## Middleware

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

- Add CORS middleware with explicit origins.
- Use middleware for cross-cutting concerns: request logging, timing, request IDs.
- For authentication, prefer dependencies over middleware (more granular control).

## Database Integration

- Use SQLAlchemy 2.0 with async support for production applications.
- Define models with `mapped_column` and type annotations.
- Use Alembic for database migrations. Generate migrations automatically, then review them.
- Always use database transactions for multi-step operations.

## Testing

```python
import pytest
from httpx import AsyncClient, ASGITransport

@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

@pytest.mark.anyio
async def test_create_user(client: AsyncClient):
    response = await client.post("/users/", json={
        "email": "test@example.com",
        "name": "Test",
        "password": "securepassword",
    })
    assert response.status_code == 201
    assert response.json()["email"] == "test@example.com"
```

- Use `httpx.AsyncClient` with `ASGITransport` for async test clients.
- Override dependencies in tests using `app.dependency_overrides`.
- Use a separate test database. Roll back transactions after each test.
