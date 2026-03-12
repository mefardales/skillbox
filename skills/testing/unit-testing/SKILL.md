---
name: unit-testing
description: >
  Unit testing best practices including test structure, mocking, assertions,
  and test organization. Use this skill when writing, reviewing, or
  refactoring unit tests. Covers patterns for JavaScript/TypeScript (Jest,
  Vitest) and Python (pytest) with language-agnostic principles.
license: MIT
metadata:
  author: skillbox
  version: "1.0"
  category: testing
  tags: testing, unit-tests, jest, vitest, pytest
---

# Unit Testing Best Practices

## Core Principles

1. **Test behavior, not implementation.** Tests should verify what a function does, not how it does it. If you refactor internals without changing behavior, no tests should break.
2. **Each test should have one reason to fail.** Test one logical concept per test case.
3. **Tests are documentation.** A test name should describe the expected behavior clearly enough that someone unfamiliar with the code understands what it does.
4. **Fast and isolated.** Unit tests should run in milliseconds with no network, database, or filesystem dependencies.

## Test Structure: Arrange-Act-Assert

Every test follows the same three-part structure.

```typescript
test('calculates total with tax for items in cart', () => {
  // Arrange: set up test data and dependencies
  const cart = new Cart();
  cart.addItem({ name: 'Widget', price: 10.00, quantity: 2 });
  const taxRate = 0.08;

  // Act: execute the behavior under test
  const total = cart.calculateTotal(taxRate);

  // Assert: verify the result
  expect(total).toBe(21.60);
});
```

- Keep each section short. If arrangement is complex, extract a helper or factory function.
- Avoid multiple Act steps in a single test. That is usually a sign the test covers too many behaviors.
- Use a blank line to visually separate Arrange, Act, and Assert.

## Naming Conventions

Use descriptive names that state the scenario and expected outcome.

```typescript
// Pattern: "should [expected behavior] when [condition]"
// or:      "[unit] [scenario] [expected result]"

describe('UserService', () => {
  describe('createUser', () => {
    test('should return the created user with a generated ID', () => { ... });
    test('should throw ValidationError when email is invalid', () => { ... });
    test('should hash the password before storing', () => { ... });
  });
});
```

- Group related tests with `describe` blocks by function or feature.
- Use nesting sparingly -- two levels deep is usually sufficient.

## Test Data

Use factory functions to create test data. Avoid duplicating object literals across tests.

```typescript
function createUser(overrides: Partial<User> = {}): User {
  return {
    id: '1',
    name: 'Jane Doe',
    email: 'jane@example.com',
    role: 'user',
    ...overrides,
  };
}

test('grants admin access to admin users', () => {
  const admin = createUser({ role: 'admin' });
  expect(canAccessAdminPanel(admin)).toBe(true);
});
```

- Provide sensible defaults. Override only the fields relevant to each test.
- Use libraries like `faker` for realistic random data in integration tests, but prefer deterministic values in unit tests.

## Mocking

### When to Mock

- External services (APIs, databases, email providers).
- System dependencies (clock, filesystem, random number generators).
- Expensive or slow collaborators that are tested separately.

### When NOT to Mock

- The unit under test itself.
- Simple value objects or pure functions.
- Internal implementation details.

### Mocking Patterns (Jest/Vitest)

```typescript
// Mock a module
vi.mock('./emailService', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock a dependency injected via parameter
test('sends welcome email on registration', async () => {
  const mockEmailService = { sendEmail: vi.fn().mockResolvedValue(true) };
  const service = new UserService(mockEmailService);

  await service.register({ email: 'new@example.com', password: 'secure123' });

  expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
    expect.objectContaining({ to: 'new@example.com', template: 'welcome' })
  );
});
```

### Mocking Patterns (pytest)

```python
from unittest.mock import AsyncMock, patch

async def test_sends_welcome_email():
    mock_email = AsyncMock(return_value=True)
    service = UserService(email_sender=mock_email)

    await service.register(email="new@example.com", password="secure123")

    mock_email.assert_called_once_with(
        to="new@example.com", template="welcome"
    )
```

- Prefer dependency injection over module-level mocking. It makes tests clearer and avoids global state.
- Reset mocks between tests. Use `beforeEach(() => vi.clearAllMocks())` or `@pytest.fixture(autouse=True)`.
- Assert on specific calls, not just call counts.

## Assertions

Write precise, readable assertions.

```typescript
// Good: specific
expect(result).toEqual({ id: 1, name: 'Alice', role: 'admin' });

// Good: partial matching when you only care about certain fields
expect(result).toEqual(expect.objectContaining({ role: 'admin' }));

// Good: array assertions
expect(items).toHaveLength(3);
expect(items).toContainEqual(expect.objectContaining({ id: 2 }));

// Good: error assertions
expect(() => validate(invalidData)).toThrow(ValidationError);
expect(() => validate(invalidData)).toThrow('Email is required');

// Async error assertions
await expect(asyncFn()).rejects.toThrow(NotFoundError);
```

- Avoid vague assertions like `toBeTruthy()` when you can assert a specific value.
- Use `toEqual` for deep equality, `toBe` for reference equality and primitives.
- Use snapshot tests sparingly. They catch unintended changes but make intentional updates tedious.

## Test Organization

```
src/
  features/
    users/
      userService.ts
      userService.test.ts      # Co-locate tests with source
  utils/
    math.ts
    math.test.ts
```

- Co-locate test files with the code they test for easy navigation.
- Use a `__fixtures__` or `test/fixtures` directory for shared test data files.
- Use a `test/helpers` directory for shared test utilities and factories.

## Edge Cases to Always Test

- Empty inputs: empty strings, empty arrays, null/undefined.
- Boundary values: zero, negative numbers, maximum lengths.
- Error paths: invalid input, network failures, permission denied.
- Concurrent operations: if applicable, test race conditions.

## Anti-Patterns to Avoid

- **Testing implementation details**: asserting on internal state, private methods, or specific function call order.
- **Excessive mocking**: if you mock everything, you are testing mocks, not code.
- **Shared mutable state**: tests that depend on execution order or modify global state.
- **Large test files**: split test files that grow beyond 200-300 lines.
- **Copy-paste tests**: extract shared setup into helpers or parameterized tests.
- **Ignoring flaky tests**: fix or remove them. A flaky test suite erodes trust.

## Parameterized Tests

```typescript
// Vitest/Jest
test.each([
  { input: 'hello', expected: 'HELLO' },
  { input: '', expected: '' },
  { input: 'Hello World', expected: 'HELLO WORLD' },
])('toUpperCase($input) returns $expected', ({ input, expected }) => {
  expect(input.toUpperCase()).toBe(expected);
});
```

```python
# pytest
@pytest.mark.parametrize("input,expected", [
    ("hello", "HELLO"),
    ("", ""),
    ("Hello World", "HELLO WORLD"),
])
def test_to_upper(input, expected):
    assert input.upper() == expected
```

Use parameterized tests for the same logic with different inputs. They reduce duplication and clearly show all covered cases.

## Coverage

- Aim for meaningful coverage, not a percentage target. 80-90% is a reasonable guideline.
- Cover happy paths, error paths, and edge cases.
- Do not write tests solely to increase coverage. Every test should validate behavior.
- Exclude generated code, type definitions, and configuration files from coverage reports.
