//! JSON API types for `/parse` and shared enums.

use serde::{Deserialize, Serialize};

/// Role of the sender relative to the case (mapped from display names).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SenderRole {
    ParentA,
    ParentB,
    Unknown,
}

/// Co-parenting platform the message came from.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PlatformSource {
    #[serde(rename = "ourfamilywizard")]
    OurFamilyWizard,
    #[serde(rename = "talkingparents")]
    TalkingParents,
    #[serde(rename = "generic")]
    Generic,
}

/// Requested export format (selects parser). JSON names match the API contract exactly.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FileFormat {
    #[serde(rename = "ofw_pdf")]
    OfwPdf,
    #[serde(rename = "talkingparents_pdf")]
    TalkingParentsPdf,
    #[serde(rename = "generic_text")]
    GenericText,
}

/// One normalized message row.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MessageRecord {
    pub sent_at: String,
    pub sender_role: SenderRole,
    pub body_text: String,
    pub platform_source: PlatformSource,
    pub raw_hash: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ParseRequest {
    pub file_content_base64: String,
    pub file_format: FileFormat,
    pub parent_a_identifier: String,
    pub parent_b_identifier: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ParseResponse {
    pub records: Vec<MessageRecord>,
    pub total_count: usize,
    pub parse_errors: Vec<String>,
    pub platform_detected: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub version: &'static str,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_format_serializes_to_api_strings() {
        assert_eq!(serde_json::to_string(&FileFormat::OfwPdf).unwrap(), "\"ofw_pdf\"");
        assert_eq!(
            serde_json::to_string(&FileFormat::TalkingParentsPdf).unwrap(),
            "\"talkingparents_pdf\""
        );
        assert_eq!(
            serde_json::to_string(&FileFormat::GenericText).unwrap(),
            "\"generic_text\""
        );
    }
}
