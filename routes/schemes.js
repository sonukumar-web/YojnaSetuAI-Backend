const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const Scheme = require('../models/Scheme');
const User = require('../models/User');
const PREDEFINED_DOCUMENTS = require('../config/documents');
const { logActivity } = require('../services/activityService');

// ==================== BOOKMARK ROUTES (MUST COME FIRST) ====================

// @desc    Get user's bookmarked schemes
// @route   GET /api/schemes/bookmarks
// @access  Private
router.get('/bookmarks', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate({
            path: 'bookmarks',
            populate: {
                path: 'createdBy',
                select: 'name email'
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            count: user.bookmarks.length,
            data: user.bookmarks
        });

    } catch (error) {
        console.error('Error fetching bookmarks:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch bookmarks',
            error: error.message
        });
    }
});

// @desc    Toggle bookmark for a scheme
// @route   POST /api/schemes/bookmark/:id
// @access  Private
router.post('/bookmark/:id', protect, async (req, res) => {
    try {
        const schemeId = req.params.id;
        const userId = req.user._id;

        // Check if scheme exists
        const scheme = await Scheme.findById(schemeId);
        if (!scheme) {
            return res.status(404).json({
                success: false,
                message: 'Scheme not found'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if already bookmarked
        const isBookmarked = user.bookmarks.some(id => id.toString() === schemeId);

        if (isBookmarked) {
            // Remove bookmark
            user.bookmarks = user.bookmarks.filter(id => id.toString() !== schemeId);
            await user.save();
            
            await logActivity(
                req.user._id,
                'unbookmark_scheme',
                `Unbookmarked scheme: ${scheme.name}`,
                `User removed bookmark for "${scheme.name}"`,
                { schemeId: schemeId, schemeName: scheme.name },
                req
            );
            
            res.status(200).json({
                success: true,
                message: 'Bookmark removed',
                isBookmarked: false
            });
        } else {
            // Add bookmark
            user.bookmarks.push(schemeId);
            await user.save();
            
            await logActivity(
                req.user._id,
                'bookmark_scheme',
                `Bookmarked scheme: ${scheme.name}`,
                `User bookmarked "${scheme.name}"`,
                { schemeId: schemeId, schemeName: scheme.name },
                req
            );
            
            res.status(200).json({
                success: true,
                message: 'Bookmark added',
                isBookmarked: true
            });
        }

    } catch (error) {
        console.error('Error toggling bookmark:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle bookmark',
            error: error.message
        });
    }
});

// ==================== PREDEFINED DOCUMENTS ROUTE ====================

// @desc    Get predefined documents for scheme creation
// @route   GET /api/schemes/documents/predefined
// @access  Private/Admin
router.get('/documents/predefined', protect, authorize('admin'), async (req, res) => {
    try {
        const documents = PREDEFINED_DOCUMENTS.map(doc => ({
            documentKey: doc.documentKey,
            name: doc.name,
            category: doc.category,
            description: doc.description,
            isPredefined: true
        }));

        res.status(200).json({
            success: true,
            data: documents
        });

    } catch (error) {
        console.error('Error fetching predefined documents:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch predefined documents',
            error: error.message
        });
    }
});

// ==================== PUBLIC ROUTES ====================

// @desc    Get all schemes (public access)
// @route   GET /api/schemes/public
// @access  Public
router.get('/public', async (req, res) => {
    try {
        const { category, governmentLevel, search } = req.query;
        
        let query = { status: 'Active' };
        
        if (category) {
            query.category = category;
        }
        
        if (governmentLevel) {
            query.governmentLevel = governmentLevel;
        }
        
        if (search) {
            query.$text = { $search: search };
        }
        
        const schemes = await Scheme.find(query)
            .select('name shortDescription fullDescription category governmentLevel department status launchDate benefitType benefitAmount eligibilityText requiredDocuments')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: schemes.length,
            data: schemes
        });

    } catch (error) {
        console.error('Error fetching public schemes:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch schemes',
            error: error.message
        });
    }
});

// ==================== CRUD ROUTES ====================

