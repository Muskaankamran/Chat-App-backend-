# Chat backend

## Setup

Use Node.js 20 or newer. Copy `.env.example` to `.env`, set the MongoDB URI, a long random JWT secret, and the ImageKit private key, then install dependencies and start the backend:

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

`npm start` starts the non-watch production server. The server waits for MongoDB and GraphQL initialization before listening on `PORT`.

`CLIENT_ORIGIN` is a comma-separated allowlist of browser origins. The development default is `http://localhost:5173`. Authentication uses an HttpOnly cookie; browser requests must include credentials. `JWT_SECRET` and `IMAGEKIT_PRIVATE_KEY` are server-only.

## APIs

- `POST /api/auth/register` and `POST /api/auth/login` preserve the existing authentication routes. `POST /api/auth/logout` clears the cookie. Responses contain only the signed-in user's public profile fields.
- `POST /api/chat/upload` accepts multipart fields `conversationId` and `file`; images and audio are limited to 15 MB and stored in ImageKit. MongoDB stores the remote URL and media metadata, not file bytes.
- `POST /api/chat/profile/avatar` accepts an image in multipart field `file` and updates the authenticated user's avatar.
- `/graphql` provides authenticated `me`, user search, profile update, conversation creation/history, message send/delete/reactions, and seen-status operations. Queries and mutations use the existing MongoDB users plus the Conversation and Message collections.

## Socket.IO

The existing todo events remain available. Chat actions require a valid cookie or bearer token; sockets without a token may connect for the legacy todo feature but cannot join or modify chat conversations.

Chat client events:

- `chat:join` with `{ conversationId }`
- `chat:send` with `{ conversationId, content }`
- `chat:typing` with `{ conversationId, isTyping }`
- `chat:seen` with `{ conversationId }`

Server events include `chat:message`, `chat:typing`, `chat:seen`, `notification:new`, `presence:update`, `profile:update`, and `chat:error`. Conversation membership is checked before room joins or message operations.

## Tests

```powershell
npm test
npm audit
```

The tests cover auth serialization/cookies, GraphQL authorization and resolver behavior, Mongo model compatibility, chat persistence service behavior, media validation, HTTP routes, and Socket.IO authentication/message delivery. Database-backed end-to-end checks require a configured MongoDB instance and are not run against the configured `.env` automatically.
