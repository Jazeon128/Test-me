# Monitoring Quick Start Guide

Get monitoring up and running in 5 minutes!

## Prerequisites

- Docker and Docker Compose installed
- Test Me backend running and exposing metrics at `/metrics`

## Quick Start

### 1. Start Monitoring Stack

```bash
# From the project root directory
docker-compose -f docker-compose.yml -f backend/monitoring/docker-compose.monitoring.yml up -d
```

This will start:
- **Prometheus** on http://localhost:9090
- **Grafana** on http://localhost:3000

### 2. Access Grafana

1. Open http://localhost:3000 in your browser
2. Login with default credentials:
   - Username: `admin`
   - Password: `admin` (change this immediately!)
3. The dashboard should be automatically loaded under "Test Me" folder

### 3. Verify Metrics

1. Check that Prometheus is scraping metrics:
   - Go to http://localhost:9090/targets
   - Ensure `testme-backend` target is "UP"

2. View raw metrics:
   - Go to http://localhost:8000/metrics
   - You should see Prometheus-formatted metrics

### 4. View Dashboard

1. In Grafana, go to Dashboards → Browse
2. Open "Test Me Platform - Monitoring Dashboard"
3. You should see:
   - API request rates
   - Response times
   - Error rates
   - Question generation metrics
   - AI costs and token usage
   - Database performance
   - Document parsing times

## Troubleshooting

### No Data in Dashboard

**Problem**: Dashboard shows "No data"

**Solution**:
1. Verify backend is running: `curl http://localhost:8000/metrics`
2. Check Prometheus targets: http://localhost:9090/targets
3. Ensure time range is set to "Last 5 minutes"
4. Generate some traffic to the API

### Prometheus Target Down

**Problem**: Prometheus shows target as "DOWN"

**Solution**:
1. Check if backend is accessible from Prometheus container:
   ```bash
   docker exec testme-prometheus wget -O- http://backend:8000/metrics
   ```
2. Verify network configuration in docker-compose.yml
3. Check backend logs: `docker-compose logs backend`

### Grafana Can't Connect to Prometheus

**Problem**: Grafana shows "Bad Gateway" or connection errors

**Solution**:
1. Verify Prometheus is running: `docker ps | grep prometheus`
2. Check Prometheus URL in Grafana datasource (should be `http://prometheus:9090`)
3. Test connection: Configuration → Data Sources → Prometheus → Save & Test

## Next Steps

1. **Change Grafana Password**:
   - Go to Profile → Change Password
   - Or set `GRAFANA_ADMIN_PASSWORD` environment variable

2. **Set Up Alerts**:
   - Alerts are already configured in `alerts.yml`
   - Configure Alertmanager to receive notifications
   - See [docs/MONITORING.md](../../docs/MONITORING.md) for details

3. **Customize Dashboard**:
   - Click the gear icon → Settings
   - Modify panels or add new ones
   - Save your changes

4. **Review Metrics**:
   - Monitor API performance
   - Track AI costs
   - Identify slow endpoints
   - Watch for errors

## Useful Commands

```bash
# View Prometheus logs
docker-compose logs prometheus

# View Grafana logs
docker-compose logs grafana

# Restart monitoring stack
docker-compose -f docker-compose.yml -f backend/monitoring/docker-compose.monitoring.yml restart prometheus grafana

# Stop monitoring stack
docker-compose -f docker-compose.yml -f backend/monitoring/docker-compose.monitoring.yml down

# View metrics from command line
curl http://localhost:8000/metrics

# Query Prometheus API
curl 'http://localhost:9090/api/v1/query?query=api_requests_total'
```

## Production Considerations

Before deploying to production:

1. **Security**:
   - Change default Grafana password
   - Enable authentication on `/metrics` endpoint
   - Use HTTPS for Grafana
   - Restrict network access to monitoring ports

2. **Storage**:
   - Configure Prometheus retention period
   - Set up remote storage for long-term metrics
   - Configure Grafana backup

3. **Alerting**:
   - Set up Alertmanager
   - Configure notification channels (email, Slack, PagerDuty)
   - Test alert rules

4. **Performance**:
   - Adjust scrape intervals based on load
   - Monitor Prometheus resource usage
   - Consider using Prometheus federation for scale

## Resources

- Full documentation: [docs/MONITORING.md](../../docs/MONITORING.md)
- Prometheus docs: https://prometheus.io/docs/
- Grafana docs: https://grafana.com/docs/
- PromQL tutorial: https://prometheus.io/docs/prometheus/latest/querying/basics/
