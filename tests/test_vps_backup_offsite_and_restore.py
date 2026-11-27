"""Tests for VPS encrypted offsite backup script and isolated restore drill guards."""

import gzip
import hashlib
import os
from pathlib import Path
import shutil
import subprocess

import pytest
from scripts.backup_crypto import decrypt_file, encrypt_file, generate_key_file, verify_file

ROOT = Path(__file__).resolve().parent.parent


def _find_git_bash() -> str | None:
    for candidate in (
        r"C:\Program Files\Git\bin\bash.exe",
        r"C:\Program Files\Git\usr\bin\bash.exe",
        shutil.which("bash"),
    ):
        if candidate and os.path.exists(candidate) and "System32\\bash.exe" not in candidate:
            return candidate
    return None


def test_vps_backup_and_restore_scripts_syntax_and_guards():
    backup_sh = ROOT / "scripts" / "vps_daily_backup.sh"
    restore_sh = ROOT / "scripts" / "vps_restore_verify.sh"

    backup_text = backup_sh.read_text(encoding="utf-8")
    restore_text = restore_sh.read_text(encoding="utf-8")

    assert "backup_crypto.py" in backup_text
    assert "sendDocument" in backup_text
    assert "MIN_RETAINED_BACKUPS" in backup_text

    assert 'ALLOWED_TEST_DB="aisales_restore_drill"' in restore_text
    assert 'TARGET_TEST_DB}" == "aisales"' in restore_text
    assert "ON_ERROR_STOP=1" in restore_text

    bash = _find_git_bash()
    if bash:
        for script in (backup_sh, restore_sh):
            res = subprocess.run([bash, "-n", str(script)], capture_output=True, text=True)
            assert res.returncode == 0, f"{script.name} syntax error: {res.stderr}"

        # Safety guard: passing production DB 'aisales' must abort immediately before docker exec
        guard_res = subprocess.run(
            [bash, str(restore_sh), "--test-db", "aisales"],
            capture_output=True,
            text=True,
        )
        assert guard_res.returncode != 0
        assert "forbidden" in (guard_res.stderr + guard_res.stdout).lower()


def test_aes256_gcm_gzip_backup_roundtrip_and_tamper_detection(tmp_path):
    key_file = tmp_path / "backup.key"
    generate_key_file(str(key_file))

    gz_in = tmp_path / "aisales_db_test.sql.gz"
    sample_sql = b"-- PostgreSQL database dump\nCREATE TABLE organizations(id INT);\n"
    with gzip.open(gz_in, "wb") as fh:
        fh.write(sample_sql)

    enc_path = tmp_path / "aisales_db_test.sql.gz.enc"
    encrypt_file(str(key_file), str(gz_in), str(enc_path))
    assert verify_file(str(key_file), str(enc_path)) is True

    expected_sha = hashlib.sha256(enc_path.read_bytes()).hexdigest()
    assert len(expected_sha) == 64

    # Decrypt and verify SQL payload
    gz_out = tmp_path / "restored.sql.gz"
    decrypt_file(str(key_file), str(enc_path), str(gz_out))
    with gzip.open(gz_out, "rb") as fh:
        assert fh.read() == sample_sql

    # Tampered ciphertext must fail authentication tag check cleanly
    tampered = bytearray(enc_path.read_bytes())
    tampered[-1] ^= 0xFF
    enc_tampered = tmp_path / "tampered.sql.gz.enc"
    enc_tampered.write_bytes(bytes(tampered))

    from cryptography.exceptions import InvalidTag
    with pytest.raises(InvalidTag):
        verify_file(str(key_file), str(enc_tampered))
