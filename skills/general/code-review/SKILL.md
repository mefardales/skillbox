---
name: code-review
description: >
  Code review checklist and best practices for reviewing pull requests.
  Use this skill when reviewing code, preparing code for review, or
  establishing review standards. Covers correctness, security, performance,
  readability, and constructive feedback patterns.
license: MIT
metadata:
  author: skillbox
  version: "1.0"
  category: general
  tags: code-review, pull-requests, quality, best-practices, collaboration
---

# Code Review Checklist and Best Practices

## Review Approach

Start with the big picture before examining details.

1. **Read the PR description.** Understand the intent and scope before looking at code.
2. **Review the architecture.** Are files in the right places? Is the approach sound?
3. **Check the logic.** Walk through the critical paths. Verify correctness.
4. **Examine edge cases.** Think about what could go wrong.
5. **Assess readability.** Would a new team member understand this code?
6. **Verify tests.** Do tests cover the important behaviors?

## Correctness

- Does the code do what the PR description says it does?
- Are all code paths handled? Check for missing `else` branches, unhandled promise rejections, uncaught exceptions.
- Are boundary conditions handled? Empty arrays, null values, zero-length strings, negative numbers.
- Does the code handle concurrent access correctly if applicable?
- Are database transactions used where multiple writes need to be atomic?
- Is state cleaned up properly? Look for resource leaks: unclosed connections, missing event listener removal, incomplete error recovery.

## Security

- **Input validation**: Is all user input validated and sanitized before use?
- **SQL injection**: Are queries parameterized? No string concatenation for SQL.
- **XSS**: Is user-generated content escaped before rendering in HTML?
- **Authentication**: Are endpoints properly protected? Check for missing auth middleware.
- **Authorization**: Does the code verify the user has permission for the specific resource, not just that they are logged in?
- **Secrets**: Are API keys, passwords, or tokens hardcoded? Check for credentials in environment variable defaults.
- **Dependencies**: Are new dependencies from trusted sources? Check for known vulnerabilities.
- **File uploads**: Are file types validated? Are size limits enforced?
- **CORS**: Is the CORS policy appropriate? Avoid `*` in production.

## Performance

- **N+1 queries**: Is data fetched in a loop that could be batched? Look for database calls inside `map`/`forEach`.
- **Missing indexes**: Are queries filtering or joining on unindexed columns?
- **Unbounded queries**: Is there a `LIMIT` on queries that could return large result sets?
- **Memory**: Are large datasets loaded entirely into memory when they could be streamed or paginated?
- **Unnecessary work**: Is work repeated that could be cached or computed once?
- **Bundle size**: Do new frontend dependencies significantly increase the bundle? Could a lighter alternative be used?
- **Re-renders**: In React, will this cause unnecessary re-renders in parent or sibling components?

## Readability and Maintainability

- Are variable and function names descriptive and consistent with the codebase?
- Are complex sections commented explaining *why*, not *what*?
- Is the code duplication acceptable, or should shared logic be extracted?
- Are functions short and focused on a single responsibility?
- Are error messages clear and actionable for debugging?
- Is the code consistent with existing patterns in the codebase?
- Are magic numbers replaced with named constants?

## Error Handling

- Are errors caught at appropriate boundaries?
- Do error handlers log enough context for debugging (user ID, request ID, input values)?
- Are errors propagated or swallowed? Silently catching errors hides bugs.
- Are error responses user-friendly? No stack traces or internal details exposed to clients.
- Is retry logic implemented for transient failures (network errors, rate limits)?
- Are partial failures handled? If step 2 of 3 fails, is step 1 rolled back?

## Testing

- Are there tests for the new behavior?
- Do tests cover the happy path AND error cases?
- Are edge cases tested (empty input, boundary values, concurrent access)?
- Are tests testing behavior, not implementation details?
- Can tests run independently, in any order?
- Are mocks used appropriately -- not over-mocking the system under test?
- For bug fixes: is there a regression test that would have caught the bug?

## API Design

- Are endpoint URLs and HTTP methods consistent with REST conventions?
- Is the request/response format consistent with existing APIs?
- Are breaking changes to existing APIs versioned or communicated?
- Is pagination implemented for list endpoints?
- Are error responses in a consistent format?
- Is the API documented (OpenAPI spec, JSDoc, or inline)?

## Database Changes

- Is the migration reversible?
- Will the migration lock tables or cause downtime on large tables?
- Are new columns nullable or do they have defaults for existing rows?
- Are indexes added for new foreign keys and frequently queried columns?
- Is the data migration separate from the schema migration?

## Giving Constructive Feedback

### Comment Categories

Prefix comments to clarify intent:

- **`nit:`** Minor style or preference issue. Not blocking.
- **`suggestion:`** An alternative approach to consider. Not blocking.
- **`question:`** Seeking understanding. May or may not be blocking.
- **`issue:`** A bug, security concern, or correctness problem. Blocking.
- **`praise:`** Something done well. Reinforce good patterns.

### Tone Guidelines

- Phrase feedback as suggestions, not commands: "What do you think about..." instead of "Change this to...".
- Ask questions when you do not understand, rather than assuming the code is wrong.
- Acknowledge good work. Positive feedback reinforces good practices.
- Focus on the code, not the person. Say "this function could be simplified" not "you wrote this wrong."
- If a change is a matter of personal preference, say so. Do not block PRs on style.

### As a PR Author

- Keep PRs small (under 400 lines of production code). Split large changes into a stack of PRs.
- Write a clear description: what changed, why, how to test, and any trade-offs.
- Self-review your PR before requesting review. Catch the obvious issues yourself.
- Respond to all comments, even if just to acknowledge.
- Do not take feedback personally. Code review improves everyone's skills.
