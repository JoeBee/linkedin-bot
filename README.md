# LinkedIn Bot

Browser automation (Playwright) to log into LinkedIn and interact with Messaging and Jobs. Node.js/TypeScript backend + Angular frontend.

## Features

- **Conversations**: Browse and reply to LinkedIn messages, AI-generated replies (Gemini)
- **Jobs**: Search with filters, view details, apply (Easy Apply or external)
- **Browser automation**: Playwright, automatic recovery on disconnect

## Prerequisites

- Node.js 18+
- npm or yarn

## Quick Start

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your GEMINI_API_KEY
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm start
```

Open http://localhost:4200.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend port | 3000 |
| `HEADLESS` | Run browser headless | true |
| `GEMINI_API_KEY` | Google Gemini API key (required for AI replies) | — |
| `MY_DISPLAY_NAME` | Your LinkedIn display name for message attribution | — |

See `backend/.env.example` and [SECURITY.md](SECURITY.md).

## Deployment

### Docker

```bash
# Create backend/.env from .env.example
cp backend/.env.example backend/.env

# Build and run
docker compose up -d
```

- Frontend: http://localhost
- Backend API: http://localhost:3000

### Manual Production Build

```bash
# Backend
cd backend && npm ci && npm run build && npm start

# Frontend (served separately or via nginx)
cd frontend && npm ci && npm run build
# Output: dist/frontend/browser/
```

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/bot/status` | Bot status and conversations |
| POST | `/api/bot/login` | `{ email, password, headless }` |
| POST | `/api/bot/conversations/refresh` | Refresh conversation list |
| POST | `/api/bot/conversations/:id/open` | Open conversation |
| POST | `/api/bot/send` | `{ text }` – send message |
| POST | `/api/bot/generate-reply` | `{ conversationHistory, recipientName }` – AI reply |
| POST | `/api/bot/logout` | Close browser |
| GET | `/api/jobs` | Job listings |
| POST | `/api/jobs/search` | Search jobs |
| GET | `/api/jobs/:id` | Job details |
| POST | `/api/jobs/:id/apply` | Apply to job |

## Important

- Credentials are sent only to your backend; never stored.
- Automating LinkedIn may violate their User Agreement. Use at your own risk.
- Job applications open Easy Apply or external pages; complete manually in the browser.
