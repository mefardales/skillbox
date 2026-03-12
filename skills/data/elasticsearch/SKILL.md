---
name: elasticsearch
description: >
  Elasticsearch best practices for search, analytics, and log management.
  Covers index design, query DSL, analyzers, aggregations, index lifecycle
  management, and ELK stack patterns. Use this skill when building search
  features, log pipelines, or analytics dashboards with Elasticsearch.
license: MIT
metadata:
  author: skillbox
  version: "1.0"
  category: data
  tags: elasticsearch, search, elk, indexing, fulltext
---

# Elasticsearch Best Practices

## Index Design

### Mappings

Define explicit mappings. Do not rely on dynamic mapping for production indexes:

```json
PUT /products
{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 1,
    "refresh_interval": "5s"
  },
  "mappings": {
    "properties": {
      "name":        { "type": "text", "analyzer": "english" },
      "description": { "type": "text", "analyzer": "english" },
      "sku":         { "type": "keyword" },
      "price":       { "type": "float" },
      "category":    { "type": "keyword" },
      "tags":        { "type": "keyword" },
      "created_at":  { "type": "date" },
      "in_stock":    { "type": "boolean" },
      "attributes":  { "type": "object", "dynamic": true }
    }
  }
}
```

- Use `text` for fields that need full-text search (tokenized, analyzed).
- Use `keyword` for fields used in exact match, filtering, sorting, and aggregations.
- Use multi-fields when you need both:

```json
"name": {
  "type": "text",
  "analyzer": "english",
  "fields": {
    "raw": { "type": "keyword" }
  }
}
```

This allows full-text search on `name` and exact match/sorting on `name.raw`.

### Aliases

Always query through aliases. Never point application code at index names directly:

```json
POST /_aliases
{
  "actions": [
    { "add": { "index": "products_v2", "alias": "products" } },
    { "remove": { "index": "products_v1", "alias": "products" } }
  ]
}
```

This allows zero-downtime reindexing by swapping the alias to a new index.

## Query DSL

### Bool Query

The bool query is the workhorse. Use `must` for scoring matches, `filter` for non-scoring filters, `should` for boosting, and `must_not` for exclusion:

```json
GET /products/_search
{
  "query": {
    "bool": {
      "must": [
        { "match": { "name": "wireless headphones" } }
      ],
      "filter": [
        { "term": { "category": "electronics" } },
        { "range": { "price": { "gte": 20, "lte": 200 } } },
        { "term": { "in_stock": true } }
      ],
      "should": [
        { "term": { "tags": { "value": "bestseller", "boost": 2.0 } } }
      ],
      "must_not": [
        { "term": { "category": "refurbished" } }
      ]
    }
  }
}
```

Use `filter` context for any clause that does not need to affect relevance scoring. Filters are cached and faster.

### Match Query Variants

```json
// Standard match (OR of terms by default)
{ "match": { "description": "noise cancelling headphones" } }

// Match with AND operator (all terms required)
{ "match": { "description": { "query": "noise cancelling", "operator": "and" } } }

// Match phrase (exact phrase in order)
{ "match_phrase": { "description": "noise cancelling" } }

// Multi-match across fields with boosting
{
  "multi_match": {
    "query": "wireless headphones",
    "fields": ["name^3", "description", "tags^2"],
    "type": "best_fields"
  }
}
```

### Nested Queries

Use nested type and queries for arrays of objects that must maintain field relationships:

```json
// Mapping
"reviews": {
  "type": "nested",
  "properties": {
    "user":   { "type": "keyword" },
    "rating": { "type": "integer" },
    "text":   { "type": "text" }
  }
}

// Query -- find products with a 5-star review mentioning "excellent"
{
  "nested": {
    "path": "reviews",
    "query": {
      "bool": {
        "must": [
          { "term": { "reviews.rating": 5 } },
          { "match": { "reviews.text": "excellent" } }
        ]
      }
    }
  }
}
```

## Analyzers and Tokenizers

### Built-in Analyzers

- `standard`: good default, lowercases, removes punctuation.
- `english` / `french` / etc.: language-specific stemming and stop words.
- `keyword`: no tokenization, treats the entire field as one token.

### Custom Analyzers

Build custom analyzers for domain-specific needs:

```json
PUT /products
{
  "settings": {
    "analysis": {
      "analyzer": {
        "sku_analyzer": {
          "type": "custom",
          "tokenizer": "keyword",
          "filter": ["lowercase"]
        },
        "autocomplete_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "autocomplete_filter"]
        }
      },
      "filter": {
        "autocomplete_filter": {
          "type": "edge_ngram",
          "min_gram": 2,
          "max_gram": 15
        }
      }
    }
  }
}
```

Use `edge_ngram` for autocomplete / type-ahead search. Index with the ngram analyzer, search with the standard analyzer:

```json
"name": {
  "type": "text",
  "analyzer": "autocomplete_analyzer",
  "search_analyzer": "standard"
}
```

### Synonyms

