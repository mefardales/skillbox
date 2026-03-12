---
name: postgresql
description: >
  Advanced PostgreSQL patterns for production systems. Covers data types,
  indexing strategies, query optimization, partitioning, full-text search,
  row-level security, and operational concerns like connection pooling and
  backups. Use this skill when building or optimizing PostgreSQL databases
  beyond basic schema design.
license: MIT
metadata:
  author: skillbox
  version: "1.0"
  category: data
  tags: postgresql, sql, database, indexing, optimization
---

# PostgreSQL Advanced Patterns

## Data Types

### Use the Right Type for the Job

Use `UUID` for public identifiers. Generate them with `gen_random_uuid()` (built-in since PostgreSQL 13):

```sql
CREATE TABLE accounts (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email      TEXT NOT NULL UNIQUE
);
```

Use `JSONB` for semi-structured data. Do not use `JSON` -- it stores raw text and cannot be indexed:

```sql
ALTER TABLE products ADD COLUMN attributes JSONB NOT NULL DEFAULT '{}';

-- Query nested fields
SELECT * FROM products WHERE attributes->>'color' = 'red';
SELECT * FROM products WHERE attributes @> '{"size": "large"}';
```

Use `ARRAY` types for small, fixed-purpose lists. Do not use arrays as a substitute for join tables:

```sql
ALTER TABLE posts ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}';
SELECT * FROM posts WHERE 'postgresql' = ANY(tags);
```

Use custom `ENUM` types for small, stable value sets:

```sql
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled');
ALTER TABLE orders ADD COLUMN status order_status NOT NULL DEFAULT 'pending';
```

Use `INET` and `CIDR` for IP addresses. Do not store IPs as text:

```sql
ALTER TABLE audit_logs ADD COLUMN ip_address INET;
SELECT * FROM audit_logs WHERE ip_address << '192.168.1.0/24';
```

## Indexing Strategies

### B-tree (Default)

Best for equality and range queries. Use for most columns in WHERE/ORDER BY:

```sql
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
```

### GIN (Generalized Inverted Index)

Use for JSONB, arrays, and full-text search:

```sql
CREATE INDEX idx_products_attrs ON products USING gin(attributes);
CREATE INDEX idx_posts_tags ON posts USING gin(tags);
```

### GiST (Generalized Search Tree)

Use for geometric data, range types, and PostGIS:

```sql
CREATE INDEX idx_locations_coords ON locations USING gist(coordinates);
CREATE INDEX idx_reservations_period ON reservations USING gist(
    tstzrange(starts_at, ends_at)
);
```

### BRIN (Block Range Index)

Use for large, naturally ordered tables (e.g., time-series data appended in order). Much smaller than B-tree:

```sql
CREATE INDEX idx_events_created_at ON events USING brin(created_at);
```

### Partial Indexes

Index only the rows that matter. Reduces index size and write overhead:

```sql
CREATE INDEX idx_orders_pending ON orders(created_at)
    WHERE status = 'pending';
```

### Expression Indexes

Index computed values:

```sql
CREATE INDEX idx_users_lower_email ON users(lower(email));
-- Supports: SELECT * FROM users WHERE lower(email) = 'foo@bar.com';
```

## Query Optimization

### Always Use EXPLAIN ANALYZE

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT o.id, o.total, u.email
FROM orders o
JOIN users u ON u.id = o.user_id
WHERE o.created_at > now() - interval '7 days'
ORDER BY o.created_at DESC
LIMIT 50;
```

Look for: Seq Scan on large tables (missing index), high actual vs estimated rows (run `ANALYZE tablename`), Nested Loop with large outer sets.

### CTEs and Optimization Fences

In PostgreSQL 12+, CTEs are inlined by default. Use `MATERIALIZED` to force a fence when needed:

```sql
WITH active_users AS MATERIALIZED (
    SELECT id FROM users WHERE last_login_at > now() - interval '30 days'
)
SELECT p.* FROM posts p JOIN active_users au ON au.id = p.user_id;
```

### Window Functions

Use window functions instead of self-joins or correlated subqueries:

```sql
-- Running total
SELECT id, amount,
    SUM(amount) OVER (ORDER BY created_at) AS running_total
FROM transactions;

-- Rank within a group
SELECT user_id, score,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY score DESC) AS rank
FROM game_scores;

