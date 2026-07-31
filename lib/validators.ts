// Tax ID and bank-detail validators — format/checksum only, no external API calls.
// These catch typos and structurally invalid input; they do not confirm the ID is
// registered or active (that requires a live lookup against GSTN/IRS/companies-house/etc,
// which needs a paid provider and isn't wired up here).

export type ValidationResult = { valid: boolean; message?: string };

const ok: ValidationResult = { valid: true };
const fail = (message: string): ValidationResult => ({ valid: false, message });

// ── India ──────────────────────────────────────────────────────────────────

export function validatePAN(value: string): ValidationResult {
  const v = value.trim().toUpperCase();
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v)) return fail("PAN must be 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F).");
  return ok;
}

// GSTIN check-digit algorithm: 15th character is a mod-36 checksum over the first 14.
export function validateGST(value: string): ValidationResult {
  const v = value.trim().toUpperCase();
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z][Z][0-9A-Z]$/.test(v)) return fail("GSTIN must be 15 characters in the standard format (e.g. 27ABCDE1234F1Z5).");
  const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let factor = 2, sum = 0;
  for (let i = 0; i < 14; i++) {
    const code = CHARS.indexOf(v[i]);
    let d = factor * code;
    d = Math.floor(d / 36) + (d % 36);
    sum += d;
    factor = factor === 2 ? 1 : 2;
  }
  const checkDigit = CHARS[(36 - (sum % 36)) % 36];
  if (checkDigit !== v[14]) return fail("GSTIN checksum digit doesn't match — check for a typo.");
  return ok;
}

export function validateCIN(value: string): ValidationResult {
  const v = value.trim().toUpperCase();
  if (!/^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/.test(v)) return fail("CIN must match the MCA format (e.g. L12345MH1949PLC001234).");
  return ok;
}

export function validateIFSC(value: string): ValidationResult {
  const v = value.trim().toUpperCase();
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(v)) return fail("IFSC must be 4 bank letters, a 0, then 6 branch characters (e.g. HDFC0001234).");
  return ok;
}

// ── US ─────────────────────────────────────────────────────────────────────

export function validateEIN(value: string): ValidationResult {
  const v = value.trim().replace(/-/g, "");
  if (!/^\d{9}$/.test(v)) return fail("EIN must be 9 digits (e.g. 12-3456789).");
  return ok;
}

// ABA routing number checksum: 3(d1+d4+d7) + 7(d2+d5+d8) + (d3+d6+d9) must be divisible by 10.
export function validateRoutingNumber(value: string): ValidationResult {
  const v = value.trim();
  if (!/^\d{9}$/.test(v)) return fail("Routing number must be 9 digits.");
  const d = v.split("").map(Number);
  const sum = 3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + 1 * (d[2] + d[5] + d[8]);
  if (sum % 10 !== 0) return fail("Routing number checksum is invalid — check for a typo.");
  return ok;
}

// ── International ─────────────────────────────────────────────────────────

// IBAN mod-97 checksum (ISO 7064): move first 4 chars to the end, convert letters to
// numbers (A=10..Z=35), the resulting number mod 97 must equal 1.
export function validateIBAN(value: string): ValidationResult {
  const v = value.trim().toUpperCase().replace(/\s/g, "");
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(v)) return fail("IBAN must start with a 2-letter country code and 2 check digits.");
  const rearranged = v.slice(4) + v.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, ch => String(ch.charCodeAt(0) - 55));
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    remainder = Number(String(remainder) + numeric.slice(i, i + 7)) % 97;
  }
  if (remainder !== 1) return fail("IBAN checksum is invalid — check for a typo.");
  return ok;
}

export function validateSWIFT(value: string): ValidationResult {
  const v = value.trim().toUpperCase();
  if (!/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(v)) return fail("SWIFT/BIC must be 8 or 11 characters (e.g. DEUTDEFF or DEUTDEFF500).");
  return ok;
}

// Australian Business Number — weighted mod-89 checksum (subtract 1 from the first digit first).
export function validateABN(value: string): ValidationResult {
  const v = value.trim().replace(/\s/g, "");
  if (!/^\d{11}$/.test(v)) return fail("ABN must be 11 digits.");
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const digits = v.split("").map(Number);
  digits[0] -= 1;
  const sum = digits.reduce((acc, d, i) => acc + d * weights[i], 0);
  if (sum % 89 !== 0) return fail("ABN checksum is invalid — check for a typo.");
  return ok;
}

// Singapore UEN — three known formats (businesses / local companies / others).
export function validateUEN(value: string): ValidationResult {
  const v = value.trim().toUpperCase();
  const business = /^\d{8}[A-Z]$/;
  const localCompany = /^\d{4}\d{5}[A-Z]$/;
  const other = /^[TSR]\d{2}[A-Z]{2}\d{4}[A-Z]$/;
  if (!business.test(v) && !localCompany.test(v) && !other.test(v)) return fail("UEN doesn't match a known Singapore format.");
  return ok;
}

// Generic VAT format check — not exhaustive across all ~30 EU/UK/etc. schemes, but
// catches the common ones plus a length/alphanumeric fallback for others.
export function validateVAT(value: string): ValidationResult {
  const v = value.trim().toUpperCase().replace(/\s/g, "");
  const known: Record<string, RegExp> = {
    GB: /^GB(\d{9}|\d{12}|GD\d{3}|HA\d{3})$/,
    DE: /^DE\d{9}$/,
    FR: /^FR[A-Z0-9]{2}\d{9}$/,
    IT: /^IT\d{11}$/,
    ES: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/,
    NL: /^NL\d{9}B\d{2}$/,
  };
  const country = v.slice(0, 2);
  if (known[country]) {
    if (!known[country].test(v)) return fail(`VAT number doesn't match the standard ${country} format.`);
    return ok;
  }
  if (!/^[A-Z]{2}[A-Z0-9]{2,15}$/.test(v)) return fail("VAT number should start with a 2-letter country code followed by 2-15 alphanumeric characters.");
  return ok;
}

export type TaxIdType = "PAN" | "GST" | "CIN" | "EIN" | "IBAN" | "SWIFT" | "ABN" | "UEN" | "VAT" | "IFSC" | "ROUTING";

const VALIDATORS: Record<TaxIdType, (v: string) => ValidationResult> = {
  PAN: validatePAN, GST: validateGST, CIN: validateCIN, EIN: validateEIN,
  IBAN: validateIBAN, SWIFT: validateSWIFT, ABN: validateABN, UEN: validateUEN,
  VAT: validateVAT, IFSC: validateIFSC, ROUTING: validateRoutingNumber,
};

export function validateTaxOrBankField(type: TaxIdType, value: string): ValidationResult {
  if (!value?.trim()) return ok; // absence is a completeness concern, not a format error
  return VALIDATORS[type](value);
}
