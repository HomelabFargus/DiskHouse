FROM rust:1.88 AS builder
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends cmake g++ libssl-dev pkg-config \
    && rm -rf /var/lib/apt/lists/*

COPY . .
RUN cargo build --release -p disk-service

FROM debian:bookworm-slim
WORKDIR /app
COPY --from=builder /app/target/release/disk-service /usr/local/bin/disk-service
EXPOSE 3003
CMD ["/usr/local/bin/disk-service"]
