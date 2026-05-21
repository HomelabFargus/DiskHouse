FROM rust:1.88 AS builder
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends cmake g++ libssl-dev pkg-config \
    && rm -rf /var/lib/apt/lists/*

COPY . .
RUN cargo build --release -p id-service

FROM debian:bookworm-slim
WORKDIR /app
COPY --from=builder /app/target/release/id-service /usr/local/bin/id-service
EXPOSE 3001
CMD ["/usr/local/bin/id-service"]
