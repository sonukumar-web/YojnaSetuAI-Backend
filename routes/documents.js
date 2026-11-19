const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/auth');
const Document = require('../models/Document');
const User = require('../models/User');
const { analyzeDocument } = require('../services/geminiService');
const { logActivity } = require('../services/activityService');

// PREDEFINED DOCUMENTS
const PREDEFINED_DOCUMENTS = [
    {
        documentKey: "aadhaar",
        name: "Aadhaar Card",
        type: "Aadhaar Card",
        category: "ID",
        description: "Government issued identity and address proof containing name, date of birth, and address."
    },
    {
        documentKey: "pan",
        name: "PAN Card",
        type: "PAN Card",
        category: "ID",
        description: "Permanent Account Number card issued by Income Tax Department."
    },
    {
        documentKey: "income_certificate",
        name: "Income Certificate",
        type: "Income Certificate",
        category: "Income",
        description: "Certificate showing annual family income issued by competent authority."
    },
    {
        documentKey: "caste_certificate",
        name: "Caste Certificate",
        type: "Caste Certificate",
        category: "ID",
        description: "Certificate showing caste category (General/OBC/SC/ST) issued by competent authority."
    },
    {
        documentKey: "domicile",
        name: "Residence Certificate",
        type: "Residence Certificate",
        category: "ID",
        description: "Proof of residence/domicile issued by state government."
    },
    {
        documentKey: "marksheet",
        name: "Marksheet",
        type: "Marksheet",
        category: "Education",
        description: "Educational marksheet or transcript from recognized institution."
    },
    {
        documentKey: "education_certificate",
        name: "Education Certificate",
        type: "Education Certificate",
        category: "Education",
        description: "Degree/diploma/certificate of educational qualification."
    },
    {
        documentKey: "ration_card",
        name: "Ration Card",
        type: "Ration Card",
        category: "Government",
        description: "Ration card issued by Food and Civil Supplies department."
    },
    {
        documentKey: "bank_passbook",
        name: "Bank Passbook",
        type: "Bank Passbook",
        category: "Income",
        description: "Bank account passbook or statement."
    },
    {
        documentKey: "disability_certificate",
        name: "Disability Certificate",
        type: "Disability Certificate",
        category: "ID",
        description: "Certificate showing disability type and percentage issued by medical authority."
    }
];

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueName = `${req.user._id}_${Date.now()}_${file.originalname.replace(/\s/g, '_')}`;
        cb(null, uniqueName);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'application/pdf',
        'image/jpeg', 'image/jpg', 'image/png',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDF, JPG, PNG, and DOC files are allowed.'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: fileFilter
});

// @desc    Get all documents for a user
// @route   GET /api/documents
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const userDocuments = await Document.find({ user: req.user._id });

        const uploadedMap = {};
        userDocuments.forEach(doc => {
            if (doc.documentKey) {
                uploadedMap[doc.documentKey] = doc;
            }
        });

        const result = PREDEFINED_DOCUMENTS.map(predef => {
            const uploaded = uploadedMap[predef.documentKey];
            if (uploaded) {
                return {
                    ...uploaded.toObject(),
                    isPredefined: true,
                    status: uploaded.status || 'Uploaded'
                };
            } else {
                return {
                    ...predef,
                    _id: `predef_${predef.documentKey}`,
                    status: 'Not Uploaded',
                    isPredefined: true,
                    user: req.user._id,
                    ocrText: '',
                    ocrConfidence: 0,
                    extractedData: null,
                    analysis: null,
                    readabilityScore: 0,
                    uploadDate: null,
                    processedAt: null,
                    fileName: null,
                    filePath: null,
                    fileSize: 0,
                    mimeType: '',
                    originalName: ''
                };
            }
        });

        const customDocs = userDocuments.filter(doc => !doc.isPredefined);
        const allDocs = [...result, ...customDocs.map(doc => ({
            ...doc.toObject(),
            isPredefined: false,
            status: doc.status || 'Uploaded'
        }))];

        res.status(200).json({
            success: true,
            count: allDocs.length,
            data: allDocs
        });

    } catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch documents',
            error: error.message
        });
    }
});

