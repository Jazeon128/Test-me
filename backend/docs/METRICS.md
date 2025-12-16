# Prometheus Metrics Documentation

This document describes all available Prometheus metrics exposed by the Test Me platform.

## Accessing Metrics

Metrics are exposed at the `/metrics` endpoint in Prometheus text format:

```
GET http://localhost:8000/metrics
```

## Available Metrics

### Question Generation Metrics

#### `question_generation_duration_seconds`
**Type:** Histogram  
**Description:** Time spent generating questions  
**Labels:**
- `provider`: AI provider (anthropic, openai, gemini)
- `difficulty`: Question difficulty (easy, medium, hard, mixed)

**Example:**
```
question_generation_duration_seconds_bucket{provider="anthropic",difficulty="medium",le="30"} 45
question_generation_duration_seconds_sum{provider="anthropic",difficulty="medium"} 1234.5
question_generation_duration_seconds_count{provider="anthropic",difficulty="medium"} 50
```

#### `question_generation_total`
**Type:** Counter  
**Description:** Total number of question generation requests  
**Labels:**
- `provider`: AI provider
- `difficulty`: Question difficulty
- `status`: success or failure

#### `questions_generated_count`
**Type:** Counter  
**Description:** Total number of questions successfully generated  
**Labels:**
- `provider`: AI provider
- `difficulty`: Question difficulty

### AI API Metrics

#### `ai_api_calls_total`
**Type:** Counter  
**Description:** Total number of AI API calls  
**Labels:**
- `provider`: AI provider
- `model`: Model name (e.g., claude-3-5-sonnet-20241022, gpt-4o)
- `status`: success or failure

#### `ai_api_duration_seconds`
**Type:** Histogram  
**Description:** Duration of AI API calls  
**Labels:**
- `provider`: AI provider
- `model`: Model name

#### `ai_tokens_used_total`
**Type:** Counter  
**Description:** Total number of tokens used  
**Labels:**
- `provider`: AI provider
- `model`: Model name
- `token_type`: input or output

**Usage Example:**
```
# Total input tokens for Claude
ai_tokens_used_total{provider="anthropic",model="claude-3-5-sonnet-20241022",token_type="input"}

# Total output tokens for GPT-4
ai_tokens_used_total{provider="openai",model="gpt-4o",token_type="output"}
```

#### `ai_estimated_cost_usd`
**Type:** Counter  
**Description:** Estimated cost of AI API usage in USD  
**Labels:**
- `provider`: AI provider
- `model`: Model name

**Note:** Costs are estimated based on published pricing as of December 2024:
- Claude 3.5 Sonnet: $3/MTok input, $15/MTok output
- GPT-4o: $2.50/MTok input, $10/MTok output
- Gemini 2.0 Flash: $0.075/MTok input, $0.30/MTok output

### API Request Metrics

#### `api_requests_total`
**Type:** Counter  
**Description:** Total number of API requests  
**Labels:**
- `method`: HTTP method (GET, POST, PUT, DELETE)
- `endpoint`: API endpoint path
- `status`: HTTP status code

#### `api_request_duration_seconds`
**Type:** Histogram  
**Description:** Duration of API requests  
**Labels:**
- `method`: HTTP method
- `endpoint`: API endpoint path

### Database Metrics

#### `db_query_duration_seconds`
**Type:** Histogram  
**Description:** Duration of database queries  
**Labels:**
- `operation`: Type of operation (select, insert, update, delete)

#### `db_operations_total`
**Type:** Counter  
**Description:** Total number of database operations  
**Labels:**
- `operation`: Type of operation
- `status`: success or failure

### Document Processing Metrics

#### `document_uploads_total`
**Type:** Counter  
**Description:** Total number of document uploads  
**Labels:**
- `file_type`: Document type (PDF, DOCX, HTML, etc.)
- `status`: success or failure

#### `document_parsing_duration_seconds`
**Type:** Histogram  
**Description:** Duration of document parsing  
**Labels:**
- `file_type`: Document type

#### `document_size_bytes`
**Type:** Histogram  
**Description:** Size of uploaded documents in bytes  
**Labels:**
- `file_type`: Document type

### User Progress Metrics

#### `answers_submitted_total`
**Type:** Counter  
**Description:** Total number of answers submitted  
**Labels:**
- `result`: correct or incorrect
- `difficulty`: Question difficulty

