# Security & Environment Variables

## API Key Configuration

This project uses Google Gemini AI, which requires an API key. The API key is stored securely in environment variables and is **never** committed to the repository.

## Setup Instructions

### Backend Setup

#### 1. Create your backend `.env` file

Copy the example file:

```bash
cd backend
cp .env.example .env
```

#### 2. Add your API key

Edit `backend/.env` and add your Gemini API key:

```env
GEMINI_API_KEY=your_actual_api_key_here
```

#### 3. Get your API key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and paste it into your `.env` file

### Frontend Setup

#### 1. Create your local environment file

Copy the example file:

```bash
cd frontend/src/environments
cp environment.local.example.ts environment.local.ts
```

#### 2. Add your LinkedIn credentials

Edit `frontend/src/environments/environment.local.ts`:

```typescript
export const environmentLocal = {
  defaultEmail: 'your_linkedin_email@example.com',
  defaultPassword: 'your_linkedin_password',
};
```

**Note:** These credentials are only used to pre-fill the login form for convenience. They are stored locally and never committed to Git.

## Security Best Practices

### ✅ What we do RIGHT

- API keys are stored in `.env` files
- `.env` files are excluded via `.gitignore`
- Example files (`.env.example`) don't contain real keys
- Documentation references `.env` without exposing keys

### ❌ What to NEVER do

- Never commit `.env` files to Git
- Never hardcode API keys in source code
- Never share API keys in documentation
- Never commit files containing API keys

## Files Protected

The following files are automatically excluded from Git:

**Backend:**
- `backend/.env` - Contains your API key

**Frontend:**
- `frontend/src/environments/environment.local.ts` - Contains your LinkedIn credentials

**Other sensitive files:**
- `.env` - Any environment files
- `*.env` - All environment file variants
- `secrets.json` - Any secret configuration files
- `credentials.json` - Any credential files

## Verifying Security

### Check Backend .env

```bash
git status backend/.env
```

### Check Frontend environment.local.ts

```bash
git status frontend/src/environments/environment.local.ts
```

If Git shows "nothing to commit" or "Untracked files" for these files, they are properly ignored. ✅

If Git shows the file as staged or to be committed, check your `.gitignore`. ❌

## What if I accidentally committed my credentials?

If you accidentally committed your API key or credentials:

1. **Immediately rotate your API key** at [Google AI Studio](https://makersuite.google.com/app/apikey)
2. **Change your LinkedIn password** if it was committed
3. Update your local files (`backend/.env` and `frontend/src/environments/environment.local.ts`) with new credentials
4. Remove the credentials from Git history (advanced - seek help if needed)
5. Never use the exposed credentials again

## Environment Variables Reference

### Backend (`backend/.env`)

```env
# Server Configuration
PORT=3000

# Browser Automation
HEADLESS=false  # Set to "true" to hide browser window

# AI Configuration
GEMINI_API_KEY=your_api_key_here  # Get from https://makersuite.google.com/app/apikey
```

### Frontend (`frontend/src/environments/environment.local.ts`)

```typescript
// Local environment configuration
export const environmentLocal = {
  defaultEmail: 'your_linkedin_email@example.com',
  defaultPassword: 'your_linkedin_password',
};
```

**Note:** The frontend credentials are only used to pre-fill the login form. The actual LinkedIn login happens through the backend using Playwright automation.

## Additional Resources

- [Google AI Studio](https://makersuite.google.com/app/apikey) - Get your API key
- [Gemini API Documentation](https://ai.google.dev/docs) - API docs
- [.gitignore Documentation](https://git-scm.com/docs/gitignore) - Git ignore patterns
