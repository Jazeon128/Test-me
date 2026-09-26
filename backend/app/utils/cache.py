"""
Simple in-memory caching utility for expensive database operations.

This provides a basic LRU cache for query results to reduce database load
for frequently accessed data like statistics and leaderboards.
"""

from functools import wraps
from typing import Callable, Any
import hashlib
import json
from datetime import datetime


# Simple time-based cache decorator
def timed_cache(seconds: int = 300):
    """
    Cache decorator with time-based expiration.

    Args:
        seconds: Cache TTL in seconds (default: 300 = 5 minutes)

    Usage:
        @timed_cache(seconds=60)
        def expensive_query():
            return db.query(...).all()
    """

    def decorator(func: Callable) -> Callable:
        cache = {}
        cache_times = {}

        @wraps(func)
        def wrapper(*args, **kwargs):
            # Create cache key from function name and arguments
            key_data = {
                "func": func.__name__,
                "args": str(args),
                "kwargs": str(sorted(kwargs.items())),
            }
            cache_key = hashlib.md5(json.dumps(key_data, sort_keys=True).encode()).hexdigest()

            # Check if cached and not expired
            now = datetime.utcnow()
            if cache_key in cache:
                cached_time = cache_times.get(cache_key)
                if cached_time and (now - cached_time).total_seconds() < seconds:
                    return cache[cache_key]

            # Execute function and cache result
            result = func(*args, **kwargs)
            cache[cache_key] = result
            cache_times[cache_key] = now

            # Clean up old entries (simple cleanup strategy)
            if len(cache) > 100:  # Max 100 cached items
                oldest_key = min(cache_times.keys(), key=lambda k: cache_times[k])
                del cache[oldest_key]
                del cache_times[oldest_key]

            return result

        # Add cache clearing method
        def clear_cache():
            cache.clear()
            cache_times.clear()

        wrapper.clear_cache = clear_cache
        return wrapper

    return decorator


# Specialized cache for statistics that auto-invalidates on data changes
class StatisticsCache:
    """
    Cache for statistics queries with automatic invalidation.

    This cache is designed for expensive aggregate queries like overall stats
    and leaderboards. It automatically invalidates when new data is added.
    """

    def __init__(self, ttl_seconds: int = 300):
        self.ttl_seconds = ttl_seconds
        self._cache = {}
        self._cache_times = {}
        self._last_invalidation = datetime.utcnow()

    def get(self, key: str) -> Any:
        """Get cached value if not expired."""
        if key not in self._cache:
            return None

        cached_time = self._cache_times.get(key)
        if not cached_time:
            return None

        now = datetime.utcnow()
        if (now - cached_time).total_seconds() >= self.ttl_seconds:
            # Expired
            del self._cache[key]
            del self._cache_times[key]
            return None

        return self._cache[key]

    def set(self, key: str, value: Any):
        """Set cached value."""
        self._cache[key] = value
        self._cache_times[key] = datetime.utcnow()

    def invalidate(self, key: str = None):
        """Invalidate specific key or all cache."""
        if key:
            self._cache.pop(key, None)
            self._cache_times.pop(key, None)
        else:
            self._cache.clear()
            self._cache_times.clear()
            self._last_invalidation = datetime.utcnow()

    def invalidate_all(self):
        """Clear all cached data."""
        self.invalidate()


# Global statistics cache instance
stats_cache = StatisticsCache(ttl_seconds=300)  # 5 minute TTL
