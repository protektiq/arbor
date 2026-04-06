//! Orchestrates base64 decode, limits, and format dispatch.

use base64::Engine;

use crate::parsers;
use crate::pdf_text;
use crate::types::{FileFormat, ParseRequest, ParseResponse};

/// Decoded payload must not exceed this size (abuse / memory guard).
pub const MAX_DECODED_BYTES: usize = 50 * 1024 * 1024;

/// Parent display names from the request body.
pub const MAX_IDENTIFIER_LEN: usize = 256;

#[derive(Debug)]
pub enum ServiceReject {
    BadRequest(String),
}

pub fn validate_parse_request(req: &ParseRequest) -> Result<(), ServiceReject> {
    if req.parent_a_identifier.len() > MAX_IDENTIFIER_LEN
        || req.parent_b_identifier.len() > MAX_IDENTIFIER_LEN
    {
        return Err(ServiceReject::BadRequest(
            "parent_a_identifier or parent_b_identifier exceeds maximum length".into(),
        ));
    }
    let max_b64 = MAX_DECODED_BYTES.saturating_mul(4).saturating_div(3).saturating_add(1024);
    if req.file_content_base64.len() > max_b64 {
        return Err(ServiceReject::BadRequest(
            "file_content_base64 exceeds maximum encoded length".into(),
        ));
    }
    Ok(())
}

fn platform_detected_string(format: FileFormat) -> String {
    match format {
        FileFormat::OfwPdf => "ourfamilywizard",
        FileFormat::TalkingParentsPdf => "talkingparents",
        FileFormat::GenericText => "generic",
    }
    .to_string()
}

/// Decode and parse according to `file_format`. PDF load/extract failures return `parse_errors` (HTTP 200), not `Err`.
pub fn parse_document(req: &ParseRequest) -> Result<ParseResponse, ServiceReject> {
    validate_parse_request(req)?;

    let decoded = base64::engine::general_purpose::STANDARD
        .decode(req.file_content_base64.trim())
        .map_err(|e| ServiceReject::BadRequest(format!("invalid base64: {e}")))?;

    if decoded.len() > MAX_DECODED_BYTES {
        return Err(ServiceReject::BadRequest(
            "decoded file exceeds maximum size".into(),
        ));
    }

    let platform_detected = platform_detected_string(req.file_format);
    let parent_a = req.parent_a_identifier.trim();
    let parent_b = req.parent_b_identifier.trim();

    if decoded.is_empty() {
        return Ok(ParseResponse {
            records: vec![],
            total_count: 0,
            parse_errors: vec![],
            platform_detected,
        });
    }

    let response = match req.file_format {
        FileFormat::OfwPdf => match pdf_text::extract_pdf_text(&decoded) {
            Ok(text) => {
                let (records, parse_errors) = parsers::parse_ofw_pdf_text(&text, parent_a, parent_b);
                let total_count = records.len();
                ParseResponse {
                    records,
                    total_count,
                    parse_errors,
                    platform_detected,
                }
            }
            Err(e) => ParseResponse {
                records: vec![],
                total_count: 0,
                parse_errors: vec![e],
                platform_detected,
            },
        },
        FileFormat::TalkingParentsPdf => match pdf_text::extract_pdf_text(&decoded) {
            Ok(text) => {
                let (records, parse_errors) =
                    parsers::parse_talkingparents_pdf_text(&text, parent_a, parent_b);
                let total_count = records.len();
                ParseResponse {
                    records,
                    total_count,
                    parse_errors,
                    platform_detected,
                }
            }
            Err(e) => ParseResponse {
                records: vec![],
                total_count: 0,
                parse_errors: vec![e],
                platform_detected,
            },
        },
        FileFormat::GenericText => {
            let text = String::from_utf8(decoded).map_err(|e| {
                ServiceReject::BadRequest(format!("generic_text requires valid UTF-8: {e}"))
            })?;
            let (records, parse_errors) = parsers::parse_generic_text(&text, parent_a, parent_b);
            let total_count = records.len();
            ParseResponse {
                records,
                total_count,
                parse_errors,
                platform_detected,
            }
        }
    };

    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine;
    use crate::types::FileFormat;

    fn req(
        format: FileFormat,
        bytes: &[u8],
        parent_a: &str,
        parent_b: &str,
    ) -> ParseRequest {
        ParseRequest {
            file_content_base64: base64::engine::general_purpose::STANDARD.encode(bytes),
            file_format: format,
            parent_a_identifier: parent_a.to_string(),
            parent_b_identifier: parent_b.to_string(),
        }
    }

    #[test]
    fn empty_payload_returns_empty_without_errors() {
        let r = parse_document(&req(
            FileFormat::OfwPdf,
            b"",
            "John Smith",
            "Jane Smith",
        ))
        .unwrap();
        assert!(r.records.is_empty());
        assert_eq!(r.total_count, 0);
        assert!(r.parse_errors.is_empty());
        assert_eq!(r.platform_detected, "ourfamilywizard");
    }

    #[test]
    fn malformed_pdf_yields_parse_error_not_panic() {
        let junk = [0xFF, 0xD8, 0xFF, 0x00, 0x25, 0x50, 0x44, 0x46];
        let r = parse_document(&req(
            FileFormat::OfwPdf,
            &junk,
            "A",
            "B",
        ))
        .unwrap();
        assert!(r.records.is_empty());
        assert!(!r.parse_errors.is_empty());
    }

    #[test]
    fn invalid_base64_is_rejected() {
        let bad = ParseRequest {
            file_content_base64: "@@@not-base64@@@".into(),
            file_format: FileFormat::GenericText,
            parent_a_identifier: "A".into(),
            parent_b_identifier: "B".into(),
        };
        assert!(parse_document(&bad).is_err());
    }
}
