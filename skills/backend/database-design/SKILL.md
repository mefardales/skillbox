---
name: database-design
description: >
  Database schema design, migrations, indexing, and query optimization
  for relational databases. Use this skill when designing schemas,
  writing migrations, optimizing queries, or making data modeling
  decisions. Covers PostgreSQL patterns applicable to most SQL databases.
license: MIT
metadata:
  author: skillbox
  version: "1.0"
  category: backend
  tags: database, sql, postgresql, schema, migrations
---

# Database Schema Design

## Schema Design Principles

### Naming Conventions

- Use `snake_case` for all identifiers: tables, columns, indexes, constraints.
- Table names should be plural: `users`, `posts`, `order_items`.
- Foreign key columns: `user_id`, `parent_comment_id` -- the referenced table (singular) + `_id`.
- Boolean columns: use `is_` or `has_` prefix: `is_active`, `has_verified_email`.
- Timestamp columns: use `_at` suffix: `created_at`, `updated_at`, `deleted_at`.
- Index names: `idx_{table}_{columns}`. Unique: `uniq_{table}_{columns}`.

### Standard Columns

Every table should include:

```sql
CREATE TABLE users (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- domain columns here
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- Use `BIGINT GENERATED ALWAYS AS IDENTITY` for primary keys, not `SERIAL`.
- Use `TIMESTAMPTZ` (with time zone), never `TIMESTAMP` without time zone.
- Add `updated_at` with a trigger or application-level update.
- Consider `deleted_at TIMESTAMPTZ` for soft deletes when business rules require auditability.

### Data Types

- Use `TEXT` instead of `VARCHAR(n)` unless you need a hard length constraint enforced at the DB level. Validate lengths in the application.
- Use `BOOLEAN` not integers for true/false.
- Use `NUMERIC(precision, scale)` for money and exact decimals, never `FLOAT` or `DOUBLE`.
- Use `JSONB` for semi-structured data. Avoid it for data you need to query or join on frequently.
- Use `UUID` for public-facing identifiers (API responses, URLs). Keep integer IDs as internal primary keys for performance.
- Use `ENUM` types for fixed, rarely-changing sets. Use a reference table for sets that change.

## Relationships

### One-to-Many

```sql
CREATE TABLE posts (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_posts_user_id ON posts(user_id);
```

- Always index foreign key columns. PostgreSQL does not auto-index them.
- Choose `ON DELETE` behavior deliberately: `CASCADE`, `SET NULL`, `RESTRICT`.

### Many-to-Many

```sql
CREATE TABLE post_tags (
    post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    tag_id  BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);
```

- Use a composite primary key on the junction table.
- Add extra columns (e.g., `assigned_at`, `role`) to the junction table when the relationship carries data.

### One-to-One

Use a foreign key with a unique constraint. Decide which table owns the relationship.

## Indexing Strategy

### When to Add Indexes

- Columns in `WHERE` clauses used frequently.
- Columns used in `JOIN` conditions (foreign keys).
- Columns used in `ORDER BY` on large tables.
- Columns used in `UNIQUE` constraints (automatically indexed).

### Index Types

```sql
-- B-tree (default, good for equality and range)
CREATE INDEX idx_users_email ON users(email);

-- Partial index (index only matching rows)
CREATE INDEX idx_users_active ON users(email) WHERE is_active = true;

-- Composite index (column order matters)
CREATE INDEX idx_orders_user_date ON orders(user_id, created_at DESC);

-- GIN index (for JSONB, arrays, full-text search)
CREATE INDEX idx_products_metadata ON products USING gin(metadata);

-- Covering index (includes columns to avoid table lookup)
CREATE INDEX idx_orders_lookup ON orders(user_id) INCLUDE (status, total);
```

- Column order in composite indexes matters. Put equality conditions first, range conditions last.
- A composite index on `(a, b)` supports queries on `a` alone, but NOT on `b` alone.
- Do not over-index. Each index slows writes and consumes storage. Add indexes based on actual query patterns.

## Query Optimization

### Use EXPLAIN ANALYZE

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT ...
```

- Look for sequential scans on large tables -- usually indicates a missing index.
- Watch for high `actual rows` vs `estimated rows` -- indicates stale statistics. Run `ANALYZE`.
- Look for nested loops on large result sets -- may need a hash or merge join.

### Common Optimizations

- Use `EXISTS` instead of `IN` for subqueries with large result sets.
- Avoid `SELECT *`. Select only needed columns.
- Use pagination with keyset (cursor) pagination, not `OFFSET`:
  ```sql
  -- Instead of: SELECT * FROM posts ORDER BY id LIMIT 20 OFFSET 1000;
  SELECT * FROM posts WHERE id > :last_seen_id ORDER BY id LIMIT 20;
  ```
- Use CTEs (`WITH`) for readability but be aware they may fence off optimization in some databases.
- Batch inserts with `INSERT INTO ... VALUES (...), (...), (...)` instead of individual inserts.

## Migrations

### Migration Best Practices

- Each migration should be a single, focused change. Do not combine unrelated schema changes.
- Migrations must be reversible. Always write both `up` and `down` operations.
- Never modify a migration that has been applied to shared environments (staging, production).
- Test migrations against a copy of production data before deploying.

### Safe Migration Patterns

Adding a column:
```sql
-- Safe: nullable column with no default (instant in PostgreSQL)
ALTER TABLE users ADD COLUMN bio TEXT;

-- Safe in PostgreSQL 11+: column with a default (uses metadata, not rewrite)
ALTER TABLE users ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT false;
```

Renaming or removing columns -- use a multi-step process:
1. Add the new column.
2. Deploy code that writes to both old and new columns.
3. Backfill data from old to new column.
4. Deploy code that reads from the new column only.
5. Drop the old column in a later migration.

Adding an index on a large table:
```sql
-- Use CONCURRENTLY to avoid locking the table
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
```

### Migration Tools

- PostgreSQL: Alembic (Python), Prisma Migrate, Drizzle Kit, golang-migrate, Flyway.
- Always version-control migrations alongside application code.
- Run migrations as part of the deployment pipeline, not manually.

## Constraints

- Use `NOT NULL` by default. Only allow `NULL` when absence of a value has specific meaning.
- Add `CHECK` constraints for business rules:
  ```sql
  ALTER TABLE orders ADD CONSTRAINT chk_orders_total CHECK (total >= 0);
  ```
- Use `UNIQUE` constraints to enforce business uniqueness rules at the database level.
- Foreign key constraints prevent orphaned data. Always use them.

## Performance Patterns

- **Connection pooling**: Use PgBouncer or application-level pooling. Do not open a connection per request.
- **Read replicas**: Route read-heavy queries to replicas in high-traffic applications.
- **Partitioning**: Use table partitioning for very large tables (millions+ rows) with time-based queries.
- **Materialized views**: For expensive aggregation queries, use materialized views with scheduled refreshes.
- **Denormalization**: Acceptable for read-heavy paths after measuring. Always keep the normalized source of truth and sync.
