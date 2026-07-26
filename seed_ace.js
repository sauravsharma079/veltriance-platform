const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");
const p = new PrismaClient();

const ORG_ID = "85c48fe0-7934-4ac6-86ad-07e8e25af811"; // ace org

async function main() {
  console.log("\n🌱  Seeding Ace Technologies workspace...\n");

  // ── Wipe existing ace data ─────────────────────────────────────────────────
  console.log("  Clearing existing data...");
  await p.purchaseOrderLineItem.deleteMany({ where: { purchaseOrder: { organizationId: ORG_ID } } });
  await p.purchaseOrder.deleteMany({ where: { organizationId: ORG_ID } });
  await p.approvalStep.deleteMany({ where: { requisition: { organizationId: ORG_ID } } });
  await p.requisitionLineItem.deleteMany({ where: { requisition: { organizationId: ORG_ID } } });
  await p.requisition.deleteMany({ where: { organizationId: ORG_ID } });
  await p.supplierMessage.deleteMany({ where: { supplier: { organizationId: ORG_ID } } });
  await p.supplierDocument.deleteMany({ where: { supplier: { organizationId: ORG_ID } } });
  await p.supplierOnboardingProfile.deleteMany({ where: { supplier: { organizationId: ORG_ID } } });
  await p.supplier.deleteMany({ where: { organizationId: ORG_ID } });
  await p.lookup.deleteMany({ where: { organizationId: ORG_ID } });
  await p.customField.deleteMany({ where: { organizationId: ORG_ID } });
  await p.approvalRuleStep.deleteMany({ where: { rule: { organizationId: ORG_ID } } });
  await p.approvalRule.deleteMany({ where: { organizationId: ORG_ID } });
  await p.coaSegmentValue.deleteMany({ where: { segment: { chartOfAccount: { organizationId: ORG_ID } } } });
  await p.coaSegment.deleteMany({ where: { chartOfAccount: { organizationId: ORG_ID } } });
  await p.chartOfAccount.deleteMany({ where: { organizationId: ORG_ID } });
  await p.contentGroupMember.deleteMany({ where: { contentGroup: { organizationId: ORG_ID } } });
  await p.contentGroup.deleteMany({ where: { organizationId: ORG_ID } });
  await p.workspaceRoleMember.deleteMany({ where: { user: { organizationId: ORG_ID } } });
  await p.workspaceRole.deleteMany({ where: { organizationId: ORG_ID } });
  await p.apiToken.deleteMany({ where: { client: { organizationId: ORG_ID } } });
  await p.apiClient.deleteMany({ where: { organizationId: ORG_ID } });
  await p.integration.deleteMany({ where: { organizationId: ORG_ID } });
  // Keep existing users — just update them
  await p.user.deleteMany({ where: { organizationId: ORG_ID } });

  // ── Users ──────────────────────────────────────────────────────────────────
  // Find Kate's authId from Supabase-linked users
  const kateAuth = await p.user.findFirst({ where: { email: { contains: "kate", mode: "insensitive" } } });
  const sauravAuth = await p.user.findFirst({ where: { email: "sauravsharma079@gmail.com" } });

  const [kate, priya, rahul, sneha, vikram, ananya, deepak] = await Promise.all([
    p.user.create({ data: { organizationId: ORG_ID, email: "kate@ace.com", name: "Kate Williams", role: "ADMIN", jobTitle: "CEO & Founder", department: "Executive", currency: "INR", inviteStatus: "ACTIVE", authId: kateAuth?.authId ?? null } }),
    p.user.create({ data: { organizationId: ORG_ID, email: "priya.mehta@ace.tech", name: "Priya Mehta", role: "PROCUREMENT", jobTitle: "Procurement Manager", department: "Procurement", currency: "INR", inviteStatus: "ACTIVE" } }),
    p.user.create({ data: { organizationId: ORG_ID, email: "rahul.gupta@ace.tech", name: "Rahul Gupta", role: "APPROVER", jobTitle: "Engineering Director", department: "Engineering", currency: "INR", inviteStatus: "ACTIVE" } }),
    p.user.create({ data: { organizationId: ORG_ID, email: "sneha.patel@ace.tech", name: "Sneha Patel", role: "APPROVER", jobTitle: "Finance Controller", department: "Finance", currency: "INR", inviteStatus: "ACTIVE" } }),
    p.user.create({ data: { organizationId: ORG_ID, email: "vikram.singh@ace.tech", name: "Vikram Singh", role: "REQUESTOR", jobTitle: "Senior Software Engineer", department: "Engineering", currency: "INR", inviteStatus: "ACTIVE" } }),
    p.user.create({ data: { organizationId: ORG_ID, email: "ananya.roy@ace.tech", name: "Ananya Roy", role: "REQUESTOR", jobTitle: "Product Manager", department: "Product", currency: "INR", inviteStatus: "PENDING" } }),
    p.user.create({ data: { organizationId: ORG_ID, email: "deepak.nair@ace.tech", name: "Deepak Nair", role: "REQUESTOR", jobTitle: "HR Manager", department: "HR", currency: "INR", inviteStatus: "PENDING" } }),
  ]);
  console.log("  ✓  Users: 7");

  // ── Workspace Roles ────────────────────────────────────────────────────────
  const [adminRole, procRole, viewerRole] = await Promise.all([
    p.workspaceRole.create({ data: { organizationId: ORG_ID, name: "Admin", description: "Full access to all modules and settings", isSystem: true, permissions: ["ALL"] } }),
    p.workspaceRole.create({ data: { organizationId: ORG_ID, name: "Procurement Officer", description: "Manage suppliers, requisitions and purchase orders", isSystem: false, permissions: ["SUPPLIERS_READ","SUPPLIERS_WRITE","REQUISITIONS_READ","REQUISITIONS_WRITE","PO_READ","PO_WRITE"] } }),
    p.workspaceRole.create({ data: { organizationId: ORG_ID, name: "Viewer", description: "Read-only access to approved data", isSystem: false, permissions: ["REQUISITIONS_READ","PO_READ","SUPPLIERS_READ"] } }),
  ]);
  await Promise.all([
    p.workspaceRoleMember.create({ data: { userId: kate.id, workspaceRoleId: adminRole.id } }),
    p.workspaceRoleMember.create({ data: { userId: priya.id, workspaceRoleId: procRole.id } }),
    p.workspaceRoleMember.create({ data: { userId: vikram.id, workspaceRoleId: viewerRole.id } }),
  ]);
  console.log("  ✓  Workspace Roles: 3");

  // ── Content Groups ─────────────────────────────────────────────────────────
  const [itGroup, finGroup, opsGroup] = await Promise.all([
    p.contentGroup.create({ data: { organizationId: ORG_ID, name: "IT & Engineering", description: "Technology purchases and infrastructure", color: "#1A2A52" } }),
    p.contentGroup.create({ data: { organizationId: ORG_ID, name: "Finance & Admin", description: "Finance team operational purchases", color: "#C8A04D" } }),
    p.contentGroup.create({ data: { organizationId: ORG_ID, name: "Operations", description: "Facilities and operational supplies", color: "#10B981" } }),
  ]);
  await Promise.all([
    p.contentGroupMember.create({ data: { contentGroupId: itGroup.id, userId: vikram.id } }),
    p.contentGroupMember.create({ data: { contentGroupId: finGroup.id, userId: sneha.id } }),
    p.contentGroupMember.create({ data: { contentGroupId: opsGroup.id, userId: priya.id } }),
  ]);
  console.log("  ✓  Content Groups: 3");

  // ── Lookups ────────────────────────────────────────────────────────────────
  await p.lookup.createMany({ data: [
    { organizationId: ORG_ID, type: "DEPARTMENT", code: "EXE", label: "Executive",           sortOrder: 1 },
    { organizationId: ORG_ID, type: "DEPARTMENT", code: "ENG", label: "Engineering",          sortOrder: 2 },
    { organizationId: ORG_ID, type: "DEPARTMENT", code: "PRO", label: "Product",              sortOrder: 3 },
    { organizationId: ORG_ID, type: "DEPARTMENT", code: "FIN", label: "Finance",              sortOrder: 4 },
    { organizationId: ORG_ID, type: "DEPARTMENT", code: "OPS", label: "Operations",           sortOrder: 5 },
    { organizationId: ORG_ID, type: "DEPARTMENT", code: "HR",  label: "Human Resources",      sortOrder: 6 },
    { organizationId: ORG_ID, type: "DEPARTMENT", code: "MKT", label: "Marketing",            sortOrder: 7 },
    { organizationId: ORG_ID, type: "DEPARTMENT", code: "SAL", label: "Sales",                sortOrder: 8 },
    { organizationId: ORG_ID, type: "COST_CENTER", code: "CC001", label: "IT Infrastructure", sortOrder: 1 },
    { organizationId: ORG_ID, type: "COST_CENTER", code: "CC002", label: "Engineering R&D",   sortOrder: 2 },
    { organizationId: ORG_ID, type: "COST_CENTER", code: "CC003", label: "Finance & Compliance", sortOrder: 3 },
    { organizationId: ORG_ID, type: "COST_CENTER", code: "CC004", label: "Operations & Facilities", sortOrder: 4 },
    { organizationId: ORG_ID, type: "COST_CENTER", code: "CC005", label: "Marketing & Growth", sortOrder: 5 },
    { organizationId: ORG_ID, type: "CATEGORY", code: "IT_HW",  label: "IT Hardware",         sortOrder: 1 },
    { organizationId: ORG_ID, type: "CATEGORY", code: "IT_SW",  label: "Software & Licenses", sortOrder: 2 },
    { organizationId: ORG_ID, type: "CATEGORY", code: "CLOUD",  label: "Cloud Services",      sortOrder: 3 },
    { organizationId: ORG_ID, type: "CATEGORY", code: "CONS",   label: "Consulting Services", sortOrder: 4 },
    { organizationId: ORG_ID, type: "CATEGORY", code: "OFFICE", label: "Office Supplies",     sortOrder: 5 },
    { organizationId: ORG_ID, type: "CATEGORY", code: "FAC",    label: "Facilities",          sortOrder: 6 },
    { organizationId: ORG_ID, type: "CATEGORY", code: "MKT",    label: "Marketing & Events",  sortOrder: 7 },
    { organizationId: ORG_ID, type: "CATEGORY", code: "HR",     label: "HR & Training",       sortOrder: 8 },
    { organizationId: ORG_ID, type: "GL_ACCOUNT", code: "6100", label: "IT Equipment & Assets",  sortOrder: 1 },
    { organizationId: ORG_ID, type: "GL_ACCOUNT", code: "6200", label: "Software Subscriptions",  sortOrder: 2 },
    { organizationId: ORG_ID, type: "GL_ACCOUNT", code: "6300", label: "Cloud Infrastructure",    sortOrder: 3 },
    { organizationId: ORG_ID, type: "GL_ACCOUNT", code: "6400", label: "Professional Services",   sortOrder: 4 },
    { organizationId: ORG_ID, type: "GL_ACCOUNT", code: "6500", label: "Office & Admin",          sortOrder: 5 },
    { organizationId: ORG_ID, type: "GL_ACCOUNT", code: "6600", label: "Facilities & Maintenance",sortOrder: 6 },
    { organizationId: ORG_ID, type: "GL_ACCOUNT", code: "6700", label: "Marketing & Branding",    sortOrder: 7 },
    { organizationId: ORG_ID, type: "GL_ACCOUNT", code: "6800", label: "Travel & Accommodation",  sortOrder: 8 },
    { organizationId: ORG_ID, type: "GL_ACCOUNT", code: "6900", label: "Other Operating Expenses",sortOrder: 9 },
    { organizationId: ORG_ID, type: "PAYMENT_TERMS", code: "NET15",     label: "Net 15",     sortOrder: 1 },
    { organizationId: ORG_ID, type: "PAYMENT_TERMS", code: "NET30",     label: "Net 30",     sortOrder: 2 },
    { organizationId: ORG_ID, type: "PAYMENT_TERMS", code: "NET45",     label: "Net 45",     sortOrder: 3 },
    { organizationId: ORG_ID, type: "PAYMENT_TERMS", code: "NET60",     label: "Net 60",     sortOrder: 4 },
    { organizationId: ORG_ID, type: "PAYMENT_TERMS", code: "IMMEDIATE", label: "Immediate",  sortOrder: 5 },
  ]});
  console.log("  ✓  Lookups: 35");

  // ── Chart of Accounts ──────────────────────────────────────────────────────
  const coa = await p.chartOfAccount.create({
    data: { organizationId: ORG_ID, name: "Ace Technologies — India COA", code: "ACE-IN01", companyCode: "ACETEC-IN", currency: "INR", taxRegNumber: "29AABCA1234A1ZX", taxType: "GST", billingCity: "Bengaluru", billingState: "Karnataka", billingCountry: "India" },
  });
  const [seg1, seg2, seg3, seg4] = await Promise.all([
    p.coaSegment.create({ data: { chartOfAccountId: coa.id, position: 1, name: "Company",       linkedLookupType: null } }),
    p.coaSegment.create({ data: { chartOfAccountId: coa.id, position: 2, name: "Business Area", linkedLookupType: "DEPARTMENT" } }),
    p.coaSegment.create({ data: { chartOfAccountId: coa.id, position: 3, name: "Cost Centre",   linkedLookupType: "COST_CENTER" } }),
    p.coaSegment.create({ data: { chartOfAccountId: coa.id, position: 4, name: "GL Account",    linkedLookupType: "GL_ACCOUNT" } }),
  ]);
  await p.coaSegmentValue.createMany({ data: [
    { segmentId: seg1.id, code: "ACETEC", label: "Ace Technologies", isActive: true },
    { segmentId: seg1.id, code: "ACELAB", label: "Ace Labs",         isActive: true },
  ]});
  console.log("  ✓  Chart of Accounts: ACE-IN01 (4 segments)");

  // ── Custom Fields ──────────────────────────────────────────────────────────
  await p.customField.createMany({ data: [
    { organizationId: ORG_ID, module: "REQUISITION",    fieldName: "project_code",      label: "Project Code",          fieldType: "TEXT",    required: true,  sortOrder: 1, placeholder: "e.g. PRJ-2025-001" },
    { organizationId: ORG_ID, module: "REQUISITION",    fieldName: "budget_year",       label: "Budget Year",           fieldType: "SELECT",  required: true,  sortOrder: 2, options: ["FY 2024-25","FY 2025-26","FY 2026-27"] },
    { organizationId: ORG_ID, module: "REQUISITION",    fieldName: "capex_opex",        label: "CAPEX / OPEX",          fieldType: "SELECT",  required: true,  sortOrder: 3, options: ["CAPEX","OPEX"] },
    { organizationId: ORG_ID, module: "REQUISITION",    fieldName: "delivery_location", label: "Delivery Location",     fieldType: "TEXT",    required: false, sortOrder: 4, placeholder: "Office address or site name" },
    { organizationId: ORG_ID, module: "REQUISITION",    fieldName: "is_recurring",      label: "Recurring Purchase",    fieldType: "BOOLEAN", required: false, sortOrder: 5 },
    { organizationId: ORG_ID, module: "SUPPLIER",       fieldName: "vendor_class",      label: "Vendor Classification", fieldType: "SELECT",  required: true,  sortOrder: 1, options: ["Strategic","Preferred","Approved","Conditional"] },
    { organizationId: ORG_ID, module: "SUPPLIER",       fieldName: "csr_score",         label: "CSR Score",             fieldType: "NUMBER",  required: false, sortOrder: 2, placeholder: "0-100" },
    { organizationId: ORG_ID, module: "PURCHASE_ORDER", fieldName: "incoterms",         label: "Incoterms",             fieldType: "SELECT",  required: false, sortOrder: 1, options: ["EXW","FOB","CIF","DDP","DAP"] },
  ]});
  console.log("  ✓  Custom Fields: 8");

  // ── Approval Chains ────────────────────────────────────────────────────────
  const [rule1, rule2, rule3, rule4] = await Promise.all([
    p.approvalRule.create({ data: { organizationId: ORG_ID, name: "Up to ₹1 Lakh — Manager Only",     priority: 10, active: true, maxAmount: 100000 } }),
    p.approvalRule.create({ data: { organizationId: ORG_ID, name: "₹1L to ₹10L — Manager + Finance", priority: 20, active: true, minAmount: 100001,  maxAmount: 1000000 } }),
    p.approvalRule.create({ data: { organizationId: ORG_ID, name: "₹10L to ₹50L — Full Approval",    priority: 30, active: true, minAmount: 1000001, maxAmount: 5000000 } }),
    p.approvalRule.create({ data: { organizationId: ORG_ID, name: "Above ₹50L — Board Level",        priority: 40, active: true, minAmount: 5000001 } }),
  ]);
  await p.approvalRuleStep.createMany({ data: [
    { ruleId: rule1.id, sequence: 1, stepType: "MANAGER",   stepLabel: "Line Manager" },
    { ruleId: rule2.id, sequence: 1, stepType: "MANAGER",   stepLabel: "Line Manager" },
    { ruleId: rule2.id, sequence: 2, stepType: "FINANCE",   stepLabel: "Finance Controller" },
    { ruleId: rule3.id, sequence: 1, stepType: "MANAGER",   stepLabel: "Line Manager" },
    { ruleId: rule3.id, sequence: 2, stepType: "DIRECTOR",  stepLabel: "Director" },
    { ruleId: rule3.id, sequence: 3, stepType: "FINANCE",   stepLabel: "Finance Sign-off" },
    { ruleId: rule4.id, sequence: 1, stepType: "MANAGER",   stepLabel: "Line Manager" },
    { ruleId: rule4.id, sequence: 2, stepType: "DIRECTOR",  stepLabel: "Director" },
    { ruleId: rule4.id, sequence: 3, stepType: "FINANCE",   stepLabel: "CFO" },
    { ruleId: rule4.id, sequence: 4, stepType: "EXECUTIVE", stepLabel: "CEO / Founder" },
  ]});
  console.log("  ✓  Approval Chains: 4 tiers");

  // ── Suppliers ──────────────────────────────────────────────────────────────
  const now = new Date();

  const [dell, aws, msft, wipro, cisco, infosys, zoom, fresh] = await Promise.all([
    p.supplier.create({ data: { organizationId: ORG_ID, name: "Dell Technologies India Pvt. Ltd.", code: "SUP-001", status: "ACTIVE", onboardingStage: "ACTIVE", category: "IT Hardware", tier: "Tier 1", preferred: true, rating: 94, onTimeDelivery: 96, qualityScore: 92, invoiceAccuracy: 98, responsivenessScore: 90, riskLevel: "LOW", riskScore: 10, contactName: "Rajesh Kumar", contactEmail: "enterprise@dell.com", contactPhone: "+91-80-4150-0000", city: "Bengaluru", country: "India", currency: "INR", paymentTerms: "Net 30", requestedById: kate.id } }),
    p.supplier.create({ data: { organizationId: ORG_ID, name: "Amazon Web Services India Pvt. Ltd.", code: "SUP-002", status: "ACTIVE", onboardingStage: "ACTIVE", category: "Cloud Services", tier: "Tier 1", preferred: true, rating: 98, onTimeDelivery: 99, qualityScore: 99, invoiceAccuracy: 99, responsivenessScore: 96, riskLevel: "LOW", riskScore: 5, contactName: "Deepak Malhotra", contactEmail: "aws-billing@amazon.com", contactPhone: "+91-80-4032-0000", city: "Bengaluru", country: "India", currency: "INR", paymentTerms: "Net 30", requestedById: kate.id } }),
    p.supplier.create({ data: { organizationId: ORG_ID, name: "Microsoft India Pvt. Ltd.", code: "SUP-003", status: "ACTIVE", onboardingStage: "ACTIVE", category: "Software & Licenses", tier: "Tier 1", preferred: true, rating: 96, onTimeDelivery: 98, qualityScore: 97, invoiceAccuracy: 99, responsivenessScore: 94, riskLevel: "LOW", riskScore: 7, contactName: "Anita Sharma", contactEmail: "procurement@microsoft.com", contactPhone: "+91-11-4130-3000", city: "Hyderabad", country: "India", currency: "INR", paymentTerms: "Net 45", requestedById: kate.id } }),
    p.supplier.create({ data: { organizationId: ORG_ID, name: "Wipro Limited", code: "SUP-004", status: "ACTIVE", onboardingStage: "ACTIVE", category: "Consulting Services", tier: "Tier 2", preferred: false, rating: 83, onTimeDelivery: 81, qualityScore: 85, invoiceAccuracy: 90, responsivenessScore: 78, riskLevel: "MEDIUM", riskScore: 30, contactName: "Suresh Nair", contactEmail: "vendor@wipro.com", contactPhone: "+91-80-2844-0011", city: "Bengaluru", country: "India", currency: "INR", paymentTerms: "Net 45", requestedById: priya.id } }),
    p.supplier.create({ data: { organizationId: ORG_ID, name: "Cisco Systems India Pvt. Ltd.", code: "SUP-005", status: "ACTIVE", onboardingStage: "ACTIVE", category: "IT Hardware", tier: "Tier 1", preferred: false, rating: 89, onTimeDelivery: 91, qualityScore: 90, invoiceAccuracy: 94, responsivenessScore: 86, riskLevel: "LOW", riskScore: 14, contactName: "Preeti Joshi", contactEmail: "orders@cisco.com", contactPhone: "+91-80-4426-0000", city: "Bengaluru", country: "India", currency: "INR", paymentTerms: "Net 30", requestedById: priya.id } }),
    p.supplier.create({ data: { organizationId: ORG_ID, name: "Infosys BPM Limited", code: "SUP-006", status: "PENDING_APPROVAL", onboardingStage: "COMPLIANCE_REVIEW", category: "Consulting Services", tier: "Tier 2", riskLevel: "MEDIUM", riskScore: 35, contactName: "Kiran Rao", contactEmail: "vendor@infosys.com", contactPhone: "+91-80-2852-0000", city: "Bengaluru", country: "India", currency: "INR", requestedById: priya.id } }),
    p.supplier.create({ data: { organizationId: ORG_ID, name: "Zoom Video Communications India", code: "SUP-007", status: "PENDING_APPROVAL", onboardingStage: "VALIDATION", category: "Software & Licenses", contactName: "Meera Nair", contactEmail: "india@zoom.us", city: "Mumbai", country: "India", currency: "INR", requestedById: vikram.id } }),
    p.supplier.create({ data: { organizationId: ORG_ID, name: "Freshworks Inc.", code: "SUP-008", status: "PENDING_APPROVAL", onboardingStage: "REGISTRATION", category: "Software & Licenses", contactName: "Arun Kumar", contactEmail: "sales@freshworks.com", city: "Chennai", country: "India", currency: "INR", requestedById: kate.id } }),
  ]);

  // Onboarding profiles
  await Promise.all([
    p.supplierOnboardingProfile.create({ data: { supplierId: dell.id, legalName: "Dell Technologies India Pvt. Ltd.", businessType: "PRIVATE_LIMITED", panNumber: "AABCD1234E", gstNumber: "29AABCD1234E1Z5", bankName: "HDFC Bank", accountNumber: "50100123456789", ifscCode: "HDFC0001234", beneficiaryName: "Dell Technologies India", accountType: "CURRENT", regAddressLine1: "3rd Floor, Prestige Technostar", regCity: "Bengaluru", regState: "Karnataka", regPostal: "560048", completionScore: 100, submittedAt: new Date(now.getTime() - 90*86400000), approvedAt: new Date(now.getTime() - 85*86400000) } }),
    p.supplierOnboardingProfile.create({ data: { supplierId: aws.id,  legalName: "Amazon Web Services India Pvt. Ltd.", businessType: "PRIVATE_LIMITED", panNumber: "AABCA1234G", gstNumber: "29AABCA1234G1Z3", bankName: "DBS Bank", accountNumber: "9876543210", ifscCode: "DBSS0001234", beneficiaryName: "Amazon Web Services India", accountType: "CURRENT", regCity: "Bengaluru", regState: "Karnataka", regPostal: "560002", completionScore: 100, submittedAt: new Date(now.getTime() - 120*86400000) } }),
    p.supplierOnboardingProfile.create({ data: { supplierId: msft.id, legalName: "Microsoft India Pvt. Ltd.", businessType: "PRIVATE_LIMITED", panNumber: "AABCM1234F", gstNumber: "36AABCM1234F1Z1", bankName: "Citibank", accountNumber: "0123456789", ifscCode: "CITI0001234", beneficiaryName: "Microsoft India", accountType: "CURRENT", regCity: "Hyderabad", regState: "Telangana", regPostal: "500081", completionScore: 100, submittedAt: new Date(now.getTime() - 180*86400000) } }),
    p.supplierOnboardingProfile.create({ data: { supplierId: wipro.id, legalName: "Wipro Limited", businessType: "PUBLIC_LIMITED", panNumber: "AAACW1234C", gstNumber: "29AAACW1234C1Z3", bankName: "ICICI Bank", accountNumber: "111122223333", ifscCode: "ICIC0001234", beneficiaryName: "Wipro Limited", accountType: "CURRENT", regCity: "Bengaluru", regState: "Karnataka", regPostal: "560035", completionScore: 100, submittedAt: new Date(now.getTime() - 60*86400000) } }),
    p.supplierOnboardingProfile.create({ data: { supplierId: infosys.id, legalName: "Infosys BPM Limited", businessType: "PUBLIC_LIMITED", panNumber: "AABCI1234H", gstNumber: "29AABCI1234H1Z7", regCity: "Bengaluru", regState: "Karnataka", completionScore: 65, submittedAt: new Date(now.getTime() - 7*86400000) } }),
    p.supplierOnboardingProfile.create({ data: { supplierId: zoom.id, legalName: "Zoom Video Communications India", businessType: "PRIVATE_LIMITED", panNumber: "AABCZ1234J", regCity: "Mumbai", regState: "Maharashtra", completionScore: 30 } }),
  ]);

  // Documents
  const docSeed = [
    { sup: dell,    types: ["PAN_CARD","GST_CERTIFICATE","INCORPORATION_CERTIFICATE","CANCELLED_CHEQUE","ISO_CERTIFICATE"], verified: true  },
    { sup: aws,     types: ["PAN_CARD","GST_CERTIFICATE","INCORPORATION_CERTIFICATE","CANCELLED_CHEQUE"],                   verified: true  },
    { sup: msft,    types: ["PAN_CARD","GST_CERTIFICATE","INCORPORATION_CERTIFICATE","BANK_STATEMENT"],                     verified: true  },
    { sup: wipro,   types: ["PAN_CARD","GST_CERTIFICATE","INCORPORATION_CERTIFICATE"],                                       verified: true  },
    { sup: infosys, types: ["PAN_CARD","GST_CERTIFICATE"],                                                                   verified: false },
    { sup: zoom,    types: ["PAN_CARD"],                                                                                     verified: false },
  ];
  for (const d of docSeed) {
    for (const type of d.types) {
      await p.supplierDocument.create({ data: { supplierId: d.sup.id, type, name: `${type.replace(/_/g," ")} — ${d.sup.name}`, fileUrl: "#", status: d.verified ? "VERIFIED" : "PENDING", verifiedAt: d.verified ? new Date(now.getTime() - 30*86400000) : null } });
    }
  }
  console.log("  ✓  Suppliers: 8 + documents");

  // ── Requisitions ───────────────────────────────────────────────────────────
  let reqCount = 0;
  async function mkReq(meta, lines, steps) {
    reqCount++;
    const num = `REQ-${String(reqCount).padStart(6,"0")}`;
    const sub = lines.reduce((s,l) => s + l.qty * l.price, 0);
    const req = await p.requisition.create({
      data: {
        organizationId: ORG_ID, requestorId: meta.requestorId,
        requisitionNumber: num, title: meta.title,
        category: meta.category, priority: meta.priority,
        status: meta.status, department: meta.department || null,
        businessJustification: meta.justification || null,
        submittedAt: meta.submittedAt || null, currency: "INR",
        totalAmount: sub, taxAmount: sub * 0.18,
        intakeSource: meta.source || "FORM",
        lineItems: {
          create: lines.map(l => ({
            description: l.desc, quantity: l.qty, unitPrice: l.price,
            lineTotal: l.qty * l.price, taxRate: 0.18, taxAmount: l.qty * l.price * 0.18,
            supplierId: l.sid || null, glAccount: l.gl || null,
          })),
        },
      },
    });
    for (const s of steps) {
      await p.approvalStep.create({ data: { requisitionId: req.id, ...s } });
    }
    return req;
  }

  const req1 = await mkReq(
    { requestorId: vikram.id, title: "MacBook Pro M3 — Engineering Team (10 units)", category: "IT Hardware", priority: "HIGH", status: "APPROVED", department: "Engineering", justification: "10 new engineers joining for SaaS product launch. Laptops needed by Day 1.", submittedAt: new Date(now.getTime() - 8*86400000) },
    [
      { desc: "Apple MacBook Pro M3 14\" 16GB/512GB", qty: 10, price: 149000, sid: dell.id, gl: "6100" },
      { desc: "Apple Magic Mouse USB-C",               qty: 10, price: 6500,  sid: dell.id, gl: "6100" },
      { desc: "Dell USB-C Hub 7-in-1",                 qty: 10, price: 4500,  sid: dell.id, gl: "6100" },
    ],
    [
      { stepType: "MANAGER", sequence: 1, approverId: rahul.id,  status: "APPROVED", comment: "Approved — critical for Q3 hiring.", decidedAt: new Date(now.getTime() - 5*86400000) },
      { stepType: "FINANCE", sequence: 2, approverId: sneha.id,  status: "APPROVED", comment: "Budget confirmed. Proceed.", decidedAt: new Date(now.getTime() - 4*86400000) },
    ]
  );

  const req2 = await mkReq(
    { requestorId: vikram.id, title: "AWS Cloud Infrastructure — Q4 Production Launch", category: "Cloud Services", priority: "CRITICAL", status: "SUBMITTED", department: "Engineering", justification: "Production infra for SaaS platform launching Oct 1. Reserved instances save 40%.", submittedAt: new Date(now.getTime() - 2*86400000), source: "CHATBOT" },
    [
      { desc: "AWS EC2 Reserved m6i.2xlarge × 2 (1yr)", qty: 2, price: 165000, sid: aws.id, gl: "6300" },
      { desc: "AWS RDS PostgreSQL db.r6g.xlarge (1yr)",  qty: 1, price: 248000, sid: aws.id, gl: "6300" },
      { desc: "AWS S3 Standard — 100TB pre-paid block",  qty: 1, price: 85000,  sid: aws.id, gl: "6300" },
    ],
    [
      { stepType: "MANAGER", sequence: 1, approverId: rahul.id, status: "PENDING" },
      { stepType: "FINANCE", sequence: 2, approverId: sneha.id, status: "PENDING" },
    ]
  );

  const req3 = await mkReq(
    { requestorId: kate.id, title: "Microsoft 365 Business Premium — 50 Seats Annual Renewal", category: "Software & Licenses", priority: "HIGH", status: "MANAGER_APPROVAL", department: "IT", justification: "Annual licence renewal — all 50 users lose access Sep 1 if not renewed.", submittedAt: new Date(now.getTime() - 1*86400000) },
    [
      { desc: "Microsoft 365 Business Premium 50 seats/yr", qty: 50, price: 5200, sid: msft.id, gl: "6200" },
      { desc: "Microsoft Defender for Business — add-on",   qty: 50, price: 850,  sid: msft.id, gl: "6200" },
    ],
    [
      { stepType: "MANAGER", sequence: 1, approverId: rahul.id, status: "PENDING" },
    ]
  );

  const req4 = await mkReq(
    { requestorId: kate.id, title: "Wipro Digital Transformation Consulting — Phase 2 (6 months)", category: "Consulting Services", priority: "MEDIUM", status: "PO_CREATED", department: "IT", justification: "Phase 2 of digital roadmap. API migration and backend modernisation.", submittedAt: new Date(now.getTime() - 20*86400000) },
    [
      { desc: "Principal Consultant — API Architecture 6 months", qty: 6, price: 280000, sid: wipro.id, gl: "6400" },
      { desc: "Senior Developer — Backend Migration 6 months",    qty: 6, price: 200000, sid: wipro.id, gl: "6400" },
    ],
    [
      { stepType: "MANAGER", sequence: 1, approverId: rahul.id, status: "APPROVED", decidedAt: new Date(now.getTime() - 15*86400000) },
      { stepType: "FINANCE", sequence: 2, approverId: sneha.id, status: "APPROVED", decidedAt: new Date(now.getTime() - 13*86400000) },
    ]
  );

  const req5 = await mkReq(
    { requestorId: vikram.id, title: "Cisco Network Upgrade — HQ Office Switching & Wi-Fi 6E", category: "IT Hardware", priority: "LOW", status: "DRAFT", department: "IT", justification: "Current network 5 years old — bottlenecking VPN performance." },
    [
      { desc: "Cisco Catalyst 2960-X Switch 48-port", qty: 3,  price: 92000, sid: cisco.id, gl: "6100" },
      { desc: "Cisco Wi-Fi 6E Access Point",           qty: 12, price: 18500, sid: cisco.id, gl: "6100" },
    ],
    []
  );

  const req6 = await mkReq(
    { requestorId: vikram.id, title: "Standing Desks — Engineering Floor Ergonomic Upgrade", category: "Office Supplies", priority: "LOW", status: "REJECTED", department: "Engineering", justification: "Ergonomic upgrade for 20 engineers.", submittedAt: new Date(now.getTime() - 30*86400000) },
    [{ desc: "Autonomous SmartDesk Pro height-adjustable", qty: 20, price: 32000, gl: "6500" }],
    [{ stepType: "MANAGER", sequence: 1, approverId: rahul.id, status: "REJECTED", comment: "Budget freeze until Q4. Please resubmit in October.", decidedAt: new Date(now.getTime() - 25*86400000) }]
  );

  console.log("  ✓  Requisitions: 6");

  // ── Purchase Orders ────────────────────────────────────────────────────────
  let poCount = 0;
  async function mkPO(reqId, supId, supEmail, meta, lines) {
    poCount++;
    const poNum = `PO-${new Date().getFullYear()}-${String(poCount).padStart(3,"0")}`;
    const sub = lines.reduce((s,l) => s + l.qty * l.price, 0);
    return p.purchaseOrder.create({
      data: {
        organizationId: ORG_ID, requisitionId: reqId,
        supplierId: supId, createdById: priya.id,
        poNumber: poNum, supplierEmail: supEmail,
        currency: "INR", routingMethod: "EMAIL",
        status: meta.status, paymentTerms: meta.terms || "Net 30",
        issuedAt: meta.issuedAt || new Date(),
        acknowledgedAt: meta.acknowledgedAt || null,
        expectedDelivery: meta.delivery || null,
        deliveryAddress: meta.address || null,
        notes: meta.notes || null,
        subtotal: sub, taxAmount: sub * 0.18, totalAmount: sub * 1.18,
        lineItems: {
          create: lines.map(l => ({
            description: l.desc, supplierId: supId,
            quantity: l.qty, unitPrice: l.price, lineTotal: l.qty * l.price,
            glAccount: l.gl || null,
          })),
        },
      },
    });
  }

  const po1 = await mkPO(req1.id, dell.id, "enterprise@dell.com",
    { status: "SENT", terms: "Net 30", issuedAt: new Date(now.getTime() - 3*86400000), delivery: new Date(now.getTime() + 7*86400000), address: "Ace Technologies, 5th Floor, Prestige Technostar, Bengaluru 560048", notes: "Delivery required before Aug 15 — new hire start date." },
    [
      { desc: "Apple MacBook Pro M3 14\" × 10", qty: 10, price: 149000, gl: "6100" },
      { desc: "Apple Magic Mouse USB-C × 10",   qty: 10, price: 6500,   gl: "6100" },
      { desc: "Dell USB-C Hub × 10",             qty: 10, price: 4500,   gl: "6100" },
    ]
  );

  const po2 = await mkPO(req4.id, wipro.id, "vendor@wipro.com",
    { status: "ACKNOWLEDGED", terms: "Net 45", issuedAt: new Date(now.getTime() - 12*86400000), acknowledgedAt: new Date(now.getTime() - 10*86400000), delivery: new Date(now.getTime() + 180*86400000), address: "Ace Technologies HQ, Bengaluru" },
    [
      { desc: "Principal Consultant — API Architecture 6mo", qty: 6, price: 280000, gl: "6400" },
      { desc: "Senior Developer — Backend Migration 6mo",    qty: 6, price: 200000, gl: "6400" },
    ]
  );

  await p.requisition.update({ where: { id: req4.id }, data: { status: "PO_CREATED" } });
  console.log("  ✓  Purchase Orders: 2");

  // ── Supplier Messages ──────────────────────────────────────────────────────
  await p.supplierMessage.createMany({ data: [
    { supplierId: dell.id,    fromPortal: false, senderName: "Priya Mehta",          subject: "Delivery Confirmation — PO-2025-001",    body: "Hi Rajesh, please confirm delivery schedule for PO-2025-001. We need all 10 MacBooks by Aug 12." },
    { supplierId: dell.id,    fromPortal: true,  senderName: "Rajesh Kumar (Dell)",   subject: "RE: Delivery Confirmation",               body: "Hi Priya, confirmed delivery on Aug 11 via Blue Dart. AWB: 12345678. All 10 units arrive by 2pm." },
    { supplierId: wipro.id,   fromPortal: false, senderName: "Priya Mehta",          subject: "SOW Review — Phase 2 Engagement",         body: "Suresh, please review the SOW and sign by Friday. PO-2025-002 is already issued." },
    { supplierId: infosys.id, fromPortal: false, senderName: "Priya Mehta",          subject: "Pending Documents — Onboarding",          body: "Kiran, we still need your ISO certificate and bank statement to complete onboarding verification." },
  ]});
  console.log("  ✓  Supplier messages: 4");

  // ── API Clients ────────────────────────────────────────────────────────────
  await Promise.all([
    p.apiClient.create({ data: { organizationId: ORG_ID, name: "Ace ERP Integration", description: "Connects internal ERP to Veltriance procurement API", clientId: "ace_erp_" + crypto.randomBytes(8).toString("hex"), clientSecretHash: crypto.createHash("sha256").update("demo_secret_erp_001").digest("hex"), scopes: ["requisitions:read","requisitions:write","purchase_orders:read","suppliers:read"], active: true, createdById: kate.id } }),
    p.apiClient.create({ data: { organizationId: ORG_ID, name: "Finance System Webhook", description: "Finance approval system for auto-approval workflows", clientId: "ace_fin_" + crypto.randomBytes(8).toString("hex"), clientSecretHash: crypto.createHash("sha256").update("demo_secret_fin_002").digest("hex"), scopes: ["requisitions:read","purchase_orders:read","purchase_orders:write"], active: true, createdById: kate.id } }),
  ]);
  console.log("  ✓  API Clients: 2");

  // ── Integrations ───────────────────────────────────────────────────────────
  await p.integration.createMany({ data: [
    { organizationId: ORG_ID, connectorKey: "sap_s4hana", name: "SAP S/4HANA",  status: "CONNECTED",    config: { host: "ace-sap.internal", client: "100", systemId: "ACE" }, lastSyncAt: new Date(now.getTime() - 2*3600000),  syncCount: 1248, errorCount: 0  },
    { organizationId: ORG_ID, connectorKey: "slack",       name: "Slack",        status: "CONNECTED",    config: { workspace: "ace-technologies", channel: "#procurement-alerts" }, lastSyncAt: new Date(now.getTime() - 30*60000), syncCount: 89,   errorCount: 0  },
    { organizationId: ORG_ID, connectorKey: "coupa",       name: "Coupa",        status: "ERROR",        config: { host: "ace.coupahost.com" }, lastSyncAt: new Date(now.getTime() - 48*3600000), syncCount: 302,  errorCount: 12 },
    { organizationId: ORG_ID, connectorKey: "quickbooks",  name: "QuickBooks",   status: "DISCONNECTED", config: {}, syncCount: 0, errorCount: 0 },
  ]});
  console.log("  ✓  Integrations: 4");

  console.log(`
╔══════════════════════════════════════════════╗
║   ✅  ace.localhost:3000 ready!              ║
╠══════════════════════════════════════════════╣
║  Login:     kate@ace.com                    ║
║  URL:       http://ace.localhost:3000       ║
╠══════════════════════════════════════════════╣
║  Suppliers:        8 (5 active, 3 pending)  ║
║  Requisitions:     6 (all states)           ║
║  Purchase Orders:  2 (SENT + ACKNOWLEDGED)  ║
║  Approval chains:  4 tiers                  ║
║  Custom fields:    8                        ║
║  Lookups:          35                       ║
║  COA segments:     4                        ║
║  Workspace roles:  3                        ║
║  Content groups:   3                        ║
║  Pending invites:  2                        ║
║  API clients:      2                        ║
║  Integrations:     4                        ║
╚══════════════════════════════════════════════╝
`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => p.$disconnect());
