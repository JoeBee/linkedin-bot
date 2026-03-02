# LinkedIn Bot (Browser Automation)

A bot that uses **browser automation** (Playwright) to log into LinkedIn and interact with Messaging and Jobs. Built with a **Node.js/TypeScript** backend and an **Angular** frontend.

## Features

- **Conversations Tab**: Browse and respond to LinkedIn messages
- **Jobs Tab**: Search for jobs with filters, view details, and apply directly from the app
- **AI Reply Generation**: Automatically generate contextual replies to messages
- **Browser Automation**: Uses Playwright to interact with LinkedIn as a real user
- **Automatic Browser Recovery**: Seamlessly recovers from browser disconnections and automatically re-logs in

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
4. **Conversations Tab**:
   - Use **Refresh conversations** to load your messaging threads.
   - Open a conversation and use **Send message** to reply from the app.
   - Use **Generate AI Reply** to get AI-generated responses based on conversation context.
5. **Jobs Tab**:
   - Enter keywords in the search box (e.g., "Software Engineer Remote Python").
   - Click **Search Jobs** to find matching jobs on LinkedIn.
   - Click **Details** to view full job description in a dialog.
   - Click **Apply** to initiate the application process (Easy Apply or external).

## API (backend)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/bot/status` | Bot status and conversation list |
| POST | `/api/bot/login` | Body: `{ "email", "password", "headless" }` – start browser and log in |
| POST | `/api/bot/conversations/refresh` | Navigate to Messaging and refresh conversation list |
| POST | `/api/bot/conversations/:id/open` | Open a conversation by id |
| POST | `/api/bot/send` | Body: `{ "text" }` – send a message in the open conversation |
| POST | `/api/bot/generate-reply` | Body: `{ "conversationHistory", "recipientName" }` – generate AI reply |
| POST | `/api/bot/logout` | Close browser and clear state |
| GET | `/api/conversations` | Return current conversation list |
| GET | `/api/jobs` | Return current job listings |
| POST | `/api/jobs/search` | Body: `{ "keywords" }` – search for jobs on LinkedIn |
| GET | `/api/jobs/:id` | Get detailed info for a specific job |
| POST | `/api/jobs/:id/apply` | Apply to a job (initiates Easy Apply or external application) |

## Environment (backend)

- `PORT` – server port (default `3000`)
- `HEADLESS` – set to `false` to see the browser window (default is headless)
- `OPENAI_API_KEY` – OpenAI API key for AI reply generation

## Important

- **Credentials**: Your LinkedIn login is only sent to your local backend. Never commit `.env` or put real credentials in code.
- **Browser Recovery**: If the browser closes unexpectedly, the app will automatically restart it and re-login using stored credentials. This makes the app more resilient to network issues or accidental browser closures.
- **Job Search Filters**: The filters construct proper LinkedIn URLs with filter parameters (e.g., `f_E` for experience level, `f_JT` for job type). However, LinkedIn may not always apply these filters, especially if:
  - The job pool is small (e.g., "pet sitting" near Cambridge might only have a few jobs regardless of filters)
  - LinkedIn requires active session cookies or UI interactions to apply filters
  - Check the backend logs to see the search URL and actual URL after navigation to verify if LinkedIn is modifying the filters
- **ToS**: Automating LinkedIn may violate their User Agreement. Use at your own risk; prefer official APIs if you have partner access.
- **Selectors**: LinkedIn's HTML changes over time. If listing conversations or sending messages fails, the selectors in `backend/src/linkedin/automation.ts` may need updating.
- **Job Applications**: The apply feature opens the Easy Apply modal or navigates to external application pages. You'll need to complete the application manually in the browser.

## Project structure

```
linkedin-bot/
├── backend/                 # Node + Express + Playwright
│   ├── src/
│   │   ├── index.ts
│   │   ├── linkedin/automation.ts
│   │   ├── services/ai-service.ts
│   │   └── routes/
│   │       ├── bot.ts
│   │       ├── conversations.ts
│   │       └── jobs.ts
│   └── package.json
├── frontend/                # Angular app
│   └── ...
└── README.md
```
