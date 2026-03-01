# LinkedIn Messaging Bot (Browser Automation)

A bot that uses **browser automation** (Playwright) to log into LinkedIn and interact with Messaging. Built with a **Node.js/TypeScript** backend and an **Angular** frontend.

## Prerequisites

- Node.js 18+
- npm or yarn

## Quick start

### 1. Backend

```bash
cd backend
npm install
# Create .env file with your configuration (see SECURITY.md for details)
npm run dev
```

The API runs at `http://localhost:3000`.

### 2. Frontend

```bash
cd frontend
npm install
npm start
```

The app runs at `http://localhost:4200` and talks to the backend at `http://localhost:3000`.

### 3. Use the app

1. Open **http://localhost:4200** in your browser.
2. Enter your **LinkedIn email and password** (only sent to your local backend; never stored).
3. Click **Login** – a browser window will open and log into LinkedIn.
4. Use **Refresh conversations** to load your messaging threads.
5. Open a conversation and use **Send message** to reply from the app.

## API (backend)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/bot/status` | Bot status and conversation list |
| POST | `/api/bot/login` | Body: `{ "email", "password" }` – start browser and log in |
| POST | `/api/bot/conversations/refresh` | Navigate to Messaging and refresh conversation list |
| POST | `/api/bot/conversations/:id/open` | Open a conversation by id |
| POST | `/api/bot/send` | Body: `{ "text" }` – send a message in the open conversation |
| POST | `/api/bot/logout` | Close browser and clear state |
| GET | `/api/conversations` | Return current conversation list |

## Environment (backend)

- `PORT` – server port (default `3000`)
- `HEADLESS` – set to `false` to see the browser window (default is headless)

## Important

- **Credentials**: Your LinkedIn login is only sent to your local backend. Never commit `.env` or put real credentials in code.
- **ToS**: Automating LinkedIn may violate their User Agreement. Use at your own risk; prefer official APIs if you have partner access.
- **Selectors**: LinkedIn’s HTML changes over time. If listing conversations or sending messages fails, the selectors in `backend/src/linkedin/automation.ts` may need updating.

## Project structure

```
linkedin-bot/
├── backend/                 # Node + Express + Playwright
│   ├── src/
│   │   ├── index.ts
│   │   ├── linkedin/automation.ts
│   │   └── routes/
│   └── package.json
├── frontend/                # Angular app
│   └── ...
└── README.md
```
