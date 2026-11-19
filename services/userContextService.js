// services/userContextService.js
const User = require('../models/User');
const Document = require('../models/Document');

async function getUserAIContext(userId) {
    try {
        // Get user with profile and bookmarks
        const user = await User.findById(userId)
            .select('name email phone profile bookmarks')
            .populate('bookmarks', 'name category shortDescription')
            .lean();

        if (!user) {
            return null;
        }

        // Get user documents
        const documents = await Document.find({ user: userId })
            .select('name type category status ocrConfidence readabilityScore extractedData detectedType isPredefined')
            .lean();

        // Format profile for AI
        const profile = user.profile || {};
        const formattedProfile = {
            name: user.name || '',
            email: user.email || '',
            phone: user.phone || '',
            age: profile.age || '',
            gender: profile.gender || '',
            state: profile.state || '',
            district: profile.district || '',
            city: profile.city || '',
            educationLevel: profile.educationLevel || '',
            courseDegree: profile.courseDegree || '',
            educationStatus: profile.educationStatus || '',
            occupation: profile.occupation || '',
            employmentType: profile.employmentType || '',
            annualIncome: profile.annualIncome || '',
            incomeCategory: profile.incomeCategory || '',
            category: profile.category || '',
            maritalStatus: profile.maritalStatus || '',
            disabilityStatus: profile.disabilityStatus || '',
            disabilityPercentage: profile.disabilityPercentage || '',
            minorityCommunity: profile.minorityCommunity || '',
            bplStatus: profile.bplStatus || '',
            rationCardType: profile.rationCardType || '',
            familySize: profile.familySize || '',
            residenceType: profile.residenceType || '',
            housingStatus: profile.housingStatus || '',
            landOwnership: profile.landOwnership || '',
            landArea: profile.landArea || '',
            farmerStatus: profile.farmerStatus || '',
            incomeCertificate: profile.incomeCertificate || ''
        };

        // Format documents for AI
        const formattedDocuments = documents.map(doc => {
            const docData = {
                name: doc.name || 'Document',
                type: doc.type || '',
                category: doc.category || '',
                status: doc.status || 'Not Uploaded',
                isPredefined: doc.isPredefined || false
            };

            // Add extracted data if available and confidence is reasonable
            if (doc.extractedData && doc.ocrConfidence > 60) {
                // Only include safe fields, not sensitive numbers
                const safeData = {};
                const safeFields = ['name', 'dob', 'dateOfBirth', 'gender', 'state', 'district', 'address', 'category', 'education', 'course', 'year', 'percentage', 'cgpa', 'institution', 'bankName', 'branch', 'issuingAuthority', 'issueDate', 'validUntil'];
                
                for (const [key, value] of Object.entries(doc.extractedData)) {
                    if (safeFields.includes(key) && value) {
                        safeData[key] = value;
                    }
                }
                
                if (Object.keys(safeData).length > 0) {
                    docData.extractedInfo = safeData;
                }
            }

            if (doc.ocrConfidence) {
                docData.confidence = doc.ocrConfidence;
            }

            if (doc.readabilityScore) {
                docData.readability = doc.readabilityScore;
            }

            return docData;
        });

        // Format bookmarks
        const formattedBookmarks = (user.bookmarks || []).map(bookmark => ({
            name: bookmark.name || 'Scheme',
            category: bookmark.category || '',
            description: bookmark.shortDescription || ''
        }));

        // Determine if user has enough profile info for eligibility
        const hasBasicInfo = !!(formattedProfile.age && formattedProfile.state && formattedProfile.category);
        const hasIncomeInfo = !!(formattedProfile.annualIncome || formattedProfile.incomeCertificate === 'Yes');
        const hasDocuments = documents.length > 0;

        return {
            profile: formattedProfile,
            documents: formattedDocuments,
            bookmarks: formattedBookmarks,
            metadata: {
                hasBasicInfo,
                hasIncomeInfo,
                hasDocuments,
                documentCount: documents.length,
                uploadedCount: documents.filter(d => d.status === 'Uploaded' || d.status === 'Extracted').length,
                extractedCount: documents.filter(d => d.status === 'Extracted').length
            }
        };
    } catch (error) {
        console.error('Error getting user AI context:', error);
        return null;
    }
}

module.exports = {
    getUserAIContext
};