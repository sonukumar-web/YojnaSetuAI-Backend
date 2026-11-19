const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Eligibility = require('../models/Eligibility');
const Scheme = require('../models/Scheme');
const User = require('../models/User');
const Document = require('../models/Document');
const { analyzeEligibility, generateFallbackAnalysis } = require('../services/eligibilityService');
const { logActivity } = require('../services/activityService');

// @desc    Check eligibility for a scheme
// @route   POST /api/eligibility/check/:schemeId
// @access  Private
router.post('/check/:schemeId', protect, async (req, res) => {
    try {
        const schemeId = req.params.schemeId;
        const userId = req.user._id;

        // Check if scheme exists
        const scheme = await Scheme.findById(schemeId);
        if (!scheme) {
            return res.status(404).json({
                success: false,
                message: 'Scheme not found'
            });
        }

        // Get user profile
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get user documents
        const documents = await Document.find({ user: userId });

        // Check if eligibility already exists
        let eligibility = await Eligibility.findOne({
            user: userId,
            scheme: schemeId
        });

        // If eligibility exists and is not older than 7 days, return cached result
        if (eligibility) {
            const daysOld = (Date.now() - new Date(eligibility.checkedAt).getTime()) / (1000 * 60 * 60 * 24);
            if (daysOld < 7) {
                return res.status(200).json({
                    success: true,
                    cached: true,
                    data: eligibility,
                    message: 'Using cached eligibility result'
                });
            }
        }

        // Prepare data for analysis
        const userProfile = {
            name: user.name,
            email: user.email,
            phone: user.phone,
            profile: user.profile || {}
        };

        const userDocuments = documents.map(doc => ({
            documentKey: doc.documentKey,
            name: doc.name,
            status: doc.status,
            extractedData: doc.extractedData,
            isPredefined: doc.isPredefined
        }));

        // Analyze eligibility using AI or fallback
        let analysisResult;
        try {
            // Try AI analysis first
            analysisResult = await analyzeEligibility(scheme, userProfile, userDocuments);
        } catch (error) {
            console.error('AI analysis failed, using fallback:', error);
            // Use fallback analysis
            analysisResult = generateFallbackAnalysis(scheme, userProfile, userDocuments);
        }

        // Calculate document status
        const requiredDocs = scheme.requiredDocuments || [];
        const uploadedDocKeys = userDocuments.map(d => d.documentKey).filter(Boolean);
        const missingDocs = requiredDocs.filter(d => !uploadedDocKeys.includes(d.documentKey));

        // Create or update eligibility record
        const eligibilityData = {
            user: userId,
            scheme: schemeId,
            score: analysisResult.score || 0,
            status: analysisResult.status || 'Pending',
            analysis: analysisResult.analysis || {
                summary: 'Analysis complete',
                description: 'Detailed analysis available',
                recommendations: [],
                strengths: [],
                weaknesses: [],
                missingRequirements: []
            },
            categoryScores: analysisResult.categoryScores || {
                personal: 0,
                education: 0,
                financial: 0,
                documents: 0,
                social: 0,
                residence: 0
            },
            documentStatus: {
                required: requiredDocs.length,
                uploaded: requiredDocs.length - missingDocs.length,
                missing: missingDocs.length,
                details: requiredDocs.reduce((acc, doc) => {
                    const key = doc.documentKey || doc.customName || 'unknown';
                    acc[key] = {
                        uploaded: uploadedDocKeys.includes(doc.documentKey),
                        name: doc.customName || doc.documentKey || 'Document'
                    };
                    return acc;
                }, {})
            },
            missingDocuments: missingDocs.map(d => d.customName || d.documentKey || 'Document'),
            checkedAt: new Date(),
            updatedAt: new Date()
        };

        if (eligibility) {
            // Update existing record
            eligibility = await Eligibility.findByIdAndUpdate(
                eligibility._id,
                eligibilityData,
                { new: true }
            );
        } else {
            // Create new record
            eligibility = await Eligibility.create(eligibilityData);
        }

        // Log activity
        await logActivity(
            req.user._id,
            'check_eligibility',
            `Checked eligibility for: ${scheme.name}`,
            `User checked eligibility for "${scheme.name}" (Score: ${analysisResult.score || 0}%)`,
            { 
                schemeId: schemeId, 
                schemeName: scheme.name, 
                score: analysisResult.score || 0,
                status: analysisResult.status || 'Pending',
                category: scheme.category
            },
            req
        );

        res.status(200).json({
            success: true,
            cached: false,
            data: eligibility,
            message: 'Eligibility checked successfully'
        });

    } catch (error) {
        console.error('Error checking eligibility:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check eligibility',
            error: error.message
        });
    }
});

// @desc    Get eligibility for a scheme
// @route   GET /api/eligibility/:schemeId
// @access  Private
router.get('/:schemeId', protect, async (req, res) => {
    try {
        const schemeId = req.params.schemeId;
        const userId = req.user._id;

        const eligibility = await Eligibility.findOne({
            user: userId,
            scheme: schemeId
        });

        if (!eligibility) {
            return res.status(404).json({
                success: false,
                message: 'Eligibility not found. Please check eligibility first.'
            });
        }

        res.status(200).json({
            success: true,
            data: eligibility
        });

    } catch (error) {
        console.error('Error fetching eligibility:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch eligibility',
            error: error.message
        });
    }
});

