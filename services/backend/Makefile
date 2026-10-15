.PHONY: swagger swagger-site swagger-serve

SWAGGER_PORT ?= 8088

swagger:
	./scripts/swagger/gen.sh

swagger-site: swagger
	./scripts/swagger/build-site.sh

swagger-serve: swagger-site
	cd api-docs-site && python3 -m http.server $(SWAGGER_PORT)
