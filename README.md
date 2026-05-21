# DiskHub

DiskHub is a production-oriented storage orchestration platform for teams that need a single control plane for identity, disk lifecycle, telemetry, and iSCSI exposure.

The platform combines a Rust microservice backend, an event-driven workflow layer over Kafka, a Next.js operator console, Keycloak-based identity, and a pluggable storage-node runtime. In practice, this gives you one cohesive surface for provisioning disks, managing users, tracking IO activity, and exposing storage workflows through a UI that feels like a real product rather than a demo panel.

## Why DiskHub

DiskHub is built for environments where storage operations need to be predictable, observable, and easy to control:

- Centralized identity and access management through Keycloak
- Event-driven disk provisioning and deletion workflows via Kafka
- Dedicated services for identity, personal workspace logic, disk lifecycle, iSCSI, and storage-node execution
- Real-time workflow feedback for the frontend through platform events
- IO monitoring surface for operators and administrators
- Clear path from local development to staging-like and production-style deployments

## Platform Capabilities

- Authentication, token refresh, profile lookup, and admin user management
- Disk creation, listing, ownership management, and deletion workflows
- Workflow progress propagation from backend services to the frontend
- iSCSI integration layer for storage publication
- Storage-node abstraction with configurable backend driver
- Operator-facing monitoring for disk IO activity and platform state
- Admin panel flows for users, disks, and monitoring views

## Architecture

DiskHub follows a service-oriented, event-first control-plane model:

1. The frontend initiates an authenticated request through the identity layer.
2. `id-service` validates identity, issues workflow context, and publishes the request into Kafka.
3. Domain services consume and enrich the workflow as it moves through the provisioning pipeline.
4. `disk-service` persists disk state in MongoDB and coordinates lifecycle transitions.
5. `iscsi-service` and `storage-node-service` handle storage publication concerns.
6. Frontend update events are published throughout the pipeline so operators can track progress in near real time.

## Service Map

| Component | Role | Default Port |
| --- | --- | --- |
| `frontend` | Next.js operator console | `3000` |
| `id-service` | Auth, token flows, admin users, workflow entrypoint | `3001` |
| `personal-service` | User-scoped workflow logic | `3002` |
| `disk-service` | Disk lifecycle, metadata, IO monitoring | `3003` |
| `iscsi-service` | iSCSI-facing workflow stage | `3004` |
| `storage-node-service` | Storage backend execution layer | `3005` |
| `keycloak` | Identity provider | `8080` |
| `mongo` | Persistent state store | `27017` |
| `kafka-worker-1/2/3` | Event backbone | `29092` / `39092` / `49092` |

## Technology Stack

- Backend: Rust, Axum, Tokio
- Frontend: Next.js 14, React 18, TypeScript
- Messaging: Apache Kafka in KRaft mode
- Identity: Keycloak
- Persistence: MongoDB
- Container Runtime: Docker Compose
- Storage Integration: iSCSI workflow + pluggable storage-node driver

## Deployment Model

The repository ships with a full multi-service Docker Compose topology that mirrors how DiskHub is intended to run as an integrated platform:

- Independent stateless control-plane services
- Dedicated infrastructure containers for identity, persistence, and messaging
- Storage-node runtime with privileged host access when required
- Externalized configuration through environment variables
- Prebuilt image references for all major services

By default, the storage-node can run with a `mock` driver. For environments that need host-backed iSCSI publication, the runtime can be switched to a real driver model such as `targetcli`, provided the host supports the required kernel and `configfs` access.

## Quick Start

### 1. Prepare environment

Review and update `.env` for your environment-specific values:

- Keycloak admin credentials
- MongoDB bootstrap credentials
- Kafka cluster id if you want to override the default
- `ISCSI_PORTAL_ADDRESS`
- `STORAGE_NODE_DRIVER`
- `STORAGE_NODE_BACKING_STORE_DIR`

### 2. Launch the platform

```bash
docker compose up -d
```

To build local images first:

```bash
make build
docker compose up -d
```

### 3. Open the platform

- Operator console: `http://localhost:3000`
- Keycloak: `http://localhost:8080`
- MongoDB: `mongodb://localhost:27017`

## Developer Workflow

### Backend

```bash
cargo build
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Compose lifecycle

```bash
make up
make down
```

## Operational Highlights

- JWT validation and Keycloak integration are handled centrally in the identity service
- Disk state is persisted in MongoDB and exposed through dedicated disk APIs
- Monitoring data is collected and surfaced through `disk-service`
- Frontend progress updates are emitted as workflow stages complete
- The platform is designed so each service can evolve independently without collapsing the overall operator experience

## API Surfaces

Selected platform entrypoints include:

- `id-service`
  - `POST /request`
  - `POST /auth/login`
  - `POST /auth/refresh`
  - `GET /auth/me`
  - `GET /auth/config`
  - `GET/POST /admin/users`
- `disk-service`
  - `GET /disks`
  - `POST /disks`
  - `PUT /disks`
  - `DELETE /disks`
  - `GET /monitoring/io`

All services also expose a root health endpoint on `/`.

## Positioning

DiskHub is not just a set of isolated services. It is an integrated storage control plane with a real operator workflow:

- identity-aware
- event-native
- operationally observable
- storage-focused
- ready to be adapted for internal platforms, lab clusters, staging environments, and serious infrastructure prototypes

## Repository Layout

```text
.
├── frontend/        # Next.js operator console
├── id/              # Identity and access service
├── personal/        # User-scoped workflow service
├── disk/            # Disk lifecycle and monitoring service
├── ISCSI/           # iSCSI service
├── storage-node/    # Storage execution layer
├── data/            # Local persistent volumes
├── docker-compose.yml
└── Makefile
```

## Summary

DiskHub gives teams a strong foundation for building a modern storage platform with authentication, orchestration, workflow visibility, and backend extensibility already wired together. If you need a storage control plane that looks and feels like a serious product from day one, this repository gives you that baseline.
