const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Debug middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/user'));
app.use('/api/gemini', require('./routes/gemini'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/schemes', require('./routes/schemes'));
app.use('/api/eligibility', require('./routes/eligibility'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/activities', require('./routes/activities')); // Add this line

// Root route
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'YojanaSetu AI API is running!',
        version: '1.0.0',
        endpoints: {
            auth: {
                register: 'POST /api/auth/register',
                login: 'POST /api/auth/login',
                me: 'GET /api/auth/me',
                update: 'PUT /api/auth/update',
                profile: 'PATCH /api/auth/profile',
                role: 'PATCH /api/auth/role/:id',
                users: 'GET /api/auth/users'
            },
            documents: {
                upload: 'POST /api/documents/upload',
                getAll: 'GET /api/documents',
                getOne: 'GET /api/documents/:id',
                delete: 'DELETE /api/documents/:id',
                status: 'GET /api/documents/status/:id'
            },
            schemes: {
                create: 'POST /api/schemes',
                getAll: 'GET /api/schemes',
                getOne: 'GET /api/schemes/:id',
                update: 'PUT /api/schemes/:id',
                delete: 'DELETE /api/schemes/:id',
                public: 'GET /api/schemes/public',
                documents: 'GET /api/schemes/documents/predefined',
                bookmark: 'POST /api/schemes/bookmark/:id',
                bookmarks: 'GET /api/schemes/bookmarks'
            },
            eligibility: {
                check: 'POST /api/eligibility/check/:schemeId',
                get: 'GET /api/eligibility/:schemeId',
                refresh: 'POST /api/eligibility/refresh/:schemeId',
                all: 'GET /api/eligibility/all',
                delete: 'DELETE /api/eligibility/:schemeId'
            },
            chat: {
                message: 'POST /api/chat/message',
                history: 'GET /api/chat/history',
                sessions: 'GET /api/chat/sessions',
                delete: 'DELETE /api/chat/session/:sessionId',
                clear: 'DELETE /api/chat/clear'
            },
            activities: {
                getAll: 'GET /api/activities',
                types: 'GET /api/activities/types'
            },
            gemini: {
                summary: 'POST /api/gemini/summary'
            }
        }
    });
});

// 404 handler
app.use((req, res) => {
    console.log('404 Not Found:', req.method, req.url);
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📁 Uploads directory: ${path.join(__dirname, 'uploads')}`);
});