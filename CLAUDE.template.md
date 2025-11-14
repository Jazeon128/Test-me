# Claude Development Context

## Project: {PROJECT_NAME}
**Type**: {web-app|data-pipeline|api|mobile|infrastructure|ai-ml}
**Stack**: {technology stack - e.g., Python, React, GCP, Databricks}
**Cloud Provider**: {GCP|AWS|Azure|multi-cloud}
**Repository**: {github-url}
**Environment**: {development|staging|production}

## 🎯 Current Sprint
- **Active Issue**: #{issue_number} - {issue_title}
- **Phase**: {planning|coding|testing|deploying|completed}
- **Progress**: {X/Y tasks completed}
- **ETA**: {estimated completion date}
- **Blockers**: {any current issues preventing progress}
- **Last Updated**: {date}

## 💰 Cost Management
- **Monthly Budget**: ${amount} USD
- **Current Spend**: ${amount} USD (as of {date})
- **Cost per {unit}**: ${amount} per {transaction|user|request}
- **Alert Thresholds**: 
  - Warning at ${amount} (X% of budget)
  - Critical at ${amount} (Y% of budget)
- **Auto-shutdown Rules**: {describe when resources auto-stop}
- **Optimization Status**: {green|yellow|red} - {brief status}

## 🏗️ Architecture Overview
### System Design
```
{ASCII diagram or description of system architecture}
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Component A   │───▶│   Component B    │───▶│   Component C   │
│   {description} │    │   {description}  │    │   {description} │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Key Components
- **{Component 1}**: {purpose and technology}
- **{Component 2}**: {purpose and technology}
- **{Component 3}**: {purpose and technology}

### Data Flow
1. **Ingestion**: {how data enters the system}
2. **Processing**: {how data is transformed}
3. **Storage**: {where and how data is stored}
4. **Output**: {how data is consumed/displayed}

## 🎨 Established Patterns

### Code Organization
```
{project-structure}
src/
├── components/     # Reusable components
├── services/       # Business logic
├── utils/          # Helper functions
├── config/         # Configuration
└── tests/          # Test suites
```

### Naming Conventions
- **Files**: {snake_case|kebab-case|camelCase}
- **Functions**: {snake_case|camelCase}
- **Classes**: {PascalCase}
- **Constants**: {UPPER_SNAKE_CASE}
- **Database Tables**: {naming_pattern}

### Error Handling
```python
# Example error handling pattern
try:
    result = risky_operation()
    log_success(result)
    return result
except SpecificError as e:
    log_error(f"Specific error: {e}")
    raise
except Exception as e:
    log_error(f"Unexpected error: {e}")
    raise
```

### Testing Patterns
- **Unit Tests**: {testing framework and patterns}
- **Integration Tests**: {approach and tools}
- **E2E Tests**: {tools and scope}
- **Performance Tests**: {benchmarks and tools}

## 🧪 Quality Standards

### Testing Requirements
- **Unit Test Coverage**: {X%} minimum
- **Integration Test Coverage**: {required scenarios}
- **Performance Benchmarks**: 
  - Response time: < {X}ms
  - Throughput: > {X} requests/second
  - Resource usage: < {X}% CPU, < {X}MB memory
- **Security Requirements**: {security testing requirements}

### Code Quality Gates
- [ ] Linting passes ({linter})
- [ ] Type checking passes ({type_checker})
- [ ] Security scan passes ({security_tool})
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Cost impact analyzed

### Deployment Criteria
- [ ] All tests passing
- [ ] Code review completed
- [ ] Cost budget approved
- [ ] Performance validated
- [ ] Security cleared
- [ ] Monitoring configured

## 🚀 Deployment Process

### Environments
- **Development**: {description and access}
- **Staging**: {description and access}
- **Production**: {description and access}

### Deployment Pipeline
1. **Build**: {build process}
2. **Test**: {automated testing}
3. **Security Scan**: {security validation}
4. **Cost Check**: {budget validation}
5. **Deploy to Staging**: {staging deployment}
6. **Smoke Tests**: {production-like testing}
7. **Deploy to Production**: {production deployment}
8. **Health Check**: {post-deployment validation}

### Rollback Procedure
```bash
# Emergency rollback commands
{rollback_commands}
```

### Infrastructure as Code
- **Tool**: {Terraform|CloudFormation|Pulumi}
- **Location**: {path to IaC files}
- **State Management**: {where state is stored}
- **Cost Estimation**: {how to estimate costs}

## 📊 Monitoring & Observability

### Key Metrics
- **Business Metrics**: {KPIs to track}
- **Technical Metrics**: {performance indicators}
- **Cost Metrics**: {cost tracking}
- **Security Metrics**: {security indicators}

### Dashboards
- **Main Dashboard**: {URL and description}
- **Cost Dashboard**: {URL and description}
- **Performance Dashboard**: {URL and description}
- **Security Dashboard**: {URL and description}

### Alerting
- **Critical Alerts**: {when to wake people up}
- **Warning Alerts**: {important but not urgent}
- **Cost Alerts**: {budget and spend alerts}
- **Security Alerts**: {security incident alerts}

## 🔧 Development Tools

### Required Tools
- **IDE/Editor**: {recommended setup}
- **Version Control**: Git + GitHub
- **Package Manager**: {npm|pip|cargo|etc}
- **Build Tool**: {webpack|gradle|make|etc}
- **Testing Framework**: {jest|pytest|etc}
- **Linting**: {eslint|pylint|etc}

### Development Commands
```bash
# Setup development environment
{setup_commands}