// @desc    Refresh eligibility (force re-analysis)
// @route   POST /api/eligibility/refresh/:schemeId
// @access  Private
router.post('/refresh/:schemeId', protect, async (req, res) => {
    try {
        const schemeId = req.params.schemeId;
        const userId = req.user._id;

        // Check if scheme exists
        const scheme = await Scheme.findById(schemeId);
        if (!scheme) {
            return res.status(404).json({
                success: false,
                message: 'Scheme not found'
            });
        }

        // Get user profile
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get user documents
        const documents = await Document.find({ user: userId });

        // Prepare data for analysis
        const userProfile = {
            name: user.name,
            email: user.email,
            phone: user.phone,
            profile: user.profile || {}
        };

        const userDocuments = documents.map(doc => ({
            documentKey: doc.documentKey,
            name: doc.name,
            status: doc.status,
            extractedData: doc.extractedData,
            isPredefined: doc.isPredefined
        }));

        // Analyze eligibility
        let analysisResult;
        try {
            analysisResult = await analyzeEligibility(scheme, userProfile, userDocuments);
        } catch (error) {
            console.error('AI analysis failed, using fallback:', error);
            analysisResult = generateFallbackAnalysis(scheme, userProfile, userDocuments);
        }

        // Calculate document status
        const requiredDocs = scheme.requiredDocuments || [];
        const uploadedDocKeys = userDocuments.map(d => d.documentKey).filter(Boolean);
        const missingDocs = requiredDocs.filter(d => !uploadedDocKeys.includes(d.documentKey));

        // Create or update eligibility record
        const eligibilityData = {
            user: userId,
            scheme: schemeId,
            score: analysisResult.score || 0,
            status: analysisResult.status || 'Pending',
            analysis: analysisResult.analysis || {
                summary: 'Analysis complete',
                description: 'Detailed analysis available',
                recommendations: [],
                strengths: [],
                weaknesses: [],
                missingRequirements: []
            },
            categoryScores: analysisResult.categoryScores || {
                personal: 0,
                education: 0,
                financial: 0,
                documents: 0,
                social: 0,
                residence: 0
            },
            documentStatus: {
                required: requiredDocs.length,
                uploaded: requiredDocs.length - missingDocs.length,
                missing: missingDocs.length,
                details: requiredDocs.reduce((acc, doc) => {
                    const key = doc.documentKey || doc.customName || 'unknown';
                    acc[key] = {
                        uploaded: uploadedDocKeys.includes(doc.documentKey),
                        name: doc.customName || doc.documentKey || 'Document'
                    };
                    return acc;
                }, {})
            },
            missingDocuments: missingDocs.map(d => d.customName || d.documentKey || 'Document'),
            checkedAt: new Date(),
            updatedAt: new Date()
        };

        let eligibility = await Eligibility.findOneAndUpdate(
            { user: userId, scheme: schemeId },
            eligibilityData,
            { new: true, upsert: true }
        );

        // Log refresh activity
        await logActivity(
            req.user._id,
            'check_eligibility',
            `Refreshed eligibility for: ${scheme.name}`,
            `User refreshed eligibility for "${scheme.name}" (Score: ${analysisResult.score || 0}%)`,
            { 
                schemeId: schemeId, 
                schemeName: scheme.name, 
                score: analysisResult.score || 0,
                status: analysisResult.status || 'Pending',
                category: scheme.category,
                refreshed: true
            },
            req
        );

        res.status(200).json({
            success: true,
            data: eligibility,
            message: 'Eligibility refreshed successfully'
        });

    } catch (error) {
        console.error('Error refreshing eligibility:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to refresh eligibility',
            error: error.message
        });
    }
});

// @desc    Get eligibility for all schemes (dashboard)
// @route   GET /api/eligibility/all
// @access  Private
router.get('/all', protect, async (req, res) => {
    try {
        const userId = req.user._id;

        const eligibilities = await Eligibility.find({ user: userId })
            .populate('scheme', 'name category status')
            .sort({ checkedAt: -1 });

        res.status(200).json({
            success: true,
            count: eligibilities.length,
            data: eligibilities
        });

    } catch (error) {
        console.error('Error fetching eligibilities:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch eligibilities',
            error: error.message
        });
    }
});

// @desc    Delete eligibility record
// @route   DELETE /api/eligibility/:schemeId
// @access  Private
router.delete('/:schemeId', protect, async (req, res) => {
    try {
        const schemeId = req.params.schemeId;
        const userId = req.user._id;

        const result = await Eligibility.findOneAndDelete({
            user: userId,
            scheme: schemeId
        });

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Eligibility record not found'
            });
        }

        // Log delete activity
        await logActivity(
            req.user._id,
            'update_profile',
            `Deleted eligibility record`,
            `User deleted eligibility record for scheme`,
            { 
                schemeId: schemeId,
                deletedRecord: result
            },
            req
        );

        res.status(200).json({
            success: true,
            message: 'Eligibility record deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting eligibility:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete eligibility',
            error: error.message
        });
    }
});

module.exports = router;