#### `review_sessions_total`
**Type:** Counter  
**Description:** Total number of review sessions started  
**Labels:**
- `session_type`: Type of review session

### Error Metrics

#### `errors_total`
**Type:** Counter  
**Description:** Total number of errors  
**Labels:**
- `error_type`: Type of error
- `endpoint`: Endpoint where error occurred

### System Metrics

#### `active_users`
**Type:** Gauge  
**Description:** Number of currently active users

#### `application_info`
**Type:** Info  
**Description:** Application version and configuration  
**Labels:**
- `version`: Application version
- `ai_provider`: Configured AI provider
- `environment`: Environment (development, staging, production)

## Querying Metrics

### Prometheus Query Examples

**Average question generation time by provider:**
```promql
rate(question_generation_duration_seconds_sum[5m]) / rate(question_generation_duration_seconds_count[5m])
```

**Total AI API cost per hour:**
```promql
increase(ai_estimated_cost_usd[1h])
```

**API request rate by endpoint:**
```promql
rate(api_requests_total[5m])
```

**95th percentile API response time:**
```promql
histogram_quantile(0.95, rate(api_request_duration_seconds_bucket[5m]))
```

**Error rate percentage:**
```promql
100 * (
  sum(rate(api_requests_total{status=~"5.."}[5m]))
  /
  sum(rate(api_requests_total[5m]))
)
```

**Token usage by provider:**
```promql
sum by (provider) (ai_tokens_used_total)
```

## Grafana Dashboard

A sample Grafana dashboard configuration is available in `docs/grafana-dashboard.json`.

Key panels include:
- Question generation rate and duration
- AI API usage and costs
- API response times and error rates
- Document processing metrics
- User activity metrics

## Alerting Rules

### Recommended Alerts

**High Error Rate:**
```yaml
- alert: HighErrorRate
  expr: |
    100 * (
      sum(rate(api_requests_total{status=~"5.."}[5m]))
      /
      sum(rate(api_requests_total[5m]))
    ) > 5
  for: 5m
  annotations:
    summary: "High error rate detected"
    description: "Error rate is {{ $value }}%"
```

**Slow Question Generation:**
```yaml
- alert: SlowQuestionGeneration
  expr: |
    histogram_quantile(0.95,
      rate(question_generation_duration_seconds_bucket[5m])
    ) > 60
  for: 10m
  annotations:
    summary: "Question generation is slow"
    description: "95th percentile is {{ $value }}s"
```

**High AI Costs:**
```yaml
- alert: HighAICosts
  expr: increase(ai_estimated_cost_usd[1h]) > 10
  annotations:
    summary: "High AI API costs"
    description: "Spent ${{ $value }} in the last hour"
```

## Integration with Monitoring Stack

### Docker Compose Example

```yaml
version: '3.8'

services:
  testme-backend:
    build: ./backend
    ports:
      - "8000:8000"
  
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
  
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    volumes:
      - grafana_data:/var/lib/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin

volumes:
  prometheus_data:
  grafana_data:
```

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'testme'
    static_configs:
      - targets: ['testme-backend:8000']
    metrics_path: '/metrics'
```

## Best Practices

1. **Cardinality Management**: Avoid high-cardinality labels (e.g., user IDs, document IDs)
2. **Metric Naming**: Follow Prometheus naming conventions (unit suffixes, snake_case)
3. **Label Consistency**: Use consistent label names across related metrics
4. **Histogram Buckets**: Adjust bucket boundaries based on actual data distribution
5. **Cost Tracking**: Monitor AI costs regularly to avoid unexpected bills

## Troubleshooting

### Metrics Not Appearing

1. Check that prometheus-client is installed: `pip list | grep prometheus`
2. Verify the `/metrics` endpoint is accessible: `curl http://localhost:8000/metrics`
3. Check Prometheus scrape configuration and targets

### Incorrect Metric Values

1. Verify label values match expected format
2. Check for metric name collisions
3. Review metric type (Counter vs Gauge vs Histogram)

### High Memory Usage

1. Reduce histogram bucket count
2. Limit label cardinality
3. Adjust Prometheus retention period

## Further Reading

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/naming/)
- [Grafana Documentation](https://grafana.com/docs/)
- [FastAPI Prometheus Integration](https://github.com/trallnag/prometheus-fastapi-instrumentator)
