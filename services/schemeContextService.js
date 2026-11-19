// services/schemeContextService.js
const Scheme = require('../models/Scheme');

// Escape regex special characters
function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Find scheme by name (exact or partial)
async function findSchemeByName(name) {
    if (!name || name.trim().length === 0) return null;
    
    const searchName = name.trim();
    
    // Try exact match first (case insensitive)
    let scheme = await Scheme.findOne({
        status: 'Active',
        name: { $regex: `^${escapeRegex(searchName)}$`, $options: 'i' }
    }).lean();
    
    if (scheme) return scheme;
    
    // Try partial match
    scheme = await Scheme.findOne({
        status: 'Active',
        name: { $regex: escapeRegex(searchName), $options: 'i' }
    }).lean();
    
    if (scheme) return scheme;
    
    // Try searching in shortDescription
    scheme = await Scheme.findOne({
        status: 'Active',
        shortDescription: { $regex: escapeRegex(searchName), $options: 'i' }
    }).lean();
    
    return scheme || null;
}

// Resolve scheme from message and context
async function resolveSchemeFromMessage({ message, conversationHistory, currentSchemeName, currentCategory }) {
    const lowerMsg = message.toLowerCase().trim();
    
    // Check if message contains a scheme name
    // First, check if it's a direct scheme name query
    if (lowerMsg.includes('tell me about') || lowerMsg.includes('more about')) {
        const parts = lowerMsg.split(/tell me about|more about/i);
        if (parts.length > 1) {
            const schemeName = parts[1].trim().replace(/[?.,!]/g, '').trim();
            if (schemeName.length > 2) {
                const scheme = await findSchemeByName(schemeName);
                if (scheme) return scheme;
            }
        }
    }
    
    // Check if message contains a scheme name (for eligibility, documents, etc.)
    // Look for: "am I eligible for [scheme]", "documents for [scheme]", etc.
    const forMatch = lowerMsg.match(/for\s+([a-zA-Z0-9\s]+)/i);
    if (forMatch) {
        const schemeName = forMatch[1].trim().replace(/[?.,!]/g, '').trim();
        if (schemeName.length > 2) {
            const scheme = await findSchemeByName(schemeName);
            if (scheme) return scheme;
        }
    }
    
    // Check if message is just a scheme name
    const words = lowerMsg.split(/\s+/).filter(w => w.length > 2);
    for (const word of words) {
        const scheme = await findSchemeByName(word);
        if (scheme) return scheme;
    }
    
    // Use current scheme from context
    if (currentSchemeName) {
        const scheme = await findSchemeByName(currentSchemeName);
        if (scheme) return scheme;
    }
    
    // Check conversation history for mentioned scheme
    if (conversationHistory && conversationHistory.length > 0) {
        // Look for assistant messages that mentioned scheme names
        const assistantMessages = conversationHistory.filter(msg => msg.role === 'assistant').slice(-3);
        for (const msg of assistantMessages) {
            // Look for scheme names in the assistant's response
            const lines = msg.content.split('\n');
            for (const line of lines) {
                // Check if line contains a scheme name pattern
                const match = line.match(/^\d+\.\s*([^:\n]+)/);
                if (match) {
                    const schemeName = match[1].trim();
                    if (schemeName.length > 2) {
                        const scheme = await findSchemeByName(schemeName);
                        if (scheme) return scheme;
                    }
                }
            }
        }
    }
    
    return null;
}

// Get relevant schemes by category
async function getSchemesByCategory(category, limit = 50) {
    if (!category) return [];
    
    const schemes = await Scheme.find({
        status: 'Active',
        category: category
    })
    .select('name shortDescription fullDescription category governmentLevel state department benefitType benefitAmount paymentFrequency benefitDescription eligibilityText requiredDocuments officialUrl applicationUrl helplineNumber email launchDate')
    .limit(limit)
    .lean();
    
    return schemes;
}

