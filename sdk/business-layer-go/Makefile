.PHONY: build test test-unit test-integ tidy fmt vet

build:
	go build ./...

test:
	go test ./... -count=1

test-unit:
	go test ./... -short -count=1

vet:
	go vet ./...

tidy:
	go mod tidy

fmt:
	gofmt -w .
