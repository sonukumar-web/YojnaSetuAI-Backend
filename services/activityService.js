// services/activityService.js
const Activity = require('../models/Activity');

// Activity types with their icons and colors
const ACTIVITY_TYPES = {
    view_scheme: {
        icon: 'Eye',
        color: '#1677FF',
        label: 'Viewed Scheme'
    },
    check_eligibility: {
        icon: 'Award',
        color: '#7C3AED',
        label: 'Checked Eligibility'
    },
    upload_document: {
        icon: 'Upload',
        color: '#16A36A',
        label: 'Uploaded Document'
    },
    delete_document: {
        icon: 'Trash2',
        color: '#DC2626',
        label: 'Deleted Document'
    },
    bookmark_scheme: {
        icon: 'BookmarkCheck',
        color: '#F59E0B',
        label: 'Bookmarked Scheme'
    },
    unbookmark_scheme: {
        icon: 'BookmarkX',
        color: '#94A3B8',
        label: 'Unbookmarked Scheme'
    },
    update_profile: {
        icon: 'User',
        color: '#1677FF',
        label: 'Updated Profile'
    },
    chat_message: {
        icon: 'MessageCircle',
        color: '#7C3AED',
        label: 'Chat Message'
    },
    login: {
        icon: 'LogIn',
        color: '#16A36A',
        label: 'Logged In'
    },
    logout: {
        icon: 'LogOut',
        color: '#94A3B8',
        label: 'Logged Out'
    },
    search: {
        icon: 'Search',
        color: '#1677FF',
        label: 'Search'
    },
    scheme_created: {
        icon: 'Plus',
        color: '#16A36A',
        label: 'Created Scheme'
    },
    scheme_updated: {
        icon: 'Edit',
        color: '#F59E0B',
        label: 'Updated Scheme'
    },
    scheme_deleted: {
        icon: 'Trash2',
        color: '#DC2626',
        label: 'Deleted Scheme'
    }
};

// Log an activity
async function logActivity(userId, type, action, description, metadata = {}, req = null) {
    try {
        const activityData = {
            user: userId,
            type: type,
            action: action,
            description: description,
            metadata: metadata
        };

        if (req) {
            activityData.ip = req.ip || req.connection?.remoteAddress || '';
            activityData.userAgent = req.headers?.['user-agent'] || '';
        }

        const activity = await Activity.create(activityData);
        return activity;
    } catch (error) {
        console.error('Error logging activity:', error);
        return null;
    }
}

// Get recent activities for a user
async function getUserActivities(userId, limit = 20, offset = 0) {
    try {
        const activities = await Activity.find({ user: userId })
            .sort({ createdAt: -1 })
            .skip(offset)
            .limit(limit)
            .lean();

        // Add type metadata
        const formattedActivities = activities.map(activity => ({
            ...activity,
            typeInfo: ACTIVITY_TYPES[activity.type] || {
                icon: 'Activity',
                color: '#94A3B8',
                label: activity.type
            }
        }));

        return formattedActivities;
    } catch (error) {
        console.error('Error getting user activities:', error);
        return [];
    }
}

// Get activities with pagination
async function getActivities(userId, limit = 20, offset = 0, filter = {}) {
    try {
        const query = { user: userId };
        
        if (filter.type) {
            query.type = filter.type;
        }
        
        if (filter.fromDate) {
            query.createdAt = { $gte: new Date(filter.fromDate) };
        }
        
        if (filter.toDate) {
            if (query.createdAt) {
                query.createdAt.$lte = new Date(filter.toDate);
            } else {
                query.createdAt = { $lte: new Date(filter.toDate) };
            }
        }

        const [activities, total] = await Promise.all([
            Activity.find(query)
                .sort({ createdAt: -1 })
                .skip(offset)
                .limit(limit)
                .lean(),
            Activity.countDocuments(query)
        ]);

        const formattedActivities = activities.map(activity => ({
            ...activity,
            typeInfo: ACTIVITY_TYPES[activity.type] || {
                icon: 'Activity',
                color: '#94A3B8',
                label: activity.type
            }
        }));

        return {
            activities: formattedActivities,
            total,
            offset,
            limit
        };
    } catch (error) {
        console.error('Error getting activities:', error);
        return {
            activities: [],
            total: 0,
            offset: 0,
            limit
        };
    }
}

// Get activity types for filtering
function getActivityTypes() {
    return Object.entries(ACTIVITY_TYPES).map(([key, value]) => ({
        type: key,
        ...value
    }));
}

module.exports = {
    logActivity,
    getUserActivities,
    getActivities,
    getActivityTypes,
    ACTIVITY_TYPES
};