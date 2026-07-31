import type { TaxIdType } from "@/lib/validators";

// Drives the country-specific step of supplier onboarding: which tax ID(s), which
// bank fields, and which documents are required. Backed by real, checksum-verified
// validators (lib/validators.ts) for the countries listed here; "Other" is a
// deliberately generic fallback (IBAN/SWIFT + a free-text tax ID) for anywhere not
// explicitly modeled — covering every country's exact requirements precisely would
// need per-jurisdiction legal/tax research this doesn't attempt to fake.

export type FieldSpec = { key: string; label: string; validator?: TaxIdType; placeholder?: string; helpText?: string };

export type CountryRequirement = {
  country: string;
  taxFields: FieldSpec[];
  bankFields: FieldSpec[];
  requiredDocs: string[]; // SupplierDocument.type keys
};

export const DOC_TYPE_LABELS: Record<string, string> = {
  PAN_CARD: "PAN Card",
  GST_CERTIFICATE: "GST Certificate",
  VAT_CERTIFICATE: "VAT Certificate",
  W9_FORM: "W-9 Form",
  W8_FORM: "W-8 Form",
  INCORPORATION_CERTIFICATE: "Certificate of Incorporation",
  MSME_CERTIFICATE: "MSME Certificate",
  CANCELLED_CHEQUE: "Cancelled Cheque",
  BANK_STATEMENT: "Bank Statement",
  ISO_CERTIFICATE: "ISO Certificate",
  INSURANCE_CERTIFICATE: "Insurance Certificate",
  NDA: "NDA",
  MSA: "MSA",
  OTHER: "Other",
};

export const COUNTRY_REQUIREMENTS: Record<string, CountryRequirement> = {
  "India": {
    country: "India",
    taxFields: [
      { key: "panNumber", label: "PAN Number", validator: "PAN", placeholder: "ABCDE1234F" },
      { key: "gstNumber", label: "GST Number", validator: "GST", placeholder: "27ABCDE1234F1Z5" },
    ],
    bankFields: [
      { key: "bankName", label: "Bank Name" },
      { key: "accountNumber", label: "Account Number" },
      { key: "ifscCode", label: "IFSC Code", validator: "IFSC", placeholder: "HDFC0001234" },
    ],
    requiredDocs: ["PAN_CARD", "GST_CERTIFICATE", "INCORPORATION_CERTIFICATE", "CANCELLED_CHEQUE"],
  },
  "United States": {
    country: "United States",
    taxFields: [
      { key: "taxIdValue", label: "EIN (Employer ID Number)", validator: "EIN", placeholder: "12-3456789" },
    ],
    bankFields: [
      { key: "bankName", label: "Bank Name" },
      { key: "accountNumber", label: "Account Number" },
      { key: "routingNumber", label: "Routing Number (ABA)", validator: "ROUTING", placeholder: "021000021" },
    ],
    requiredDocs: ["W9_FORM", "INCORPORATION_CERTIFICATE", "BANK_STATEMENT"],
  },
  "United Kingdom": {
    country: "United Kingdom",
    taxFields: [
      { key: "taxIdValue", label: "VAT Number", validator: "VAT", placeholder: "GB123456789" },
    ],
    bankFields: [
      { key: "bankName", label: "Bank Name" },
      { key: "iban", label: "IBAN", validator: "IBAN" },
      { key: "swiftCode", label: "SWIFT/BIC", validator: "SWIFT" },
    ],
    requiredDocs: ["VAT_CERTIFICATE", "INCORPORATION_CERTIFICATE", "BANK_STATEMENT"],
  },
  "Germany": {
    country: "Germany",
    taxFields: [
      { key: "taxIdValue", label: "VAT Number (USt-IdNr.)", validator: "VAT", placeholder: "DE123456789" },
    ],
    bankFields: [
      { key: "bankName", label: "Bank Name" },
      { key: "iban", label: "IBAN", validator: "IBAN" },
      { key: "swiftCode", label: "SWIFT/BIC", validator: "SWIFT" },
    ],
    requiredDocs: ["VAT_CERTIFICATE", "INCORPORATION_CERTIFICATE", "BANK_STATEMENT"],
  },
  "Australia": {
    country: "Australia",
    taxFields: [
      { key: "taxIdValue", label: "ABN (Australian Business Number)", validator: "ABN", placeholder: "51824753556" },
    ],
    bankFields: [
      { key: "bankName", label: "Bank Name" },
      { key: "accountNumber", label: "Account Number" },
      { key: "bsb", label: "BSB", validator: "BSB", placeholder: "062-000" },
    ],
    requiredDocs: ["INCORPORATION_CERTIFICATE", "BANK_STATEMENT"],
  },
  "Singapore": {
    country: "Singapore",
    taxFields: [
      { key: "taxIdValue", label: "UEN (Unique Entity Number)", validator: "UEN", placeholder: "201912345A" },
    ],
    bankFields: [
      { key: "bankName", label: "Bank Name" },
      { key: "accountNumber", label: "Account Number" },
      { key: "swiftCode", label: "SWIFT/BIC", validator: "SWIFT" },
    ],
    requiredDocs: ["INCORPORATION_CERTIFICATE", "BANK_STATEMENT"],
  },
  "Other": {
    country: "Other",
    taxFields: [
      { key: "taxIdValue", label: "Tax ID / VAT Number", validator: "VAT", helpText: "Local tax registration number, whatever format applies in this country." },
    ],
    bankFields: [
      { key: "bankName", label: "Bank Name" },
      { key: "iban", label: "IBAN (or local account number)" },
      { key: "swiftCode", label: "SWIFT/BIC", validator: "SWIFT" },
    ],
    requiredDocs: ["INCORPORATION_CERTIFICATE", "BANK_STATEMENT"],
  },
};

export const SUPPORTED_COUNTRIES = Object.keys(COUNTRY_REQUIREMENTS);

export function requirementsFor(country: string | null | undefined): CountryRequirement {
  return (country && COUNTRY_REQUIREMENTS[country]) || COUNTRY_REQUIREMENTS["Other"];
}