// @desc    Get all schemes
// @route   GET /api/schemes
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const { category, governmentLevel, status, search } = req.query;
        
        let query = {};
        
        if (category) {
            query.category = category;
        }
        
        if (governmentLevel) {
            query.governmentLevel = governmentLevel;
        }
        
        if (status) {
            if (req.user.role === 'admin') {
                query.status = status;
            } else {
                query.status = 'Active';
            }
        } else {
            if (req.user.role !== 'admin') {
                query.status = 'Active';
            }
        }
        
        if (search) {
            query.$text = { $search: search };
        }
        
        const schemes = await Scheme.find(query)
            .populate('createdBy', 'name email')
            .populate('updatedBy', 'name email')
            .sort({ createdAt: -1 });

        // Get user's bookmarks
        const user = await User.findById(req.user._id);
        const bookmarks = user?.bookmarks || [];

        // Add isBookmarked flag to each scheme
        const schemesWithBookmark = schemes.map(scheme => {
            const schemeObj = scheme.toObject();
            schemeObj.isBookmarked = bookmarks.some(id => id.toString() === scheme._id.toString());
            return schemeObj;
        });

        res.status(200).json({
            success: true,
            count: schemes.length,
            data: schemesWithBookmark
        });

    } catch (error) {
        console.error('Error fetching schemes:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch schemes',
            error: error.message
        });
    }
});

// @desc    Create a new scheme
// @route   POST /api/schemes
// @access  Private/Admin
router.post('/', protect, authorize('admin'), async (req, res) => {
    try {
        const {
            name,
            shortDescription,
            fullDescription,
            category,
            governmentLevel,
            state,
            department,
            status,
            launchDate,
            expiryDate,
            officialUrl,
            applicationUrl,
            helplineNumber,
            email,
            benefitType,
            benefitAmount,
            paymentFrequency,
            benefitDescription,
            eligibilityText,
            requiredDocuments
        } = req.body;

        if (!name || !shortDescription || !fullDescription || !governmentLevel || !department || !launchDate || !eligibilityText) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields'
            });
        }

        const scheme = await Scheme.create({
            name,
            shortDescription,
            fullDescription,
            category: category || 'Other',
            governmentLevel,
            state: state || '',
            department,
            status: status || 'Draft',
            launchDate: new Date(launchDate),
            expiryDate: expiryDate ? new Date(expiryDate) : null,
            officialUrl: officialUrl || '',
            applicationUrl: applicationUrl || '',
            helplineNumber: helplineNumber || '',
            email: email || '',
            benefitType: benefitType || 'Other',
            benefitAmount: benefitAmount || '',
            paymentFrequency: paymentFrequency || 'N/A',
            benefitDescription: benefitDescription || '',
            eligibilityText,
            requiredDocuments: requiredDocuments || [],
            createdBy: req.user._id,
            updatedBy: req.user._id
        });

        // Log activity
        await logActivity(
            req.user._id,
            'scheme_created',
            `Created scheme: ${scheme.name}`,
            `Admin created scheme "${scheme.name}"`,
            { schemeId: scheme._id, schemeName: scheme.name, category: scheme.category },
            req
        );

        res.status(201).json({
            success: true,
            message: 'Scheme created successfully',
            data: scheme
        });

    } catch (error) {
        console.error('Error creating scheme:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create scheme',
            error: error.message
        });
    }
});

// @desc    Get a single scheme
// @route   GET /api/schemes/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const scheme = await Scheme.findById(req.params.id)
            .populate('createdBy', 'name email')
            .populate('updatedBy', 'name email');

        if (!scheme) {
            return res.status(404).json({
                success: false,
                message: 'Scheme not found'
            });
        }

        if (req.user.role !== 'admin' && scheme.status !== 'Active') {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to view this scheme'
            });
        }

        // Check if bookmarked
        const user = await User.findById(req.user._id);
        const isBookmarked = user?.bookmarks?.some(id => id.toString() === scheme._id.toString()) || false;

        const schemeObj = scheme.toObject();
        schemeObj.isBookmarked = isBookmarked;

        // Log activity (after fetching scheme successfully)
        await logActivity(
            req.user._id,
            'view_scheme',
            `Viewed scheme: ${scheme.name}`,
            `User viewed scheme "${scheme.name}"`,
            { schemeId: scheme._id, schemeName: scheme.name, category: scheme.category },
            req
        );

        res.status(200).json({
            success: true,
            data: schemeObj
        });

    } catch (error) {
        console.error('Error fetching scheme:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch scheme',
            error: error.message
        });
    }
});

