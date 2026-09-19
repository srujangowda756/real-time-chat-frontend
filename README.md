# Real-Time Chat Frontend

React and Vite frontend for the real-time chat application. Users can register, log in with JWT authentication, select another user, and exchange messages over an authenticated WebSocket connection.

## Requirements

- Node.js 20+
- npm 10+
- The backend running locally or at a reachable URL

## Setup

Install dependencies:

```bash
npm ci
```

Start the development server:

```bash
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`.

The frontend currently connects to `http://127.0.0.1:8000` and `ws://127.0.0.1:8000`. Update the `API_URL` and `WS_URL` constants near the top of `src/App.jsx` when the backend runs elsewhere.

## Scripts

```bash
npm run dev      # Start the development server
npm run build    # Create a production build in dist/
npm run preview  # Preview the production build
npm run lint     # Run ESLint
```

## Backend Contract

The backend must provide:

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `GET /users/`
- `ws://<backend-host>/ws?token=<jwt>`

The frontend stores the access token in `localStorage` under `access_token`. Messages sent through the WebSocket use this shape:

```json
{
  "receiver": 2,
  "message": "Hello"
}
```

Start the backend first and follow its README for PostgreSQL and migration setup.

## Production Build

```bash
npm ci
npm run build
```

Serve the generated `dist/` directory with a static web server. Configure backend CORS and the API/WebSocket URLs for the deployed environments.

## Repository Notes

- `node_modules/`, `dist/`, and local environment files are ignored.
- `package-lock.json` is committed for reproducible installs.
- Never commit access tokens or production credentials.
