# Auth0 Setup Guide

## Overview

CollectionsUltimate uses **Auth0** for authentication. The flow is:

1. User logs in via Auth0 Universal Login (hosted by Auth0)
2. Auth0 returns a JWT access token to the React SPA
3. SPA includes the token in `Authorization: Bearer <token>` headers
4. ASP.NET API validates the token and extracts the user's identity
5. On first login, an Account + default Household are auto-created

## Auth0 Tenant Setup

### 1. Create Auth0 Account

Go to [auth0.com](https://auth0.com) and create a free account.

### 2. Create a Single-Page Application

In the Auth0 Dashboard:

1. Go to **Applications → Create Application**
2. Name: `CollectionsUltimate Web`
3. Type: **Single Page Application**
4. After creation, go to the **Settings** tab and note:
   - **Domain** (e.g., `your-tenant.us.auth0.com`)
   - **Client ID** (e.g., `abc123...`)
5. Configure the following URLs:

| Setting | Local Dev | Production |
|---------|-----------|------------|
| Allowed Callback URLs | `http://localhost:5173` | `https://your-domain.com` |
| Allowed Logout URLs | `http://localhost:5173` | `https://your-domain.com` |
| Allowed Web Origins | `http://localhost:5173` | `https://your-domain.com` |

### 3. Create an API

1. Go to **Applications → APIs → Create API**
2. Name: `CollectionsUltimate API`
3. Identifier (Audience): `https://api.collectionsultimate.com` (or any unique URI)
4. Signing Algorithm: **RS256**

### 4. Enable Social Connections (Optional)

Under **Authentication → Social**, enable:
- Google
- GitHub
- Microsoft

## Application Configuration

### Backend (`appsettings.json` or environment variables)

```json
{
  "Auth0": {
    "Domain": "your-tenant.us.auth0.com",
    "Audience": "https://api.collectionsultimate.com"
  }
}
```

Or via environment variables:
```
Auth0__Domain=your-tenant.us.auth0.com
Auth0__Audience=https://api.collectionsultimate.com
```

### Frontend (`.env` or `vite` config)

```env
VITE_AUTH0_DOMAIN=your-tenant.us.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id
VITE_AUTH0_AUDIENCE=https://api.collectionsultimate.com
```

## How Authentication Works

### Login Flow

```
Browser                    Auth0                    API
  │                          │                       │
  ├──── redirect ───────────►│                       │
  │                          │                       │
  │◄─── JWT token ──────────┤                       │
  │                          │                       │
  ├──── POST /api/auth/login ───────────────────────►│
  │     (Bearer token)       │                       │
  │                          │         ┌─────────────┤
  │                          │         │ Validate JWT │
  │                          │         │ Find/create  │
  │                          │         │ account      │
  │                          │         └─────────────┤
  │◄─── { accountId, households } ──────────────────┤
```

### API Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /api/auth/login` | Required | First-login auto-provision; returns account + households |
| `GET /api/auth/me` | Required | Returns current user info + household memberships |
| All other endpoints | Optional* | Currently unprotected for dev; will be locked down |

*Endpoints will be progressively secured with `.RequireAuthorization()`.

### Account Model

```
Account
├── Id (GUID)
├── DisplayName
├── Email
├── Auth0Sub (unique, from JWT "sub" claim)
└── CreatedUtc

AccountHousehold (many-to-many)
├── AccountId → Account
├── HouseholdId → Household
├── Role ("Owner" | "Member" | "ReadOnly")
└── CreatedUtc
```

## Running the Migration

Before starting the API with Auth0 configured, run the migration:

```sql
-- Run api/Db/migrations/0017_auth0_accounts.sql against your database
```

Or use the bootstrap tool:
```powershell
dotnet run --project tools/DbBootstrap
```

## Local Development (No Auth)

When `Auth0:Domain` and `Auth0:Audience` are empty (default), authentication middleware
is registered but no endpoints require it. The API runs fully open for local development.

To test with Auth0 locally, fill in the values in `appsettings.Development.json`.

## Deployment Notes

- Store Auth0 secrets in Azure Key Vault or App Service Configuration
- Never commit real Auth0 Domain/ClientId/Audience to source control
- Use `appsettings.Production.json` or environment variables in production
