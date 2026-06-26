"""Self-signed TLS materials for the local lab stack (dev.py only)."""

from __future__ import annotations

import datetime
import ipaddress
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

ROOT = Path(__file__).resolve().parent
CERT_DIR = ROOT / ".dev" / "certs"
CERT_FILE = CERT_DIR / "lab.crt"
KEY_FILE = CERT_DIR / "lab.key"


def ensure_lab_certs() -> tuple[Path, Path]:
    """Create or return lab TLS cert + key (localhost / 127.0.0.1)."""
    CERT_DIR.mkdir(parents=True, exist_ok=True)
    if CERT_FILE.is_file() and KEY_FILE.is_file():
        return CERT_FILE, KEY_FILE

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = issuer = x509.Name(
        [
            x509.NameAttribute(NameOID.COUNTRY_NAME, "CO"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Aligo Lab"),
            x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
        ]
    )
    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now)
        .not_valid_after(now + datetime.timedelta(days=825))
        .add_extension(
            x509.SubjectAlternativeName(
                [
                    x509.DNSName("localhost"),
                    x509.DNSName("127.0.0.1"),
                    x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
                ]
            ),
            critical=False,
        )
        .sign(key, hashes.SHA256())
    )

    KEY_FILE.write_bytes(
        key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )
    CERT_FILE.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    return CERT_FILE, KEY_FILE
