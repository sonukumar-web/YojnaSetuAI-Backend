// services/chatService.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini
let genAI;
let activeModel = null;
let modelInitialized = false;

try {
    if (process.env.GEMINI_API_KEY) {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        console.log('Gemini AI initialized successfully');
    } else {
        console.warn('GEMINI_API_KEY not found in environment variables');
    }
} catch (error) {
    console.error('Error initializing Gemini AI:', error);
}

// Get available model with proper fallback
function getAvailableModel() {
    if (!genAI) return null;
    if (activeModel) return activeModel;
    
    // Current supported models for @google/generative-ai
    // Use gemini-1.5-flash as primary (most stable)
    const modelNames = [
        'gemini-3.5-flash',
        'gemini-1.5-pro',
        'gemini-pro'
    ];
    
    for (const modelName of modelNames) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            // Test with a simple prompt to verify
            console.log(`[CHAT GEMINI] Testing model: ${modelName}`);
            activeModel = model;
            console.log(`[CHAT GEMINI] Using model: ${modelName}`);
            return model;
        } catch (e) {
            console.log(`[CHAT GEMINI] Model ${modelName} not available: ${e.message}`);
            continue;
        }
    }
    
    console.warn('[CHAT GEMINI] No available model found');
    return null;
}

// Build context for Gemini
function buildContext(userContext, schemeResult, chatContext, conversationHistory, currentMessage, intent, resolvedScheme) {
    let context = '';

    // User Profile
    if (userContext?.profile) {
        const p = userContext.profile;
        const hasInfo = p.name || p.age || p.state || p.category || p.occupation || p.annualIncome;
        
        if (hasInfo) {
            context += 'USER PROFILE:\n';
            if (p.name) context += `Name: ${p.name}\n`;
            if (p.age) context += `Age: ${p.age}\n`;
            if (p.gender) context += `Gender: ${p.gender}\n`;
            if (p.state) context += `State: ${p.state}\n`;
            if (p.district) context += `District: ${p.district}\n`;
            if (p.city) context += `City: ${p.city}\n`;
            if (p.educationLevel) context += `Education: ${p.educationLevel} ${p.courseDegree || ''} ${p.educationStatus || ''}\n`;
            if (p.occupation) context += `Occupation: ${p.occupation}\n`;
            if (p.annualIncome) context += `Annual Income: ${p.annualIncome}\n`;
            if (p.category) context += `Category: ${p.category}\n`;
            if (p.farmerStatus === 'Yes') context += `Farmer Status: Yes\n`;
            if (p.maritalStatus) context += `Marital Status: ${p.maritalStatus}\n`;
            if (p.residenceType) context += `Residence: ${p.residenceType}\n`;
            if (p.housingStatus) context += `Housing: ${p.housingStatus}\n`;
            if (p.incomeCertificate === 'Yes') context += `Income Certificate: Available\n`;
            if (p.disabilityStatus === 'Yes') context += `Disability Status: Yes (${p.disabilityPercentage || ''})\n`;
            if (p.bplStatus === 'Yes') context += `BPL Status: Yes\n`;
            context += '\n';
        }
    }

    // User Documents
    if (userContext?.documents && userContext.documents.length > 0) {
        context += 'UPLOADED DOCUMENTS:\n';
        userContext.documents.forEach(doc => {
            const status = doc.status || 'Uploaded';
            const statusIcon = status === 'Extracted' ? '✅' : status === 'Uploaded' ? '📄' : '⏳';
            context += `${statusIcon} ${doc.name}`;
            if (doc.type) context += ` (${doc.type})`;
            if (doc.status) context += ` - ${doc.status}`;
            if (doc.confidence) context += `, Confidence: ${doc.confidence}%`;
            if (doc.readability) context += `, Readability: ${doc.readability}%`;
            context += '\n';
        });
        context += '\n';
    }

    // Bookmarks
    if (userContext?.bookmarks && userContext.bookmarks.length > 0) {
        context += 'BOOKMARKED SCHEMES:\n';
        userContext.bookmarks.forEach(bm => {
            context += `- ${bm.name}${bm.category ? ` (${bm.category})` : ''}\n`;
        });
        context += '\n';
    }

    // Specific Scheme (if resolved)
    if (resolvedScheme) {
        context += 'TARGET SCHEME:\n';
        context += `Name: ${resolvedScheme.name || 'N/A'}\n`;
        if (resolvedScheme.category) context += `Category: ${resolvedScheme.category}\n`;
        if (resolvedScheme.governmentLevel) context += `Government Level: ${resolvedScheme.governmentLevel}\n`;
        if (resolvedScheme.state) context += `State: ${resolvedScheme.state}\n`;
        if (resolvedScheme.department) context += `Department: ${resolvedScheme.department}\n`;
        if (resolvedScheme.shortDescription) context += `Description: ${resolvedScheme.shortDescription}\n`;
        if (resolvedScheme.fullDescription) context += `Full Details: ${resolvedScheme.fullDescription}\n`;
        if (resolvedScheme.benefitType) context += `Benefit Type: ${resolvedScheme.benefitType}\n`;
        if (resolvedScheme.benefitAmount) context += `Benefit Amount: ${resolvedScheme.benefitAmount}\n`;
        if (resolvedScheme.paymentFrequency && resolvedScheme.paymentFrequency !== 'N/A') {
            context += `Payment Frequency: ${resolvedScheme.paymentFrequency}\n`;
        }
        if (resolvedScheme.benefitDescription) context += `Benefit Description: ${resolvedScheme.benefitDescription}\n`;
        if (resolvedScheme.eligibilityText) context += `Eligibility: ${resolvedScheme.eligibilityText}\n`;
        if (resolvedScheme.requiredDocuments && resolvedScheme.requiredDocuments.length > 0) {
            const docNames = resolvedScheme.requiredDocuments
                .map(d => d.customName || d.documentKey || 'Document')
                .filter(Boolean);
            if (docNames.length > 0) {
                context += `Required Documents: ${docNames.join(', ')}\n`;
            }
        }
        if (resolvedScheme.applicationUrl) context += `Application URL: ${resolvedScheme.applicationUrl}\n`;
        if (resolvedScheme.officialUrl) context += `Official URL: ${resolvedScheme.officialUrl}\n`;
        if (resolvedScheme.helplineNumber) context += `Helpline: ${resolvedScheme.helplineNumber}\n`;
        if (resolvedScheme.email) context += `Email: ${resolvedScheme.email}\n`;
        context += '\n';
    }

    // Category Schemes
    if (schemeResult && schemeResult.schemes && schemeResult.schemes.length > 0 && !resolvedScheme) {
        context += `RELEVANT SCHEMES FROM DATABASE (${schemeResult.count} found):\n\n`;
        schemeResult.schemes.forEach((scheme, i) => {
            context += `${i + 1}. ${scheme.name || 'Unnamed Scheme'}`;
            if (scheme.category) context += ` (${scheme.category})`;
            if (scheme.shortDescription) context += `\n   ${scheme.shortDescription}`;
            if (scheme.benefitAmount) context += `\n   Benefit: ${scheme.benefitAmount}`;
            context += '\n\n';
        });
    }

    // Chat Context
    if (chatContext) {
        context += 'SESSION CONTEXT:\n';
        if (chatContext.currentTopic) context += `Current Topic: ${chatContext.currentTopic}\n`;
        if (chatContext.lastIntent) context += `Last Intent: ${chatContext.lastIntent}\n`;
        if (chatContext.currentSchemeName) context += `Current Scheme: ${chatContext.currentSchemeName}\n`;
        context += '\n';
    }

    // Conversation History (last 10 messages)
    if (conversationHistory && conversationHistory.length > 0) {
        context += 'CONVERSATION HISTORY (oldest to newest):\n';
        const recentHistory = conversationHistory.slice(-10);
        recentHistory.forEach(msg => {
            const role = msg.role === 'user' ? 'User' : 'Assistant';
            context += `${role}: ${msg.content}\n`;
        });
        context += '\n';
    }

    // Current Message
    context += `CURRENT USER MESSAGE: ${currentMessage}\n`;
    context += `DETECTED INTENT: ${intent?.intent || 'UNKNOWN'}\n`;
    if (intent?.category) context += `DETECTED CATEGORY: ${intent.category}\n`;

    context += '\nINSTRUCTIONS:\n';
    context += '1. Respond naturally based on the context above.\n';
    context += '2. If a specific scheme is provided, focus on that scheme.\n';
    context += '3. If the user asked for eligibility, analyze using the scheme eligibility and user profile.\n';
    context += '4. If the user asked for documents, list required documents and compare with uploaded.\n';
    context += '5. Do not invent information not in the context.\n';
    context += '6. Be conversational and helpful.\n';

    return context;
}

