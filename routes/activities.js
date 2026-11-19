const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getUserActivities, getActivityTypes } = require('../services/activityService');

// @desc    Get user's recent activities
// @route   GET /api/activities
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const filter = {
            type: req.query.type || null,
            fromDate: req.query.fromDate || null,
            toDate: req.query.toDate || null
        };

        const result = await getUserActivities(req.user._id, limit, offset);
        
        res.status(200).json({
            success: true,
            count: result.length,
            data: result
        });
    } catch (error) {
        console.error('Error fetching activities:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch activities',
            error: error.message
        });
    }
});

// @desc    Get activity types (for filtering)
// @route   GET /api/activities/types
// @access  Private
router.get('/types', protect, async (req, res) => {
    try {
        const types = getActivityTypes();
        res.status(200).json({
            success: true,
            data: types
        });
    } catch (error) {
        console.error('Error fetching activity types:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch activity types',
            error: error.message
        });
    }
});

module.exports = router;