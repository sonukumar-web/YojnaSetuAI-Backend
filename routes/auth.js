const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { logActivity } = require('../services/activityService');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        // Check if phone already exists
        const existingPhone = await User.findOne({ phone });
        if (existingPhone) {
            return res.status(400).json({
                success: false,
                message: 'Phone number already registered'
            });
        }

        // Create user with default role 'user'
        const user = await User.create({
            name,
            email,
            phone,
            password,
            role: 'user' // Default role
        });

        // Create token
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE }
        );

        // Log registration activity
        await logActivity(
            user._id,
            'login',
            `User registered: ${email}`,
            `New user registered with email ${email}`,
            { 
                userId: user._id,
                email: user.email,
                name: user.name,
                registrationMethod: 'email'
            },
            req
        );

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                profile: user.profile,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate email & password
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        // Check for user
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Account is deactivated. Please contact admin.'
            });
        }

        // Check if password matches
        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Create token with role included
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE }
        );

        // Log login activity
        await logActivity(
            user._id,
            'login',
            `User logged in: ${email}`,
            `User logged in successfully`,
            { 
                userId: user._id,
                email: user.email,
                loginMethod: 'email'
            },
            req
        );

        res.status(200).json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                profile: user.profile,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', async (req, res) => {
    try {
        // Get token from header
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Log logout activity
        await logActivity(
            user._id,
            'logout',
            `User logged out: ${user.email}`,
            `User logged out successfully`,
            { 
                userId: user._id,
                email: user.email
            },
            req
        );

        res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Failed to logout',
            error: error.message
        });
    }
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', async (req, res) => {
    try {
        // Get token from header
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                profile: user.profile,
                preferences: user.preferences,
                isActive: user.isActive,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }
        });
    } catch (error) {
        console.error(error);
        res.status(401).json({
            success: false,
            message: 'Not authorized'
        });
    }
});

