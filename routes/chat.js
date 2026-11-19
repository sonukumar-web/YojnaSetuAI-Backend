const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Chat = require('../models/Chat');
const { getUserAIContext } = require('../services/userContextService');
const { getRelevantSchemes, resolveSchemeFromMessage, getSchemesByCategory } = require('../services/schemeContextService');
const { generateChatResponse, generateSuggestions } = require('../services/chatService');
const { detectIntent, isSingleWordCategory } = require('../services/intentService');
const { logActivity } = require('../services/activityService');

// @desc    Send a message to AI chat
// @route   POST /api/chat/message
// @access  Private
router.post('/message', protect, async (req, res) => {
    try {
        const { message, sessionId } = req.body;

        if (!message) {
            return res.status(400).json({
                success: false,
                message: 'Message is required'
            });
        }

        // Get or create chat session
        let chat;
        if (sessionId) {
            chat = await Chat.findOne({
                user: req.user._id,
                sessionId: sessionId,
                isActive: true
            });
        }

        if (!chat) {
            const newSessionId = new mongoose.Types.ObjectId().toString();
            chat = await Chat.create({
                user: req.user._id,
                sessionId: newSessionId,
                messages: [],
                context: {}
            });
        }

        // Get user context
        const userContext = await getUserAIContext(req.user._id);

        // Detect intent
        const conversationHistory = chat.messages || [];
        const intent = detectIntent(message, conversationHistory);

        console.log('[CHAT INTENT]', {
            intent: intent.intent,
            category: intent.category,
            message: message
        });

        // Resolve specific scheme if applicable
        let resolvedScheme = null;
        let schemeResult = { schemes: [], count: 0, detectedCategory: null };

        // Check if message references a specific scheme
        if (intent.intent === 'SCHEME_DETAILS' || 
            intent.intent === 'ELIGIBILITY' || 
            intent.intent === 'DOCUMENTS' || 
            intent.intent === 'APPLICATION') {
            
            resolvedScheme = await resolveSchemeFromMessage({
                message: message,
                conversationHistory: chat.messages || [],
                currentSchemeName: chat.context?.currentSchemeName,
                currentCategory: chat.context?.currentCategory
            });

            if (resolvedScheme) {
                console.log('[CHAT SCHEME RESOLVED]', {
                    name: resolvedScheme.name,
                    id: resolvedScheme._id,
                    category: resolvedScheme.category
                });
            }
        }

        // If no specific scheme resolved, get category schemes
        if (!resolvedScheme) {
            // For single word category, use it directly
            let searchMessage = message;
            if (isSingleWordCategory(message) && intent.category) {
                searchMessage = `${intent.category} schemes`;
            }
            
            schemeResult = await getRelevantSchemes({
                message: searchMessage,
                userProfile: userContext?.profile || {},
                conversationHistory: chat.messages || [],
                limit: 50
            });

            console.log('[CHAT SCHEME SEARCH]', {
                category: intent.category,
                count: schemeResult.count,
                searchType: schemeResult.searchType
            });
        }

        // Save user message
        chat.messages.push({
            role: 'user',
            content: message,
            timestamp: new Date()
        });

        // Generate AI response
        const aiResponse = await generateChatResponse(
            chat.messages,
            userContext,
            schemeResult,
            chat.context,
            intent,
            resolvedScheme
        );

        // Save AI response
        chat.messages.push({
            role: 'assistant',
            content: aiResponse.content,
            timestamp: new Date()
        });

        // Update chat context
        chat.context = {
            ...chat.context,
            currentTopic: resolvedScheme?.category || schemeResult.detectedCategory || intent.category || chat.context.currentTopic,
            currentCategory: resolvedScheme?.category || schemeResult.detectedCategory || intent.category || chat.context.currentCategory,
            currentSchemeName: resolvedScheme?.name || chat.context.currentSchemeName,
            currentSchemeId: resolvedScheme?._id || chat.context.currentSchemeId,
            lastIntent: intent.intent,
            schemeCount: resolvedScheme ? 1 : schemeResult.count || 0
        };

        chat.updatedAt = Date.now();
        await chat.save();

        // Log chat activity (every 5 messages or important ones)
        if (chat.messages.length % 3 === 0 || chat.messages.length <= 3) {
            await logActivity(
                req.user._id,
                'chat_message',
                `Chat message sent in session ${chat.sessionId}`,
                `User sent a message in chat (${chat.messages.length} messages total)`,
                { 
                    sessionId: chat.sessionId,
                    messageCount: chat.messages.length,
                    intent: intent.intent,
                    category: intent.category || 'general',
                    messagePreview: message.substring(0, 100),
                    resolvedScheme: resolvedScheme ? {
                        name: resolvedScheme.name,
                        id: resolvedScheme._id,
                        category: resolvedScheme.category
                    } : null
                },
                req
            );
        }

        // Generate suggestions
        const suggestions = generateSuggestions(
            chat.messages,
            userContext,
            chat.context,
            schemeResult,
            resolvedScheme
        );

        res.status(200).json({
            success: true,
            data: {
                message: aiResponse.content,
                sessionId: chat.sessionId,
                suggestions: suggestions,
                messageCount: chat.messages.length,
                metadata: {
                    intent: intent.intent,
                    category: resolvedScheme?.category || schemeResult.detectedCategory || intent.category,
                    schemeCount: resolvedScheme ? 1 : schemeResult.count,
                    resolvedScheme: resolvedScheme ? {
                        name: resolvedScheme.name,
                        id: resolvedScheme._id,
                        category: resolvedScheme.category
                    } : null
                }
            }
        });

    } catch (error) {
        console.error('[CHAT ERROR]', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process message',
            error: error.message
        });
    }
});

