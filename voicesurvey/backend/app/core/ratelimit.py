import time
from collections import defaultdict, deque

from app.core.errors import AppError


class RateLimiter:
    """In-memory sliding window. Per-process only: use Redis or a gateway if you run several workers."""

    def __init__(self, limit: int, window_seconds: int) -> None:
        self.limit, self.window = limit, window_seconds
        self.hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = time.monotonic()
        q = self.hits[key]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.limit:
            raise AppError("RATE_LIMITED", "Too many requests. Please wait a moment and try again.", 429)
        q.append(now)
