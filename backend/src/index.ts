import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { botRouter } from './routes/bot';
import { conversationsRouter } from './routes/conversations';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true }));
app.use(express.json());

app.use('/api/bot', botRouter);
app.use('/api/conversations', conversationsRouter);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, message: 'LinkedIn bot API' });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
