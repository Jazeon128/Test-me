# Monitoring Configuration Files

This directory contains configuration files for monitoring the Test Me platform with Prometheus and Grafana.

## Files

### `prometheus.yml`
Prometheus configuration file that defines:
- Scrape intervals and targets
- Job configurations for the Test Me backend
- Alert rules (optional)

### `grafana-dashboard.json`
Complete Grafana dashboard configuration with all panels for monitoring:
- API metrics (request rate, latency)
- Error metrics (error rates by type and endpoint)
- Question generation metrics (duration, costs, tokens)
- Performance metrics (database queries, document parsing)

### `panels/`
Individual panel configurations that can be used to build custom dashboards:
- `api-metrics.json` - API request and response time panels
- `error-metrics.json` - Error tracking panels
- `question-generation-metrics.json` - AI generation monitoring panels
- `performance-metrics.json` - Database and parsing performance panels

## Quick Start

### Using Docker Compose

1. Add the monitoring services to your `docker-compose.yml`:

```yaml
prometheus:
  image: prom/prometheus:latest
  ports:
    - "9090:9090"
  volumes:
    - ./backend/monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    - prometheus_data:/prometheus

grafana:
  image: grafana/grafana:latest
  ports:
    - "3000:3000"
  volumes:
    - grafana_data:/var/lib/grafana
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=admin
```

2. Start the services:
```bash
docker-compose up -d prometheus grafana
```

3. Access Grafana at http://localhost:3000 and import the dashboard

## Documentation

See [docs/MONITORING.md](../../docs/MONITORING.md) for complete setup instructions, dashboard usage, and troubleshooting.

## Metrics Endpoint

The Test Me backend exposes metrics at:
```
http://localhost:8000/metrics
```

You can view raw metrics by visiting this endpoint in your browser or using curl:
```bash
curl http://localhost:8000/metrics
```
