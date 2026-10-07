<div align="center">
  <img src="client/src/assets/logo.jpg" alt="SyncScribe Logo" width="150" style="border-radius: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin-bottom: 20px;"/>

  # SyncScribe
  
  **A high-performance, real-time collaborative workspace and text editor.**
  
  [Live Demo](https://syncscribe-editor.onrender.com) · [Report Bug](#) · [Request Feature](#)
</div>

<br />

## 📖 Overview

**SyncScribe** is a production-ready, real-time collaborative document editor designed for modern teams. Built with modern web technologies, it allows multiple users to write, edit, and create together in a unified workspace with zero merge conflicts.

Engineered with low-latency WebSockets and the Yjs CRDT (Conflict-free Replicated Data Type) algorithm, SyncScribe ensures that your keystrokes are synchronized across the globe in milliseconds, while maintaining a robust offline-first local cache.

## ✨ Features

- **Real-Time Collaboration:** Millisecond-level synchronization using WebSockets and the Yjs CRDT algorithm.
- **Live Typing Awareness:** See exactly who is in the room with floating avatars and view live "typing..." indicators.
- **Rich Text Formatting:** A powerful WYSIWYG editor powered by Quill.js, supporting code syntax highlighting, image embeds, and advanced text layouts.
- **Modern Authentication UI:** A beautiful, enterprise-grade split-screen landing page with persistent user identities.
- **Offline Resilience:** Built-in IndexedDB caching allows you to continue writing if your internet drops, syncing silently when reconnected.
- **File Portability:** Import local `.txt` or `.html` files directly into a live room, and export your finished work with a single click.
- **In-Document Live Chat:** A synchronized, timezone-aware side-panel chat for team communication while editing.

## 🛠️ Tech Stack

- **Frontend:** React (Vite), CSS3
- **Editor Engine:** Quill.js
- **CRDT / Sync:** Yjs, y-websocket, y-indexeddb
- **Backend:** Node.js, Express.js, ws (WebSockets)
- **Database:** y-leveldb (Embedded NoSQL)

## 🚀 Quick Start (Local Development)

To run SyncScribe locally on your machine:

### 1. Clone the repository
```bash
git clone https://github.com/your-username/syncscribe.git
cd syncscribe
```

### 2. Install dependencies
This unified command will install the required dependencies for both the frontend client and the backend server.
```bash
npm run install-all
```

### 3. Run the application
This will build the frontend client and start the backend WebSocket server.
```bash
npm run build
npm start
```
*Note: The application will be accessible at `http://localhost:1234`*

## 🌍 Deployment

SyncScribe is architected as a monorepo and is fully configured for 1-click deployment on modern cloud platforms like Render, Railway, or Heroku.

1. Connect your GitHub repository to Render as a **Web Service**.
2. Set the Build Command to: `npm run heroku-postbuild`
3. Set the Start Command to: `npm start`
4. Deploy!

---
<div align="center">
  <i>Engineered with passion.</i>
</div>
