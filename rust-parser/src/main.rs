use axum::http::StatusCode;
use axum::routing::{get, post};
use axum::{Json, Router};
use rust_parser::service::{parse_document, ServiceReject};
use rust_parser::types::{HealthResponse, ParseRequest, ParseResponse};
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tracing::{error, info};

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health))
        .route("/parse", post(parse_handler))
        .layer(cors);

    let addr = SocketAddr::from(([0, 0, 0, 0], 8080));
    info!(?addr, "rust-parser listening");
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("bind 0.0.0.0:8080");
    axum::serve(listener, app).await.expect("server");
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        version: env!("CARGO_PKG_VERSION"),
    })
}

async fn parse_handler(
    Json(body): Json<ParseRequest>,
) -> Result<Json<ParseResponse>, (StatusCode, String)> {
    info!(file_format = ?body.file_format, "parse request");
    match parse_document(&body) {
        Ok(resp) => Ok(Json(resp)),
        Err(ServiceReject::BadRequest(msg)) => {
            error!(%msg, "parse request rejected");
            Err((StatusCode::BAD_REQUEST, msg))
        }
    }
}
