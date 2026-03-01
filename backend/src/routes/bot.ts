import { Router } from 'express';
import {
  getState,
  getDiagnostics,
  login,
  refreshConversations,
  openConversation,
  getLastMessages,
  sendMessage,
  stopBrowser,
} from '../linkedin/automation';
import { generateReply } from '../services/ai-service';

export const botRouter = Router();

botRouter.get('/status', (_req, res) => {
  res.json(getState());
});

botRouter.get('/diagnostics', (_req, res) => {
  res.json(getDiagnostics());
});

botRouter.post('/login', async (req, res) => {
  const { email, password, headless } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  try {
    const isHeadless = headless === true;
    await login(String(email).trim(), String(password), isHeadless);
    res.json({ ok: true, message: 'Logged in' });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Login failed';
    res.status(401).json({ error: message });
  }
});

botRouter.post('/conversations/refresh', async (_req, res) => {
  try {
    const list = await refreshConversations();
    const diagnostics = getDiagnostics();
    res.json({ conversations: list, diagnostics });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Refresh failed';
    res.status(500).json({ error: message });
  }
});

botRouter.post('/conversations/:id/open', async (req, res) => {
  const { id } = req.params;
  try {
    const ok = await openConversation(id);
    const messages = ok ? await getLastMessages(200) : [];
    res.json({ ok, messages });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' });
  }
});

botRouter.post('/send', async (req, res) => {
  const { text } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Message text required' });
  }
  try {
    const ok = await sendMessage(text.trim());
    res.json({ ok });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Send failed' });
  }
});

botRouter.post('/logout', async (_req, res) => {
  try {
    await stopBrowser();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Logout failed' });
  }
});

botRouter.post('/generate-reply', async (req, res) => {
  const { conversationHistory, recipientName } = req.body || {};
  
  if (!Array.isArray(conversationHistory)) {
    return res.status(400).json({ error: 'Conversation history required' });
  }
  
  if (!recipientName || typeof recipientName !== 'string') {
    return res.status(400).json({ error: 'Recipient name required' });
  }

  try {
    const generatedReply = await generateReply(conversationHistory, recipientName);
    res.json({ reply: generatedReply });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to generate reply';
    res.status(500).json({ error: message });
  }
});
