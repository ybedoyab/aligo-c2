"""Tests for canonical JSON serialization and SHA-256 hashing."""

from __future__ import annotations

from app.core.hashing import canonical_json, hash_payload, sha256_hex


def test_canonical_json_sorts_keys_and_strips_whitespace():
    assert canonical_json({"b": 1, "a": 2}) == '{"a":2,"b":1}'


def test_canonical_json_is_order_independent():
    a = canonical_json({"x": 1, "y": {"b": 2, "a": 1}})
    b = canonical_json({"y": {"a": 1, "b": 2}, "x": 1})
    assert a == b


def test_hash_payload_is_deterministic_regardless_of_insertion_order():
    assert hash_payload({"a": 1, "b": 2}) == hash_payload({"b": 2, "a": 1})


def test_hash_changes_when_data_changes():
    assert hash_payload({"a": 1}) != hash_payload({"a": 2})


def test_sha256_hex_known_value_for_empty_string():
    assert (
        sha256_hex("")
        == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    )
