import os

os.environ["DATABASE_URL"] = "sqlite:///./voicesurvey_test.db"

import pytest
from fastapi.testclient import TestClient

from app.api import public
from app.core.ratelimit import RateLimiter
from app.database.session import Base, engine
from app.main import app


@pytest.fixture()
def client():
    Base.metadata.drop_all(engine)
    public.submit_limiter = RateLimiter(20, 60)
    public.transcribe_limiter = RateLimiter(10, 60)
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def auth_headers(client):
    r = client.post("/api/auth/register", json={"name": "Owner", "email": "o@example.com", "password": "password123"})
    return {"Authorization": f"Bearer {r.json()['data']['token']}"}
