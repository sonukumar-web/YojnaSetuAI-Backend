// config/documents.js
const PREDEFINED_DOCUMENTS = [
    {
        documentKey: "aadhaar",
        name: "Aadhaar Card",
        type: "Aadhaar Card",
        category: "ID",
        description: "Government issued identity and address proof containing name, date of birth, and address.",
        isPredefined: true,
        icon: "File"
    },
    {
        documentKey: "pan",
        name: "PAN Card",
        type: "PAN Card",
        category: "ID",
        description: "Permanent Account Number card issued by Income Tax Department.",
        isPredefined: true,
        icon: "File"
    },
    {
        documentKey: "income_certificate",
        name: "Income Certificate",
        type: "Income Certificate",
        category: "Income",
        description: "Certificate showing annual family income issued by competent authority.",
        isPredefined: true,
        icon: "File"
    },
    {
        documentKey: "caste_certificate",
        name: "Caste Certificate",
        type: "Caste Certificate",
        category: "ID",
        description: "Certificate showing caste category (General/OBC/SC/ST) issued by competent authority.",
        isPredefined: true,
        icon: "File"
    },
    {
        documentKey: "domicile",
        name: "Residence Certificate",
        type: "Residence Certificate",
        category: "ID",
        description: "Proof of residence/domicile issued by state government.",
        isPredefined: true,
        icon: "File"
    },
    {
        documentKey: "marksheet",
        name: "Marksheet",
        type: "Marksheet",
        category: "Education",
        description: "Educational marksheet or transcript from recognized institution.",
        isPredefined: true,
        icon: "File"
    },
    {
        documentKey: "education_certificate",
        name: "Education Certificate",
        type: "Education Certificate",
        category: "Education",
        description: "Degree/diploma/certificate of educational qualification.",
        isPredefined: true,
        icon: "File"
    },
    {
        documentKey: "ration_card",
        name: "Ration Card",
        type: "Ration Card",
        category: "Government",
        description: "Ration card issued by Food and Civil Supplies department.",
        isPredefined: true,
        icon: "File"
    },
    {
        documentKey: "bank_passbook",
        name: "Bank Passbook",
        type: "Bank Passbook",
        category: "Income",
        description: "Bank account passbook or statement.",
        isPredefined: true,
        icon: "File"
    },
    {
        documentKey: "disability_certificate",
        name: "Disability Certificate",
        type: "Disability Certificate",
        category: "ID",
        description: "Certificate showing disability type and percentage issued by medical authority.",
        isPredefined: true,
        icon: "File"
    }
];

module.exports = PREDEFINED_DOCUMENTS;