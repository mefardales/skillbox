---
name: timeseries-databases
description: >
  Time-series database patterns for metrics, IoT, financial data, and
  observability. Covers TimescaleDB, InfluxDB, data modeling, downsampling,
  retention policies, and query patterns. Use this skill when building
  systems that ingest and analyze time-stamped data at scale.
license: MIT
metadata:
  author: skillbox
  version: "1.0"
  category: data
  tags: timeseries, influxdb, timescaledb, metrics, iot
---

# Time-Series Database Patterns

## When to Use Time-Series Databases

Use a time-series database when your data has these characteristics:

- **Time-stamped**: every record has a timestamp as its primary dimension.
- **Append-heavy**: data is almost always inserted, rarely updated or deleted.
- **Time-range queries**: most queries filter by time windows.
- **Aggregation-heavy**: you compute averages, sums, percentiles over time buckets.

Common use cases: application metrics, server monitoring, IoT sensor data, financial tick data, event logs, energy usage.

Do not use a time-series database for general-purpose transactional data, user profiles, or content management.

## TimescaleDB (PostgreSQL Extension)

TimescaleDB extends PostgreSQL with automatic time-based partitioning, compression, and continuous aggregates. Use it when you want time-series capabilities without leaving the PostgreSQL ecosystem.

### Hypertables

Convert a regular table into a hypertable for automatic time-based partitioning:

```sql
CREATE TABLE metrics (
    time        TIMESTAMPTZ NOT NULL,
    sensor_id   TEXT NOT NULL,
    temperature DOUBLE PRECISION,
    humidity    DOUBLE PRECISION
);

SELECT create_hypertable('metrics', by_range('time'));

-- Optional: add a space dimension for multi-tenant partitioning
SELECT add_dimension('metrics', by_hash('sensor_id', 4));
```

Create indexes on frequently filtered columns:

```sql
CREATE INDEX idx_metrics_sensor_time ON metrics (sensor_id, time DESC);
```

### Time Bucketing

Use `time_bucket()` for aggregation over fixed intervals:

```sql
SELECT
    time_bucket('1 hour', time) AS bucket,
    sensor_id,
    AVG(temperature) AS avg_temp,
    MAX(temperature) AS max_temp,
    MIN(temperature) AS min_temp,
    COUNT(*) AS reading_count
FROM metrics
WHERE time > now() - interval '7 days'
    AND sensor_id = 'sensor-001'
GROUP BY bucket, sensor_id
ORDER BY bucket DESC;
```

### Continuous Aggregates

Pre-compute aggregations that update automatically as new data arrives:

```sql
CREATE MATERIALIZED VIEW metrics_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    sensor_id,
    AVG(temperature) AS avg_temp,
    MAX(temperature) AS max_temp,
    COUNT(*) AS readings
FROM metrics
GROUP BY bucket, sensor_id;

-- Refresh policy: keep the last 7 days of hourly data up to date
SELECT add_continuous_aggregate_policy('metrics_hourly',
    start_offset    => INTERVAL '7 days',
    end_offset      => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour'
);
```

### Compression

Enable native compression for older data to reduce storage 90-95%:

```sql
ALTER TABLE metrics SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'sensor_id',
    timescaledb.compress_orderby = 'time DESC'
);

-- Automatically compress data older than 7 days
SELECT add_compression_policy('metrics', INTERVAL '7 days');
```

### Retention Policies

Automatically drop old data:

```sql
SELECT add_retention_policy('metrics', INTERVAL '90 days');
```

Combine with continuous aggregates: keep raw data for 90 days, hourly aggregates for 1 year, daily aggregates indefinitely.

## InfluxDB

### Measurement Design

In InfluxDB, data is organized into measurements (similar to tables). Each point has a timestamp, tags (indexed metadata), and fields (values):

```
// Line protocol format
// measurement,tag1=value1,tag2=value2 field1=value1,field2=value2 timestamp

cpu,host=server01,region=us-east usage_percent=72.5,idle_percent=27.5 1705363200000000000
cpu,host=server02,region=eu-west usage_percent=45.2,idle_percent=54.8 1705363200000000000
```

### Tags vs Fields

- **Tags**: string-only, indexed, used for filtering and grouping. Use for metadata with low cardinality (hostname, region, sensor type).
- **Fields**: any type, not indexed, used for actual measurements. Use for numeric values you aggregate.

Do not put high-cardinality values (user IDs, request IDs) in tags. This causes excessive series creation and memory pressure.

### Flux Query Language

