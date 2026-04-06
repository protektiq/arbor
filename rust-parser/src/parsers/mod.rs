//! Format-specific parsers: PDF text is extracted upstream; these functions scan plain text.

mod dates;
mod sender;

pub use dates::parse_to_rfc3339_utc;
pub use sender::{clean_sender_label, map_sender_role};

use crate::hash::message_raw_hash;
use crate::types::{MessageRecord, PlatformSource};
use regex::Regex;
use std::sync::OnceLock;

/// OurFamilyWizard-style export: a line that parses as a full datetime, then sender, then body until the next datetime line.
pub fn parse_ofw_pdf_text(
    text: &str,
    parent_a: &str,
    parent_b: &str,
) -> (Vec<MessageRecord>, Vec<String>) {
    scan_stacked_messages(text, parent_a, parent_b, PlatformSource::OurFamilyWizard)
}

/// TalkingParents-style export: same stacked layout, plus optional `date | sender` combined header lines.
pub fn parse_talkingparents_pdf_text(
    text: &str,
    parent_a: &str,
    parent_b: &str,
) -> (Vec<MessageRecord>, Vec<String>) {
    scan_stacked_messages(text, parent_a, parent_b, PlatformSource::TalkingParents)
}

fn line_starts_new_message(line: &str, platform: PlatformSource) -> Option<MessageStart> {
    let t = line.trim();
    if t.is_empty() {
        return None;
    }
    if let Some(iso) = dates::parse_to_rfc3339_utc(t) {
        return Some(MessageStart::DateTimeLine(iso));
    }
    if platform == PlatformSource::TalkingParents {
        if let Some((iso, sender)) = dates::parse_talkingparents_combined_line(t) {
            return Some(MessageStart::Combined { iso, sender });
        }
    }
    None
}

enum MessageStart {
    DateTimeLine(String),
    Combined { iso: String, sender: String },
}

fn scan_stacked_messages(
    text: &str,
    parent_a: &str,
    parent_b: &str,
    platform: PlatformSource,
) -> (Vec<MessageRecord>, Vec<String>) {
    let lines: Vec<&str> = text.lines().collect();
    let mut i = 0usize;
    let mut records = Vec::new();
    let mut errors = Vec::new();

    while i < lines.len() {
        while i < lines.len() && lines[i].trim().is_empty() {
            i += 1;
        }
        if i >= lines.len() {
            break;
        }

        let Some(start) = line_starts_new_message(lines[i], platform) else {
            i += 1;
            continue;
        };

        let (iso, sender_line) = match start {
            MessageStart::DateTimeLine(iso) => {
                i += 1;
                while i < lines.len() && lines[i].trim().is_empty() {
                    i += 1;
                }
                if i >= lines.len() {
                    errors.push(format!("incomplete message after timestamp {iso}: missing sender"));
                    break;
                }
                let sender = lines[i].trim().to_string();
                i += 1;
                (iso, sender)
            }
            MessageStart::Combined { iso, sender } => {
                i += 1;
                (iso, sender)
            }
        };

        let mut body_lines: Vec<String> = Vec::new();
        while i < lines.len() {
            let raw = lines[i];
            if line_starts_new_message(raw, platform).is_some() {
                break;
            }
            body_lines.push(raw.to_string());
            i += 1;
        }

        let body = body_lines.join("\n").trim().to_string();
        let role = sender::map_sender_role(&sender_line, parent_a, parent_b);
        let hash = message_raw_hash(&iso, &body);
        records.push(MessageRecord {
            sent_at: iso,
            sender_role: role,
            body_text: body,
            platform_source: platform,
            raw_hash: hash,
        });
    }

    (records, errors)
}

static GENERIC_LINE: OnceLock<Regex> = OnceLock::new();

/// Plain text lines: `[DATETIME] SENDER_NAME: body`
pub fn parse_generic_text(
    text: &str,
    parent_a: &str,
    parent_b: &str,
) -> (Vec<MessageRecord>, Vec<String>) {
    let re = GENERIC_LINE.get_or_init(|| {
        Regex::new(r"^\[(?P<dt>[^\]]+)\]\s*(?P<sender>[^:]+):\s*(?P<body>.*)$")
            .expect("generic line regex")
    });

    let mut records = Vec::new();
    let mut errors = Vec::new();

    for line in text.lines() {
        let t = line.trim();
        if t.is_empty() {
            continue;
        }
        let Some(caps) = re.captures(t) else {
            continue;
        };
        let dt_raw = caps.name("dt").map(|m| m.as_str().trim()).unwrap_or("");
        let sender_raw = caps.name("sender").map(|m| m.as_str().trim()).unwrap_or("");
        let body = caps.name("body").map(|m| m.as_str().to_string()).unwrap_or_default();

        let Some(iso) = dates::parse_to_rfc3339_utc(dt_raw) else {
            errors.push(format!("generic_text: could not parse datetime in brackets: {dt_raw}"));
            continue;
        };

        let role = sender::map_sender_role(sender_raw, parent_a, parent_b);
        let hash = message_raw_hash(&iso, &body);
        records.push(MessageRecord {
            sent_at: iso,
            sender_role: role,
            body_text: body,
            platform_source: PlatformSource::Generic,
            raw_hash: hash,
        });
    }

    (records, errors)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::SenderRole;

    #[test]
    fn ofw_style_blocks_from_plain_text() {
        let text = "2024-01-10T15:00:00Z\nJohn Smith\nHello there\n\n2024-01-11T16:00:00Z\nJane Smith\nReply text";
        let (recs, errs) = parse_ofw_pdf_text(text, "John Smith", "Jane Smith");
        assert!(errs.is_empty(), "{errs:?}");
        assert_eq!(recs.len(), 2);
        assert_eq!(recs[0].sender_role, SenderRole::ParentA);
        assert_eq!(recs[0].body_text, "Hello there");
        assert_eq!(recs[1].sender_role, SenderRole::ParentB);
    }

    #[test]
    fn talkingparents_combined_header() {
        let text = "01/02/2024 9:05 AM | Jane Smith\nTP body line\n\n03/04/2024 10:00 AM | John Smith\nSecond";
        let (recs, errs) = parse_talkingparents_pdf_text(text, "John Smith", "Jane Smith");
        assert!(errs.is_empty(), "{errs:?}");
        assert_eq!(recs.len(), 2);
        assert_eq!(recs[0].sender_role, SenderRole::ParentB);
        assert_eq!(recs[0].body_text, "TP body line");
    }

    #[test]
    fn generic_bracket_line() {
        let text = "[2024-05-01 12:00:00] John Smith: Hi\n[2024-05-02 12:00:00] Jane Smith: Ok";
        let (recs, errs) = parse_generic_text(text, "John Smith", "Jane Smith");
        assert!(errs.is_empty(), "{errs:?}");
        assert_eq!(recs.len(), 2);
    }
}