# Run tests
{test_commands}

# Start development server
{dev_server_commands}

# Build for production
{build_commands}

# Deploy
{deploy_commands}
```

### Environment Variables
```bash
# Required environment variables
{list of env vars and descriptions}
```

## 📚 Context & Memory

### Key Decisions Made
- **{Date}**: {Decision description and rationale}
- **{Date}**: {Decision description and rationale}

### Patterns That Work
- **{Pattern Name}**: {Description and when to use}
- **{Pattern Name}**: {Description and when to use}

### Gotchas & Lessons Learned
- **{Issue}**: {Problem encountered and solution}
- **{Issue}**: {Problem encountered and solution}

### Performance Optimizations
- **{Optimization}**: {What was optimized and impact}
- **{Optimization}**: {What was optimized and impact}

### Cost Optimizations Applied
- **{Optimization}**: {Cost savings and implementation}
- **{Optimization}**: {Cost savings and implementation}

### Security Considerations
- **{Security Measure}**: {Implementation and rationale}
- **{Security Measure}**: {Implementation and rationale}

## 🚨 Troubleshooting

### Common Issues
1. **{Issue Description}**
   - **Symptoms**: {how to identify}
   - **Cause**: {root cause}
   - **Solution**: {how to fix}
   - **Prevention**: {how to avoid}

2. **{Issue Description}**
   - **Symptoms**: {how to identify}
   - **Cause**: {root cause}
   - **Solution**: {how to fix}
   - **Prevention**: {how to avoid}

### Emergency Procedures
```bash
# Emergency shutdown
{emergency_shutdown_commands}

# Rollback to last known good state
{rollback_commands}

# Scale down for cost savings
{scale_down_commands}

# Check system health
{health_check_commands}
```

### Debug Commands
```bash
# Check logs
{log_commands}

# Check resource usage
{monitoring_commands}

# Check database status
{database_commands}

# Check external dependencies
{dependency_commands}
```

## ⚡ Quick Reference

### Frequent Commands
```bash
# Most used development commands
{list of frequently used commands}
```

### Quick Links
- **Documentation**: {links to key docs}
- **Monitoring**: {links to dashboards}
- **Cost Tracking**: {links to cost tools}
- **Issue Tracker**: {link to issues}
- **CI/CD Pipeline**: {link to build status}

### Contact Information
- **Team Lead**: {contact info}
- **DevOps**: {contact info}
- **Security**: {contact info}
- **On-Call**: {contact info}

## 🔄 Workflow Status

### Recent Completed Issues
- **#{number}**: {title} - {completion date} - {outcome}
- **#{number}**: {title} - {completion date} - {outcome}

### Current Priorities
1. **{Priority 1}**: {description and timeline}
2. **{Priority 2}**: {description and timeline}
3. **{Priority 3}**: {description and timeline}

### Upcoming Work
- **{Upcoming Item}**: {description and timeline}
- **{Upcoming Item}**: {description and timeline}

### Technical Debt
- **{Debt Item}**: {description and priority}
- **{Debt Item}**: {description and priority}

---

**Last Updated**: {date}
**Updated By**: Claude (AI Assistant)
**Context Version**: {version}

---

## 📝 Instructions for Claude

### Context Management
- Update this file after completing each issue
- Preserve successful patterns and optimization strategies
- Document new learnings and gotchas
- Keep cost and performance data current
- Maintain links to external resources

### Development Workflow
1. Read this entire file before starting work
2. Update "Current Sprint" section when starting new issues
3. Follow established patterns and conventions
4. Update "Context & Memory" section with new learnings
5. Keep troubleshooting section current with new issues found

### Cost Consciousness
- Always check current costs before making changes
- Estimate cost impact of new features
- Document cost optimizations in the patterns section
- Alert if approaching budget limits
- Suggest cost-saving alternatives when appropriate

### Quality Assurance
- Follow all quality standards listed above
- Run all required tests before deployment
- Update monitoring and alerting as needed
- Document any new testing patterns or tools
- Maintain high code quality standards