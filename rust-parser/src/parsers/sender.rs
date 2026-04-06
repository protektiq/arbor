//! Map export display names to `SenderRole` using attorney-provided identifiers.

use crate::types::SenderRole;

/// Strip common co-parenting export prefixes (case-insensitive).
pub fn clean_sender_label(raw: &str) -> &str {
    let s = raw.trim();
    let lower = s.to_ascii_lowercase();
    const PREFIXES: [&str; 4] = ["from:", "to:", "sent by:", "sender:"];
    for p in PREFIXES {
        if lower.starts_with(p) {
            return s[p.len()..].trim();
        }
    }
    s
}

fn norm(s: &str) -> String {
    clean_sender_label(s).to_lowercase()
}

pub fn map_sender_role(raw: &str, parent_a: &str, parent_b: &str) -> SenderRole {
    let r = norm(raw);
    if r.is_empty() {
        return SenderRole::Unknown;
    }
    if r == norm(parent_a) {
        return SenderRole::ParentA;
    }
    if r == norm(parent_b) {
        return SenderRole::ParentB;
    }
    SenderRole::Unknown
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_parent_identifiers_case_insensitive() {
        assert_eq!(
            map_sender_role("John Smith", "john smith", "Jane Smith"),
            SenderRole::ParentA
        );
        assert_eq!(
            map_sender_role("Jane Smith", "John Smith", "jane smith"),
            SenderRole::ParentB
        );
    }

    #[test]
    fn from_prefix_stripped() {
        assert_eq!(
            map_sender_role("From: John Smith", "John Smith", "Jane Smith"),
            SenderRole::ParentA
        );
    }

    #[test]
    fn unknown_when_no_match() {
        assert_eq!(
            map_sender_role("Someone Else", "John Smith", "Jane Smith"),
            SenderRole::Unknown
        );
    }
}