```json
"filter": {
  "synonym_filter": {
    "type": "synonym",
    "synonyms": [
      "laptop, notebook, portable computer",
      "phone, mobile, cell phone, smartphone"
    ]
  }
}
```

## Aggregations

### Terms Aggregation

```json
GET /orders/_search
{
  "size": 0,
  "aggs": {
    "by_category": {
      "terms": { "field": "category", "size": 20 },
      "aggs": {
        "avg_price": { "avg": { "field": "price" } },
        "total_revenue": { "sum": { "field": "price" } }
      }
    }
  }
}
```

### Date Histogram

```json
{
  "size": 0,
  "query": { "range": { "created_at": { "gte": "2025-01-01" } } },
  "aggs": {
    "orders_over_time": {
      "date_histogram": {
        "field": "created_at",
        "calendar_interval": "week"
      },
      "aggs": {
        "revenue": { "sum": { "field": "total" } }
      }
    }
  }
}
```

### Nested Aggregations

```json
{
  "size": 0,
  "aggs": {
    "review_stats": {
      "nested": { "path": "reviews" },
      "aggs": {
        "avg_rating": { "avg": { "field": "reviews.rating" } },
        "rating_distribution": {
          "terms": { "field": "reviews.rating" }
        }
      }
    }
  }
}
```

Set `"size": 0` when you only need aggregation results, not document hits.

## Index Lifecycle Management (ILM)

Use ILM for time-based indexes (logs, metrics) to automate rollover, shrinking, and deletion:

```json
PUT _ilm/policy/logs_policy
{
  "policy": {
    "phases": {
      "hot": {
        "min_age": "0ms",
        "actions": {
          "rollover": {
            "max_primary_shard_size": "50gb",
            "max_age": "1d"
          },
          "set_priority": { "priority": 100 }
        }
      },
      "warm": {
        "min_age": "7d",
        "actions": {
          "shrink": { "number_of_shards": 1 },
          "forcemerge": { "max_num_segments": 1 },
          "set_priority": { "priority": 50 }
        }
      },
      "cold": {
        "min_age": "30d",
        "actions": {
          "set_priority": { "priority": 0 }
        }
      },
      "delete": {
        "min_age": "90d",
        "actions": { "delete": {} }
      }
    }
  }
}
```

Apply the policy to an index template so all new indexes inherit it.

## Performance

### Shard Sizing

- Target 10-50GB per shard. Do not create shards smaller than 1GB or larger than 65GB.
- One shard per index is correct for small datasets. Do not over-shard.
- Use the formula: `number_of_shards = ceil(expected_data_size / 30GB)`.

### Bulk Indexing

Always use the bulk API for batch operations. Do not index documents one at a time:

```json
POST /_bulk
{"index": {"_index": "products", "_id": "1"}}
{"name": "Wireless Headphones", "price": 79.99, "category": "electronics"}
{"index": {"_index": "products", "_id": "2"}}
{"name": "USB-C Cable", "price": 12.99, "category": "accessories"}
```

- Use batch sizes of 5-15MB per bulk request.
- Increase `refresh_interval` to `30s` or `-1` during bulk loads, then reset.
- Disable replicas during initial bulk load: `"number_of_replicas": 0`, then restore.

### Search Optimization

- Use `filter` context for non-scoring clauses -- filters are cached.
- Avoid deep pagination with `from` + `size`. Use `search_after` for deep pagination:

```json
GET /products/_search
{
  "size": 20,
  "sort": [{ "created_at": "desc" }, { "_id": "asc" }],
  "search_after": ["2025-01-15T00:00:00Z", "abc123"]
}
```

- Use `_source` filtering to return only needed fields.
- Profile slow queries with the `"profile": true` parameter.

## Security

### Role-Based Access Control

```json
POST /_security/role/read_only_products
{
  "indices": [
    {
      "names": ["products*"],
      "privileges": ["read"],
      "field_security": {
        "grant": ["name", "description", "price", "category"]
      }
    }
  ]
}
```

Use field-level security to restrict which fields a role can read. Use document-level security with a query to restrict which documents a role can access:

```json
"query": {
  "term": { "department": "engineering" }
}
```

## ELK Stack Patterns

### Logstash Pipeline

```ruby
input {
  beats { port => 5044 }
}

filter {
  grok {
    match => { "message" => "%{TIMESTAMP_ISO8601:timestamp} %{LOGLEVEL:level} %{GREEDYDATA:msg}" }
  }
  date {
    match => ["timestamp", "ISO8601"]
    target => "@timestamp"
  }
  mutate {
    remove_field => ["timestamp"]
  }
}

output {
  elasticsearch {
    hosts => ["https://localhost:9200"]
    index => "logs-%{+YYYY.MM.dd}"
    user => "logstash_writer"
    password => "${ES_PASSWORD}"
  }
}
```

### Kibana

- Create index patterns matching your time-based indexes (e.g., `logs-*`).
- Use Discover for ad-hoc log exploration.
- Build dashboards with Lens for metrics visualization.
- Set up Kibana alerts for error rate spikes and anomaly detection.

Use data views (formerly index patterns) that match your ILM-managed indexes so old indexes are automatically included.
