// Simple CORS proxy server for book APIs
// This allows the frontend to access APIs that don't support CORS

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all origins in development
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Proxy server is running' });
});

// Generic proxy endpoint
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    console.log(`Proxying request to: ${targetUrl}`);
    
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'BookCollectionApp/1.0',
        'Accept': 'application/json, text/xml, */*',
      },
    });

    const contentType = response.headers.get('content-type');
    
    // Forward the content type
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    // Get the response body
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      res.json(data);
    } else {
      const text = await response.text();
      res.send(text);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch from target URL', 
      message: error.message 
    });
  }
});

// POST proxy for APIs that need POST requests
app.post('/proxy', async (req, res) => {
  const { url, method = 'POST', headers = {}, body } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    console.log(`Proxying ${method} request to: ${url}`);
    
    const response = await fetch(url, {
      method,
      headers: {
        'User-Agent': 'BookCollectionApp/1.0',
        'Accept': 'application/json, text/xml, */*',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const contentType = response.headers.get('content-type');
    
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      res.json(data);
    } else {
      const text = await response.text();
      res.send(text);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch from target URL', 
      message: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`📡 CORS Proxy server running on http://localhost:${PORT}`);
  console.log(`   Use: http://localhost:${PORT}/proxy?url=<encoded-url>`);
});
