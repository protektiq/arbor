//! Parse assorted datetime strings and normalize to ISO 8601 UTC (`Z`).

use chrono::{DateTime, NaiveDate, NaiveDateTime, Utc};
use std::sync::OnceLock;

/// Ordered list of parse attempts (first success wins).
pub fn parse_to_rfc3339_utc(input: &str) -> Option<String> {
    let s = input.trim();
    if s.is_empty() {
        return None;
    }

    if let Ok(dt) = DateTime::parse_from_rfc3339(s) {
        return Some(dt.with_timezone(&Utc).to_rfc3339_opts(chrono::SecondsFormat::Secs, true));
    }

    // Explicit UTC / offset forms
    const RFC3339_LIKE: &[&str] = &[
        "%Y-%m-%dT%H:%M:%S%.fZ",
        "%Y-%m-%dT%H:%M:%S%.f%:z",
        "%Y-%m-%dT%H:%M:%S%:z",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
    ];
    for fmt in RFC3339_LIKE {
        if let Ok(naive) = NaiveDateTime::parse_from_str(s, fmt) {
            return Some(DateTime::<Utc>::from_naive_utc_and_offset(naive, Utc).to_rfc3339_opts(
                chrono::SecondsFormat::Secs,
                true,
            ));
        }
    }

    // US-style with optional seconds
    const US: &[&str] = &[
        "%m/%d/%Y %I:%M %p",
        "%m/%d/%Y %I:%M:%S %p",
        "%m/%d/%Y %H:%M",
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%y %I:%M %p",
    ];
    for fmt in US {
        if let Ok(naive) = NaiveDateTime::parse_from_str(s, fmt) {
            return Some(DateTime::<Utc>::from_naive_utc_and_offset(naive, Utc).to_rfc3339_opts(
                chrono::SecondsFormat::Secs,
                true,
            ));
        }
    }

    // Long-form month names
    const VERBOSE: &[&str] = &[
        "%B %d, %Y %I:%M %p",
        "%b %d, %Y %I:%M %p",
        "%A, %B %d, %Y at %I:%M %p",
        "%A, %b %d, %Y at %I:%M %p",
        "%B %d, %Y %H:%M",
    ];
    for fmt in VERBOSE {
        if let Ok(naive) = NaiveDateTime::parse_from_str(s, fmt) {
            return Some(DateTime::<Utc>::from_naive_utc_and_offset(naive, Utc).to_rfc3339_opts(
                chrono::SecondsFormat::Secs,
                true,
            ));
        }
    }

    // Date-only → midnight UTC
    if let Ok(d) = NaiveDate::parse_from_str(s, "%Y-%m-%d") {
        let naive = d.and_hms_opt(0, 0, 0)?;
        return Some(DateTime::<Utc>::from_naive_utc_and_offset(naive, Utc).to_rfc3339_opts(
            chrono::SecondsFormat::Secs,
            true,
        ));
    }

    None
}

static TP_COMBINED: OnceLock<regex::Regex> = OnceLock::new();

/// TalkingParents-style single line: `MM/DD/YYYY HH:MM AM | Sender Name`
pub fn parse_talkingparents_combined_line(line: &str) -> Option<(String, String)> {
    let re = TP_COMBINED.get_or_init(|| {
        regex::Regex::new(
            r"(?i)^(?P<dt>\d{1,2}/\d{1,2}/\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)\s*[\|\t\-–—]+\s*(?P<sender>.+)$",
        )
        .expect("tp combined regex")
    });
    let caps = re.captures(line.trim())?;
    let dt_raw = caps.name("dt")?.as_str();
    let sender = caps.name("sender")?.as_str().trim().to_string();
    let iso = parse_to_rfc3339_utc(dt_raw)?;
    Some((iso, sender))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_rfc3339_utc() {
        let o = parse_to_rfc3339_utc("2024-03-15T18:30:00Z").unwrap();
        assert_eq!(o, "2024-03-15T18:30:00Z");
    }

    #[test]
    fn parses_us_slash_am_pm() {
        let o = parse_to_rfc3339_utc("03/15/2024 6:30 PM").unwrap();
        assert!(o.starts_with("2024-03-15T"));
    }

    #[test]
    fn parses_bracketless_sql_like() {
        let o = parse_to_rfc3339_utc("2024-03-15 14:00:00").unwrap();
        assert!(o.contains("2024-03-15"));
    }

    #[test]
    fn talkingparents_combined_line() {
        let (iso, sender) =
            parse_talkingparents_combined_line("01/02/2024 9:05 AM | Jane Smith").unwrap();
        assert_eq!(sender, "Jane Smith");
        assert!(iso.starts_with("2024-01-02"));
    }
}
