# Monitoring and Observability Guide

This guide explains how to set up and use monitoring for the Test Me platform using Prometheus and Grafana.

## Overview

The Test Me platform exposes Prometheus metrics for monitoring application performance, AI usage, and system health. This document covers:

- Available metrics and their meanings
- Setting up Prometheus and Grafana
- Importing and using the pre-built dashboard
- Creating custom alerts
- Troubleshooting common issues

## Architecture

```
┌─────────────────┐
│  Test Me API    │
│  (FastAPI)      │
│  Port: 8000     │
│  /metrics       │
└────────┬────────┘
         │
         │ HTTP Scrape
         │ (every 15s)
         ▼
┌─────────────────┐
│  Prometheus     │
│  Port: 9090     │
│  Time Series DB │
└────────┬────────┘
         │
         │ PromQL Queries
         ▼
┌─────────────────┐
│  Grafana        │
│  Port: 3000     │
│  Dashboards     │
└─────────────────┘
```

## Available Metrics

### API Metrics

#### `api_requests_total`
- **Type**: Counter
- **Labels**: `method`, `endpoint`, `status`
- **Description**: Total number of API requests
- **Example**: `api_requests_total{method="POST",endpoint="/api/documents",status="200"}`

#### `api_request_duration_seconds`
- **Type**: Histogram
- **Labels**: `method`, `endpoint`
- **Description**: Duration of API requests in seconds
- **Buckets**: 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10
- **Example**: `api_request_duration_seconds_bucket{method="GET",endpoint="/api/questions",le="0.5"}`

### Question Generation Metrics

#### `question_generation_duration_seconds`
- **Type**: Histogram
- **Labels**: `provider`, `difficulty`
- **Description**: Time spent generating questions
- **Buckets**: 1, 5, 10, 20, 30, 45, 60, 90, 120, 180, 300
- **Example**: `question_generation_duration_seconds{provider="anthropic",difficulty="medium"}`

#### `question_generation_total`
- **Type**: Counter
- **Labels**: `provider`, `difficulty`, `status`
- **Description**: Total number of question generation requests
- **Example**: `question_generation_total{provider="openai",difficulty="hard",status="success"}`

#### `questions_generated_count`
- **Type**: Counter
- **Labels**: `provider`, `difficulty`
- **Description**: Total number of questions generated
- **Example**: `questions_generated_count{provider="gemini",difficulty="easy"}`

### AI API Metrics

#### `ai_api_calls_total`
- **Type**: Counter
- **Labels**: `provider`, `model`, `status`
- **Description**: Total number of AI API calls
- **Example**: `ai_api_calls_total{provider="anthropic",model="claude-3-5-sonnet",status="success"}`

#### `ai_api_duration_seconds`
- **Type**: Histogram
- **Labels**: `provider`, `model`
- **Description**: Duration of AI API calls
- **Buckets**: 0.5, 1, 2, 5, 10, 15, 20, 30, 45, 60


#### `ai_tokens_used_total`
- **Type**: Counter
- **Labels**: `provider`, `model`, `token_type`
- **Description**: Total number of tokens used (input/output)
- **Example**: `ai_tokens_used_total{provider="openai",model="gpt-4o",token_type="input"}`

#### `ai_estimated_cost_usd`
- **Type**: Counter
- **Labels**: `provider`, `model`
- **Description**: Estimated cost of AI API usage in USD
- **Example**: `ai_estimated_cost_usd{provider="anthropic",model="claude-3-5-sonnet"}`

### Database Metrics

#### `db_query_duration_seconds`
- **Type**: Histogram
- **Labels**: `operation`
- **Description**: Duration of database queries
- **Buckets**: 0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1
- **Example**: `db_query_duration_seconds{operation="select"}`

#### `db_operations_total`
- **Type**: Counter
- **Labels**: `operation`, `status`
- **Description**: Total number of database operations
- **Example**: `db_operations_total{operation="insert",status="success"}`

### Document Processing Metrics

