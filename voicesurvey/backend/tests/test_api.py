SURVEY = {"title": "Cafe feedback", "description": "Tell us", "questions": ["How was the service?", "What should we change?"]}


def _create(client, headers):
    return client.post("/api/surveys", json=SURVEY, headers=headers).json()["data"]


def test_owner_endpoints_require_auth(client):
    assert client.get("/api/surveys").status_code == 401


def test_full_flow(client, auth_headers):
    s = _create(client, auth_headers)
    pub = client.get(f"/api/public/surveys/{s['slug']}").json()["data"]
    assert len(pub["questions"]) == 2 and pub["server_transcription"] is False
    q1, q2 = [q["id"] for q in pub["questions"]]
    for a1, a2 in [("The service was great and the staff were helpful", "Nothing, it was perfect"),
                   ("Slow service and the coffee was cold", "Faster service please, the queue is terrible")]:
        r = client.post(f"/api/public/surveys/{s['slug']}/responses", json={"answers": [
            {"question_id": q1, "transcript": a1, "input_type": "voice"},
            {"question_id": q2, "transcript": a2, "input_type": "text"}]})
        assert r.status_code == 201
    res = client.get(f"/api/surveys/{s['id']}/results", headers=auth_headers).json()["data"]
    assert res["total_responses"] == 2 and res["total_answers"] == 4 and res["voice_answers"] == 2
    assert res["questions"][0]["sentiment"]["positive"] == 1 and res["questions"][0]["sentiment"]["negative"] == 1
    csv = client.get(f"/api/surveys/{s['id']}/export.csv", headers=auth_headers)
    assert csv.status_code == 200 and "response_id" in csv.text and "Slow service" in csv.text
    listed = client.get("/api/surveys", headers=auth_headers).json()["data"]
    assert listed[0]["response_count"] == 2


def test_validation_and_closed(client, auth_headers):
    s = _create(client, auth_headers)
    q1 = client.get(f"/api/public/surveys/{s['slug']}").json()["data"]["questions"][0]["id"]
    url = f"/api/public/surveys/{s['slug']}/responses"
    assert client.post(url, json={"answers": [{"question_id": 99999, "transcript": "x", "input_type": "text"}]}).status_code == 422
    assert client.post(url, json={"answers": [{"question_id": q1, "transcript": "", "input_type": "text"}]}).status_code == 422
    assert client.post(url, json={"answers": [{"question_id": q1, "transcript": "ok", "input_type": "robot"}]}).status_code == 422
    client.patch(f"/api/surveys/{s['id']}", json={"is_open": False}, headers=auth_headers)
    assert client.get(f"/api/public/surveys/{s['slug']}").status_code == 403


def test_other_user_cannot_see_results(client, auth_headers):
    s = _create(client, auth_headers)
    r = client.post("/api/auth/register", json={"name": "B", "email": "b@example.com", "password": "password123"})
    h = {"Authorization": f"Bearer {r.json()['data']['token']}"}
    assert client.get(f"/api/surveys/{s['id']}/results", headers=h).status_code == 404
    assert client.delete(f"/api/surveys/{s['id']}", headers=h).status_code == 404


def test_rate_limit_on_submit(client, auth_headers):
    s = _create(client, auth_headers)
    q1 = client.get(f"/api/public/surveys/{s['slug']}").json()["data"]["questions"][0]["id"]
    codes = [client.post(f"/api/public/surveys/{s['slug']}/responses",
                         json={"answers": [{"question_id": q1, "transcript": "fine", "input_type": "text"}]}).status_code for _ in range(22)]
    assert codes.count(429) == 2


def test_csv_formula_injection_is_neutralised(client, auth_headers):
    s = _create(client, auth_headers)
    q1 = client.get(f"/api/public/surveys/{s['slug']}").json()["data"]["questions"][0]["id"]
    client.post(f"/api/public/surveys/{s['slug']}/responses",
                json={"answers": [{"question_id": q1, "transcript": "=HYPERLINK(\"http://x\")", "input_type": "text"}]})
    assert "'=HYPERLINK" in client.get(f"/api/surveys/{s['id']}/export.csv", headers=auth_headers).text
