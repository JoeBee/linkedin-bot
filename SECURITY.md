# Security & Environment

## Setup

### Backend

Create `backend/.env`:

```env
PORT=3000
HEADLESS=true
GEMINI_API_KEY=your_api_key
```

Get an API key from [Google AI Studio](https://makersuite.google.com/app/apikey).

### Frontend

The app uses `frontend/src/environments/environment.ts` by default. For production builds, `environment.prod.ts` is used (API at `/api`).

Optional: copy `environment.local.ts.example` to `environment.local.ts` for local overrides (gitignored). Configure `ng serve --configuration=local` if using file replacement.

## Protected Files

- `backend/.env` – API keys
- `frontend/src/environments/environment.local.ts` – local overrides
- `*.env`, `secrets.json`, `credentials.json`

## Best Practices

- Never commit `.env` or files with API keys
- Rotate keys if exposed
- Use `MY_DISPLAY_NAME` for message attribution (optional)
