// services/geminiService.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Function to encode file to base64
const fileToGenerativePart = (filePath, mimeType) => {
    const fileData = fs.readFileSync(filePath);
    return {
        inlineData: {
            data: fileData.toString('base64'),
            mimeType: mimeType
        }
    };
};

// Function to analyze document with Gemini
async function analyzeDocument(filePath, mimeType, originalName) {
    try {
const model = genAI.getGenerativeModel({
    model: "gemini-3.8-flash"
    
      
});

        // Read file and convert to base64
        const imagePart = fileToGenerativePart(filePath, mimeType);

        // Create prompt for document analysis
        const prompt = `
        You are an AI document analyzer for YojanaSetu AI, a government scheme discovery platform in India.
        
        Analyze this document and extract all relevant information.
        
        Return ONLY valid JSON with the following structure:
        {
            "documentType": "Detected document type (e.g., Aadhaar Card, PAN Card, Income Certificate, etc.)",
            "category": "ID | Income | Education | Government | Custom | Other",
            "confidence": 0-100,
            "readabilityScore": 0-100,
            "ocrText": "Full extracted text from the document",
            "extractedData": {
                // Dynamic fields based on document type
                // For Aadhaar: name, dateOfBirth, gender, address, aadhaarNumber
                // For PAN: name, panNumber, dateOfBirth
                // For Income Certificate: name, annualIncome, certificateNumber, issueDate, validUntil, issuingAuthority
                // For Caste Certificate: name, category, certificateNumber, issueDate, issuingAuthority
                // For Marksheet: studentName, institution, course, semester, year, percentage, cgpa
                // For Residence: name, address, district, state, certificateNumber
                // For Bank: accountHolderName, bankName, branch, accountNumber, ifsc
                // For Ration Card: holderName, familyMembers, rationCardNumber, cardType, address
                // For Disability: name, disabilityType, disabilityPercentage, certificateNumber, issueDate, validUntil
            },
            "analysis": {
                "summary": "Brief summary of the document",
                "keyFields": ["Field1", "Field2"],
                "warnings": ["Warning1", "Warning2"],
                "suggestions": ["Suggestion1", "Suggestion2"]
            }
        }
        
        IMPORTANT RULES:
        1. Only extract information that is clearly present and readable.
        2. If a field is not present, omit it or set to null.
        3. DO NOT invent or guess information.
        4. The ocrText should contain the complete extracted text from the document.
        5. For documents that are blurry or partially readable, set appropriate warnings.
        6. Return ONLY the JSON object, no other text.
        `;

        // Generate content
        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();

        // Parse JSON
        try {
            // Clean the text - remove markdown code blocks
            let cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            
            // Try to find JSON object in the text
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cleanedText = jsonMatch[0];
            }
            
            const analysisResult = JSON.parse(cleanedText);
            
            // Ensure required fields exist
            return {
                documentType: analysisResult.documentType || 'Unknown Document',
                category: analysisResult.category || 'Other',
                confidence: analysisResult.confidence || 50,
                readabilityScore: analysisResult.readabilityScore || 50,
                ocrText: analysisResult.ocrText || '',
                extractedData: analysisResult.extractedData || null,
                analysis: {
                    summary: analysisResult.analysis?.summary || 'Document analyzed successfully.',
                    keyFields: analysisResult.analysis?.keyFields || [],
                    warnings: analysisResult.analysis?.warnings || [],
                    suggestions: analysisResult.analysis?.suggestions || []
                }
            };
        } catch (parseError) {
            console.error('JSON Parse Error:', parseError);
            console.error('Raw response:', text);
            
            // Fallback: Create a basic analysis from what we can parse
            return {
                documentType: 'Document',
                category: 'Other',
                confidence: 40,
                readabilityScore: 40,
                ocrText: text.substring(0, 2000),
                extractedData: null,
                analysis: {
                    summary: 'Document analyzed but parsing failed. Please verify the document.',
                    keyFields: [],
                    warnings: ['Could not fully parse document content'],
                    suggestions: ['Try uploading a clearer document']
                }
            };
        }
    } catch (error) {
        console.error('Gemini API Error:', error);
        throw new Error(`Document analysis failed: ${error.message}`);
    }
}

module.exports = { analyzeDocument };