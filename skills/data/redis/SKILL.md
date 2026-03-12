---
name: redis
description: >
  Redis best practices for caching, session management, rate limiting,
  messaging, and data structure usage. Covers all major Redis data types,
  caching patterns, Lua scripting, cluster configuration, and memory
  management. Use this skill when integrating Redis into your application.
license: MIT
metadata:
  author: skillbox
  version: "1.0"
  category: data
  tags: redis, cache, nosql, messaging, sessions
---

# Redis Best Practices

## Data Structures

### Strings

Use for simple key-value caching, counters, and flags:

```redis
SET user:42:email "alice@example.com" EX 3600
GET user:42:email

INCR api:requests:2025-01-15
INCRBY product:99:stock -1
```

### Hashes

Use for objects with multiple fields. More memory-efficient than separate string keys:

```redis
HSET user:42 name "Alice" email "alice@example.com" plan "pro"
HGET user:42 name
HGETALL user:42
HINCRBY user:42 login_count 1
```

### Lists

Use for queues, recent activity feeds, and bounded logs:

```redis
LPUSH notifications:user:42 '{"type":"mention","post_id":99}'
LRANGE notifications:user:42 0 19    # last 20 notifications
LTRIM notifications:user:42 0 99     # keep only last 100
```

### Sets

Use for unique collections, tagging, and intersection/union operations:

```redis
SADD post:1:tags "redis" "caching" "nosql"
SISMEMBER post:1:tags "redis"        # O(1) membership check
SINTER user:1:interests user:2:interests   # common interests
```

### Sorted Sets

Use for leaderboards, priority queues, and time-based indexes:

```redis
ZADD leaderboard 1500 "player:alice" 1200 "player:bob"
ZREVRANGE leaderboard 0 9 WITHSCORES    # top 10
ZRANGEBYSCORE events 1705000000 1705100000  # time range query
ZINCRBY leaderboard 50 "player:alice"
```

### Streams

Use for event sourcing, message queues, and audit logs:

```redis
XADD orders * user_id 42 product_id 99 amount 29.99
XREAD COUNT 10 BLOCK 5000 STREAMS orders $

# Consumer groups for reliable processing
XGROUP CREATE orders order-processors $ MKSTREAM
XREADGROUP GROUP order-processors worker-1 COUNT 5 BLOCK 2000 STREAMS orders >
XACK orders order-processors 1705000000000-0
```

## Caching Patterns

### Cache-Aside (Lazy Loading)

The application manages cache reads and writes. Use this as the default pattern:

```python
def get_user(user_id):
    cached = redis.get(f"user:{user_id}")
    if cached:
        return json.loads(cached)

    user = db.query("SELECT * FROM users WHERE id = %s", user_id)
    redis.setex(f"user:{user_id}", 3600, json.dumps(user))
    return user
```

### Write-Through

Write to cache and database together. Use when you cannot tolerate stale reads:

```python
def update_user(user_id, data):
    db.execute("UPDATE users SET ... WHERE id = %s", user_id)
    redis.setex(f"user:{user_id}", 3600, json.dumps(data))
```

### Write-Behind (Write-Back)

Write to cache immediately, flush to database asynchronously. Use for high-write-throughput scenarios where brief data loss is acceptable:

```python
def record_page_view(page_id):
    redis.hincrby(f"pageviews:{page_id}", "count", 1)
    # Background worker flushes to DB every minute
```

### Cache Invalidation

- Set TTLs on every cached value. Do not cache without expiration.
- Invalidate on write: delete or update the cache key when the source data changes.
- Use key prefixes with versioning for bulk invalidation: `v2:user:42` allows clearing all `v1:*` keys.

## Session Management

Store sessions in Redis hashes with a TTL:

```python
import uuid

def create_session(user_id):
    session_id = str(uuid.uuid4())
    redis.hset(f"session:{session_id}", mapping={
        "user_id": user_id,
        "created_at": int(time.time())
    })
    redis.expire(f"session:{session_id}", 86400)  # 24 hours
    return session_id

def get_session(session_id):
    data = redis.hgetall(f"session:{session_id}")
    if not data:
        return None
    redis.expire(f"session:{session_id}", 86400)  # refresh TTL on access
    return data
```

