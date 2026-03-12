---
name: mongodb
description: >
  MongoDB best practices for schema design, indexing, aggregation, and
  operations. Covers document modeling patterns, transactions, sharding,
  and driver configuration. Use this skill when building applications
  with MongoDB or optimizing existing MongoDB deployments.
license: MIT
metadata:
  author: skillbox
  version: "1.0"
  category: data
  tags: mongodb, nosql, document, schema, aggregation
---

# MongoDB Best Practices

## Schema Design Patterns

### Embedding vs Referencing

**Embed** when the child data is always accessed with the parent, has a bounded size, and belongs to one parent:

```javascript
// Good: address is always read with user, one-to-one
{
  _id: ObjectId("..."),
  name: "Alice",
  email: "alice@example.com",
  address: {
    street: "123 Main St",
    city: "Portland",
    state: "OR",
    zip: "97201"
  }
}
```

**Reference** when the child data is shared across parents, is unbounded, or is accessed independently:

```javascript
// Good: comments can grow unboundedly, store as separate collection
// orders collection
{ _id: ObjectId("..."), user_id: ObjectId("..."), total: 99.50 }

// order_items collection
{ _id: ObjectId("..."), order_id: ObjectId("..."), product_id: ObjectId("..."), qty: 2 }
```

### One-to-Many Patterns

For small, bounded sets (< 100), embed an array:

```javascript
{ _id: "post1", title: "...", tags: ["mongodb", "nosql", "database"] }
```

For large or unbounded sets, use child references:

```javascript
// Parent stores nothing about children
{ _id: "user1", name: "Alice" }

// Children reference parent
{ _id: "order1", user_id: "user1", total: 42.00 }
{ _id: "order2", user_id: "user1", total: 18.50 }
```

### Many-to-Many

Store an array of references on the side you query most:

```javascript
// students collection
{ _id: "s1", name: "Alice", course_ids: ["c1", "c2", "c3"] }

// courses collection
{ _id: "c1", title: "Database Systems", student_ids: ["s1", "s2"] }
```

Keep both sides in sync with transactions or accept eventual consistency.

### Document Size

MongoDB has a 16MB document limit. Do not embed unbounded arrays. Use the bucket pattern for time-series or event data:

```javascript
// Bucket pattern: group events into fixed-size documents
{
  sensor_id: "temp-001",
  bucket_start: ISODate("2025-01-15T00:00:00Z"),
  count: 60,
  readings: [
    { ts: ISODate("2025-01-15T00:00:00Z"), value: 22.1 },
    { ts: ISODate("2025-01-15T00:01:00Z"), value: 22.3 }
    // ... up to 60 readings per bucket
  ]
}
```

## Indexing

### Compound Indexes

MongoDB uses only one index per query. Design compound indexes following the ESR rule -- Equality, Sort, Range:

```javascript
// Query: find active users in a city, sorted by name
// Equality: status, city | Sort: name | Range: (none)
db.users.createIndex({ status: 1, city: 1, name: 1 });
```

### Text Indexes

Use text indexes for keyword search. Only one text index per collection:

```javascript
db.articles.createIndex({ title: "text", body: "text" }, {
  weights: { title: 10, body: 1 }
});

db.articles.find({ $text: { $search: "mongodb indexing" } },
  { score: { $meta: "textScore" } }
).sort({ score: { $meta: "textScore" } });
```

### TTL Indexes

Automatically delete documents after a time period:

```javascript
db.sessions.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 });
```

### Wildcard Indexes

Index all fields in a sub-document when the shape varies:

```javascript
db.products.createIndex({ "attributes.$**": 1 });
// Supports: db.products.find({ "attributes.color": "red" })
```

### Index Guidelines

- Run `db.collection.explain("executionStats").find(...)` to verify index usage.
- Drop unused indexes. Use `$indexStats` to find them.
- Do not create indexes with more than 4-5 fields. Reexamine your query patterns instead.

