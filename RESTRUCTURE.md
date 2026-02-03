# Project Restructure

## New Structure

The repository has been restructured to separate the web frontend and API backend into distinct top-level directories:

```
Collections.Ultimate/
├── web/              # React frontend (Vite + TypeScript)
│   ├── src/
│   ├── package.json
│   ├── vite.config.ts
│   └── .env.local
│
├── api/              # .NET backend
│   ├── Api/          # Web API project
│   ├── Application/  # Application layer
│   ├── Domain/       # Domain models
│   ├── Infrastructure/ # Data access & external services
│   └── Db/           # Database scripts
│
├── database/         # Database files
├── scripts/          # Build/deployment scripts
├── tools/            # Development tools
└── CollectionsUltimate.slnx  # .NET solution file
```

## Previous Structure

Previously, all projects were under `src/`:
- `src/Web/` → moved to `web/`
- `src/Api/` → moved to `api/Api/`
- `src/Application/` → moved to `api/Application/`
- `src/Domain/` → moved to `api/Domain/`
- `src/Infrastructure/` → moved to `api/Infrastructure/`
- `src/Db/` → moved to `api/Db/`

## Running the Projects

### Web Frontend
```bash
cd web
npm install
npm run dev
```

### API Backend
```bash
cd api/Api
dotnet run
```

## Benefits

- **Clearer separation** between frontend and backend
- **Independent deployments** for web and API
- **Easier team collaboration** with clear project boundaries
- **Simpler CI/CD** pipelines for each project

## Next Steps

You can safely delete the old `src/` directory once you've verified everything works correctly.
