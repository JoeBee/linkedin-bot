# Security & Environment Variables

## API Key Configuration

This project uses Google Gemini AI, which requires an API key. The API key is stored securely in environment variables and is **never** committed to the repository.

## Setup Instructions

### 1. Create your `.env` file

Copy the example file:

```bash
cd backend
cp .env.example .env
```

### 2. Add your API key

Edit `backend/.env` and add your Gemini API key:

```env
GEMINI_API_KEY=your_actual_api_key_here
```

### 3. Get your API key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and paste it into your `.env` file

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

- `backend/.env` - Contains your actual API key
- `.env` - Any environment files
- `*.env` - All environment file variants
- `secrets.json` - Any secret configuration files
- `credentials.json` - Any credential files

## Verifying Security

Check that your `.env` file is ignored:

```bash
git status backend/.env
```

If Git shows "nothing to commit", your `.env` is properly ignored. ✅

If Git shows the file as "untracked" or "modified", check your `.gitignore`. ❌

## What if I accidentally committed my API key?

If you accidentally committed your API key:

1. **Immediately rotate your API key** at [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Update your `backend/.env` with the new key
3. Remove the key from Git history (advanced - seek help if needed)
4. Never use the exposed key again

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

## Additional Resources

- [Google AI Studio](https://makersuite.google.com/app/apikey) - Get your API key
- [Gemini API Documentation](https://ai.google.dev/docs) - API docs
- [.gitignore Documentation](https://git-scm.com/docs/gitignore) - Git ignore patterns
