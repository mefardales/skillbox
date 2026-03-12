---
name: e2e-playwright
description: >
  Playwright end-to-end testing patterns for web applications. Use this
  skill when writing, maintaining, or debugging E2E tests with Playwright.
  Covers page object models, selectors, assertions, API testing, visual
  regression, and CI integration.
license: MIT
metadata:
  author: skillbox
  version: "1.0"
  category: testing
  tags: playwright, e2e, testing, automation, browser
---

# Playwright E2E Testing Patterns

## Project Setup

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'results.xml' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'mobile', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

- Use `webServer` to automatically start your dev server before tests.
- Enable `trace: 'on-first-retry'` to capture traces for debugging failures.
- Set `retries: 2` in CI to handle flaky browser behavior.
- Use `forbidOnly` in CI to fail if `.only` is accidentally committed.

## Writing Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('User Registration', () => {
  test('should register a new user and redirect to dashboard', async ({ page }) => {
    await page.goto('/register');

    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('SecurePass123!');
    await page.getByLabel('Confirm Password').fill('SecurePass123!');
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
  });

  test('should show validation error for weak password', async ({ page }) => {
    await page.goto('/register');

    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('123');
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();
  });
});
```

## Selectors -- Priority Order

Use selectors that reflect how users interact with the page. In order of preference:

1. **Role selectors** (best): `page.getByRole('button', { name: 'Submit' })`
2. **Label selectors**: `page.getByLabel('Email')`
3. **Text selectors**: `page.getByText('Welcome back')`
4. **Placeholder**: `page.getByPlaceholder('Search...')`
5. **Test IDs** (fallback): `page.getByTestId('submit-button')`

- Avoid CSS selectors and XPath. They break when the UI structure changes.
- Use `getByRole` as the primary strategy. It also validates accessibility.
- Reserve `getByTestId` for elements that lack accessible names or text.

## Page Object Model

Encapsulate page interactions in page objects for maintainability.

```typescript
// e2e/pages/LoginPage.ts
import { type Page, type Locator, expect } from '@playwright/test';

export class LoginPage {
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly submitButton: Locator;
  private readonly errorMessage: Locator;

  constructor(private page: Page) {
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: 'Sign In' });
    this.errorMessage = page.getByRole('alert');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectError(message: string) {
    await expect(this.errorMessage).toContainText(message);
  }
}

// Usage in test
test('should show error for invalid credentials', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('bad@email.com', 'wrongpass');
  await loginPage.expectError('Invalid email or password');
});
```

- Page objects encapsulate selectors and actions. Tests read like user stories.
- Do not put assertions in page objects except for self-contained verification methods.
- Create page objects for each major page or component.

## Authentication

Use `storageState` to avoid logging in before every test.

```typescript
// e2e/auth.setup.ts
import { test as setup } from '@playwright/test';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('/dashboard');
  await page.context().storageState({ path: '.auth/user.json' });
});

// playwright.config.ts
projects: [
  { name: 'setup', testMatch: /.*\.setup\.ts/ },
  {
    name: 'chromium',
    dependencies: ['setup'],
    use: { storageState: '.auth/user.json' },
  },
]
```

## API Testing

Use Playwright's `request` context for API-level tests or to set up test data.

```typescript
test('should create and retrieve a post via API', async ({ request }) => {
  const response = await request.post('/api/posts', {
    data: { title: 'Test Post', content: 'Hello world' },
  });
  expect(response.ok()).toBeTruthy();

  const post = await response.json();
  expect(post.title).toBe('Test Post');

  const getResponse = await request.get(`/api/posts/${post.id}`);
  expect(getResponse.ok()).toBeTruthy();
});
```

Use API calls in `beforeEach` to set up test data instead of navigating through the UI. This makes tests faster and more reliable.

## Waiting and Assertions

Playwright auto-waits for elements. Do not add manual waits.

```typescript
// Good: Playwright waits automatically
await expect(page.getByText('Success')).toBeVisible();
await expect(page.getByRole('table')).toContainText('John');

// Good: wait for navigation
await page.waitForURL('/dashboard');

// Good: wait for network
await page.waitForResponse(resp =>
  resp.url().includes('/api/data') && resp.status() === 200
);

// Bad: manual waits
await page.waitForTimeout(3000);  // NEVER do this
```

- Use `expect` with auto-retrying assertions: `toBeVisible()`, `toHaveText()`, `toHaveURL()`.
- Use `waitForResponse` when you need to wait for a specific API call.
- Increase the default timeout in config for slow CI environments, not in individual tests.

## Fixtures

Use custom fixtures for shared setup.

```typescript
// e2e/fixtures.ts
import { test as base } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';

type Fixtures = {
  loginPage: LoginPage;
};

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await use(loginPage);
  },
});
```

## Debugging

- Use `npx playwright test --ui` for the interactive UI mode.
- Use `npx playwright test --debug` to step through tests.
- Use `await page.pause()` to pause execution and inspect with the inspector.
- View traces from failed CI runs: `npx playwright show-trace trace.zip`.

## CI Integration

```yaml
# GitHub Actions
- name: Install Playwright
  run: npx playwright install --with-deps
- name: Run E2E tests
  run: npx playwright test
- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: playwright-report
    path: playwright-report/
```

- Install browser dependencies with `--with-deps` in CI.
- Upload test reports and traces as artifacts for debugging.
- Run with fewer workers in CI to avoid resource contention.
- Consider running E2E tests on a deployed preview URL rather than spinning up the app in CI.