#### `document_uploads_total`
- **Type**: Counter
- **Labels**: `file_type`, `status`
- **Description**: Total number of document uploads
- **Example**: `document_uploads_total{file_type="PDF",status="success"}`

#### `document_parsing_duration_seconds`
- **Type**: Histogram
- **Labels**: `file_type`
- **Description**: Duration of document parsing
- **Buckets**: 0.1, 0.5, 1, 2, 5, 10, 20, 30
- **Example**: `document_parsing_duration_seconds{file_type="DOCX"}`

#### `document_size_bytes`
- **Type**: Histogram
- **Labels**: `file_type`
- **Description**: Size of uploaded documents in bytes
- **Buckets**: 1KB, 10KB, 100KB, 1MB, 10MB, 50MB
- **Example**: `document_size_bytes{file_type="PDF"}`

### Error Metrics

#### `errors_total`
- **Type**: Counter
- **Labels**: `error_type`, `endpoint`
- **Description**: Total number of errors
- **Example**: `errors_total{error_type="ValidationError",endpoint="/api/documents"}`

### User Activity Metrics

#### `answers_submitted_total`
- **Type**: Counter
- **Labels**: `result`, `difficulty`
- **Description**: Total number of answers submitted
- **Example**: `answers_submitted_total{result="correct",difficulty="medium"}`

#### `review_sessions_total`
- **Type**: Counter
- **Labels**: `session_type`
- **Description**: Total number of review sessions started
- **Example**: `review_sessions_total{session_type="spaced_repetition"}`

## Setup Instructions

### Option 1: Docker Compose (Recommended)

1. **Add Prometheus and Grafana to docker-compose.yml**:

```yaml
services:
  # ... existing services ...
  
  prometheus:
    image: prom/prometheus:latest
    container_name: testme-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./backend/monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/usr/share/prometheus/console_libraries'
      - '--web.console.templates=/usr/share/prometheus/consoles'
    networks:
      - testme-network
    restart: unless-stopped
  
  grafana:
    image: grafana/grafana:latest
    container_name: testme-grafana
    ports:
      - "3000:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./backend/monitoring/grafana-dashboard.json:/etc/grafana/provisioning/dashboards/testme.json
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    networks:
      - testme-network
    depends_on:
      - prometheus
    restart: unless-stopped

volumes:
  prometheus_data:
  grafana_data:

networks:
  testme-network:
    driver: bridge
```

2. **Start the monitoring stack**:

```bash
docker-compose up -d prometheus grafana
```

3. **Access the services**:
   - Prometheus: http://localhost:9090
   - Grafana: http://localhost:3000 (default credentials: admin/admin)

### Option 2: Manual Installation

#### Install Prometheus

1. **Download Prometheus**:
```bash
wget https://github.com/prometheus/prometheus/releases/download/v2.45.0/prometheus-2.45.0.linux-amd64.tar.gz
tar xvfz prometheus-*.tar.gz
cd prometheus-*
```

2. **Copy the configuration**:
```bash
cp /path/to/backend/monitoring/prometheus.yml ./prometheus.yml
```

3. **Start Prometheus**:
```bash
./prometheus --config.file=prometheus.yml
```

4. **Verify**: Open http://localhost:9090

#### Install Grafana

1. **Install Grafana** (Ubuntu/Debian):
```bash
sudo apt-get install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
sudo apt-get update
sudo apt-get install grafana
```

2. **Start Grafana**:
```bash
sudo systemctl start grafana-server
sudo systemctl enable grafana-server
```

3. **Verify**: Open http://localhost:3000

## Importing the Dashboard

### Method 1: Automatic Provisioning (Docker)

The dashboard is automatically loaded when using Docker Compose with the provided configuration.

### Method 2: Manual Import