// @desc    Upload a document
// @route   POST /api/documents/upload
// @access  Private
router.post('/upload', protect, upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const { documentKey, name, description } = req.body;
        let document;

        if (documentKey) {
            document = await Document.findOne({
                user: req.user._id,
                documentKey: documentKey
            });

            if (document) {
                if (document.filePath && fs.existsSync(document.filePath)) {
                    fs.unlinkSync(document.filePath);
                }
                document.originalName = req.file.originalname;
                document.fileName = req.file.filename;
                document.filePath = req.file.path;
                document.fileSize = req.file.size;
                document.mimeType = req.file.mimetype;
                document.status = 'Uploaded';
                document.ocrText = '';
                document.ocrConfidence = 0;
                document.extractedData = null;
                document.detectedType = '';
                document.analysis = null;
                document.readabilityScore = 0;
                document.uploadDate = new Date();
                document.processedAt = null;
                document.ocrReason = '';
                
                if (name) document.name = name;
                if (description) document.description = description;
                
                await document.save();
            } else {
                const predef = PREDEFINED_DOCUMENTS.find(d => d.documentKey === documentKey);
                document = await Document.create({
                    user: req.user._id,
                    documentKey: documentKey,
                    isPredefined: true,
                    name: name || predef?.name || 'Document',
                    type: predef?.type || 'Document',
                    category: predef?.category || 'Other',
                    description: description || predef?.description || '',
                    originalName: req.file.originalname,
                    fileName: req.file.filename,
                    filePath: req.file.path,
                    fileSize: req.file.size,
                    mimeType: req.file.mimetype,
                    status: 'Uploaded',
                    uploadDate: new Date()
                });
            }
        } else {
            document = await Document.create({
                user: req.user._id,
                isPredefined: false,
                documentKey: null,
                name: name || req.file.originalname.replace(/\.[^/.]+$/, ''),
                type: 'Custom Document',
                category: 'Custom',
                description: description || '',
                originalName: req.file.originalname,
                fileName: req.file.filename,
                filePath: req.file.path,
                fileSize: req.file.size,
                mimeType: req.file.mimetype,
                status: 'Uploaded',
                uploadDate: new Date()
            });
        }

        await User.findByIdAndUpdate(req.user._id, {
            $addToSet: { documents: document._id }
        });

        // Log document upload activity
        await logActivity(
            req.user._id,
            'upload_document',
            `Uploaded document: ${document.name}`,
            `User uploaded "${document.name}"`,
            { 
                documentId: document._id, 
                documentName: document.name, 
                documentKey: document.documentKey || 'custom',
                isPredefined: document.isPredefined || false,
                fileSize: req.file.size
            },
            req
        );

        // Start processing in background
        processDocument(document._id, req.user._id);

        res.status(201).json({
            success: true,
            message: 'Document uploaded successfully. Processing in background.',
            data: document
        });

    } catch (error) {
        console.error('Upload error:', error);
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting file:', err);
            });
        }
        res.status(500).json({
            success: false,
            message: 'Failed to upload document',
            error: error.message
        });
    }
});

// @desc    Get document processing status
// @route   GET /api/documents/status/:id
// @access  Private
router.get('/status/:id', protect, async (req, res) => {
    try {
        const document = await Document.findOne({
            _id: req.params.id,
            user: req.user._id
        });

        if (!document) {
            return res.status(404).json({
                success: false,
                message: 'Document not found'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                status: document.status,
                documentType: document.detectedType || document.type,
                category: document.category,
                ocrConfidence: document.ocrConfidence,
                readabilityScore: document.readabilityScore,
                extractedData: document.extractedData,
                analysis: document.analysis,
                ocrReason: document.ocrReason,
                isPredefined: document.isPredefined
            }
        });
    } catch (error) {
        console.error('Error getting status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get document status',
            error: error.message
        });
    }
});