-- Get previous row value
SELECT date, revenue,
    LAG(revenue) OVER (ORDER BY date) AS prev_day_revenue,
    revenue - LAG(revenue) OVER (ORDER BY date) AS daily_change
FROM daily_revenue;
```

## Partitioning

Use partitioning for tables with millions of rows where queries filter on the partition key.

### Range Partitioning (most common for time-series)

```sql
CREATE TABLE events (
    id          BIGINT GENERATED ALWAYS AS IDENTITY,
    event_type  TEXT NOT NULL,
    payload     JSONB,
    created_at  TIMESTAMPTZ NOT NULL
) PARTITION BY RANGE (created_at);

CREATE TABLE events_2025_01 PARTITION OF events
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE events_2025_02 PARTITION OF events
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
```

Automate partition creation with pg_partman or a cron job. Do not create partitions manually in production.

### List Partitioning

```sql
CREATE TABLE orders (
    id      BIGINT GENERATED ALWAYS AS IDENTITY,
    region  TEXT NOT NULL,
    total   NUMERIC(10,2)
) PARTITION BY LIST (region);

CREATE TABLE orders_us PARTITION OF orders FOR VALUES IN ('us-east', 'us-west');
CREATE TABLE orders_eu PARTITION OF orders FOR VALUES IN ('eu-west', 'eu-central');
```

## Full-Text Search

Use `tsvector` and `tsquery` for built-in full-text search. Do not use `LIKE '%term%'` for search:

```sql
ALTER TABLE articles ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(body, '')), 'B')
    ) STORED;

CREATE INDEX idx_articles_search ON articles USING gin(search_vector);

-- Query with ranking
SELECT id, title,
    ts_rank(search_vector, query) AS rank
FROM articles, to_tsquery('english', 'postgresql & indexing') AS query
WHERE search_vector @@ query
ORDER BY rank DESC
LIMIT 20;
```

Use `pg_trgm` for fuzzy matching and typo tolerance:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_users_name_trgm ON users USING gin(name gin_trgm_ops);
SELECT * FROM users WHERE name % 'jonh';  -- finds "john"
```

## Connection Pooling

Use PgBouncer in front of PostgreSQL. Do not let application instances each open their own pool of connections directly to PostgreSQL in production.

Recommended PgBouncer settings:
- Use `transaction` pool mode (releases connection after each transaction).
- Set `default_pool_size` to match your PostgreSQL `max_connections / number_of_pools`.
- Set `max_client_conn` higher than `default_pool_size` to queue bursts.

Do not use `session` pool mode unless your application relies on session-level state (prepared statements, temp tables).

## Backup Strategies

- **`pg_dump`**: Logical backup. Use for small-to-medium databases and for migrating between PostgreSQL versions.
- **`pg_basebackup`**: Physical backup. Use for large databases and point-in-time recovery.
- **WAL archiving**: Continuous archiving for point-in-time recovery. Combine with `pg_basebackup` for production systems.

```bash
# Logical backup (compressed, custom format)
pg_dump -Fc -Z 9 -f backup.dump mydb

# Restore from custom format
pg_restore -d mydb backup.dump

# Base backup for PITR
pg_basebackup -D /backups/base -Ft -z -Xs -P
```

Always test restores. A backup you have never restored is not a backup.

## Row-Level Security

Use RLS to enforce multi-tenant data isolation at the database level:

```sql
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON documents
    USING (tenant_id = current_setting('app.current_tenant_id')::BIGINT);

-- Set tenant context per request
SET app.current_tenant_id = '42';
SELECT * FROM documents;  -- only sees tenant 42's rows
```

Always add `FORCE ROW LEVEL SECURITY` if table owners should also be restricted:

```sql
ALTER TABLE documents FORCE ROW LEVEL SECURITY;
```

## Essential Extensions

```sql
-- Trigram matching for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Query performance tracking
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SELECT query, calls, mean_exec_time, rows
FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 20;

-- PostGIS for geospatial
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT ST_Distance(
    ST_MakePoint(-73.99, 40.73)::geography,
    ST_MakePoint(-118.24, 34.05)::geography
) / 1000 AS distance_km;
```

Enable `pg_stat_statements` on every production database. Review slow queries weekly.