1. **Log in to Grafana** (http://localhost:3000)
   - Default credentials: admin/admin

2. **Add Prometheus as a data source**:
   - Go to Configuration → Data Sources
   - Click "Add data source"
   - Select "Prometheus"
   - Set URL to `http://prometheus:9090` (Docker) or `http://localhost:9090` (local)
   - Click "Save & Test"

3. **Import the dashboard**:
   - Go to Dashboards → Import
   - Click "Upload JSON file"
   - Select `backend/monitoring/grafana-dashboard.json`
   - Select the Prometheus data source
   - Click "Import"

### Method 3: Build Complete Dashboard from Panels

If you want to customize the dashboard, you can build it from the individual panel configurations:

1. Create a new dashboard in Grafana
2. Add panels using the configurations in `backend/monitoring/panels/`:
   - `api-metrics.json` - API request rate and latency
   - `error-metrics.json` - Error rates and HTTP errors
   - `question-generation-metrics.json` - AI generation metrics
   - `performance-metrics.json` - Database and parsing performance

## Dashboard Panels

### API Metrics Section

1. **API Request Rate**
   - Shows requests per second by endpoint and method
   - Useful for identifying traffic patterns and peak usage

2. **API Response Time (p50, p95)**
   - Shows median and 95th percentile response times
   - Thresholds: Green < 500ms, Yellow < 2s, Red > 2s

### Error Metrics Section

3. **Error Rate by Type and Endpoint**
   - Shows error occurrences grouped by type and endpoint
   - Helps identify problematic endpoints

4. **HTTP Error Rate**
   - Shows 4xx and 5xx error rates as percentages
   - Thresholds: Green < 1%, Yellow < 5%, Red > 5%

### Question Generation Section

5. **Question Generation Duration**
   - Shows p50 and p95 generation times by provider and difficulty
   - Helps identify slow AI providers or difficult content

6. **AI Token Usage Rate**
   - Shows input and output token consumption rate
   - Useful for capacity planning and cost estimation

7. **Estimated AI Costs**
   - Shows estimated hourly costs by provider and model
   - Based on current token pricing

8. **Question Generation Success Rate**
   - Gauge showing percentage of successful generations
   - Thresholds: Green > 95%, Yellow > 90%, Red < 90%

### Performance Section

9. **Database Query Duration**
   - Shows p50 and p95 query times by operation type
   - Thresholds: Green < 50ms, Yellow < 100ms, Red > 100ms

10. **Document Parsing Duration**
    - Shows parsing times by file type
    - Helps identify slow parsers or problematic file types

## Useful PromQL Queries

### API Performance

```promql
# Request rate by endpoint
rate(api_requests_total[5m])

# 95th percentile response time
histogram_quantile(0.95, rate(api_request_duration_seconds_bucket[5m]))

# Error rate percentage
sum(rate(api_requests_total{status=~"5.."}[5m])) / sum(rate(api_requests_total[5m])) * 100
```

### Question Generation

```promql
# Average generation time by provider
avg(rate(question_generation_duration_seconds_sum[5m])) by (provider)

# Questions generated per minute
rate(questions_generated_count[1m]) * 60

# AI cost per hour
rate(ai_estimated_cost_usd[5m]) * 3600
```

### Database Performance

```promql
# Slow queries (> 100ms)
histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m])) > 0.1

# Database operations per second
rate(db_operations_total[5m])
```

## Creating Alerts

### Example Alert Rules

Create a file `backend/monitoring/alerts.yml`:

```yaml
groups:
  - name: testme_alerts
    interval: 30s
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: |
          sum(rate(api_requests_total{status=~"5.."}[5m])) 
          / sum(rate(api_requests_total[5m])) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }}"
      
      # Slow API responses
      - alert: SlowAPIResponses
        expr: |
          histogram_quantile(0.95, 
            rate(api_request_duration_seconds_bucket[5m])
          ) > 2
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "API responses are slow"
          description: "95th percentile response time is {{ $value }}s"
      
      # High AI costs
      - alert: HighAICosts
        expr: rate(ai_estimated_cost_usd[1h]) * 24 > 100
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "AI costs are high"
          description: "Estimated daily cost: ${{ $value }}"
      
      # Question generation failures
      - alert: QuestionGenerationFailures
        expr: |
          sum(rate(question_generation_total{status="failure"}[5m])) 
          / sum(rate(question_generation_total[5m])) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High question generation failure rate"
          description: "Failure rate is {{ $value | humanizePercentage }}"
```

Add to `prometheus.yml`:
```yaml
rule_files:
  - "alerts.yml"
```

## Monitoring Best Practices

### 1. Set Up Alerts

Configure alerts for:
- Error rates > 5%
- Response times > 2 seconds (p95)
- Question generation failures > 10%
- Daily AI costs > budget threshold

### 2. Regular Review

- Review dashboards daily during initial deployment
- Check for anomalies in traffic patterns
- Monitor AI costs and optimize if needed
- Identify slow endpoints and optimize

### 3. Capacity Planning

Use metrics to plan for:
- Scaling decisions (when to add resources)
- AI provider selection (cost vs performance)
- Database optimization needs
- Storage requirements

### 4. Performance Optimization

Monitor and optimize:
- Endpoints with p95 > 1 second
- Database queries > 100ms
- Document parsing > 10 seconds
- AI generation > 60 seconds

## Troubleshooting

### Prometheus Not Scraping Metrics

**Problem**: No data in Prometheus

**Solutions**:
1. Check if metrics endpoint is accessible:
   ```bash
   curl http://localhost:8000/metrics
   ```

2. Verify Prometheus configuration:
   ```bash
   # Check for syntax errors
   promtool check config prometheus.yml
   ```

3. Check Prometheus targets:
   - Go to http://localhost:9090/targets
   - Ensure target is "UP"

### Grafana Not Showing Data

**Problem**: Dashboard panels show "No data"

**Solutions**:
1. Verify Prometheus data source:
   - Configuration → Data Sources → Prometheus
   - Click "Test" to verify connection

2. Check time range:
   - Ensure time range includes recent data
   - Try "Last 5 minutes"

3. Verify metrics exist:
   - Go to Prometheus (http://localhost:9090)
   - Run query: `api_requests_total`

### High Memory Usage

**Problem**: Prometheus using too much memory

**Solutions**:
1. Reduce retention period:
   ```yaml
   # In prometheus.yml
   storage:
     tsdb:
       retention.time: 7d  # Reduce from default 15d
   ```

2. Reduce scrape frequency:
   ```yaml
   global:
     scrape_interval: 30s  # Increase from 15s
   ```

### Missing Metrics

**Problem**: Some metrics not appearing

**Solutions**:
1. Ensure feature is being used (metrics only appear after first use)
2. Check application logs for errors
3. Verify metric names match exactly (case-sensitive)

## Security Considerations

### 1. Protect Metrics Endpoint

Add authentication to `/metrics` endpoint:

```python
# In backend/main.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
import secrets

security = HTTPBasic()

def verify_metrics_auth(credentials: HTTPBasicCredentials = Depends(security)):
    correct_username = secrets.compare_digest(credentials.username, "prometheus")
    correct_password = secrets.compare_digest(
        credentials.password, 
        os.getenv("METRICS_PASSWORD", "changeme")
    )
    if not (correct_username and correct_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    return credentials.username

@app.get("/metrics", dependencies=[Depends(verify_metrics_auth)])
async def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
```

Update Prometheus config:
```yaml
scrape_configs:
  - job_name: 'testme-backend'
    basic_auth:
      username: 'prometheus'
      password: 'your-secure-password'
```

### 2. Secure Grafana

1. Change default admin password immediately
2. Enable HTTPS in production
3. Configure proper user roles and permissions
4. Use OAuth or LDAP for authentication

### 3. Network Security

1. Use firewall rules to restrict access to monitoring ports
2. Run Prometheus and Grafana in private network
3. Use reverse proxy with authentication for external access

## Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PromQL Basics](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Grafana Dashboard Best Practices](https://grafana.com/docs/grafana/latest/best-practices/)

## Support

For issues or questions:
1. Check application logs: `docker-compose logs backend`
2. Check Prometheus logs: `docker-compose logs prometheus`
3. Check Grafana logs: `docker-compose logs grafana`
4. Review this documentation
5. Open an issue on GitHub