// Generate chat response
async function generateChatResponse(messages, userContext, schemeResult, chatContext, intent, resolvedScheme) {
    try {
        // Check if Gemini is available
        if (!genAI) {
            console.warn('[CHAT GEMINI] Not initialized');
            return getFallbackResponse(messages, userContext, schemeResult, intent, resolvedScheme);
        }

        // Get available model
        const model = getAvailableModel();
        if (!model) {
            console.warn('[CHAT GEMINI] No available model');
            return getFallbackResponse(messages, userContext, schemeResult, intent, resolvedScheme);
        }

        const lastMessage = messages.length > 0 ? messages[messages.length - 1].content : '';
        const context = buildContext(
            userContext,
            schemeResult,
            chatContext,
            messages,
            lastMessage,
            intent,
            resolvedScheme
        );

        const systemPrompt = `You are YojanaSetu AI, a conversational assistant for government schemes.

PERSONALITY:
- Friendly, knowledgeable, and helpful
- Natural and conversational
- Uses the user's name naturally when known

RULES:
1. ONLY use information provided in the context
2. NEVER invent schemes, amounts, or eligibility rules
3. If a specific scheme is provided, focus on answering about that scheme
4. If the user asks about eligibility, use the scheme eligibility and user profile
5. If the user asks about documents, list required documents and compare with uploaded
6. Be honest when information is not available
7. Keep responses natural and conversational

${context}

Respond naturally to the user's message.`;

        // Generate response with timeout
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Response timeout')), 25000);
        });

        const generatePromise = model.generateContent(systemPrompt);
        const result = await Promise.race([generatePromise, timeoutPromise]);
        const response = await result.response;
        const text = response.text();

        let cleanText = text.trim();
        cleanText = cleanText.replace(/^Assistant:\s*/i, '');
        
        if (!cleanText) {
            return getFallbackResponse(messages, userContext, schemeResult, intent, resolvedScheme);
        }

        console.log('[CHAT GEMINI] Response generated successfully');
        return {
            content: cleanText,
            role: 'assistant'
        };

    } catch (error) {
        console.error('[CHAT GEMINI ERROR]', {
            message: error.message,
            status: error.status || 'unknown'
        });
        return getFallbackResponse(messages, userContext, schemeResult, intent, resolvedScheme);
    }
}

