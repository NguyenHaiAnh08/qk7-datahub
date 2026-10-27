"""
test_qdrant_safety.py — Kiểm tra self-healing Qdrant KHÔNG phá dữ liệu.
"""
import os
import shutil
import pytest
import threading
import time
from pathlib import Path


def test_lock_not_removed_when_other_process_active(tmp_path, monkeypatch):
    """Giả lập: có process khác đang chạy → KHÔNG xóa lock."""
    storage = tmp_path / "qdrant_test"
    storage.mkdir()
    lock_file = storage / ".lock"
    lock_file.write_text("fake_lock_content")

    # Mock subprocess.run trả về PID giả (giả lập có process khác)
    import subprocess
    original_run = subprocess.run

    def mock_run(*args, **kwargs):
        class MockResult:
            stdout = "12345"  # fake PID
            stderr = ""
            returncode = 0
        return MockResult()

    monkeypatch.setattr(subprocess, "run", mock_run)

    # Gọi init → phải raise hoặc không xóa lock
    from core.vector_store import HybridVectorStore
    store = HybridVectorStore(storage_path=str(storage))

    # Assert: lock file PHẢI CÒN (không bị xóa)
    assert lock_file.exists(), "Lock file bị xóa NHẦM khi có process khác!"
    assert lock_file.read_text() == "fake_lock_content", "Nội dung lock bị thay đổi khi có process khác!"
    assert not store.stale_lock_cleaned, "stale_lock_cleaned không được là True khi có process khác!"
    assert store.qdrant_client is None, "Qdrant không được init khi có process khác"


def test_lock_removed_when_no_other_process(tmp_path, monkeypatch):
    """Giả lập: KHÔNG có process khác → được phép xóa lock và khởi động bình thường."""
    storage = tmp_path / "qdrant_test"
    storage.mkdir()
    lock_file = storage / ".lock"
    lock_file.write_text("stale_lock")

    import subprocess

    def mock_run(*args, **kwargs):
        class MockResult:
            stdout = ""  # không có PID
            stderr = ""
            returncode = 0
        return MockResult()

    monkeypatch.setattr(subprocess, "run", mock_run)

    from core.vector_store import HybridVectorStore
    store = HybridVectorStore(storage_path=str(storage))

    # Assert: stale lock đã bị xóa và Qdrant init thành công
    assert store.stale_lock_cleaned is True, "Stale lock phải được xóa khi không có process khác!"
    assert store.qdrant_client is not None, "Qdrant phải init được sau khi xóa lock tồn dư"

    # Đóng qdrant client để giải phóng lock descriptor trên Windows trước khi đọc file
    if hasattr(store.qdrant_client, "close"):
        store.qdrant_client.close()

    assert lock_file.read_text() != "stale_lock", "Nội dung stale lock ban đầu phải đã bị xóa!"


