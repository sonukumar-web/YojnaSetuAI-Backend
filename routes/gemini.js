const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');

// Generate a structured summary from profile data
const generateProfileSummary = (profileData) => {
    const name = profileData?.name || 'User';
    const age = profileData?.age || 'Not specified';
    const gender = profileData?.gender || 'Not specified';
    const state = profileData?.state || 'Not specified';
    const district = profileData?.district || 'Not specified';
    const city = profileData?.city || 'Not specified';
    const education = profileData?.educationLevel || 'Not specified';
    const course = profileData?.courseDegree || '';
    const educationStatus = profileData?.educationStatus || '';
    const occupation = profileData?.occupation || 'Not specified';
    const employmentType = profileData?.employmentType || '';
    const annualIncome = profileData?.annualIncome || 'Not specified';
    const category = profileData?.category || 'Not specified';
    const maritalStatus = profileData?.maritalStatus || 'Not specified';
    const familySize = profileData?.familySize || 'Not specified';
    const residenceType = profileData?.residenceType || 'Not specified';
    const housingStatus = profileData?.housingStatus || '';
    const farmerStatus = profileData?.farmerStatus || 'No';
    const disabilityStatus = profileData?.disabilityStatus || 'No';
    const disabilityPercentage = profileData?.disabilityPercentage || '';
    const bplStatus = profileData?.bplStatus || 'No';
    const minorityCommunity = profileData?.minorityCommunity || 'No';
    const incomeCertificate = profileData?.incomeCertificate || 'No';
    const rationCardType = profileData?.rationCardType || 'N/A';

    // Build location string
    const location = [city, district, state].filter(Boolean).join(', ');

    // Build education string
    const educationStr = [education, course, educationStatus].filter(Boolean).join(' - ');

    // Build summary
    const summary = `${name} is a ${age} year old ${gender} ${occupation} from ${location || state}. ` +
        `Education: ${educationStr || 'Not specified'}. ` +
        `Category: ${category}. Income: ${annualIncome}. ` +
        `Residence: ${residenceType} (${housingStatus}).`;

    // Build eligibility highlights
    const eligibility = [];
    if (category && category !== 'Not specified') {
        eligibility.push(`Category (${category}) - Eligible for category-specific schemes`);
    }
    if (annualIncome && annualIncome !== 'Not specified') {
        eligibility.push(`Income (${annualIncome}) - May be eligible for income-based schemes`);
    }
    if (state && state !== 'Not specified') {
        eligibility.push(`State (${state}) - Eligible for state government schemes`);
    }
    if (education && education !== 'Not specified') {
        eligibility.push(`Education (${education}) - Eligible for educational scholarships`);
    }
    if (occupation && occupation !== 'Not specified') {
        eligibility.push(`Occupation (${occupation}) - Eligible for occupation-specific schemes`);
    }
    if (farmerStatus === 'Yes') {
        eligibility.push('Farmer - Eligible for agricultural schemes');
    }
    if (disabilityStatus === 'Yes') {
        eligibility.push(`Disability (${disabilityPercentage || 'Yes'}) - Eligible for disability schemes`);
    }
    if (bplStatus === 'Yes') {
        eligibility.push('BPL - Eligible for BPL category schemes');
    }
    if (minorityCommunity === 'Yes') {
        eligibility.push('Minority Community - Eligible for minority welfare schemes');
    }
    if (incomeCertificate === 'Yes') {
        eligibility.push('Income Certificate Available - Can apply for income-based schemes');
    }

    // Build missing information
    const missingInfo = [];
    if (!profileData?.incomeCertificate || profileData?.incomeCertificate === '') {
        missingInfo.push('Income Certificate (required for income-based schemes)');
    }
    if (!profileData?.educationLevel || profileData?.educationLevel === '') {
        missingInfo.push('Educational Documents (required for scholarships)');
    }
    if (!profileData?.category || profileData?.category === '') {
        missingInfo.push('Category Certificate (if applicable)');
    }
    if (!profileData?.state || profileData?.state === '') {
        missingInfo.push('State/Residence Proof');
    }

    return {
        summary: summary,
        eligibility: eligibility.length > 0 ? eligibility : ['Complete your profile to see eligibility highlights'],
        missingInfo: missingInfo.length > 0 ? missingInfo : ['All required information provided']
    };
};

// @desc    Generate profile summary
// @route   POST /api/gemini/summary
// @access  Private
router.post('/summary', protect, async (req, res) => {
    try {
        const profileData = req.body.profileData;

        if (!profileData) {
            return res.status(400).json({
                success: false,
                message: 'Profile data is required'
            });
        }

        // Generate summary from profile data
        const summaryData = generateProfileSummary(profileData);

        // Save the summary to the user's profile
        try {
            const user = await User.findById(req.user._id);
            if (user) {
                if (!user.profile) user.profile = {};
                user.profile.aiSummary = summaryData;
                user.profile.aiSummaryGeneratedAt = new Date();
                user.updatedAt = Date.now();
                await user.save();
            }
        } catch (saveError) {
            console.error('Error saving summary:', saveError);
        }

        res.status(200).json({
            success: true,
            data: summaryData
        });

    } catch (error) {
        console.error('Summary generation error:', error);
        
        // Generate fallback summary
        const fallbackData = req.body.profileData || {};
        const summaryData = generateProfileSummary(fallbackData);
        
        // Try to save the fallback
        try {
            const user = await User.findById(req.user._id);
            if (user) {
                if (!user.profile) user.profile = {};
                user.profile.aiSummary = summaryData;
                user.profile.aiSummaryGeneratedAt = new Date();
                user.updatedAt = Date.now();
                await user.save();
            }
        } catch (saveError) {
            console.error('Error saving fallback summary:', saveError);
        }

        res.status(200).json({
            success: true,
            data: summaryData
        });
    }
});

// @desc    Get saved profile summary
// @route   GET /api/gemini/summary
// @access  Private
router.get('/summary', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        
        if (!user || !user.profile || !user.profile.aiSummary) {
            return res.status(404).json({
                success: false,
                message: 'No summary found'
            });
        }

        res.status(200).json({
            success: true,
            data: user.profile.aiSummary,
            generatedAt: user.profile.aiSummaryGeneratedAt
        });

    } catch (error) {
        console.error('Error fetching summary:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch summary',
            error: error.message
        });
    }
});

module.exports = router;