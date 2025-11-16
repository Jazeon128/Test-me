"""Professional certification exam question archetypes for GCP ACE and AWS SAA"""

GCP_ACE_ARCHETYPES = {
    "iam_least_privilege": {
        "name": "IAM & Least Privilege",
        "description": "Identity and Access Management questions focusing on secure, minimal permissions",
        "structure": [
            "Persona: Role assignment (e.g., 'You are a Cloud Engineer...')",
            "Problem: Access control scenario (e.g., 'A pod needs to access Cloud SQL...')",
            "Goal: Security objective (e.g., 'Grant minimal required permissions')",
            "Constraint: Security requirement (e.g., 'most secure', 'least privilege', 'no key files')"
        ],
        "distractor_focus": [
            "Over-permissive roles (e.g., Owner, Editor when Viewer is enough)",
            "Unnecessary admin access",
            "Key files instead of service accounts",
            "Outdated or insecure methods"
        ],
        "example_constraints": [
            "most secure and recommended method",
            "least privilege access",
            "without using key files",
            "following best practices"
        ],
        "common_services": [
            "IAM", "Service Accounts", "Workload Identity", "Cloud IAM Policies",
            "Organization Policies", "Resource Manager", "VPC Service Controls"
        ]
    },
    "cost_optimization": {
        "name": "Cost Optimization & Billing",
        "description": "Budget management and cost-effective resource selection",
        "structure": [
            "Persona: Engineer or manager role",
            "Problem: Resource optimization scenario",
            "Goal: Cost reduction objective",
            "Constraint: Cost requirement (e.g., 'most cost-effective', 'minimize spend')"
        ],
        "distractor_focus": [
            "More expensive machine types",
            "Unnecessary premium features",
            "Over-provisioned resources",
            "Inefficient architectures"
        ],
        "example_constraints": [
            "most cost-effective solution",
            "minimize monthly costs",
            "without reducing performance",
            "cheapest option that meets requirements"
        ],
        "common_services": [
            "Compute Engine", "Committed Use Discounts", "Sustained Use Discounts",
            "Preemptible VMs", "Cloud Functions", "Cloud Run", "BigQuery pricing"
        ]
    },
    "compute_gke_nuance": {
        "name": "Compute/GKE/App Engine Nuances",
        "description": "Compute platform selection and configuration details",
        "structure": [
            "Persona: Application developer or platform engineer",
            "Problem: Compute platform scenario",
            "Goal: Technical requirement",
            "Constraint: Platform-specific requirement (e.g., 'without managing infrastructure', 'autoscaling')"
        ],
        "distractor_focus": [
            "Wrong compute platform for use case",
            "Missing autoscaling configurations",
            "Incorrect resource specifications",
            "Platform feature misunderstandings"
        ],
        "example_constraints": [
            "without managing infrastructure",
            "automatic scaling to zero",
            "fastest deployment time",
            "containerized workload"
        ],
        "common_services": [
            "GKE", "Compute Engine", "App Engine", "Cloud Run", "Cloud Functions",
            "Instance Groups", "Node Pools", "GKE Autopilot"
        ]
    },
    "networking_vpc": {
        "name": "Networking & VPC Configuration",
        "description": "Network architecture, connectivity, and security",
        "structure": [
            "Persona: Network engineer or cloud architect",
            "Problem: Connectivity or network security scenario",
            "Goal: Network configuration objective",
            "Constraint: Network requirement (e.g., 'private connectivity', 'lowest latency')"
        ],
        "distractor_focus": [
            "Wrong peering method",
            "Insecure network configurations",
            "Inefficient routing",
            "Incorrect firewall rules"
        ],
        "example_constraints": [
            "private IP connectivity only",
            "lowest network latency",
            "without exposing to internet",
            "highly available connection"
        ],
        "common_services": [
            "VPC", "Cloud VPN", "Cloud Interconnect", "VPC Peering", "Shared VPC",
            "Firewall Rules", "Cloud NAT", "Cloud DNS", "Cloud Load Balancing"
        ]
    },
    "storage_databases": {
        "name": "Storage & Database Selection",
        "description": "Choosing appropriate storage and database services",
        "structure": [
            "Persona: Data engineer or application developer",
            "Problem: Data storage scenario",
            "Goal: Storage requirement",
            "Constraint: Storage characteristic (e.g., 'ACID compliance', 'global availability')"
        ],
        "distractor_focus": [
            "Wrong database type (SQL vs NoSQL)",
            "Inappropriate consistency model",
            "Incorrect storage class",
            "Over-engineered solutions"
        ],
        "example_constraints": [
            "ACID transactions required",
            "global multi-region availability",
            "lowest cost for archive data",
            "sub-10ms latency required"
        ],
        "common_services": [
            "Cloud Storage", "Cloud SQL", "Cloud Spanner", "Firestore", "Bigtable",
            "Memorystore", "Filestore", "Persistent Disk", "Cloud Storage classes"
        ]
    },
    "monitoring_logging": {
        "name": "Monitoring, Logging & Observability",
        "description": "Application monitoring, logging, and troubleshooting",
        "structure": [
            "Persona: SRE or operations engineer",
            "Problem: Observability scenario",
            "Goal: Monitoring or troubleshooting objective",
            "Constraint: Observability requirement (e.g., 'real-time alerts', 'log retention')"
        ],
        "distractor_focus": [
            "Wrong monitoring tool",
            "Insufficient alert configuration",
            "Inappropriate log retention",
            "Missing metrics"
        ],
        "example_constraints": [
            "real-time alerting required",
            "7-year log retention",
            "distributed tracing needed",
            "custom metrics dashboard"
        ],
        "common_services": [
            "Cloud Monitoring", "Cloud Logging", "Cloud Trace", "Cloud Profiler",
            "Error Reporting", "Cloud Debugger", "Uptime Checks", "Alerting Policies"
        ]
    },
    "security_compliance": {
        "name": "Security & Compliance",
        "description": "Security controls, encryption, and regulatory compliance",
        "structure": [
            "Persona: Security engineer or compliance officer",
            "Problem: Security or compliance scenario",
            "Goal: Security objective",
            "Constraint: Security/compliance requirement (e.g., 'HIPAA compliant', 'customer-managed keys')"
        ],
        "distractor_focus": [
            "Weaker encryption methods",
            "Non-compliant configurations",
            "Missing security controls",
            "Inadequate data protection"
        ],
        "example_constraints": [
            "HIPAA/PCI-DSS compliance",
            "customer-managed encryption keys",
            "data residency in specific region",
            "audit log immutability"
        ],
        "common_services": [
            "Cloud KMS", "Secret Manager", "Cloud HSM", "VPC Service Controls",
            "Binary Authorization", "Security Command Center", "Data Loss Prevention API"
        ]
    },
    "devops_cicd": {
        "name": "DevOps & CI/CD Pipelines",
        "description": "Continuous integration, deployment, and automation",
        "structure": [
            "Persona: DevOps engineer or platform engineer",
            "Problem: CI/CD or automation scenario",
            "Goal: Deployment objective",
            "Constraint: Deployment requirement (e.g., 'zero downtime', 'automated rollback')"
        ],
        "distractor_focus": [
            "Manual deployment processes",
            "Downtime during deployment",
            "Missing automation",
            "Insecure pipeline configurations"
        ],
        "example_constraints": [
            "zero-downtime deployment",
            "automated rollback on failure",
            "GitOps workflow",
            "container vulnerability scanning"
        ],
        "common_services": [
            "Cloud Build", "Cloud Deploy", "Artifact Registry", "Cloud Source Repositories",
            "Cloud Run", "GKE", "Binary Authorization", "Container Analysis"
        ]
    }
}

