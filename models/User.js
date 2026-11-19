const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name'],
        trim: true,
        maxlength: [50, 'Name cannot be more than 50 characters']
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please add a valid email'
        ]
    },
    phone: {
        type: String,
        required: [true, 'Please add a phone number'],
        match: [
            /^[0-9]{10}$/,
            'Please add a valid 10-digit phone number'
        ]
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    password: {
        type: String,
        required: [true, 'Please add a password'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // Add bookmarks field
    bookmarks: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Scheme'
    }],
    profile: {
        // Personal Information
        age: { type: String, default: '' },
        dateOfBirth: { type: String, default: '' },
        gender: { type: String, default: '' },
        state: { type: String, default: '' },
        district: { type: String, default: '' },
        city: { type: String, default: '' },
        
        // Education & Employment
        educationLevel: { type: String, default: '' },
        courseDegree: { type: String, default: '' },
        educationStatus: { type: String, default: '' },
        occupation: { type: String, default: '' },
        employmentType: { type: String, default: '' },
        
        // Financial Information
        annualIncome: { type: String, default: '' },
        incomeCertificate: { type: String, default: '' },
        incomeCategory: { type: String, default: '' },
        
        // Social / Eligibility
        category: { type: String, default: '' },
        maritalStatus: { type: String, default: '' },
        disabilityStatus: { type: String, default: '' },
        disabilityPercentage: { type: String, default: '' },
        minorityCommunity: { type: String, default: '' },
        bplStatus: { type: String, default: '' },
        rationCardType: { type: String, default: '' },
        
        // Family & Residence
        familySize: { type: String, default: '' },
        residenceType: { type: String, default: '' },
        housingStatus: { type: String, default: '' },
        landOwnership: { type: String, default: '' },
        landArea: { type: String, default: '' },
        farmerStatus: { type: String, default: '' },
        
        // AI Summary
        aiSummary: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        aiSummaryGeneratedAt: {
            type: Date,
            default: null
        }
    },
    documents: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document'
    }],
    preferences: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Encrypt password using bcrypt
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    this.updatedAt = Date.now();
    next();
});

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Check if model already exists before creating
module.exports = mongoose.models.User || mongoose.model('User', UserSchema);