// Intent-specific fallback responses
function getFallbackResponse(messages, userContext, schemeResult, intent, resolvedScheme) {
    const lastMessage = messages.length > 0 ? messages[messages.length - 1].content.toLowerCase() : '';
    const userName = userContext?.profile?.name || '';
    const intentType = intent?.intent || 'GENERAL_CONVERSATION';

    console.log('[CHAT FALLBACK]', { intentType, hasScheme: !!resolvedScheme });

    // Handle specific intents with actual data
    switch (intentType) {
        case 'SCHEME_DETAILS':
            if (resolvedScheme) {
                return {
                    content: `Here are the details for ${resolvedScheme.name}:

${resolvedScheme.shortDescription || 'No description available'}

${resolvedScheme.fullDescription || ''}

Category: ${resolvedScheme.category || 'Not specified'}
Government Level: ${resolvedScheme.governmentLevel || 'Not specified'}
Department: ${resolvedScheme.department || 'Not specified'}

Benefits:
${resolvedScheme.benefitDescription || 'No benefit description available'}
${resolvedScheme.benefitAmount ? `Benefit Amount: ${resolvedScheme.benefitAmount}` : ''}
${resolvedScheme.paymentFrequency && resolvedScheme.paymentFrequency !== 'N/A' ? `Payment Frequency: ${resolvedScheme.paymentFrequency}` : ''}

Eligibility:
${resolvedScheme.eligibilityText || 'No eligibility information available'}

${resolvedScheme.applicationUrl ? `Apply here: ${resolvedScheme.applicationUrl}` : ''}
${resolvedScheme.officialUrl ? `Official: ${resolvedScheme.officialUrl}` : ''}
${resolvedScheme.helplineNumber ? `Helpline: ${resolvedScheme.helplineNumber}` : ''}`,
                    role: 'assistant'
                };
            }
            break;

        case 'ELIGIBILITY':
            if (resolvedScheme) {
                // Check if user has enough profile info
                const profile = userContext?.profile || {};
                const hasInfo = profile.age || profile.state || profile.category || profile.occupation;
                
                if (hasInfo) {
                    return {
                        content: `Based on your profile information, here's my assessment for ${resolvedScheme.name}:

${resolvedScheme.eligibilityText || 'No specific eligibility criteria available in the database.'}

Your Profile Summary:
${profile.age ? `- Age: ${profile.age}` : ''}
${profile.state ? `- State: ${profile.state}` : ''}
${profile.category ? `- Category: ${profile.category}` : ''}
${profile.occupation ? `- Occupation: ${profile.occupation}` : ''}
${profile.annualIncome ? `- Annual Income: ${profile.annualIncome}` : ''}
${profile.farmerStatus === 'Yes' ? '- Farmer Status: Yes' : ''}

To confirm your exact eligibility, please ensure your profile is complete and all documents are uploaded.`,
                        role: 'assistant'
                    };
                }
                return {
                    content: `I need more information about you to check eligibility for ${resolvedScheme.name}. Please complete your profile with details like age, state, occupation, and income.`,
                    role: 'assistant'
                };
            }
            break;

        case 'DOCUMENTS':
            if (resolvedScheme) {
                const requiredDocs = resolvedScheme.requiredDocuments || [];
                const userDocs = userContext?.documents || [];
                const uploadedNames = userDocs.map(d => d.name.toLowerCase());
                
                if (requiredDocs.length > 0) {
                    const docNames = requiredDocs.map(d => d.customName || d.documentKey || 'Document').filter(Boolean);
                    const missing = docNames.filter(d => !uploadedNames.some(u => u.includes(d.toLowerCase()) || d.toLowerCase().includes(u)));
                    
                    let response = `For ${resolvedScheme.name}, the required documents are: ${docNames.join(', ')}.\n\n`;
                    
                    if (missing.length > 0 && missing.length < docNames.length) {
                        response += `You have uploaded some documents, but you're still missing: ${missing.join(', ')}.`;
                    } else if (missing.length === 0 && userDocs.length > 0) {
                        response += `You have uploaded all the required documents! 🎉`;
                    } else if (userDocs.length === 0) {
                        response += `You haven't uploaded any documents yet. Please upload the required documents.`;
                    } else {
                        response += `Please upload these documents to apply for this scheme.`;
                    }
                    return { content: response, role: 'assistant' };
                }
                return {
                    content: `No specific documents are listed for ${resolvedScheme.name} in the database.`,
                    role: 'assistant'
                };
            }
            break;

        case 'APPLICATION':
            if (resolvedScheme) {
                let response = `For ${resolvedScheme.name}:\n\n`;
                if (resolvedScheme.applicationUrl) {
                    response += `You can apply online at: ${resolvedScheme.applicationUrl}\n`;
                } else if (resolvedScheme.officialUrl) {
                    response += `Visit the official website for application details: ${resolvedScheme.officialUrl}\n`;
                } else {
                    response += `Application details are not available in the database. Please visit the official government website for more information.`;
                }
                if (resolvedScheme.helplineNumber) {
                    response += `\nHelpline: ${resolvedScheme.helplineNumber}`;
                }
                if (resolvedScheme.email) {
                    response += `\nEmail: ${resolvedScheme.email}`;
                }
                return { content: response, role: 'assistant' };
            }
            break;

        case 'SCHEME_CATEGORY':
            if (schemeResult && schemeResult.schemes && schemeResult.schemes.length > 0) {
                const category = schemeResult.detectedCategory || 'available';
                const schemeList = schemeResult.schemes.map((s, i) => 
                    `${i + 1}. ${s.name}${s.shortDescription ? ` - ${s.shortDescription}` : ''}`
                ).join('\n');
                return {
                    content: `I found ${schemeResult.count} active ${category} schemes in YojanaSetu:\n\n${schemeList}\n\nWould you like more details about any of these schemes?`,
                    role: 'assistant'
                };
            }
            break;

        case 'GREETING':
            if (userName) {
                return {
                    content: `Hey ${userName}! 👋 What can I help you with today?`,
                    role: 'assistant'
                };
            }
            return {
                content: "Hi there! 👋 I'm YojanaSetu AI. How can I help you find government schemes today?",
                role: 'assistant'
            };
    }

    // Default fallback
    if (userName) {
        return {
            content: `I'm here to help you, ${userName}. What would you like to know about government schemes?`,
            role: 'assistant'
        };
    }
    return {
        content: "I'm here to help you with government schemes. What would you like to know?",
        role: 'assistant'
    };
}