AWS_SAA_ARCHETYPES = {
    "iam_least_privilege": {
        "name": "IAM & Least Privilege",
        "description": "AWS Identity and Access Management best practices",
        "structure": [
            "Persona: Solutions Architect or Security Engineer",
            "Problem: Access control scenario",
            "Goal: Secure access objective",
            "Constraint: Security requirement (e.g., 'least privilege', 'temporary credentials')"
        ],
        "distractor_focus": [
            "Overly permissive policies",
            "Long-term access keys instead of roles",
            "Missing MFA requirements",
            "Incorrect trust relationships"
        ],
        "example_constraints": [
            "least privilege access",
            "temporary credentials only",
            "MFA required",
            "cross-account access needed"
        ],
        "common_services": [
            "IAM", "STS", "IAM Roles", "IAM Policies", "AWS Organizations",
            "Service Control Policies", "Permission Boundaries", "IAM Identity Center"
        ]
    },
    "cost_optimization": {
        "name": "Cost Optimization",
        "description": "AWS cost management and optimization strategies",
        "structure": [
            "Persona: Solutions Architect or FinOps Engineer",
            "Problem: Cost reduction scenario",
            "Goal: Cost optimization objective",
            "Constraint: Cost requirement"
        ],
        "distractor_focus": [
            "On-Demand instead of Reserved/Savings Plans",
            "Wrong instance family",
            "Unoptimized storage classes",
            "Missing cost allocation tags"
        ],
        "example_constraints": [
            "most cost-effective solution",
            "predictable workload",
            "minimize data transfer costs",
            "optimize storage costs"
        ],
        "common_services": [
            "EC2", "S3", "Reserved Instances", "Savings Plans", "Spot Instances",
            "S3 Intelligent-Tiering", "Cost Explorer", "Budgets"
        ]
    },
    "compute_selection": {
        "name": "Compute Service Selection",
        "description": "Choosing appropriate AWS compute services",
        "structure": [
            "Persona: Solutions Architect",
            "Problem: Compute platform scenario",
            "Goal: Application deployment objective",
            "Constraint: Technical requirement"
        ],
        "distractor_focus": [
            "Wrong compute service for use case",
            "Over-provisioned resources",
            "Missing autoscaling",
            "Incorrect container service"
        ],
        "example_constraints": [
            "serverless required",
            "containerized microservices",
            "batch processing workload",
            "stateless web application"
        ],
        "common_services": [
            "EC2", "Lambda", "ECS", "EKS", "Fargate", "Batch",
            "Elastic Beanstalk", "Lightsail", "Auto Scaling"
        ]
    },
    "networking_vpc": {
        "name": "Networking & VPC",
        "description": "AWS networking architecture and connectivity",
        "structure": [
            "Persona: Network Architect or Solutions Architect",
            "Problem: Network connectivity scenario",
            "Goal: Network configuration objective",
            "Constraint: Network requirement"
        ],
        "distractor_focus": [
            "Wrong peering/connectivity option",
            "Insecure network design",
            "Single point of failure",
            "Incorrect routing configuration"
        ],
        "example_constraints": [
            "private connectivity required",
            "multi-region failover",
            "lowest latency",
            "hybrid cloud connectivity"
        ],
        "common_services": [
            "VPC", "Direct Connect", "VPN", "Transit Gateway", "VPC Peering",
            "PrivateLink", "NAT Gateway", "Route 53", "CloudFront"
        ]
    },
    "storage_databases": {
        "name": "Storage & Databases",
        "description": "AWS storage and database service selection",
        "structure": [
            "Persona: Database Administrator or Solutions Architect",
            "Problem: Data storage scenario",
            "Goal: Data management objective",
            "Constraint: Data requirement"
        ],
        "distractor_focus": [
            "Wrong database engine",
            "Inappropriate storage class",
            "Missing backup strategy",
            "Incorrect consistency model"
        ],
        "example_constraints": [
            "ACID transactions required",
            "millisecond latency needed",
            "petabyte-scale analytics",
            "11 9s durability required"
        ],
        "common_services": [
            "S3", "RDS", "DynamoDB", "Aurora", "Redshift", "ElastiCache",
            "EBS", "EFS", "FSx", "DocumentDB", "Neptune"
        ]
    },
    "high_availability": {
        "name": "High Availability & Disaster Recovery",
        "description": "Resilient architecture and business continuity",
        "structure": [
            "Persona: Solutions Architect or SRE",
            "Problem: Availability scenario",
            "Goal: Resilience objective",
            "Constraint: Availability requirement"
        ],
        "distractor_focus": [
            "Single AZ deployment",
            "Missing failover mechanism",
            "Inadequate backup strategy",
            "No disaster recovery plan"
        ],
        "example_constraints": [
            "99.99% availability required",
            "RTO < 1 hour",
            "RPO < 5 minutes",
            "multi-region failover"
        ],
        "common_services": [
            "Multi-AZ deployments", "Auto Scaling", "ELB", "Route 53",
            "S3 Cross-Region Replication", "RDS Multi-AZ", "Aurora Global Database"
        ]
    },
    "security_compliance": {
        "name": "Security & Compliance",
        "description": "AWS security best practices and compliance",
        "structure": [
            "Persona: Security Engineer or Compliance Officer",
            "Problem: Security scenario",
            "Goal: Security objective",
            "Constraint: Security/compliance requirement"
        ],
        "distractor_focus": [
            "Unencrypted data",
            "Public access when private needed",
            "Missing security controls",
            "Non-compliant configurations"
        ],
        "example_constraints": [
            "encryption at rest and in transit",
            "HIPAA compliance",
            "data residency requirements",
            "least privilege access"
        ],
        "common_services": [
            "KMS", "Secrets Manager", "GuardDuty", "Security Hub", "WAF",
            "Shield", "Macie", "Inspector", "CloudHSM", "Certificate Manager"
        ]
    },
    "monitoring_troubleshooting": {
        "name": "Monitoring & Troubleshooting",
        "description": "Observability and operational excellence",
        "structure": [
            "Persona: SRE or Operations Engineer",
            "Problem: Monitoring or troubleshooting scenario",
            "Goal: Observability objective",
            "Constraint: Operational requirement"
        ],
        "distractor_focus": [
            "Inadequate monitoring coverage",
            "Missing alarms",
            "Wrong metrics",
            "Inefficient logging strategy"
        ],
        "example_constraints": [
            "real-time alerting required",
            "centralized logging needed",
            "application performance monitoring",
            "automated remediation"
        ],
        "common_services": [
            "CloudWatch", "X-Ray", "CloudTrail", "EventBridge", "SNS",
            "Systems Manager", "Config", "Trusted Advisor"
        ]
    }
}
