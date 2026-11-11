"""HTTP client for the story-audio-worker edge function."""
from __future__ import annotations

import base64
import hashlib


class WorkerHTTPError(RuntimeError):
    pass


class WorkerClient:
    def __init__(self, url: str, token: str, worker_id: str, session=None):
        if not url or not token:
            raise ValueError("Worker URL and token are required.")
        if session is None:
            import requests

            session = requests
        self.url, self.token, self.worker_id, self._http = url, token, worker_id, session

    def post(self, payload: dict, timeout: int = 180) -> dict:
        response = self._http.post(
            self.url,
            headers={"Content-Type": "application/json", "x-khaledoon-worker-token": self.token},
            json=payload,
            timeout=timeout,
        )
        try:
            data = response.json()
        except Exception:
            data = {"error": getattr(response, "text", "")[:1000]}
        if not response.ok:
            raise WorkerHTTPError(f"Worker HTTP {response.status_code}: {data}")
        return data

    def claim(self, lease_seconds: int = 900):
        data = self.post({"action": "claim", "worker_id": self.worker_id, "lease_seconds": lease_seconds}, timeout=60)
        return data.get("job")

    def heartbeat(self, job: dict) -> None:
        self.post(
            {"action": "heartbeat", "job_id": job["id"], "lock_token": job["lock_token"], "worker_id": self.worker_id},
            timeout=30,
        )

    def complete(self, job: dict, mp3_bytes: bytes) -> dict:
        return self.post(
            {
                "action": "complete",
                "job_id": job["id"],
                "lock_token": job["lock_token"],
                "extension": "mp3",
                "content_type": "audio/mpeg",
                "audio_base64": base64.b64encode(mp3_bytes).decode("ascii"),
                "sha256": hashlib.sha256(mp3_bytes).hexdigest(),
            },
            timeout=240,
        )

    def fail(self, job: dict, error: str) -> None:
        self.post(
            {"action": "fail", "job_id": job["id"], "lock_token": job["lock_token"], "error": str(error)[:1800]},
            timeout=30,
        )