## Rate Limiting

### Sliding Window Rate Limiter

Use a sorted set for precise sliding window rate limiting:

```python
def is_rate_limited(user_id, limit=100, window_seconds=60):
    key = f"ratelimit:{user_id}"
    now = time.time()
    window_start = now - window_seconds

    pipe = redis.pipeline()
    pipe.zremrangebyscore(key, 0, window_start)   # remove old entries
    pipe.zadd(key, {str(now): now})                # add current request
    pipe.zcard(key)                                # count requests in window
    pipe.expire(key, window_seconds)               # auto-cleanup
    _, _, count, _ = pipe.execute()

    return count > limit
```

### Fixed Window with INCR

Simpler but less precise. Use when approximate limits are acceptable:

```redis
INCR ratelimit:user:42:202501151430
EXPIRE ratelimit:user:42:202501151430 60
```

## Pub/Sub

Use for real-time fan-out where message loss is acceptable (chat, live updates):

```python
# Publisher
redis.publish("notifications:user:42", json.dumps({
    "type": "new_message", "from": "bob"
}))

# Subscriber
pubsub = redis.pubsub()
pubsub.subscribe("notifications:user:42")
for message in pubsub.listen():
    if message["type"] == "message":
        handle_notification(json.loads(message["data"]))
```

Do not use Pub/Sub when you need guaranteed delivery. Use Redis Streams or a dedicated message broker instead.

## Lua Scripting

Use Lua scripts for atomic multi-step operations. The entire script runs without interruption:

```python
# Atomic "check and set" -- reserve stock only if available
RESERVE_STOCK = """
local current = tonumber(redis.call('GET', KEYS[1]) or 0)
if current >= tonumber(ARGV[1]) then
    redis.call('DECRBY', KEYS[1], ARGV[1])
    return 1
end
return 0
"""

reserved = redis.eval(RESERVE_STOCK, 1, "product:99:stock", 2)
```

```python
# Atomic rate limiter
RATE_LIMIT_LUA = """
local count = redis.call('INCR', KEYS[1])
if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
"""
```

Register frequently used scripts with `SCRIPT LOAD` and call with `EVALSHA` to avoid retransmitting the script body.

## Key Naming Conventions

Use colon-separated namespaces: `object-type:id:field`.

```
user:42:profile
user:42:sessions
order:1001:items
cache:v2:product:99
ratelimit:api:user:42
```

- Keep keys short but readable. Avoid excessively long keys -- they consume memory.
- Use a consistent prefix for cache keys so you can track memory usage by category.
- Always set a TTL. Use `SCAN` with pattern matching to find keys missing TTLs.

## Cluster and Sentinel

### Redis Sentinel

Use Sentinel for high availability with automatic failover on a single primary + replicas:

```
sentinel monitor mymaster 10.0.0.1 6379 2
sentinel down-after-milliseconds mymaster 5000
sentinel failover-timeout mymaster 10000
```

### Redis Cluster

Use Cluster for horizontal scaling across multiple primaries. Data is sharded across 16,384 hash slots:

- Use hash tags `{user:42}:profile` and `{user:42}:orders` to co-locate related keys on the same shard.
- Do not use multi-key commands (MGET, SUNION) across different hash slots.
- Minimum 3 primary nodes for production.

## Memory Management

### Eviction Policies

Set `maxmemory` and choose an eviction policy:

- `allkeys-lru`: Evict least recently used keys. Use for general caching.
- `volatile-lru`: Evict LRU keys that have a TTL set. Use when mixing cache and persistent data.
- `allkeys-lfu`: Evict least frequently used. Better than LRU for skewed access patterns.
- `noeviction`: Return errors on writes when memory is full. Use when data loss is unacceptable.

```
maxmemory 2gb
maxmemory-policy allkeys-lru
```

### Memory Optimization

- Use hashes instead of individual string keys for objects (ziplist encoding is compact).
- Use `OBJECT ENCODING key` to check encoding. Small hashes/lists use ziplist (memory-efficient).
- Set `hash-max-ziplist-entries 128` and `hash-max-ziplist-value 64` to tune ziplist thresholds.
- Monitor memory with `INFO memory` and `MEMORY USAGE key`.