// @desc    Delete a document
// @route   DELETE /api/documents/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
    try {
        const document = await Document.findOne({
            _id: req.params.id,
            user: req.user._id
        });

        if (!document) {
            return res.status(404).json({
                success: false,
                message: 'Document not found'
            });
        }

        const docName = document.name;
        const docKey = document.documentKey;

        if (document.filePath && fs.existsSync(document.filePath)) {
            fs.unlinkSync(document.filePath);
        }

        await User.findByIdAndUpdate(req.user._id, {
            $pull: { documents: document._id }
        });

        if (document.isPredefined) {
            document.status = 'Not Uploaded';
            document.originalName = '';
            document.fileName = '';
            document.filePath = '';
            document.fileSize = 0;
            document.mimeType = '';
            document.ocrText = '';
            document.ocrConfidence = 0;
            document.extractedData = null;
            document.detectedType = '';
            document.analysis = null;
            document.readabilityScore = 0;
            document.uploadDate = null;
            document.processedAt = null;
            document.ocrReason = '';
            await document.save();
            
            // Log document reset activity
            await logActivity(
                req.user._id,
                'delete_document',
                `Reset document: ${docName}`,
                `User reset "${docName}" to Not Uploaded`,
                { 
                    documentId: document._id, 
                    documentName: docName, 
                    documentKey: docKey,
                    isPredefined: true,
                    action: 'reset'
                },
                req
            );
            
            res.status(200).json({
                success: true,
                message: 'Document reset successfully'
            });
        } else {
            await document.deleteOne();
            
            // Log document delete activity
            await logActivity(
                req.user._id,
                'delete_document',
                `Deleted document: ${docName}`,
                `User deleted "${docName}"`,
                { 
                    documentId: document._id, 
                    documentName: docName,
                    isPredefined: false,
                    action: 'delete'
                },
                req
            );
            
            res.status(200).json({
                success: true,
                message: 'Document deleted successfully'
            });
        }

    } catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete document',
            error: error.message
        });
    }
});

// Process document with Gemini AI
async function processDocument(documentId, userId) {
    try {
        await Document.findByIdAndUpdate(documentId, {
            status: 'Processing'
        });

        const document = await Document.findById(documentId);
        if (!document) {
            throw new Error('Document not found');
        }

        if (!document.filePath || !fs.existsSync(document.filePath)) {
            throw new Error('Document file not found');
        }

        console.log(`🤖 Starting AI analysis for document: ${documentId}`);

        // Use the real Gemini service
        const analysisResult = await analyzeDocument(
            document.filePath,
            document.mimeType,
            document.originalName
        );

        console.log(`✅ AI analysis completed for document: ${documentId}`);

        if (!analysisResult) {
            throw new Error('AI analysis returned no result');
        }

        const updateData = {
            status: 'Extracted',
            ocrText: analysisResult.ocrText || '',
            ocrConfidence: analysisResult.confidence || 0,
            readabilityScore: analysisResult.readabilityScore || 0,
            extractedData: analysisResult.extractedData || null,
            analysis: analysisResult.analysis || null,
            detectedType: analysisResult.documentType || document.type,
            processedAt: new Date(),
            ocrReason: ''
        };

        if (analysisResult.category && analysisResult.category !== 'Other') {
            updateData.category = analysisResult.category;
        }

        if (analysisResult.documentType && analysisResult.documentType !== 'Document') {
            updateData.type = analysisResult.documentType;
        }

        if (analysisResult.analysis?.warnings?.length > 0) {
            updateData.ocrReason = analysisResult.analysis.warnings.join('; ');
        }

        await Document.findByIdAndUpdate(documentId, updateData);

        console.log(`✅ Document ${documentId} processed successfully`);

        // Log successful document processing
        await logActivity(
            userId,
            'upload_document',
            `Document processed: ${document.name}`,
            `Document "${document.name}" processed with ${analysisResult.confidence || 0}% confidence`,
            { 
                documentId: documentId, 
                documentName: document.name,
                confidence: analysisResult.confidence || 0,
                readability: analysisResult.readabilityScore || 0,
                status: 'Extracted'
            }
        );

    } catch (error) {
        console.error('❌ Processing error:', error);
        
        let errorMessage = 'Processing failed: ';
        if (error.message.includes('Gemini') || error.message.includes('AI')) {
            errorMessage += 'AI analysis service error. Please try again.';
        } else if (error.message.includes('file')) {
            errorMessage += 'File access error. Please try re-uploading.';
        } else {
            errorMessage += error.message;
        }

        await Document.findByIdAndUpdate(documentId, {
            status: 'Failed',
            ocrReason: errorMessage,
            processedAt: new Date()
        });

        // Log failed document processing
        const document = await Document.findById(documentId);
        if (document) {
            await logActivity(
                userId,
                'upload_document',
                `Document processing failed: ${document.name}`,
                `Document "${document.name}" processing failed: ${errorMessage}`,
                { 
                    documentId: documentId, 
                    documentName: document.name,
                    error: errorMessage,
                    status: 'Failed'
                }
            );
        }
    }
}

module.exports = router;