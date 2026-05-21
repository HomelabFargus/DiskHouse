COMPOSE = docker compose

.PHONY: build build-id build-personal build-disk build-iscsi build-storage-node build-frontend up down prune

build: build-id build-personal build-disk build-iscsi build-storage-node build-frontend

build-id:
	docker build -t diskhouse/id-service:latest -f id/Dockerfile .

build-personal:
	docker build -t diskhouse/personal-service:latest -f personal/Dockerfile .

build-disk:
	docker build -t diskhouse/disk-service:latest -f disk/Dockerfile .

build-iscsi:
	docker build -t diskhouse/iscsi-service:latest -f ISCSI/Dockerfile .

build-storage-node:
	docker build -t diskhouse/storage-node-service:latest -f storage-node/Dockerfile .

build-frontend:
	docker build -t diskhouse/frontend:latest -f frontend/Dockerfile .

up:
	$(COMPOSE) up

down:
	$(COMPOSE) down

prune:
	docker system prune -a -f && docker volume prune -a -f
