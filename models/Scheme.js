const mongoose = require('mongoose');

const SchemeSchema = new mongoose.Schema({
    // Basic Information
    name: {
        type: String,
        required: [true, 'Please add a scheme name'],
        trim: true,
        maxlength: [100, 'Scheme name cannot be more than 100 characters']
    },
    shortDescription: {
        type: String,
        required: [true, 'Please add a short description'],
        maxlength: [200, 'Short description cannot be more than 200 characters']
    },
    fullDescription: {
        type: String,
        required: [true, 'Please add a full description']
    },
    
    // Category & Government Level
    category: {
        type: String,
        enum: ['Agriculture', 'Education', 'Healthcare', 'Housing', 'Employment', 'Financial', 'Social Welfare', 'Infrastructure', 'Technology', 'Other'],
        default: 'Other'
    },
    governmentLevel: {
        type: String,
        enum: ['Central', 'State', 'District', 'Local'],
        required: [true, 'Please select government level']
    },
    state: {
        type: String,
        default: ''
    },
    department: {
        type: String,
        required: [true, 'Please add department/ministry name'],
        trim: true
    },
    
    // Status & Dates
    status: {
        type: String,
        enum: ['Active', 'Inactive', 'Draft', 'Expired'],
        default: 'Draft'
    },
    launchDate: {
        type: Date,
        required: [true, 'Please add launch date']
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    expiryDate: {
        type: Date,
        default: null
    },
    
    // Contact Information
    officialUrl: {
        type: String,
        default: ''
    },
    applicationUrl: {
        type: String,
        default: ''
    },
    helplineNumber: {
        type: String,
        default: ''
    },
    email: {
        type: String,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please add a valid email'
        ]
    },
    
    // Benefit Information
    benefitType: {
        type: String,
        enum: ['Financial Assistance', 'Scholarship', 'Subsidy', 'Loan', 'Pension', 'Insurance', 'Healthcare', 'Housing', 'Employment', 'Training', 'Other'],
        default: 'Other'
    },
    benefitAmount: {
        type: String,
        default: ''
    },
    paymentFrequency: {
        type: String,
        enum: ['Annual', 'Monthly', 'Quarterly', 'One-time', 'N/A'],
        default: 'N/A'
    },
    benefitDescription: {
        type: String,
        default: ''
    },
    
    // Eligibility (Free text)
    eligibilityText: {
        type: String,
        required: [true, 'Please add eligibility details']
    },
    
    // Required Documents - Array of document keys and custom documents
    requiredDocuments: [{
        type: {
            type: String,
            enum: ['predefined', 'custom'],
            default: 'predefined'
        },
        documentKey: {
            type: String,
            default: null
        },
        customName: {
            type: String,
            default: null
        },
        required: {
            type: Boolean,
            default: true
        }
    }],
    
    // Admin who created/updated the scheme
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Index for searching
SchemeSchema.index({ name: 'text', shortDescription: 'text', fullDescription: 'text' });

module.exports = mongoose.model('Scheme', SchemeSchema);