```flux
from(bucket: "monitoring")
  |> range(start: -24h)
  |> filter(fn: (r) => r._measurement == "cpu" and r.host == "server01")
  |> filter(fn: (r) => r._field == "usage_percent")
  |> aggregateWindow(every: 1h, fn: mean, createEmpty: false)
  |> yield(name: "hourly_avg")
```

```flux
// Moving average
from(bucket: "monitoring")
  |> range(start: -7d)
  |> filter(fn: (r) => r._measurement == "temperature")
  |> aggregateWindow(every: 1h, fn: mean)
  |> movingAverage(n: 24)  // 24-hour moving average

// Percentiles
from(bucket: "monitoring")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "response_time")
  |> quantile(q: 0.95, method: "exact_mean")
```

### Bucket and Retention

```flux
// Create a bucket with 30-day retention
// (typically done via CLI or API)
influx bucket create --name monitoring --retention 30d

// Downsampling task: aggregate 1-minute data into 1-hour summaries
option task = {name: "downsample_hourly", every: 1h}

from(bucket: "monitoring")
  |> range(start: -task.every)
  |> filter(fn: (r) => r._measurement == "cpu")
  |> aggregateWindow(every: 1h, fn: mean)
  |> to(bucket: "monitoring_longterm")
```

## Data Modeling

### Wide vs Narrow Tables

**Narrow table** (one measurement per row) -- flexible, easy to add new metrics:

```sql
CREATE TABLE metrics (
    time       TIMESTAMPTZ NOT NULL,
    device_id  TEXT NOT NULL,
    metric     TEXT NOT NULL,     -- 'temperature', 'humidity', etc.
    value      DOUBLE PRECISION NOT NULL
);
```

**Wide table** (one row per timestamp per device) -- faster queries when you always read multiple metrics together:

```sql
CREATE TABLE device_readings (
    time        TIMESTAMPTZ NOT NULL,
    device_id   TEXT NOT NULL,
    temperature DOUBLE PRECISION,
    humidity    DOUBLE PRECISION,
    pressure    DOUBLE PRECISION
);
```

Use wide tables when the set of metrics is known and stable. Use narrow tables when metrics are dynamic or per-device schemas vary.

## Downsampling and Rollup Strategies

Store raw data at full resolution for recent periods, then downsample:

| Time Range       | Resolution | Storage          |
|------------------|-----------|------------------|
| Last 24 hours    | 1 second  | Raw data         |
| Last 30 days     | 1 minute  | 1-min averages   |
| Last 1 year      | 1 hour    | Hourly aggregates|
| Beyond 1 year    | 1 day     | Daily aggregates |

Store min, max, avg, count, and sum in rollup tables so you can compute accurate aggregations at any level.

## Query Patterns

### Gap Filling

Fill missing data points for charting:

```sql
-- TimescaleDB
SELECT
    time_bucket_gapfill('1 hour', time) AS bucket,
    sensor_id,
    locf(AVG(temperature)) AS temperature  -- last observation carried forward
FROM metrics
WHERE time BETWEEN '2025-01-01' AND '2025-01-02'
    AND sensor_id = 'sensor-001'
GROUP BY bucket, sensor_id
ORDER BY bucket;
```

### Moving Averages

```sql
SELECT
    time,
    temperature,
    AVG(temperature) OVER (
        ORDER BY time
        ROWS BETWEEN 23 PRECEDING AND CURRENT ROW
    ) AS moving_avg_24h
FROM metrics
WHERE sensor_id = 'sensor-001'
ORDER BY time;
```

### Rate of Change

```sql
SELECT
    time,
    value,
    value - LAG(value) OVER (ORDER BY time) AS delta,
    (value - LAG(value) OVER (ORDER BY time)) /
        EXTRACT(EPOCH FROM time - LAG(time) OVER (ORDER BY time)) AS rate_per_second
FROM metrics
WHERE sensor_id = 'sensor-001'
    AND time > now() - interval '1 hour';
```

## Grafana Integration

- Use TimescaleDB or InfluxDB as a Grafana data source directly.
- Use `$__timeFilter(time)` macro in TimescaleDB queries for automatic time range binding.
- Use `$__interval` to dynamically adjust bucket size based on the dashboard zoom level:

```sql
SELECT
    time_bucket('$__interval', time) AS time,
    AVG(temperature) AS temperature
FROM metrics
WHERE $__timeFilter(time) AND sensor_id = '$sensor'
GROUP BY 1
ORDER BY 1;
```

Set up alerting in Grafana for threshold breaches (e.g., temperature > 80C for 5 minutes).
