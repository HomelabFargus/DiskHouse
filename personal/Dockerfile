FROM rust:1.88 AS builder
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends cmake g++ libssl-dev pkg-config \
    && rm -rf /var/lib/apt/lists/*

COPY . .
RUN cargo build --release -p personal-service

FROM debian:bookworm-slim
WORKDIR /app
COPY --from=builder /app/target/release/personal-service /usr/local/bin/personal-service
EXPOSE 3002
CMD ["/usr/local/bin/personal-service"]
