import hashlib
import os
import sys
import tempfile
import unittest

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

from omnivoice_engine import (  # noqa: E402
    KARMA_SETTINGS,
    NARRATOR_SETTINGS,
    KarmaProvider,
    NarratorProvider,
    ProviderError,
    ProviderRegistry,
    WorkerClient,
    process_job,
    run_worker,
)
from omnivoice_engine.config import KARMA_REF_TEXT_SHA256  # noqa: E402

KARMA_TEXT = "أنا كارما، ولما سمعت حكاية الدكتور مجدي يعقوب، فكرت في حاجة مهمة: إزاي طفل بيحب يساعد الناس ممكن يكبر ويبقى طبيبًا ينقذ حياة أطفال كتير؟"


class FakeModel:
    def __init__(self):
        self.calls = []

    def generate(self, **kwargs):
        self.calls.append(kwargs)
        return [np.full(2400, 0.1, dtype=np.float32)]


class FakeClient:
    worker_id = "test-worker"

    def __init__(self, jobs=()):
        self.jobs = list(jobs)
        self.completed, self.failed, self.beats = [], [], 0

    def claim(self):
        return self.jobs.pop(0) if self.jobs else None

    def heartbeat(self, job):
        self.beats += 1

    def complete(self, job, mp3):
        self.completed.append((job["id"], mp3))
        return {"job_id": job["id"], "status": "completed"}

    def fail(self, job, error):
        self.failed.append((job["id"], error))


def make_job(speaker="karma", language="ar", slug="ibn-sina", text="جملة تجريبية"):
    return {
        "id": "11111111-1111-4111-8111-111111111111",
        "lock_token": "22222222-2222-4222-8222-222222222222",
        "section": "history",
        "slug": slug,
        "language": language,
        "block_index": 3,
        "speaker": speaker,
        "payload": {"text": text},
    }


def fake_convert(src, dst):
    return dst


class EngineTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.ref = os.path.join(self.tmp.name, "ref.mp3")
        with open(self.ref, "wb") as handle:
            handle.write(b"x")

    def karma(self):
        return KarmaProvider(self.ref, KARMA_TEXT, workdir=self.tmp.name, converter=fake_convert)

    def narrator(self):
        return NarratorProvider(self.ref, "نص مرجع الراوي", workdir=self.tmp.name, converter=fake_convert)

    def test_locked_karma_text_matches_hash(self):
        self.assertEqual(hashlib.sha256(KARMA_TEXT.encode("utf-8")).hexdigest(), KARMA_REF_TEXT_SHA256)

    def test_karma_rejects_changed_reference_text(self):
        with self.assertRaises(ProviderError):
            KarmaProvider(self.ref, KARMA_TEXT[:-1], workdir=self.tmp.name, converter=fake_convert)

    def test_karma_uses_listen_test_settings(self):
        model = FakeModel()
        self.karma().generate(model, "مرحبا", "ar")
        call = model.calls[0]
        self.assertEqual(call["language"], "arz")
        self.assertEqual((call["num_step"], call["guidance_scale"], call["speed"]), (36, 3.0, 0.97))
        self.assertEqual(call["ref_text"], KARMA_TEXT)
        self.assertTrue(call["ref_audio"].endswith("karma_ref_24k.wav"))

    def test_narrator_is_independent_provider(self):
        model = FakeModel()
        self.narrator().generate(model, "hello", "en")
        call = model.calls[0]
        self.assertEqual(call["language"], "en")
        self.assertEqual((call["num_step"], call["guidance_scale"], call["speed"]), (48, 3.0, 1.05))
        self.assertEqual(call["ref_text"], "نص مرجع الراوي")
        self.assertNotEqual(KARMA_SETTINGS, NARRATOR_SETTINGS)

    def test_process_job_uploads_any_story_not_only_ibn_sina(self):
        registry = ProviderRegistry({"karma": self.karma()})
        client = FakeClient()
        job = make_job(slug="magdi-yacoub")
        result = process_job(job, FakeModel(), registry, client, encoder=lambda a, sr, stem: b"mp3-bytes")
        self.assertEqual(result["status"], "completed")
        self.assertEqual(client.completed, [(job["id"], b"mp3-bytes")])
        self.assertEqual(client.failed, [])

    def test_unknown_speaker_releases_job_without_upload(self):
        registry = ProviderRegistry({"karma": self.karma()})
        client = FakeClient()
        with self.assertRaises(ProviderError):
            process_job(make_job(speaker="narrator"), FakeModel(), registry, client, encoder=lambda *a: b"x")
        self.assertEqual(client.completed, [])
        self.assertEqual(len(client.failed), 1)

    def test_empty_text_and_bad_language_release_job(self):
        registry = ProviderRegistry({"karma": self.karma()})
        for job in (make_job(text="  "), make_job(language="fr")):
            client = FakeClient()
            with self.assertRaises(ProviderError):
                process_job(job, FakeModel(), registry, client, encoder=lambda *a: b"x")
            self.assertEqual(len(client.failed), 1)

    def test_run_worker_processes_queue_one_job_at_a_time_then_idles(self):
        registry = ProviderRegistry({"karma": self.karma(), "narrator": self.narrator()})
        client = FakeClient([make_job("karma"), make_job("narrator", "en")])
        done = run_worker(
            client, FakeModel(), registry,
            idle_exit_seconds=0, sleep=lambda s: None, encoder=lambda *a: b"mp3",
        )
        self.assertEqual(done, 2)
        self.assertEqual(len(client.completed), 2)

    def test_run_worker_survives_failed_job_and_continues(self):
        registry = ProviderRegistry({"karma": self.karma()})
        client = FakeClient([make_job("narrator"), make_job("karma")])
        done = run_worker(
            client, FakeModel(), registry,
            idle_exit_seconds=0, sleep=lambda s: None, encoder=lambda *a: b"mp3",
        )
        self.assertEqual(done, 1)
        self.assertEqual(len(client.failed), 1)

    def test_client_requires_credentials(self):
        with self.assertRaises(ValueError):
            WorkerClient("", "", "w")


if __name__ == "__main__":
    unittest.main()
