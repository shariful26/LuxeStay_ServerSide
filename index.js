import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDatabase } from './src/config/db.js';

// Import Route Modules
import authRoutes from './src/routes/authRoutes.js';
// Server routes & auth reloaded
import userRoutes from './src/routes/userRoutes.js';
import hotelRoutes from './src/routes/hotelRoutes.js';
import roomRoutes from './src/routes/roomRoutes.js';
import destinationRoutes from './src/routes/destinationRoutes.js';
import offerRoutes from './src/routes/offerRoutes.js';
import blogRoutes from './src/routes/blogRoutes.js';
import bookingRoutes from './src/routes/bookingRoutes.js';
import payoutRoutes from './src/routes/payoutRoutes.js';
import reviewRoutes from './src/routes/reviewRoutes.js';
import inventoryRoutes from './src/routes/inventoryRoutes.js';
import conciergeRoutes from './src/routes/conciergeRoutes.js';
import transferRoutes from './src/routes/transferRoutes.js';
import adminRoutes from './src/routes/adminRoutes.js';
import messageRoutes from './src/routes/messageRoutes.js';
import systemRoutes from './src/routes/systemRoutes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Standard Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize Database Connection & Auto-Seed
connectDatabase();

// Root Welcome Endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    name: 'LuxeStay Hospitality REST API Gateway',
    version: '1.0.0',
    documentation: '/DOCUMENTATION.md'
  });
});

// Mount Modular API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/hotels', hotelRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/destinations', destinationRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/concierge', conciergeRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api', systemRoutes);

// Global 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: `API route '${req.originalUrl}' not found.` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.stack);
  res.status(500).json({ error: 'Internal server error occurred.' });
});

// Start Express Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 LuxeStay Pro Server running on http://127.0.0.1:${PORT}`);
});

export default app;
