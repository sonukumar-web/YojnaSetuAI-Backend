const mongoose = require('mongoose');

const EligibilitySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    scheme: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Scheme',
        required: true
    },
    // Overall eligibility score (0-100)
    score: {
        type: Number,
        default: 0
    },
    // Eligibility status
    status: {
        type: String,
        enum: ['Eligible', 'Partially Eligible', 'Not Eligible', 'Pending'],
        default: 'Pending'
    },
    // Detailed eligibility analysis
    analysis: {
        summary: {
            type: String,
            default: ''
        },
        description: {
            type: String,
            default: ''
        },
        recommendations: [{
            type: String
        }],
        strengths: [{
            type: String
        }],
        weaknesses: [{
            type: String
        }],
        missingRequirements: [{
            type: String
        }]
    },
    // Category-wise scores
    categoryScores: {
        personal: { type: Number, default: 0 },
        education: { type: Number, default: 0 },
        financial: { type: Number, default: 0 },
        documents: { type: Number, default: 0 },
        social: { type: Number, default: 0 },
        residence: { type: Number, default: 0 }
    },
    // Document status
    documentStatus: {
        required: { type: Number, default: 0 },
        uploaded: { type: Number, default: 0 },
        missing: { type: Number, default: 0 },
        details: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    // Missing documents list
    missingDocuments: [{
        type: String
    }],
    // Checked date
    checkedAt: {
        type: Date,
        default: Date.now
    },
    // Last updated
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Index for quick lookup
EligibilitySchema.index({ user: 1, scheme: 1 }, { unique: true });

module.exports = mongoose.model('Eligibility', EligibilitySchema);