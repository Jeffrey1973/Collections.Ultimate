# ── Build stage ──────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# Build args become VITE_ env vars at build time
ARG VITE_API_BASE_URL
ARG VITE_AUTH0_DOMAIN
ARG VITE_AUTH0_CLIENT_ID
ARG VITE_AUTH0_AUDIENCE
ARG VITE_GOOGLE_BOOKS_API_KEY
ARG VITE_ISBNDB_API_KEY

# Explicitly set as ENV so Vite can read them during build
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_AUTH0_DOMAIN=$VITE_AUTH0_DOMAIN
ENV VITE_AUTH0_CLIENT_ID=$VITE_AUTH0_CLIENT_ID
ENV VITE_AUTH0_AUDIENCE=$VITE_AUTH0_AUDIENCE
ENV VITE_GOOGLE_BOOKS_API_KEY=$VITE_GOOGLE_BOOKS_API_KEY
ENV VITE_ISBNDB_API_KEY=$VITE_ISBNDB_API_KEY

RUN npm run build

# ── Serve with Caddy (lightweight) ──────────────────────────
FROM caddy:2-alpine AS runtime
COPY --from=build /app/dist /srv
COPY Caddyfile.frontend /etc/caddy/Caddyfile
EXPOSE 80
