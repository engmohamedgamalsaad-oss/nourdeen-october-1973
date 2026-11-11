"""Queue worker: executes generation jobs that the Preview page enqueued.

The worker never decides what to generate and never creates jobs. It only
claims what is already in the queue, one job at a time, and uploads the result
to the private review bucket. Approval stays in the Preview page.
"""
from __future__ import annotations

import threading
import time
from typing import Callable, Optional

from .audio import encode_mp3
from .providers import ProviderError, ProviderRegistry

HEARTBEAT_SECONDS = 90


def _stem(job: dict) -> str:
    return f"/content/{job['section']}-{job['slug']}-{job['language']}-{int(job['block_index']):04d}-{job['speaker']}"


def process_job(job: dict, model, registry: ProviderRegistry, client, encoder: Callable = encode_mp3) -> dict:
    """Generate and upload one claimed job. Releases the job via ``fail`` on any error."""
    try:
        provider = registry.get(job.get("speaker"))
        payload = job.get("payload") or {}
        audio, sample_rate = provider.generate(model, str(payload.get("text") or ""), job.get("language"))
        mp3 = encoder(audio, sample_rate, _stem(job))
        return client.complete(job, mp3)
    except Exception as error:  # noqa: BLE001 - every failure must release the lease
        try:
            client.fail(job, f"{type(error).__name__}: {error}")
        except Exception as fail_error:  # noqa: BLE001
            print("Could not release failed job:", fail_error)
        raise


def _heartbeat_loop(client, job, stop: threading.Event, interval: float) -> None:
    while not stop.wait(interval):
        try:
            client.heartbeat(job)
        except Exception as error:  # noqa: BLE001
            print("Heartbeat warning:", error)


def run_worker(
    client,
    model,
    registry: ProviderRegistry,
    *,
    poll_seconds: float = 20,
    idle_exit_seconds: Optional[float] = None,
    max_jobs: Optional[int] = None,
    stop_event: Optional[threading.Event] = None,
    encoder: Callable = encode_mp3,
    sleep: Callable[[float], None] = time.sleep,
    heartbeat_seconds: float = HEARTBEAT_SECONDS,
) -> int:
    """Poll the queue until stopped, idle for too long, or ``max_jobs`` is reached. Returns jobs done."""
    stop_event = stop_event or threading.Event()
    done = 0
    idle_since = time.monotonic()
    print("OmniVoice worker started:", client.worker_id)
    while not stop_event.is_set() and (max_jobs is None or done < max_jobs):
        job = client.claim()
        if not job:
            if idle_exit_seconds is not None and time.monotonic() - idle_since >= idle_exit_seconds:
                print("Idle limit reached; worker stopping.")
                break
            sleep(poll_seconds)
            continue
        idle_since = time.monotonic()
        lease_stop = threading.Event()
        beat = threading.Thread(target=_heartbeat_loop, args=(client, job, lease_stop, heartbeat_seconds), daemon=True)
        beat.start()
        try:
            print("Claimed:", job["id"], job["section"], job["slug"], job["language"], job["block_index"], job["speaker"])
            result = process_job(job, model, registry, client, encoder)
            print("Uploaded for review:", result.get("job_id"), result.get("status"))
        except ProviderError as error:
            print("Job released (provider):", error)
        except Exception as error:  # noqa: BLE001
            print("Job released (error):", repr(error))
        else:
            done += 1
        finally:
            lease_stop.set()
            beat.join(timeout=2)
    print("OmniVoice worker stopped. Completed:", done)
    return done
