.PHONY: help build run test clean docker-build docker-run docker-stop

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build the application
	@echo "Building..."
	go build -o bin/cron-job ./cmd

run: build ## Build and run the application
	@echo "Running..."
	./bin/cron-job

test: ## Run tests
	@echo "Running tests..."
	go test -v ./...

test-integration: ## Run integration tests
	@echo "Running integration tests..."
	go test -v -tags=integration ./...

clean: ## Clean build artifacts
	@echo "Cleaning..."
	rm -rf bin/
	rm -f *.test
	rm -f *.out

deps: ## Download dependencies
	@echo "Downloading dependencies..."
	go mod download
	go mod tidy

docker-build: ## Build Docker image
	@echo "Building Docker image..."
	docker build -t oddfi-cron-job:latest .

docker-run: docker-build ## Build and run Docker container
	@echo "Running Docker container..."
	docker-compose up -d

docker-stop: ## Stop Docker container
	@echo "Stopping Docker container..."
	docker-compose down

docker-logs: ## Show Docker logs
	docker-compose logs -f

lint: ## Run linter
	@echo "Running linter..."
	golangci-lint run ./...

fmt: ## Format code
	@echo "Formatting code..."
	go fmt ./...

vet: ## Run go vet
	@echo "Running go vet..."
	go vet ./...

dev: ## Run in development mode (with hot reload if air is installed)
	@echo "Starting development server..."
	@if command -v air &> /dev/null; then \
		air; \
	else \
		echo "air not found. Install with: go install github.com/cosmtrek/air@latest"; \
		make run; \
	fi
