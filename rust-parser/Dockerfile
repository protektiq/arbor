# Multi-stage: compile with Chainguard Rust toolchain, run on minimal glibc runtime.
# Build: cd rust-parser && docker build -t arbor-rust-parser .
#
# For a fully static binary you would target x86_64-unknown-linux-musl and use
# cgr.dev/chainguard/static instead of glibc-dynamic.

FROM cgr.dev/chainguard/rust:latest AS build

USER root
WORKDIR /app

COPY Cargo.toml Cargo.lock ./
COPY src ./src

RUN cargo build --release --bin rust-parser

FROM cgr.dev/chainguard/glibc-dynamic:latest

COPY --from=build /app/target/release/rust-parser /usr/local/bin/rust-parser

ENV RUST_LOG=info

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/rust-parser"]
