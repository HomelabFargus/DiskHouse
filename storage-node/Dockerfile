FROM rust:1.86-bookworm AS builder
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends cmake g++ pkg-config \
    && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.toml
COPY id/Cargo.toml id/Cargo.toml
COPY personal/Cargo.toml personal/Cargo.toml
COPY disk/Cargo.toml disk/Cargo.toml
COPY ISCSI/Cargo.toml ISCSI/Cargo.toml
COPY storage-node/Cargo.toml storage-node/Cargo.toml
COPY . .

RUN cargo build --release -p storage-node-service

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates targetcli-fb && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/target/release/storage-node-service /usr/local/bin/storage-node-service

CMD ["/usr/local/bin/storage-node-service"]
