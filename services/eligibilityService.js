// services/eligibilityService.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper function to parse eligibility text
const parseEligibilityText = (text) => {
    if (!text) return {};
    
    const lines = text.split('\n').filter(line => line.trim());
    const sections = {};
    let currentSection = 'general';
    
    lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.endsWith(':') || trimmed.match(/^[A-Z][a-z]*:/)) {
            const sectionName = trimmed.replace(/[:]/g, '').toLowerCase().trim();
            currentSection = sectionName;
            sections[currentSection] = [];
        } else if (trimmed) {
            if (!sections[currentSection]) {
                sections[currentSection] = [];
            }
            sections[currentSection].push(trimmed);
        }
    });
    
    return sections;
};

// Generate eligibility analysis using Gemini AI
async function analyzeEligibility(scheme, userProfile, userDocuments) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

        // Parse eligibility text
        const eligibilitySections = parseEligibilityText(scheme.eligibilityText);

        // Prepare prompt for Gemini
        const prompt = `
        You are an AI eligibility analyzer for YojanaSetu AI, a government scheme discovery platform in India.
        
        Analyze if the user is eligible for the following scheme based on their profile and documents.
        
        SCHEME DETAILS:
        Name: ${scheme.name}
        Category: ${scheme.category}
        Government Level: ${scheme.governmentLevel}
        Benefit: ${scheme.benefitType} - ${scheme.benefitAmount || 'Varies'}
        
        ELIGIBILITY CRITERIA:
        ${scheme.eligibilityText}
        
        USER PROFILE:
        ${JSON.stringify(userProfile, null, 2)}
        
        USER DOCUMENTS:
        ${JSON.stringify(userDocuments, null, 2)}
        
        Analyze the user's eligibility and provide:
        
        1. OVERALL SCORE: 0-100 (0=Not Eligible, 100=Fully Eligible)
        2. STATUS: "Eligible" (70-100), "Partially Eligible" (40-69), or "Not Eligible" (0-39)
        
        3. ANALYSIS SUMMARY: A brief 2-3 sentence summary of eligibility
        4. ANALYSIS DESCRIPTION: Detailed explanation of eligibility status (4-5 sentences)
        
        5. RECOMMENDATIONS: 3-5 actionable recommendations to improve eligibility
        6. STRENGTHS: 2-4 things that make the user eligible
        7. WEAKNESSES: 2-4 things that reduce eligibility
        8. MISSING REQUIREMENTS: 2-3 specific things missing
        
        9. CATEGORY SCORES (0-100 each):
           - personal (Age, gender, marital status, etc.)
           - education (Education level, course, status)
           - financial (Income, income certificate, etc.)
           - documents (Uploaded documents vs required)
           - social (Category, disability, minority, BPL, etc.)
           - residence (State, district, residence type, etc.)
        
        10. DOCUMENT STATUS:
            - required: Total number of required documents
            - uploaded: Number of uploaded documents
            - missing: Number of missing documents
            - details: Object with documentKey: {uploaded: boolean, name: string}
        
        11. MISSING DOCUMENTS: List of missing document names
        
        IMPORTANT RULES:
        1. Be specific and detailed in your analysis
        2. Base your analysis on the actual user profile and documents provided
        3. If information is missing, note it in missing requirements
        4. Provide actionable recommendations
        5. Be fair and objective in scoring
        6. Return ONLY valid JSON with the following structure:
        
        {
            "score": 85,
            "status": "Eligible",
            "analysis": {
                "summary": "Brief summary text",
                "description": "Detailed description text",
                "recommendations": ["rec1", "rec2", "rec3"],
                "strengths": ["strength1", "strength2"],
                "weaknesses": ["weakness1", "weakness2"],
                "missingRequirements": ["missing1", "missing2"]
            },
            "categoryScores": {
                "personal": 80,
                "education": 90,
                "financial": 70,
                "documents": 85,
                "social": 75,
                "residence": 95
            },
            "documentStatus": {
                "required": 5,
                "uploaded": 3,
                "missing": 2,
                "details": {
                    "aadhaar": {"uploaded": true, "name": "Aadhaar Card"},
                    "income_certificate": {"uploaded": false, "name": "Income Certificate"}
                }
            },
            "missingDocuments": ["Income Certificate", "Caste Certificate"]
        }
        
        Return ONLY the JSON object, no other text.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Parse JSON
        let cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            cleanedText = jsonMatch[0];
        }
        
        const analysisResult = JSON.parse(cleanedText);
        
        // Ensure all required fields exist
        return {
            score: analysisResult.score || 0,
            status: analysisResult.status || 'Pending',
            analysis: {
                summary: analysisResult.analysis?.summary || 'Analysis complete',
                description: analysisResult.analysis?.description || 'Detailed analysis available',
                recommendations: analysisResult.analysis?.recommendations || [],
                strengths: analysisResult.analysis?.strengths || [],
                weaknesses: analysisResult.analysis?.weaknesses || [],
                missingRequirements: analysisResult.analysis?.missingRequirements || []
            },
            categoryScores: {
                personal: analysisResult.categoryScores?.personal || 0,
                education: analysisResult.categoryScores?.education || 0,
                financial: analysisResult.categoryScores?.financial || 0,
                documents: analysisResult.categoryScores?.documents || 0,
                social: analysisResult.categoryScores?.social || 0,
                residence: analysisResult.categoryScores?.residence || 0
            },
            documentStatus: {
                required: analysisResult.documentStatus?.required || 0,
                uploaded: analysisResult.documentStatus?.uploaded || 0,
                missing: analysisResult.documentStatus?.missing || 0,
                details: analysisResult.documentStatus?.details || {}
            },
            missingDocuments: analysisResult.missingDocuments || []
        };

    } catch (error) {
        console.error('Gemini Analysis Error:', error);
        throw new Error(`Eligibility analysis failed: ${error.message}`);
    }
}

// Generate fallback analysis (without AI)
function generateFallbackAnalysis(scheme, userProfile, userDocuments) {
    // Calculate basic eligibility based on available data
    let score = 50;
    const strengths = [];
    const weaknesses = [];
    const recommendations = [];
    const missingRequirements = [];

    // Check age
    if (userProfile.profile?.age) {
        const age = parseInt(userProfile.profile.age);
        if (age >= 18 && age <= 60) {
            score += 10;
            strengths.push('Age within eligible range');
        } else {
            weaknesses.push('Age may not meet eligibility criteria');
            recommendations.push('Verify age eligibility requirements');
        }
    } else {
        missingRequirements.push('Age information missing');
        recommendations.push('Add age to your profile');
    }

    // Check state
    if (userProfile.profile?.state) {
        score += 5;
        strengths.push(`Resident of ${userProfile.profile.state}`);
    } else {
        missingRequirements.push('State information missing');
        recommendations.push('Add state to your profile');
    }

    // Check category
    if (userProfile.profile?.category) {
        score += 5;
        strengths.push(`Category: ${userProfile.profile.category}`);
    } else {
        missingRequirements.push('Category information missing');
        recommendations.push('Add category to your profile');
    }

    // Check income
    if (userProfile.profile?.annualIncome) {
        score += 5;
        strengths.push('Income information provided');
    } else {
        missingRequirements.push('Income information missing');
        recommendations.push('Add annual income to your profile');
    }

    // Check education
    if (userProfile.profile?.educationLevel) {
        score += 5;
        strengths.push(`Education: ${userProfile.profile.educationLevel}`);
    } else {
        missingRequirements.push('Education information missing');
        recommendations.push('Add education details to your profile');
    }

    // Check documents
    const requiredDocs = scheme.requiredDocuments || [];
    const userDocKeys = userDocuments.map(d => d.documentKey).filter(Boolean);
    const uploadedDocs = requiredDocs.filter(d => userDocKeys.includes(d.documentKey));
    const missingDocs = requiredDocs.filter(d => !userDocKeys.includes(d.documentKey));

    if (uploadedDocs.length > 0) {
        score += Math.min(uploadedDocs.length * 5, 20);
        strengths.push(`${uploadedDocs.length} documents uploaded`);
    }
    
    if (missingDocs.length > 0) {
        weaknesses.push(`${missingDocs.length} required documents missing`);
        missingDocs.forEach(d => {
            missingRequirements.push(`Missing document: ${d.customName || d.documentKey}`);
        });
        recommendations.push(`Upload required documents: ${missingDocs.map(d => d.customName || d.documentKey).join(', ')}`);
    }

    // Determine status
    let status = 'Partially Eligible';
    if (score >= 70) status = 'Eligible';
    else if (score < 40) status = 'Not Eligible';

    return {
        score: Math.min(score, 100),
        status: status,
        analysis: {
            summary: `Based on your profile and documents, you are ${status.toLowerCase()} for ${scheme.name}.`,
            description: `Your eligibility score is ${Math.min(score, 100)}%. ${strengths.length > 0 ? 'You meet several requirements including: ' + strengths.join(', ') : ''} ${weaknesses.length > 0 ? 'However, there are areas for improvement: ' + weaknesses.join(', ') : ''}`,
            recommendations: recommendations.length > 0 ? recommendations : ['Complete your profile for better eligibility matching'],
            strengths: strengths.length > 0 ? strengths : ['Basic profile information provided'],
            weaknesses: weaknesses.length > 0 ? weaknesses : ['No significant weaknesses found'],
            missingRequirements: missingRequirements.length > 0 ? missingRequirements : ['No missing requirements found']
        },
        categoryScores: {
            personal: 50 + (userProfile.profile?.age ? 20 : 0) + (userProfile.profile?.gender ? 10 : 0),
            education: 50 + (userProfile.profile?.educationLevel ? 30 : 0) + (userProfile.profile?.courseDegree ? 20 : 0),
            financial: 50 + (userProfile.profile?.annualIncome ? 30 : 0) + (userProfile.profile?.incomeCertificate ? 20 : 0),
            documents: Math.min(uploadedDocs.length / (requiredDocs.length || 1) * 100, 100),
            social: 50 + (userProfile.profile?.category ? 20 : 0) + (userProfile.profile?.maritalStatus ? 10 : 0),
            residence: 50 + (userProfile.profile?.state ? 30 : 0) + (userProfile.profile?.district ? 20 : 0)
        },
        documentStatus: {
            required: requiredDocs.length,
            uploaded: uploadedDocs.length,
            missing: missingDocs.length,
            details: requiredDocs.reduce((acc, doc) => {
                const key = doc.documentKey || doc.customName;
                acc[key] = {
                    uploaded: userDocKeys.includes(doc.documentKey),
                    name: doc.customName || doc.documentKey
                };
                return acc;
            }, {})
        },
        missingDocuments: missingDocs.map(d => d.customName || d.documentKey)
    };
}

module.exports = { analyzeEligibility, generateFallbackAnalysis };