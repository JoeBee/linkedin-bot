# Quick Reference: Using AI Reply Generation

## How to Use

### Step 1: Open the App
Navigate to: http://localhost:4200

### Step 2: Log In (if needed)
- Enter LinkedIn credentials
- Click "Login"
- Wait for browser automation to complete

### Step 3: Load Conversations
- Click "Refresh conversations"
- Wait for conversation list to load

### Step 4: Select a Conversation
- Click on any conversation from the list
- Messages will load in the right panel

### Step 5: Generate AI Reply
- Click the "🤖 Generate AI Reply" button
- Wait 2-3 seconds for AI to analyze conversation
- AI-generated message appears in the text box

### Step 6: Review and Edit
- Read the generated message
- Edit if needed (it's just a suggestion!)
- Make it your own

### Step 7: Send
- Click "Send" when ready
- Message is sent to LinkedIn

## What the AI Considers

The AI analyzes:
- ✅ Full conversation history (all messages)
- ✅ Who said what (You vs. other person)
- ✅ Message timestamps (conversation flow)
- ✅ Context and topics discussed
- ✅ Tone of the conversation
- ✅ Questions that need answering
- ✅ Professional LinkedIn standards

## Tips for Best Results

1. **More context = better replies**
   - Longer conversations provide more context
   - AI understands the relationship better

2. **Review before sending**
   - AI suggestions are starting points
   - Add your personal touch
   - Fix any inaccuracies

3. **Edit freely**
   - Change tone (more/less formal)
   - Add specific details AI doesn't know
   - Remove anything you don't like

4. **Use for inspiration**
   - Great for writer's block
   - Helps structure responses
   - Saves time on routine replies

## Button States

| State | Appearance | When |
|-------|-----------|------|
| Active | Blue with 🤖 | Conversation open with messages |
| Disabled | Grayed out | No conversation selected |
| Loading | Grayed out | AI is generating reply |

## Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "No conversation selected" | Button clicked without opening conversation | Open a conversation first |
| "No messages to analyze" | Conversation has no messages | Select different conversation |
| "Invalid Gemini API key" | API key incorrect | Check .env file |
| "Gemini API quota exceeded" | Too many requests | Wait and try again |
| "Failed to generate AI reply" | Network/API error | Try again in a moment |

## Keyboard Shortcuts

None yet, but you could add:
- Ctrl+G: Generate AI reply
- Ctrl+Enter: Send message

## Technical Details

- **Model**: Google Gemini 1.5 Flash
- **Response Time**: 2-5 seconds typically
- **Cost**: FREE (within limits)
- **Max Length**: ~200 words
- **Language**: English (can handle others)

## Customizing AI Behavior

To change AI behavior, edit `backend/src/services/ai-service.ts`:

```typescript
// Change the prompt around line 35:
const prompt = `You are helping compose a professional LinkedIn message...

Guidelines:
- Keep it professional and friendly
- Address any questions or points raised
- Keep the response under 200 words
- Match the tone of the conversation
...
```

You can modify:
- Tone (formal, casual, friendly)
- Length (shorter, longer)
- Style (direct, detailed, concise)
- Focus (answer questions, schedule meetings, etc.)

## Example Use Cases

### 1. Responding to Connection Requests
**Conversation:**
- Them: "Hi! I saw your profile and would love to connect."

**Generated:** "Thanks for reaching out! I'd be happy to connect. I see we both work in [industry]. Looking forward to staying in touch!"

### 2. Following Up on Conversations
**Conversation:**
- You: "Let me know if you're free next week"
- Them: "Tuesday works!"

**Generated:** "Perfect! Tuesday it is. How about 2 PM? I'll send a calendar invite."

### 3. Answering Questions
**Conversation:**
- Them: "What tools do you use for project management?"

**Generated:** "Great question! We primarily use Jira for tracking and Confluence for documentation. Also use Slack for team communication. Happy to share more details if you're interested!"

## Troubleshooting

### AI button is grayed out
✅ Make sure you've opened a conversation
✅ Check that messages loaded (visible in right panel)
✅ Wait for loading spinner to finish

### Generated text is strange
✅ Check conversation history loaded correctly
✅ Try generating again (AI is probabilistic)
✅ Edit the text before sending

### "API quota exceeded" error
✅ Free tier: 15 requests per minute
✅ Wait 1 minute and try again
✅ Consider upgrading API plan if needed

### Backend not responding
✅ Check terminal 2 - backend should show "Server running at http://localhost:3000"
✅ Restart backend: cd backend && npm run dev
✅ Check .env has GEMINI_API_KEY

## Privacy & Safety

- ✅ Conversation data sent to Google Gemini API
- ✅ Google's privacy policy applies
- ✅ No data stored permanently by us
- ✅ Always review AI-generated content
- ❌ Don't send sensitive information without review

## Support

If something isn't working:
1. Check browser console (F12) for errors
2. Check backend terminal for errors
3. Verify API key is correct in .env
4. Try refreshing the page
5. Restart backend server
