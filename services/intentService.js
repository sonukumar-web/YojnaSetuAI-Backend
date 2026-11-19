// services/intentService.js

const CATEGORY_MAP = {
    'agriculture': 'Agriculture',
    'farming': 'Agriculture',
    'farmer': 'Agriculture',
    'crop': 'Agriculture',
    'kisan': 'Agriculture',
    
    'education': 'Education',
    'school': 'Education',
    'college': 'Education',
    'university': 'Education',
    'student': 'Education',
    'scholarship': 'Education',
    'study': 'Education',
    
    'healthcare': 'Healthcare',
    'health': 'Healthcare',
    'medical': 'Healthcare',
    'hospital': 'Healthcare',
    'treatment': 'Healthcare',
    
    'housing': 'Housing',
    'house': 'Housing',
    'home': 'Housing',
    'shelter': 'Housing',
    'awas': 'Housing',
    
    'employment': 'Employment',
    'job': 'Employment',
    'work': 'Employment',
    'career': 'Employment',
    'employee': 'Employment',
    'worker': 'Employment',
    
    'financial': 'Financial',
    'finance': 'Financial',
    'money': 'Financial',
    'loan': 'Financial',
    'bank': 'Financial',
    'credit': 'Financial',
    
    'social welfare': 'Social Welfare',
    'social': 'Social Welfare',
    'welfare': 'Social Welfare',
    'pension': 'Social Welfare',
    'insurance': 'Social Welfare',
    
    'infrastructure': 'Infrastructure',
    'road': 'Infrastructure',
    'bridge': 'Infrastructure',
    'building': 'Infrastructure',
    'construction': 'Infrastructure',
    
    'technology': 'Technology',
    'tech': 'Technology',
    'digital': 'Technology',
    'it': 'Technology'
};

const SCHEME_PATTERNS = [
    /scheme/i,
    /yojana/i,
    /plan/i,
    /program/i,
    /benefit/i,
    /help/i,
    /support/i,
    /assistance/i
];

function detectIntent(message, conversationHistory) {
    const lowerMsg = message.toLowerCase().trim();
    
    // Check for greetings
    if (lowerMsg.match(/^(hi|hello|hey|hii|helo|heyy|namaste|good morning|good afternoon|good evening)/)) {
        return { intent: 'GREETING', category: null };
    }
    
    // Check for name ask
    if (lowerMsg.match(/your name|who are you|tell me about yourself/)) {
        return { intent: 'INTRODUCTION', category: null };
    }
    
    // Check for schemes request
    const isSchemeRequest = SCHEME_PATTERNS.some(pattern => pattern.test(lowerMsg));
    
    // Check for category
    let detectedCategory = null;
    let categoryConfidence = 0;
    
    // First check exact category matches
    for (const [key, value] of Object.entries(CATEGORY_MAP)) {
        if (lowerMsg.includes(key)) {
            detectedCategory = value;
            categoryConfidence = Math.max(categoryConfidence, 2);
        }
    }
    
    // Check if it's a single word category
    const singleWord = lowerMsg.trim();
    if (singleWord in CATEGORY_MAP) {
        detectedCategory = CATEGORY_MAP[singleWord];
        categoryConfidence = 3;
    }
    
    // Check conversation history for context
    if (!detectedCategory && conversationHistory.length > 0) {
        // Look for last mentioned category in history
        const lastMessages = conversationHistory.slice(-4);
        for (const msg of lastMessages) {
            if (msg.role === 'assistant') {
                // Check if assistant mentioned categories
                for (const [key, value] of Object.entries(CATEGORY_MAP)) {
                    if (msg.content.toLowerCase().includes(value.toLowerCase())) {
                        detectedCategory = value;
                        categoryConfidence = 1;
                        break;
                    }
                }
            }
        }
    }
    
    // Determine intent
    let intent = 'GENERAL_CONVERSATION';
    
    if (detectedCategory && isSchemeRequest) {
        intent = 'SCHEME_CATEGORY';
    } else if (detectedCategory && !isSchemeRequest) {
        // If only category mentioned but no scheme words, check context
        const lastUserMsg = conversationHistory.filter(m => m.role === 'user').pop();
        if (lastUserMsg && SCHEME_PATTERNS.some(p => p.test(lastUserMsg.content))) {
            intent = 'SCHEME_CATEGORY';
        } else {
            // Could be a topic switch
            intent = 'SCHEME_CATEGORY';
        }
    } else if (isSchemeRequest && !detectedCategory) {
        intent = 'SCHEME_DISCOVERY';
    }
    
    // Check for follow-up questions
    if (lowerMsg.match(/^(it|this|that|which one|what about)/) && conversationHistory.length > 0) {
        intent = 'FOLLOW_UP';
    }
    
    // Check for eligibility
    if (lowerMsg.includes('eligibility') || lowerMsg.includes('eligible') || lowerMsg.includes('can i get')) {
        intent = 'ELIGIBILITY';
    }
    
    // Check for documents
    if (lowerMsg.includes('document') || lowerMsg.includes('documents') || lowerMsg.includes('upload')) {
        intent = 'DOCUMENTS';
    }
    
    // Check for application
    if (lowerMsg.includes('apply') || lowerMsg.includes('application') || lowerMsg.includes('how to')) {
        intent = 'APPLICATION';
    }
    
    // Check for bookmarks
    if (lowerMsg.includes('bookmark') || lowerMsg.includes('saved') || lowerMsg.includes('favorite')) {
        intent = 'BOOKMARKS';
    }
    
    // Check for thanks
    if (lowerMsg.includes('thank') || lowerMsg.includes('thanks') || lowerMsg.includes('thank you')) {
        intent = 'THANKS';
    }
    
    return {
        intent,
        category: detectedCategory,
        categoryConfidence,
        isSchemeRequest
    };
}

function detectCategoryFromMessage(message) {
    const lowerMsg = message.toLowerCase().trim();
    
    // Check direct match
    if (lowerMsg in CATEGORY_MAP) {
        return CATEGORY_MAP[lowerMsg];
    }
    
    // Check partial match
    for (const [key, value] of Object.entries(CATEGORY_MAP)) {
        if (lowerMsg.includes(key)) {
            return value;
        }
    }
    
    return null;
}

function isSingleWordCategory(message) {
    const lowerMsg = message.toLowerCase().trim();
    return lowerMsg in CATEGORY_MAP;
}

module.exports = {
    detectIntent,
    detectCategoryFromMessage,
    isSingleWordCategory,
    CATEGORY_MAP
};