// @desc    Update user profile
// @route   PUT /api/auth/update
// @access  Private
router.put('/update', async (req, res) => {
    try {
        // Get token from header
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const oldData = {
            name: user.name,
            email: user.email,
            phone: user.phone
        };

        // Update fields
        const { name, email, phone, profile, preferences } = req.body;
        
        if (name) user.name = name;
        if (email) user.email = email;
        if (phone) user.phone = phone;
        
        // Update profile fields if provided
        if (profile) {
            // Personal Information
            if (profile.age !== undefined) user.profile.age = profile.age;
            if (profile.dateOfBirth !== undefined) user.profile.dateOfBirth = profile.dateOfBirth;
            if (profile.gender !== undefined) user.profile.gender = profile.gender;
            if (profile.state !== undefined) user.profile.state = profile.state;
            if (profile.district !== undefined) user.profile.district = profile.district;
            if (profile.city !== undefined) user.profile.city = profile.city;
            
            // Education & Employment
            if (profile.educationLevel !== undefined) user.profile.educationLevel = profile.educationLevel;
            if (profile.courseDegree !== undefined) user.profile.courseDegree = profile.courseDegree;
            if (profile.educationStatus !== undefined) user.profile.educationStatus = profile.educationStatus;
            if (profile.occupation !== undefined) user.profile.occupation = profile.occupation;
            if (profile.employmentType !== undefined) user.profile.employmentType = profile.employmentType;
            
            // Financial Information
            if (profile.annualIncome !== undefined) user.profile.annualIncome = profile.annualIncome;
            if (profile.incomeCertificate !== undefined) user.profile.incomeCertificate = profile.incomeCertificate;
            if (profile.incomeCategory !== undefined) user.profile.incomeCategory = profile.incomeCategory;
            
            // Social / Eligibility
            if (profile.category !== undefined) user.profile.category = profile.category;
            if (profile.maritalStatus !== undefined) user.profile.maritalStatus = profile.maritalStatus;
            if (profile.disabilityStatus !== undefined) user.profile.disabilityStatus = profile.disabilityStatus;
            if (profile.disabilityPercentage !== undefined) user.profile.disabilityPercentage = profile.disabilityPercentage;
            if (profile.minorityCommunity !== undefined) user.profile.minorityCommunity = profile.minorityCommunity;
            if (profile.bplStatus !== undefined) user.profile.bplStatus = profile.bplStatus;
            if (profile.rationCardType !== undefined) user.profile.rationCardType = profile.rationCardType;
            
            // Family & Residence
            if (profile.familySize !== undefined) user.profile.familySize = profile.familySize;
            if (profile.residenceType !== undefined) user.profile.residenceType = profile.residenceType;
            if (profile.housingStatus !== undefined) user.profile.housingStatus = profile.housingStatus;
            if (profile.landOwnership !== undefined) user.profile.landOwnership = profile.landOwnership;
            if (profile.landArea !== undefined) user.profile.landArea = profile.landArea;
            if (profile.farmerStatus !== undefined) user.profile.farmerStatus = profile.farmerStatus;
        }
        
        if (preferences) user.preferences = preferences;
        user.updatedAt = Date.now();

        await user.save();

        // Log profile update activity
        const updatedFields = [];
        if (name && name !== oldData.name) updatedFields.push('name');
        if (email && email !== oldData.email) updatedFields.push('email');
        if (phone && phone !== oldData.phone) updatedFields.push('phone');
        if (profile) updatedFields.push('profile');

      

        res.status(200).json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                profile: user.profile,
                preferences: user.preferences,
                isActive: user.isActive,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @desc    Update specific profile section
// @route   PATCH /api/auth/profile
// @access  Private
router.patch('/profile', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const { section, data } = req.body;

        if (!section || !data) {
            return res.status(400).json({
                success: false,
                message: 'Please provide section and data'
            });
        }

        // Update specific section
        const sectionMap = {
            'personal': ['age', 'dateOfBirth', 'gender', 'state', 'district', 'city'],
            'education': ['educationLevel', 'courseDegree', 'educationStatus', 'occupation', 'employmentType'],
            'financial': ['annualIncome', 'incomeCertificate', 'incomeCategory'],
            'social': ['category', 'maritalStatus', 'disabilityStatus', 'disabilityPercentage', 'minorityCommunity', 'bplStatus', 'rationCardType'],
            'family': ['familySize', 'residenceType', 'housingStatus', 'landOwnership', 'landArea', 'farmerStatus']
        };

        const fields = sectionMap[section];
        if (!fields) {
            return res.status(400).json({
                success: false,
                message: 'Invalid section'
            });
        }

        const updatedFields = [];
        fields.forEach(field => {
            if (data[field] !== undefined) {
                user.profile[field] = data[field];
                updatedFields.push(field);
            }
        });

        user.updatedAt = Date.now();
        await user.save();

        // Log profile section update
        await logActivity(
            req.user._id,
            'update_profile',
            `Updated ${section} section`,
            `User updated ${section} section of their profile`,
            { 
                userId: user._id,
                email: user.email,
                section: section,
                updatedFields: updatedFields
            },
            req
        );

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                profile: user.profile,
                updatedAt: user.updatedAt
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @desc    Admin: Update user role
// @route   PATCH /api/auth/role/:id
// @access  Private/Admin
router.patch('/role/:id', async (req, res) => {
    try {
        // Get token from header
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized'
            });
        }

        // Verify token and check role
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check if requester is admin
        const requester = await User.findById(decoded.id);
        if (!requester || requester.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized. Admin access required.'
            });
        }

        const { role } = req.body;
        const targetUserId = req.params.id;

        if (!role) {
            return res.status(400).json({
                success: false,
                message: 'Please provide role'
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

        // Cannot change own role (prevent locking yourself out)
        if (targetUserId === decoded.id) {
            return res.status(400).json({
                success: false,
                message: 'Cannot change your own role'
            });
        }

        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const oldRole = targetUser.role;
        targetUser.role = role;
        targetUser.updatedAt = Date.now();
        await targetUser.save();

        // Log role change activity
        await logActivity(
            req.user._id,
            'update_profile',
            `Updated user role: ${targetUser.email}`,
            `Admin changed ${targetUser.email}'s role from ${oldRole} to ${role}`,
            { 
                adminId: req.user._id,
                userId: targetUser._id,
                email: targetUser.email,
                oldRole: oldRole,
                newRole: role
            },
            req
        );

        res.status(200).json({
            success: true,
            message: `User role updated to ${role}`,
            user: {
                id: targetUser._id,
                name: targetUser.name,
                email: targetUser.email,
                role: targetUser.role
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @desc    Admin: Get all users
// @route   GET /api/auth/users
// @access  Private/Admin
router.get('/users', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const requester = await User.findById(decoded.id);
        
        if (!requester || requester.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized. Admin access required.'
            });
        }

        const users = await User.find().select('-password');
        
        res.status(200).json({
            success: true,
            count: users.length,
            data: users
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

module.exports = router;