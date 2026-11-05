# orbit chat frontend

## Setup

Use Node.js 20 or newer. Copy `.env.example` to `.env`, install dependencies, and start Vite:

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

The backend must be running with MongoDB and ImageKit configured. `VITE_API_URL` and `VITE_SOCKET_URL` are public service URLs only; never put backend keys or JWT secrets in frontend environment variables. The API client uses the backend's HttpOnly auth cookie with credentials.

## Checks

```powershell
npm run lint
npm run build
```

The application includes login/signup, protected chat routes, user search and direct conversations, message history, live Socket.IO updates, image and voice uploads, message reactions, profile editing, presence, unread counts, and dark/light themes.
