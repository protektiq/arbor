//! Stable SHA-256 fingerprint for deduplication: UTF-8 bytes of `sent_at` immediately followed by `body_text` (no separator).

use hex;
use sha2::{Digest, Sha256};

/// Hex-encoded SHA-256 over the exact UTF-8 concatenation `sent_at + body_text`.
pub fn message_raw_hash(sent_at: &str, body_text: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(sent_at.as_bytes());
    hasher.update(body_text.as_bytes());
    hex::encode(hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn message_raw_hash_known_vector() {
        let sent_at = "2024-06-01T12:00:00Z";
        let body = "Hello from parent A.";
        let got = message_raw_hash(sent_at, body);
        assert_eq!(
            got,
            "96fe7069702a5a59ea44e5c244469ba4fa64d4e9a70c0d6b7fd97a052d455451"
        );
    }
}
