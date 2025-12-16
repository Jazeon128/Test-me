"""Global pytest configuration and Hypothesis settings"""
from hypothesis import settings, HealthCheck

# Register Hypothesis profiles for different environments
settings.register_profile("ci", max_examples=1000, deadline=None)
settings.register_profile("dev", max_examples=100, deadline=None)

# Load the dev profile by default (can be overridden with --hypothesis-profile=ci)
settings.load_profile("dev")
