const process = require('process');
const path = require('path');
const fs = require('fs');

// Set up Yjs persistence using y-leveldb.
// We must set this before requiring y-websocket/bin/utils.
const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir);
}
process.env.YPERSISTENCE = dbDir;

const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const { setupWSConnection } = require('y-websocket/bin/utils');

const port = process.env.PORT || 1234;

const app = express();

// Serve the compiled frontend client from client/dist
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

// Fallback to serving index.html for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

const server = http.createServer(app);

const wss = new WebSocket.Server({ server });

wss.on('connection', (conn, req) => {
  console.log('New connection established');
  setupWSConnection(conn, req);
});

server.listen(port, () => {
  console.log(`Web and WebSocket Server running on port ${port}`);
});