// @desc    Get chat history
// @route   GET /api/chat/history
// @access  Private
router.get('/history', protect, async (req, res) => {
    try {
        const { sessionId } = req.query;

        let query = { user: req.user._id, isActive: true };
        if (sessionId) {
            query.sessionId = sessionId;
        }

        const chats = await Chat.find(query)
            .sort({ updatedAt: -1 })
            .limit(20);

        res.status(200).json({
            success: true,
            data: chats
        });

    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch chat history',
            error: error.message
        });
    }
});

// @desc    Get chat sessions
// @route   GET /api/chat/sessions
// @access  Private
router.get('/sessions', protect, async (req, res) => {
    try {
        const sessions = await Chat.aggregate([
            {
                $match: { user: req.user._id, isActive: true }
            },
            {
                $group: {
                    _id: '$sessionId',
                    title: { $first: '$messages.0.content' },
                    createdAt: { $first: '$createdAt' },
                    updatedAt: { $first: '$updatedAt' },
                    messageCount: { $sum: { $size: '$messages' } }
                }
            },
            {
                $sort: { updatedAt: -1 }
            },
            {
                $limit: 20
            }
        ]);

        res.status(200).json({
            success: true,
            data: sessions
        });

    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch sessions',
            error: error.message
        });
    }
});

// @desc    Delete chat session
// @route   DELETE /api/chat/session/:sessionId
// @access  Private
router.delete('/session/:sessionId', protect, async (req, res) => {
    try {
        const { sessionId } = req.params;

        const result = await Chat.updateMany(
            {
                user: req.user._id,
                sessionId: sessionId
            },
            {
                isActive: false
            }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Session not found'
            });
        }

        // Log session deletion
        await logActivity(
            req.user._id,
            'update_profile',
            `Deleted chat session ${sessionId}`,
            `User deleted chat session ${sessionId}`,
            { sessionId: sessionId },
            req
        );

        res.status(200).json({
            success: true,
            message: 'Session deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting session:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete session',
            error: error.message
        });
    }
});

// @desc    Clear all chat history
// @route   DELETE /api/chat/clear
// @access  Private
router.delete('/clear', protect, async (req, res) => {
    try {
        const result = await Chat.updateMany(
            { user: req.user._id },
            { isActive: false }
        );

        // Log clearing chat history
        await logActivity(
            req.user._id,
            'update_profile',
            `Cleared all chat history`,
            `User cleared all chat history`,
            { sessionsCleared: result.modifiedCount },
            req
        );

        res.status(200).json({
            success: true,
            message: 'All chat history cleared'
        });

    } catch (error) {
        console.error('Error clearing chat history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to clear chat history',
            error: error.message
        });
    }
});

// @desc    Get a single chat session
// @route   GET /api/chat/session/:sessionId
// @access  Private
router.get('/session/:sessionId', protect, async (req, res) => {
    try {
        const { sessionId } = req.params;

        const chat = await Chat.findOne({
            user: req.user._id,
            sessionId: sessionId,
            isActive: true
        });

        if (!chat) {
            return res.status(404).json({
                success: false,
                message: 'Session not found'
            });
        }

        res.status(200).json({
            success: true,
            data: chat
        });

    } catch (error) {
        console.error('Error fetching session:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch session',
            error: error.message
        });
    }
});

// Export mongoose for session ID generation
const mongoose = require('mongoose');

module.exports = router;