const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: [
            'view_scheme',
            'check_eligibility',
            'upload_document',
            'delete_document',
            'bookmark_scheme',
            'unbookmark_scheme',
            'update_profile',
            'chat_message',
            'login',
            'logout',
            'search',
            'scheme_created',
            'scheme_updated',
            'scheme_deleted'
        ],
        required: true
    },
    action: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    ip: {
        type: String,
        default: ''
    },
    userAgent: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for faster queries
ActivitySchema.index({ user: 1, createdAt: -1 });
ActivitySchema.index({ user: 1, type: 1 });
ActivitySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Activity', ActivitySchema);