// Get relevant schemes based on message
async function getRelevantSchemes({ message, userProfile, conversationHistory, limit = 20 }) {
    try {
        const query = { status: 'Active' };
        let searchType = 'general';
        let detectedCategory = null;

        // Category mapping
        const categoryMap = {
            'agriculture': 'Agriculture',
            'farming': 'Agriculture',
            'farmer': 'Agriculture',
            'education': 'Education',
            'school': 'Education',
            'college': 'Education',
            'university': 'Education',
            'student': 'Education',
            'scholarship': 'Education',
            'healthcare': 'Healthcare',
            'health': 'Healthcare',
            'medical': 'Healthcare',
            'housing': 'Housing',
            'house': 'Housing',
            'home': 'Housing',
            'awas': 'Housing',
            'employment': 'Employment',
            'job': 'Employment',
            'work': 'Employment',
            'financial': 'Financial',
            'finance': 'Financial',
            'loan': 'Financial',
            'social welfare': 'Social Welfare',
            'social': 'Social Welfare',
            'welfare': 'Social Welfare',
            'infrastructure': 'Infrastructure',
            'technology': 'Technology',
            'tech': 'Technology'
        };

        const lowerMsg = message.toLowerCase().trim();
        
        // Check if single word category
        if (lowerMsg in categoryMap) {
            detectedCategory = categoryMap[lowerMsg];
            query.category = detectedCategory;
            searchType = 'category';
        } else {
            // Check for category in message
            for (const [key, value] of Object.entries(categoryMap)) {
                if (lowerMsg.includes(key)) {
                    detectedCategory = value;
                    query.category = detectedCategory;
                    searchType = 'category';
                    break;
                }
            }
        }

        // If no category found, check conversation history
        if (!detectedCategory && conversationHistory && conversationHistory.length > 0) {
            const lastMessages = conversationHistory.slice(-6);
            for (const msg of lastMessages) {
                if (msg.role === 'user') {
                    const msgLower = msg.content.toLowerCase();
                    for (const [key, value] of Object.entries(categoryMap)) {
                        if (msgLower.includes(key)) {
                            detectedCategory = value;
                            query.category = detectedCategory;
                            searchType = 'category';
                            break;
                        }
                    }
                    if (detectedCategory) break;
                }
            }
        }

        // If no category, search by text
        if (!detectedCategory) {
            const cleanMessage = message.replace(/[^\w\s]/g, '').trim();
            if (cleanMessage.length > 2) {
                query.$text = { $search: cleanMessage };
                searchType = 'text';
            }
        }

        // Execute query with limit
        let schemes = await Scheme.find(query)
            .select('name shortDescription fullDescription category governmentLevel state department benefitType benefitAmount paymentFrequency benefitDescription eligibilityText requiredDocuments officialUrl applicationUrl helplineNumber email launchDate')
            .limit(limit)
            .lean();

        // If no results and query had text search, try category fallback
        if (schemes.length === 0 && query.$text) {
            delete query.$text;
            schemes = await Scheme.find(query)
                .select('name shortDescription fullDescription category governmentLevel state department benefitType benefitAmount paymentFrequency benefitDescription eligibilityText requiredDocuments officialUrl applicationUrl helplineNumber email launchDate')
                .limit(limit)
                .lean();
        }

        // If still no results, return some active schemes
        if (schemes.length === 0 && !detectedCategory) {
            schemes = await Scheme.find({ status: 'Active' })
                .select('name shortDescription fullDescription category governmentLevel state department benefitType benefitAmount paymentFrequency benefitDescription eligibilityText requiredDocuments officialUrl applicationUrl helplineNumber email launchDate')
                .limit(5)
                .lean();
        }

        return {
            schemes,
            searchType,
            detectedCategory,
            count: schemes.length
        };
    } catch (error) {
        console.error('Error getting relevant schemes:', error);
        return {
            schemes: [],
            searchType: 'error',
            detectedCategory: null,
            count: 0
        };
    }
}

module.exports = {
    getRelevantSchemes,
    getSchemesByCategory,
    findSchemeByName,
    resolveSchemeFromMessage,
    escapeRegex
};