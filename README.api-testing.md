# API testing (Swagger UI + Postman)

## Swagger UI

When running the API in `Development`, Swagger UI is available at:

- `http://localhost:5258/swagger`

The OpenAPI document is also available at:

- `http://localhost:5258/openapi/v1.json`

## Postman

1. Open Postman
2. Import `postman/CollectionsUltimate.postman_collection.json`
3. Set collection variables:
   - `baseUrl` (default `http://localhost:5258`)
   - `householdId` (paste an existing household GUID)

Suggested flow:

1. Run **Households - Create**
2. Copy the returned `id` into the `householdId` variable
3. Run **Books - Create (by household)**
4. Run **Books - Search (by household)**
