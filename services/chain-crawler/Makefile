.PHONY: help run build install

ifeq ($(shell uname),Darwin)
 PLATFORM="darwin"
else
 ifeq ($(OS),Windows_NT)
  PLATFORM="windows"
 else
  PLATFORM="linux"
 endif
endif

build-all: install
	# swag init -g ./cmd/api/api.go -o ./docs
	go build -ldflags="-w" -o /dev/null ./cmd/chain_crawler/main.go

all: help

help: Makefile
	@echo
	@echo "Choose a make command to run in "$(PROJECTNAME)":"
	@echo
	@$(MAKE) -pRrq -f $(lastword $(MAKEFILE_LIST)) : 2>/dev/null | awk -v RS= -F: '/^# File/,/^# Finished Make data base/ {if ($$1 !~ "^[#.]") {print $$1}}' | sort | egrep -v -e '^[^[:alnum:]]' -e '^$@$$'
	@echo

install:
	go mod tidy

build-cmd:
	go build -o ./build/chain_crawler ./cmd/chain_crawler/main.go

build-api:
	go build -o ./build/chain_crawler ./cmd/chain_crawler/main.go

build-doc:
	swag init -g ./cmd/api/api.go -o ./docs

doc-fmt:
	swag fmt -g main.go

build-test:
	go build -ldflags="-w" -o ./build/chain_crawler ./cmd/chain_crawler/main.go

build:
	go build -o ./build/chain_crawler ./cmd/chain_crawler/main.go


build-linux-hwc-test-web:
	GOOS=linux GOARCH=amd64 go build -ldflags="-w" -o ./build/chain_crawler ./cmd/chain_crawler/main.go
	scp ./build/chain_crawler test-hw-web:/home/ubuntu/web3-chaincrawler/chain_crawler