function generateSuggestions(messages, userContext, chatContext, schemeResult, resolvedScheme) {
    const suggestions = [];
    const lastMessage = messages.length > 0 ? messages[messages.length - 1].content.toLowerCase() : '';
    
    // If we have a specific scheme
    if (resolvedScheme) {
        suggestions.push(`Tell me more about ${resolvedScheme.name}`);
        suggestions.push(`Am I eligible for ${resolvedScheme.name}?`);
        suggestions.push(`What documents do I need for ${resolvedScheme.name}?`);
        suggestions.push(`How do I apply for ${resolvedScheme.name}?`);
        return suggestions.slice(0, 4);
    }
    
    // If we have category schemes
    if (schemeResult && schemeResult.schemes && schemeResult.schemes.length > 0) {
        const firstScheme = schemeResult.schemes[0];
        if (firstScheme) {
            suggestions.push(`Tell me more about ${firstScheme.name}`);
        }
        suggestions.push(`Show more ${schemeResult.detectedCategory || 'schemes'}`);
        suggestions.push(`Am I eligible for ${schemeResult.detectedCategory || 'these'} schemes?`);
    }
    
    // General suggestions
    if (suggestions.length < 3) {
        suggestions.push("What schemes am I eligible for?");
        suggestions.push("What documents do I need?");
        suggestions.push("Tell me about PM Awas Yojana");
        suggestions.push("How do I apply for a scheme?");
    }
    
    return [...new Set(suggestions)].slice(0, 4);
}

module.exports = {
    generateChatResponse,
    generateSuggestions
};