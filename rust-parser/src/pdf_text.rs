//! PDF text extraction via lopdf (best-effort; layout varies by export).

use lopdf::Document;
use std::io::Cursor;

/// Load PDF bytes and concatenate extracted text from all pages in page order.
pub fn extract_pdf_text(bytes: &[u8]) -> Result<String, String> {
    let cursor = Cursor::new(bytes.to_vec());
    let doc = Document::load_from(cursor).map_err(|e| format!("pdf_load_failed: {e}"))?;

    let pages = doc.get_pages();
    let mut page_nums: Vec<u32> = pages.keys().copied().collect();
    page_nums.sort_unstable();

    let mut out = String::new();
    for n in page_nums {
        let chunk = doc
            .extract_text(&[n])
            .map_err(|e| format!("pdf_extract_text page {n}: {e}"))?;
        out.push_str(&chunk);
        if !chunk.ends_with('\n') {
            out.push('\n');
        }
    }

    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn malformed_pdf_returns_err_not_panic() {
        let garbage = [0xFF, 0xD8, 0xFF, 0x00, 0x01, 0x02];
        let r = extract_pdf_text(&garbage);
        assert!(r.is_err());
    }
}