## Aggregation Pipeline

### Common Pipeline Patterns

```javascript
// Sales summary by category for the last 30 days
db.orders.aggregate([
  { $match: {
    createdAt: { $gte: new Date(Date.now() - 30 * 86400000) }
  }},
  { $unwind: "$items" },
  { $group: {
    _id: "$items.category",
    totalRevenue: { $sum: "$items.price" },
    orderCount: { $sum: 1 },
    avgPrice: { $avg: "$items.price" }
  }},
  { $sort: { totalRevenue: -1 } },
  { $limit: 10 }
]);
```

### Lookup (Join)

```javascript
db.orders.aggregate([
  { $lookup: {
    from: "users",
    localField: "user_id",
    foreignField: "_id",
    as: "user"
  }},
  { $unwind: "$user" },
  { $project: { total: 1, "user.name": 1, "user.email": 1 } }
]);
```

### Pipeline Optimization

- Place `$match` and `$limit` as early as possible to reduce documents flowing through the pipeline.
- Use `$project` or `$addFields` early to drop unneeded fields.
- Use `allowDiskUse: true` for aggregations that exceed 100MB memory.
- Create indexes that support your `$match` and `$sort` stages.

## Transactions

Use multi-document transactions only when you need atomicity across multiple documents or collections. They add latency and lock overhead:

```javascript
const session = client.startSession();
try {
  session.startTransaction();

  await db.collection("accounts").updateOne(
    { _id: fromAccountId },
    { $inc: { balance: -amount } },
    { session }
  );
  await db.collection("accounts").updateOne(
    { _id: toAccountId },
    { $inc: { balance: amount } },
    { session }
  );
  await db.collection("transfers").insertOne(
    { from: fromAccountId, to: toAccountId, amount, ts: new Date() },
    { session }
  );

  await session.commitTransaction();
} catch (err) {
  await session.abortTransaction();
  throw err;
} finally {
  session.endSession();
}
```

Prefer single-document atomic operations (`$set`, `$inc`, `$push` with `$each` and `$slice`) over transactions whenever possible.

## Sharding

Shard only when a single replica set cannot handle the write throughput or data volume.

Choose shard keys carefully -- a bad shard key cannot be changed easily:

- **High cardinality**: the key must have many distinct values.
- **Low frequency**: no single value should dominate.
- **Non-monotonic**: avoid `_id` or timestamps as sole shard key (creates hot spots). Use hashed sharding if you must shard on a monotonic field.

```javascript
// Hashed sharding on _id
sh.shardCollection("mydb.events", { _id: "hashed" });

// Range sharding on compound key
sh.shardCollection("mydb.orders", { region: 1, createdAt: 1 });
```

## Mongoose / Driver Patterns

### Connection Configuration

```javascript
const mongoose = require("mongoose");

mongoose.connect(process.env.MONGODB_URI, {
  maxPoolSize: 10,          // match your concurrency needs
  minPoolSize: 2,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 5000,
  heartbeatFrequencyMS: 10000
});
```

### Schema Validation

Enforce shape at the database level for collections shared across services:

```javascript
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["email", "name"],
      properties: {
        email: { bsonType: "string", pattern: "^.+@.+$" },
        name: { bsonType: "string", minLength: 1 },
        role: { enum: ["admin", "user", "viewer"] }
      }
    }
  }
});
```

## Change Streams

Use change streams for real-time reactions to data changes. Do not poll:

```javascript
const pipeline = [{ $match: { operationType: { $in: ["insert", "update"] } } }];
const changeStream = db.collection("orders").watch(pipeline, {
  fullDocument: "updateLookup"
});

changeStream.on("change", (change) => {
  console.log("Order changed:", change.fullDocument);
  // Trigger notification, update cache, sync to search index, etc.
});
```

Store the `resumeToken` so you can resume after restarts without missing events.
