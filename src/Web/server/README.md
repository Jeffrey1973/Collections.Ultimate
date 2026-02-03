# CORS Proxy Server for Book APIs

This server acts as a proxy to bypass CORS restrictions when accessing book metadata APIs.

## Development Setup

1. Install dependencies:
```bash
cd server
npm install
```

2. Start the proxy server:
```bash
npm run dev
```

The server will run on `http://localhost:3001`

## Production Setup

### Option 1: Deploy to same server as frontend

1. Build and run:
```bash
cd server
npm install --production
npm start
```

2. Use a process manager like PM2:
```bash
npm install -g pm2
pm2 start proxy.js --name book-proxy
pm2 save
pm2 startup
```

### Option 2: Deploy to cloud (Heroku, Railway, Render, etc.)

1. Add a `Procfile` to the server directory:
```
web: node proxy.js
```

2. Deploy the `/server` folder to your cloud provider

3. Set environment variable:
```
PORT=3001 (or let the platform assign)
```

### Option 3: Docker

1. Create `Dockerfile` in server directory:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3001
CMD ["node", "proxy.js"]
```

2. Build and run:
```bash
docker build -t book-proxy .
docker run -p 3001:3001 book-proxy
```

## Update Frontend to Use Proxy

In your frontend code, update API calls to use the proxy:

```typescript
// Instead of:
const response = await fetch(`https://api.example.com/books?isbn=${isbn}`)

// Use:
const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001'
const targetUrl = encodeURIComponent(`https://api.example.com/books?isbn=${isbn}`)
const response = await fetch(`${proxyUrl}/proxy?url=${targetUrl}`)
```

## Environment Variables

Create `.env` file:
```
PORT=3001
NODE_ENV=production
```

Add to `.env.local` in frontend:
```
VITE_PROXY_URL=http://localhost:3001
```

For production, set:
```
VITE_PROXY_URL=https://your-proxy-domain.com
```
