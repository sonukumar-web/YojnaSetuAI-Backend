const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    documentKey: {
        type: String,
        default: null,
        index: true
    },
    isPredefined: {
        type: Boolean,
        default: false
    },
    name: {
        type: String,
        required: [true, 'Please add a document name']
    },
    originalName: {
        type: String,
        default: ''
    },
    fileName: {
        type: String,
        default: ''
    },
    filePath: {
        type: String,
        default: ''
    },
    fileSize: {
        type: Number,
        default: 0
    },
    mimeType: {
        type: String,
        default: ''
    },
    category: {
        type: String,
        enum: ['Income', 'ID', 'Education', 'Government', 'Custom', 'Other'],
        default: 'Other'
    },
    type: {
        type: String,
        default: ''
    },
    description: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['Not Uploaded', 'Uploaded', 'Processing', 'Extracted', 'Pending', 'Failed'],
        default: 'Not Uploaded'
    },
    ocrText: {
        type: String,
        default: ''
    },
    ocrConfidence: {
        type: Number,
        default: 0
    },
    ocrReason: {
        type: String,
        default: ''
    },
    extractedData: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    detectedType: {
        type: String,
        default: ''
    },
    analysis: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    readabilityScore: {
        type: Number,
        default: 0
    },
    uploadDate: {
        type: Date,
        default: null
    },
    processedAt: {
        type: Date,
        default: null
    }
});

// Ensure unique user + documentKey for predefined documents
DocumentSchema.index({ user: 1, documentKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Document', DocumentSchema);