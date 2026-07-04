# ---------- Builder ----------
FROM rust:1.95 AS builder

RUN rustup target add x86_64-unknown-linux-musl
RUN apt-get update && apt-get install -y musl-tools pkg-config

WORKDIR /app

COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY migrations ./migrations

ENV OPENSSL_STATIC=1

RUN cargo build --release --target x86_64-unknown-linux-musl

# ---------- Runtime ----------
FROM gcr.io/distroless/static-debian12

WORKDIR /

COPY --from=builder /app/target/x86_64-unknown-linux-musl/release/backend /backend
COPY --from=builder /app/migrations /migrations

EXPOSE 8080

ENTRYPOINT ["/backend"]