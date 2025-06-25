import express from 'express';
import cors from 'cors';
import eventsRouter from './routes/events';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(cors(), express.json());
app.use('/api/events', eventsRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