// @desc    Update a scheme
// @route   PUT /api/schemes/:id
// @access  Private/Admin
router.put('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        let scheme = await Scheme.findById(req.params.id);

        if (!scheme) {
            return res.status(404).json({
                success: false,
                message: 'Scheme not found'
            });
        }

        const {
            name,
            shortDescription,
            fullDescription,
            category,
            governmentLevel,
            state,
            department,
            status,
            launchDate,
            expiryDate,
            officialUrl,
            applicationUrl,
            helplineNumber,
            email,
            benefitType,
            benefitAmount,
            paymentFrequency,
            benefitDescription,
            eligibilityText,
            requiredDocuments
        } = req.body;

        const oldName = scheme.name;

        scheme.name = name || scheme.name;
        scheme.shortDescription = shortDescription || scheme.shortDescription;
        scheme.fullDescription = fullDescription || scheme.fullDescription;
        scheme.category = category || scheme.category;
        scheme.governmentLevel = governmentLevel || scheme.governmentLevel;
        scheme.state = state !== undefined ? state : scheme.state;
        scheme.department = department || scheme.department;
        scheme.status = status || scheme.status;
        scheme.launchDate = launchDate ? new Date(launchDate) : scheme.launchDate;
        scheme.expiryDate = expiryDate ? new Date(expiryDate) : null;
        scheme.officialUrl = officialUrl !== undefined ? officialUrl : scheme.officialUrl;
        scheme.applicationUrl = applicationUrl !== undefined ? applicationUrl : scheme.applicationUrl;
        scheme.helplineNumber = helplineNumber !== undefined ? helplineNumber : scheme.helplineNumber;
        scheme.email = email !== undefined ? email : scheme.email;
        scheme.benefitType = benefitType || scheme.benefitType;
        scheme.benefitAmount = benefitAmount !== undefined ? benefitAmount : scheme.benefitAmount;
        scheme.paymentFrequency = paymentFrequency || scheme.paymentFrequency;
        scheme.benefitDescription = benefitDescription !== undefined ? benefitDescription : scheme.benefitDescription;
        scheme.eligibilityText = eligibilityText || scheme.eligibilityText;
        scheme.requiredDocuments = requiredDocuments || scheme.requiredDocuments;
        scheme.updatedBy = req.user._id;
        scheme.updatedAt = Date.now();

        await scheme.save();

        // Log activity
        await logActivity(
            req.user._id,
            'scheme_updated',
            `Updated scheme: ${scheme.name}`,
            `Admin updated scheme "${scheme.name}"`,
            { 
                schemeId: scheme._id, 
                schemeName: scheme.name, 
                oldName: oldName,
                category: scheme.category,
                updatedFields: Object.keys(req.body)
            },
            req
        );

        res.status(200).json({
            success: true,
            message: 'Scheme updated successfully',
            data: scheme
        });

    } catch (error) {
        console.error('Error updating scheme:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update scheme',
            error: error.message
        });
    }
});

// @desc    Delete a scheme
// @route   DELETE /api/schemes/:id
// @access  Private/Admin
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const scheme = await Scheme.findById(req.params.id);

        if (!scheme) {
            return res.status(404).json({
                success: false,
                message: 'Scheme not found'
            });
        }

        const schemeName = scheme.name;

        await scheme.deleteOne();

        // Log activity
        await logActivity(
            req.user._id,
            'scheme_deleted',
            `Deleted scheme: ${schemeName}`,
            `Admin deleted scheme "${schemeName}"`,
            { 
                schemeId: req.params.id, 
                schemeName: schemeName,
                category: scheme.category
            },
            req
        );

        res.status(200).json({
            success: true,
            message: 'Scheme deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting scheme:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete scheme',
            error: error.message
        });
    }
});

module.exports = router;