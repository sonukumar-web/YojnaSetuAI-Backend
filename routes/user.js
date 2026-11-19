const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const User = require('../models/User');
const { logActivity } = require('../services/activityService');

// @desc    Get all users (admin only)
// @route   GET /api/users
// @access  Private/Admin
router.get('/', protect, authorize('admin'), async (req, res) => {
    try {
        const users = await User.find()
            .select('-password')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: users.length,
            data: users
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users',
            error: error.message
        });
    }
});

// @desc    Get a single user (admin only)
// @route   GET /api/users/:id
// @access  Private/Admin
router.get('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('-password')
            .populate('documents')
            .populate('bookmarks');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user',
            error: error.message
        });
    }
});

// @desc    Update user role (admin only)
// @route   PUT /api/users/:id/role
// @access  Private/Admin
router.put('/:id/role', protect, authorize('admin'), async (req, res) => {
    try {
        const { role } = req.body;
        const userId = req.params.id;

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Cannot change own role (prevent locking yourself out)
        if (userId === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot change your own role'
            });
        }

        // Validate role
        const validRoles = ['user', 'admin'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role. Must be user or admin'
            });
        }

        const oldRole = user.role;
        user.role = role;
        user.updatedAt = Date.now();
        await user.save();

        // Log activity
        await logActivity(
            req.user._id,
            'update_profile',
            `Updated user role: ${user.email}`,
            `Admin changed ${user.email}'s role from ${oldRole} to ${role}`,
            { 
                userId: user._id, 
                email: user.email, 
                oldRole: oldRole, 
                newRole: role 
            },
            req
        );

        res.status(200).json({
            success: true,
            message: `User role updated to ${role}`,
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user role',
            error: error.message
        });
    }
});

// @desc    Activate/Deactivate user (admin only)
// @route   PUT /api/users/:id/status
// @access  Private/Admin
router.put('/:id/status', protect, authorize('admin'), async (req, res) => {
    try {
        const { isActive } = req.body;
        const userId = req.params.id;

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Cannot change own status
        if (userId === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot change your own status'
            });
        }

        user.isActive = isActive;
        user.updatedAt = Date.now();
        await user.save();

        // Log activity
        await logActivity(
            req.user._id,
            'update_profile',
            `${isActive ? 'Activated' : 'Deactivated'} user: ${user.email}`,
            `Admin ${isActive ? 'activated' : 'deactivated'} ${user.email}`,
            { 
                userId: user._id, 
                email: user.email, 
                isActive: isActive 
            },
            req
        );

        res.status(200).json({
            success: true,
            message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                isActive: user.isActive
            }
        });
    } catch (error) {
        console.error('Error updating user status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user status',
            error: error.message
        });
    }
});

// @desc    Delete user (admin only)
// @route   DELETE /api/users/:id
// @access  Private/Admin
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const userId = req.params.id;

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Cannot delete own account
        if (userId === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete your own account'
            });
        }

        const userEmail = user.email;

        // Delete user's documents first
        const Document = require('../models/Document');
        await Document.deleteMany({ user: userId });

        // Delete user's chats
        const Chat = require('../models/Chat');
        await Chat.deleteMany({ user: userId });

        // Delete user's eligibility records
        const Eligibility = require('../models/Eligibility');
        await Eligibility.deleteMany({ user: userId });

        // Delete user
        await user.deleteOne();

        // Log activity
        await logActivity(
            req.user._id,
            'update_profile',
            `Deleted user: ${userEmail}`,
            `Admin deleted user ${userEmail}`,
            { userId: userId, email: userEmail },
            req
        );

        res.status(200).json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete user',
            error: error.message
        });
    }
});

// @desc    Get user statistics (admin only)
// @route   GET /api/users/stats
// @access  Private/Admin
router.get('/stats', protect, authorize('admin'), async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ isActive: true });
        const adminUsers = await User.countDocuments({ role: 'admin' });
        const regularUsers = await User.countDocuments({ role: 'user' });

        res.status(200).json({
            success: true,
            data: {
                totalUsers,
                activeUsers,
                adminUsers,
                regularUsers
            }
        });
    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user statistics',
            error: error.message
        });
    }
});

module.exports = router;