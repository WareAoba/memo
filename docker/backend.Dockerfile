FROM rust:1.94-bookworm AS build
WORKDIR /app
COPY backend/Cargo.toml backend/Cargo.lock ./
COPY backend/build.rs ./
COPY backend/migrations ./migrations
COPY backend/src ./src
RUN cargo build --release --locked

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --uid 10001 --create-home app \
    && mkdir -p /data/database /data/attachments \
    && chown -R app:app /data
COPY --from=build /app/target/release/preset-execution-api /usr/local/bin/preset-execution-api
USER app
ENV BIND_ADDRESS=0.0.0.0:3000 DATABASE_PATH=/data/database/app.sqlite3 RUST_LOG=info
EXPOSE 3000
CMD ["preset-execution-api"]
