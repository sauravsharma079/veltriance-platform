
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  console.log('\n🌱  Seeding ace.localhost workspace...\n');

  // ── Wipe existing ace org ──────────────────────────────────────────────────
  const existing = await p.organization.findUnique({ where: { slug: 'ace' } });
  if (existing) {
    console.log('  Clearing existing ace data...');
    const oid = existing.id;
    await p.purchaseOrderLineItem.deleteMany({ where: { purchaseOrder: { organizationId: oid } } });
    await p.purchaseOrder.deleteMany({ where: { organizationId: oid } });
    await p.approvalStep.deleteMany({ where: { requisition: { organizationId: oid } } });
    await p.requisitionLineItem.deleteMany({ where: { requisition: { organizationId: oid } } });
    await p.requisition.deleteMany({ where: { organizationId: oid } });
    await p.supplierDocument.deleteMany({ where: { supplier: { organizationId: oid } } });
    await p.supplierMessage.deleteMany({ where: { supplier: { organizationId: oid } } });
    await p.supplierOnboardingProfile.deleteMany({ where: { supplier: { organizationId: oid } } });
    await p.supplierCertification.deleteMany({ where: { supplier: { organizationId: oid } } });
    await p.supplier.deleteMany({ where: { organizationId: oid } });
    await p.lookup.deleteMany({ where: { organizationId: oid } });
    await p.customField.deleteMany({ where: { organizationId: oid } });
    await p.approvalRuleStep.deleteMany({ where: { rule: { organizationId: oid } } });
    await p.approvalRule.deleteMany({ where: { organizationId: oid } });
    await p.coaSegmentValue.deleteMany({ where: { segment: { chartOfAccount: { organizationId: oid } } } });
    await p.coaSegment.deleteMany({ where: { chartOfAccount: { organizationId: oid } } });
    await p.chartOfAccount.deleteMany({ where: { organizationId: oid } });
    await p.contentGroupMember.deleteMany({ where: { contentGroup: { organizationId: oid } } });
    await p.contentGroup.deleteMany({ where: { organizationId: oid } });
    await p.workspaceRoleMember.deleteMany({ where: { user: { organizationId: oid } } });
    await p.workspaceRole.deleteMany({ where: { organizationId: oid } });
    await p.apiToken.deleteMany({ where: { client: { organizationId: oid } } });
    await p.apiClient.deleteMany({ where: { organizationId: oid } });
    await p.integration.deleteMany({ where: { organizationId: oid } });
    await p.user.deleteMany({ where: { organizationId: oid } });
    await p.organization.delete({ where: { id: oid } });
  }

  // ── Organisation ───────────────────────────────────────────────────────────
  const org = await p.organization.create({
    data: { name: 'Ace Technologies Pvt. Ltd.', slug: 'ace' },
  });
  const oid = org.id;
  console.log(`  ✓  Organization: ${org.name}`);

  // ── Users ──────────────────────────────────────────────────────────────────
  // Link Saurav's existing Supabase authId
  const sauravAuth = await p.user.findFirst({ where: { email: 'sauravsharma079@gmail.com' } });

  const [admin, procurement, director, finance, eng1, eng2, hr] = await Promise.all([
    p.user.create({ data: { organizationId: oid, email: 'saurav@ace.tech', name: 'Saurav Sharma', role: 'ADMIN', jobTitle: 'CEO & Founder', department: 'Executive', currency: 'INR', inviteStatus: 'ACTIVE', authId: sauravAuth?.authId ?? null } }),
    p.user.create({ data: { organizationId: oid, email: 'priya.mehta@ace.tech', name: 'Priya Mehta', role: 'PROCUREMENT', jobTitle: 'Procurement Manager', department: 'Procurement', currency: 'INR', inviteStatus: 'ACTIVE' } }),
    p.user.create({ data: { organizationId: oid, email: 'rahul.gupta@ace.tech', name: 'Rahul Gupta', role: 'APPROVER', jobTitle: 'Engineering Director', department: 'Engineering', currency: 'INR', inviteStatus: 'ACTIVE' } }),
    p.user.create({ data: { organizationId: oid, email: 'sneha.patel@ace.tech', name: 'Sneha Patel', role: 'APPROVER', jobTitle: 'Finance Controller', department: 'Finance', currency: 'INR', inviteStatus: 'ACTIVE' } }),
    p.user.create({ data: { organizationId: oid, email: 'vikram.singh@ace.tech', name: 'Vikram Singh', role: 'REQUESTOR', jobTitle: 'Senior Software Engineer', department: 'Engineering', currency: 'INR', inviteStatus: 'ACTIVE' } }),
    p.user.create({ data: { organizationId: oid, email: 'ananya.roy@ace.tech', name: 'Ananya Roy', role: 'REQUESTOR', jobTitle: 'Product Manager', department: 'Product', currency: 'INR', inviteStatus: 'PENDING' } }),
    p.user.create({ data: { organizationId: oid, email: 'deepak.nair@ace.tech', name: 'Deepak Nair', role: 'REQUESTOR', jobTitle: 'HR Manager', department: 'HR', currency: 'INR', inviteStatus: 'PENDING' } }),
  ]);
  console.log('  ✓  Users: 7 (2 pending invites)');

  // ── Workspace Roles ────────────────────────────────────────────────────────
  const [adminRole, procRole, viewRole] = await Promise.all([
    p.workspaceRole.create({ data: { organizationId: oid, name: 'Admin', description: 'Full access to all modules and settings', isSystem: true, permissions: ['ALL'] } }),
    p.workspaceRole.create({ data: { organizationId: oid, name: 'Procurement Officer', description: 'Manage suppliers, requisitions, and purchase orders', isSystem: false, permissions: ['SUPPLIERS_READ','SUPPLIERS_WRITE','REQUISITIONS_READ','REQUISITIONS_WRITE','PO_READ','PO_WRITE'] } }),
    p.workspaceRole.create({ data: { organizationId: oid, name: 'Viewer', description: 'Read-only access to approved data', isSystem: false, permissions: ['REQUISITIONS_READ','PO_READ','SUPPLIERS_READ'] } }),
  ]);
  await Promise.all([
    p.workspaceRoleMember.create({ data: { userId: admin.id, workspaceRoleId: adminRole.id } }),
    p.workspaceRoleMember.create({ data: { userId: procurement.id, workspaceRoleId: procRole.id } }),
    p.workspaceRoleMember.create({ data: { userId: eng1.id, workspaceRoleId: viewRole.id } }),
  ]);
  console.log('  ✓  Workspace Roles: 3');

  // ── Content Groups ─────────────────────────────────────────────────────────
  const [itGroup, finGroup, opsGroup] = await Promise.all([
    p.contentGroup.create({ data: { organizationId: oid, name: 'IT & Engineering', description: 'Technology purchases and infrastructure', color: '#1A2A52' } }),
    p.contentGroup.create({ data: { organizationId: oid, name: 'Finance & Admin', description: 'Finance team operational purchases', color: '#C8A04D' } }),
    p.contentGroup.create({ data: { organizationId: oid, name: 'Operations', description: 'Facilities and operational supplies', color: '#10B981' } }),
  ]);
  await Promise.all([
    p.contentGroupMember.create({ data: { contentGroupId: itGroup.id, userId: eng1.id } }),
    p.contentGroupMember.create({ data: { contentGroupId: finGroup.id, userId: finance.id } }),
    p.contentGroupMember.create({ data: { contentGroupId: opsGroup.id, userId: procurement.id } }),
  ]);
  console.log('  ✓  Content Groups: 3');

  // ── Lookups ────────────────────────────────────────────────────────────────
  await p.lookup.createMany({ data: [
    // Departments
    { organizationId: oid, type: 'DEPARTMENT', code: 'EXE', label: 'Executive',             sortOrder: 1 },
    { organizationId: oid, type: 'DEPARTMENT', code: 'ENG', label: 'Engineering',            sortOrder: 2 },
    { organizationId: oid, type: 'DEPARTMENT', code: 'PRO', label: 'Product',                sortOrder: 3 },
    { organizationId: oid, type: 'DEPARTMENT', code: 'FIN', label: 'Finance',                sortOrder: 4 },
    { organizationId: oid, type: 'DEPARTMENT', code: 'OPS', label: 'Operations',             sortOrder: 5 },
    { organizationId: oid, type: 'DEPARTMENT', code: 'HR',  label: 'Human Resources',        sortOrder: 6 },
    { organizationId: oid, type: 'DEPARTMENT', code: 'MKT', label: 'Marketing',              sortOrder: 7 },
    { organizationId: oid, type: 'DEPARTMENT', code: 'SAL', label: 'Sales',                  sortOrder: 8 },
    // Cost Centers
    { organizationId: oid, type: 'COST_CENTER', code: 'CC001', label: 'IT Infrastructure',   sortOrder: 1 },
    { organizationId: oid, type: 'COST_CENTER', code: 'CC002', label: 'Engineering R&D',     sortOrder: 2 },
    { organizationId: oid, type: 'COST_CENTER', code: 'CC003', label: 'Finance & Compliance', sortOrder: 3 },
    { organizationId: oid, type: 'COST_CENTER', code: 'CC004', label: 'Operations & Facilities', sortOrder: 4 },
    { organizationId: oid, type: 'COST_CENTER', code: 'CC005', label: 'Marketing & Growth',  sortOrder: 5 },
    // Categories
    { organizationId: oid, type: 'CATEGORY', code: 'IT_HW',  label: 'IT Hardware',           sortOrder: 1 },
    { organizationId: oid, type: 'CATEGORY', code: 'IT_SW',  label: 'Software & Licenses',   sortOrder: 2 },
    { organizationId: oid, type: 'CATEGORY', code: 'CLOUD',  label: 'Cloud Services',        sortOrder: 3 },
    { organizationId: oid, type: 'CATEGORY', code: 'CONS',   label: 'Consulting Services',   sortOrder: 4 },
    { organizationId: oid, type: 'CATEGORY', code: 'OFFICE', label: 'Office Supplies',       sortOrder: 5 },
    { organizationId: oid, type: 'CATEGORY', code: 'FAC',    label: 'Facilities',            sortOrder: 6 },
    { organizationId: oid, type: 'CATEGORY', code: 'MKT',    label: 'Marketing & Events',    sortOrder: 7 },
    { organizationId: oid, type: 'CATEGORY', code: 'HR',     label: 'HR & Training',         sortOrder: 8 },
    // GL Accounts
    { organizationId: oid, type: 'GL_ACCOUNT', code: '6100', label: 'IT Equipment & Assets', sortOrder: 1 },
    { organizationId: oid, type: 'GL_ACCOUNT', code: '6200', label: 'Software Subscriptions', sortOrder: 2 },
    { organizationId: oid, type: 'GL_ACCOUNT', code: '6300', label: 'Cloud Infrastructure',  sortOrder: 3 },
    { organizationId: oid, type: 'GL_ACCOUNT', code: '6400', label: 'Professional Services', sortOrder: 4 },
    { organizationId: oid, type: 'GL_ACCOUNT', code: '6500', label: 'Office & Admin',        sortOrder: 5 },
    { organizationId: oid, type: 'GL_ACCOUNT', code: '6600', label: 'Facilities & Maintenance', sortOrder: 6 },
    { organizationId: oid, type: 'GL_ACCOUNT', code: '6700', label: 'Marketing & Branding',  sortOrder: 7 },
    { organizationId: oid, type: 'GL_ACCOUNT', code: '6800', label: 'Travel & Accommodation', sortOrder: 8 },
    { organizationId: oid, type: 'GL_ACCOUNT', code: '6900', label: 'Other Operating Expenses', sortOrder: 9 },
    // Payment terms
    { organizationId: oid, type: 'PAYMENT_TERMS', code: 'NET15', label: 'Net 15',            sortOrder: 1 },
    { organizationId: oid, type: 'PAYMENT_TERMS', code: 'NET30', label: 'Net 30',            sortOrder: 2 },
    { organizationId: oid, type: 'PAYMENT_TERMS', code: 'NET45', label: 'Net 45',            sortOrder: 3 },
    { organizationId: oid, type: 'PAYMENT_TERMS', code: 'NET60', label: 'Net 60',            sortOrder: 4 },
    { organizationId: oid, type: 'PAYMENT_TERMS', code: 'IMMEDIATE', label: 'Immediate',     sortOrder: 5 },
    // Priority
    { organizationId: oid, type: 'PRIORITY', code: 'LOW',      label: 'Low',                 sortOrder: 1 },
    { organizationId: oid, type: 'PRIORITY', code: 'MEDIUM',   label: 'Medium',              sortOrder: 2 },
    { organizationId: oid, type: 'PRIORITY', code: 'HIGH',     label: 'High',                sortOrder: 3 },
    { organizationId: oid, type: 'PRIORITY', code: 'CRITICAL', label: 'Critical',            sortOrder: 4 },
  ]});
  console.log('  ✓  Lookups: 39');

  // ── Chart of Accounts ──────────────────────────────────────────────────────
  const coa = await p.chartOfAccount.create({
    data: {
      organizationId: oid,
      name: 'Ace Technologies — India COA',
      code: 'ACE-IN01',
      companyCode: 'ACETEC-IN',
      currency: 'INR',
      taxRegNumber: '29AABCA1234A1ZX',
      taxType: 'GST',
      billingCity: 'Bengaluru',
      billingState: 'Karnataka',
      billingCountry: 'India',
    },
  });
  const [seg1, seg2, seg3, seg4] = await Promise.all([
    p.coaSegment.create({ data: { chartOfAccountId: coa.id, position: 1, name: 'Company',       linkedLookupType: null } }),
    p.coaSegment.create({ data: { chartOfAccountId: coa.id, position: 2, name: 'Business Area', linkedLookupType: 'DEPARTMENT' } }),
    p.coaSegment.create({ data: { chartOfAccountId: coa.id, position: 3, name: 'Cost Centre',   linkedLookupType: 'COST_CENTER' } }),
    p.coaSegment.create({ data: { chartOfAccountId: coa.id, position: 4, name: 'GL Account',    linkedLookupType: 'GL_ACCOUNT' } }),
  ]);
  await p.coaSegmentValue.createMany({ data: [
    { segmentId: seg1.id, code: 'ACETEC', label: 'Ace Technologies', isActive: true },
    { segmentId: seg1.id, code: 'ACELAB', label: 'Ace Labs',         isActive: true },
  ]});
  console.log('  ✓  Chart of Accounts: ACE-IN01 (4 segments)');

  // ── Custom Fields ──────────────────────────────────────────────────────────
  await p.customField.createMany({ data: [
    { organizationId: oid, module: 'REQUISITION', fieldName: 'project_code',      label: 'Project Code',       fieldType: 'TEXT',     required: true,  sortOrder: 1, placeholder: 'e.g. PRJ-2025-001' },
    { organizationId: oid, module: 'REQUISITION', fieldName: 'budget_year',       label: 'Budget Year',        fieldType: 'SELECT',   required: true,  sortOrder: 2, options: ['FY 2024-25','FY 2025-26','FY 2026-27'] },
    { organizationId: oid, module: 'REQUISITION', fieldName: 'capex_opex',        label: 'CAPEX / OPEX',       fieldType: 'SELECT',   required: true,  sortOrder: 3, options: ['CAPEX','OPEX'] },
    { organizationId: oid, module: 'REQUISITION', fieldName: 'delivery_location', label: 'Delivery Location',  fieldType: 'TEXT',     required: false, sortOrder: 4, placeholder: 'Office address or site name' },
    { organizationId: oid, module: 'REQUISITION', fieldName: 'is_recurring',      label: 'Recurring Purchase', fieldType: 'BOOLEAN',  required: false, sortOrder: 5 },
    { organizationId: oid, module: 'SUPPLIER',    fieldName: 'vendor_class',      label: 'Vendor Classification', fieldType: 'SELECT', required: true, sortOrder: 1, options: ['Strategic','Preferred','Approved','Conditional'] },
    { organizationId: oid, module: 'SUPPLIER',    fieldName: 'csr_score',         label: 'CSR Score',          fieldType: 'NUMBER',   required: false, sortOrder: 2, placeholder: '0-100' },
    { organizationId: oid, module: 'PURCHASE_ORDER', fieldName: 'incoterms',     label: 'Incoterms',          fieldType: 'SELECT',   required: false, sortOrder: 1, options: ['EXW','FOB','CIF','DDP','DAP'] },
  ]});
  console.log('  ✓  Custom Fields: 8 (Requisition + Supplier + PO)');

  // ── Approval Chains ────────────────────────────────────────────────────────
  const [rule1, rule2, rule3, rule4] = await Promise.all([
    p.approvalRule.create({ data: { organizationId: oid, name: 'Up to ₹1 Lakh — Manager Only',        priority: 10, active: true, maxAmount: 100000 } }),
    p.approvalRule.create({ data: { organizationId: oid, name: '₹1L to ₹10L — Manager + Finance',     priority: 20, active: true, minAmount: 100001, maxAmount: 1000000 } }),
    p.approvalRule.create({ data: { organizationId: oid, name: '₹10L to ₹50L — Full Approval',        priority: 30, active: true, minAmount: 1000001, maxAmount: 5000000 } }),
    p.approvalRule.create({ data: { organizationId: oid, name: 'Above ₹50L — Board Level',            priority: 40, active: true, minAmount: 5000001 } }),
  ]);
  await p.approvalRuleStep.createMany({ data: [
    { ruleId: rule1.id, sequence: 1, stepType: 'MANAGER',   stepLabel: 'Line Manager' },
    { ruleId: rule2.id, sequence: 1, stepType: 'MANAGER',   stepLabel: 'Line Manager' },
    { ruleId: rule2.id, sequence: 2, stepType: 'FINANCE',   stepLabel: 'Finance Controller' },
    { ruleId: rule3.id, sequence: 1, stepType: 'MANAGER',   stepLabel: 'Line Manager' },
    { ruleId: rule3.id, sequence: 2, stepType: 'DIRECTOR',  stepLabel: 'Director' },
    { ruleId: rule3.id, sequence: 3, stepType: 'FINANCE',   stepLabel: 'Finance Sign-off' },
    { ruleId: rule4.id, sequence: 1, stepType: 'MANAGER',   stepLabel: 'Line Manager' },
    { ruleId: rule4.id, sequence: 2, stepType: 'DIRECTOR',  stepLabel: 'Director' },
    { ruleId: rule4.id, sequence: 3, stepType: 'FINANCE',   stepLabel: 'CFO' },
    { ruleId: rule4.id, sequence: 4, stepType: 'EXECUTIVE', stepLabel: 'CEO' },
  ]});
  console.log('  ✓  Approval Chains: 4 tiers');

  // ── Suppliers ──────────────────────────────────────────────────────────────
  const now = new Date();

  const [dell, aws, msft, wipro, cisco, infosys, zoom, freshworks] = await Promise.all([
    // Active + preferred
    p.supplier.create({ data: { organizationId: oid, name: 'Dell Technologies India Pvt. Ltd.', code: 'SUP-001', status: 'ACTIVE', onboardingStage: 'ACTIVE', category: 'IT Hardware', tier: 'Tier 1', preferred: true, rating: 94, onTimeDelivery: 96, qualityScore: 92, invoiceAccuracy: 98, responsivenessScore: 90, riskLevel: 'LOW', riskScore: 10, contactName: 'Rajesh Kumar', contactEmail: 'enterprise@dell.com', contactPhone: '+91-80-4150-0000', city: 'Bengaluru', country: 'India', currency: 'INR', paymentTerms: 'Net 30', requestedById: admin.id } }),
    p.supplier.create({ data: { organizationId: oid, name: 'Amazon Web Services India Pvt. Ltd.', code: 'SUP-002', status: 'ACTIVE', onboardingStage: 'ACTIVE', category: 'Cloud Services', tier: 'Tier 1', preferred: true, rating: 98, onTimeDelivery: 99, qualityScore: 99, invoiceAccuracy: 99, responsivenessScore: 96, riskLevel: 'LOW', riskScore: 5, contactName: 'Deepak Malhotra', contactEmail: 'aws-billing@amazon.com', contactPhone: '+91-80-4032-0000', city: 'Bengaluru', country: 'India', currency: 'INR', paymentTerms: 'Net 30', requestedById: admin.id } }),
    p.supplier.create({ data: { organizationId: oid, name: 'Microsoft India Pvt. Ltd.', code: 'SUP-003', status: 'ACTIVE', onboardingStage: 'ACTIVE', category: 'Software & Licenses', tier: 'Tier 1', preferred: true, rating: 95, onTimeDelivery: 98, qualityScore: 97, invoiceAccuracy: 99, responsivenessScore: 94, riskLevel: 'LOW', riskScore: 7, contactName: 'Anita Sharma', contactEmail: 'procurement@microsoft.com', contactPhone: '+91-11-4130-3000', city: 'Hyderabad', country: 'India', currency: 'INR', paymentTerms: 'Net 45', requestedById: admin.id } }),
    p.supplier.create({ data: { organizationId: oid, name: 'Wipro Limited', code: 'SUP-004', status: 'ACTIVE', onboardingStage: 'ACTIVE', category: 'Consulting Services', tier: 'Tier 2', preferred: false, rating: 83, onTimeDelivery: 81, qualityScore: 85, invoiceAccuracy: 90, responsivenessScore: 78, riskLevel: 'MEDIUM', riskScore: 30, contactName: 'Suresh Nair', contactEmail: 'vendor@wipro.com', contactPhone: '+91-80-2844-0011', city: 'Bengaluru', country: 'India', currency: 'INR', paymentTerms: 'Net 45', requestedById: procurement.id } }),
    p.supplier.create({ data: { organizationId: oid, name: 'Cisco Systems India Pvt. Ltd.', code: 'SUP-005', status: 'ACTIVE', onboardingStage: 'ACTIVE', category: 'IT Hardware', tier: 'Tier 1', preferred: false, rating: 89, onTimeDelivery: 91, qualityScore: 90, invoiceAccuracy: 94, responsivenessScore: 86, riskLevel: 'LOW', riskScore: 14, contactName: 'Preeti Joshi', contactEmail: 'orders@cisco.com', contactPhone: '+91-80-4426-0000', city: 'Bengaluru', country: 'India', currency: 'INR', paymentTerms: 'Net 30', requestedById: procurement.id } }),
    // In onboarding
    p.supplier.create({ data: { organizationId: oid, name: 'Infosys BPM Limited', code: 'SUP-006', status: 'PENDING_APPROVAL', onboardingStage: 'COMPLIANCE_REVIEW', category: 'Consulting Services', tier: 'Tier 2', preferred: false, riskLevel: 'MEDIUM', riskScore: 35, contactName: 'Kiran Rao', contactEmail: 'vendor@infosys.com', contactPhone: '+91-80-2852-0000', city: 'Bengaluru', country: 'India', currency: 'INR', requestedById: procurement.id } }),
    p.supplier.create({ data: { organizationId: oid, name: 'Zoom Video Communications India', code: 'SUP-007', status: 'PENDING_APPROVAL', onboardingStage: 'VALIDATION', category: 'Software & Licenses', tier: 'Tier 2', preferred: false, contactName: 'Meera Nair', contactEmail: 'india@zoom.us', city: 'Mumbai', country: 'India', currency: 'INR', requestedById: eng1.id } }),
    // Just registered
    p.supplier.create({ data: { organizationId: oid, name: 'Freshworks Inc.', code: 'SUP-008', status: 'PENDING_APPROVAL', onboardingStage: 'REGISTRATION', category: 'Software & Licenses', preferred: false, contactName: 'Arun Kumar', contactEmail: 'sales@freshworks.com', city: 'Chennai', country: 'India', currency: 'INR', requestedById: admin.id } }),
  ]);

  // Onboarding profiles for active suppliers
  await Promise.all([
    p.supplierOnboardingProfile.create({ data: { supplierId: dell.id, legalName: 'Dell Technologies India Pvt. Ltd.', businessType: 'PRIVATE_LIMITED', panNumber: 'AABCD1234E', gstNumber: '29AABCD1234E1Z5', bankName: 'HDFC Bank', accountNumber: '50100123456789', ifscCode: 'HDFC0001234', beneficiaryName: 'Dell Technologies India', accountType: 'CURRENT', regAddressLine1: '3rd Floor, Prestige Technostar', regCity: 'Bengaluru', regState: 'Karnataka', regPostal: '560048', womenOwned: false, minorityOwned: false, smallBusiness: false, completionScore: 100, submittedAt: new Date(now.getTime() - 90*86400000), approvedAt: new Date(now.getTime() - 85*86400000) } }),
    p.supplierOnboardingProfile.create({ data: { supplierId: aws.id,  legalName: 'Amazon Web Services India Pvt. Ltd.', businessType: 'PRIVATE_LIMITED', panNumber: 'AABCA1234G', gstNumber: '29AABCA1234G1Z3', bankName: 'DBS Bank', accountNumber: '9876543210', ifscCode: 'DBSS0001234', beneficiaryName: 'Amazon Web Services India', accountType: 'CURRENT', regCity: 'Bengaluru', regState: 'Karnataka', regPostal: '560002', completionScore: 100, submittedAt: new Date(now.getTime() - 120*86400000) } }),
    p.supplierOnboardingProfile.create({ data: { supplierId: msft.id, legalName: 'Microsoft India Pvt. Ltd.', businessType: 'PRIVATE_LIMITED', panNumber: 'AABCM1234F', gstNumber: '36AABCM1234F1Z1', bankName: 'Citibank', accountNumber: '0123456789', ifscCode: 'CITI0001234', beneficiaryName: 'Microsoft India', accountType: 'CURRENT', regCity: 'Hyderabad', regState: 'Telangana', regPostal: '500081', completionScore: 100, submittedAt: new Date(now.getTime() - 180*86400000) } }),
    p.supplierOnboardingProfile.create({ data: { supplierId: infosys.id, legalName: 'Infosys BPM Limited', businessType: 'PUBLIC_LIMITED', panNumber: 'AABCI1234H', gstNumber: '29AABCI1234H1Z7', regCity: 'Bengaluru', regState: 'Karnataka', completionScore: 65, submittedAt: new Date(now.getTime() - 7*86400000) } }),
    p.supplierOnboardingProfile.create({ data: { supplierId: zoom.id,    legalName: 'Zoom Video Communications India', businessType: 'PRIVATE_LIMITED', panNumber: 'AABCZ1234J', regCity: 'Mumbai', regState: 'Maharashtra', completionScore: 30 } }),
  ]);

  // Supplier documents
  const docData = [
    { sup: dell,    types: ['PAN_CARD','GST_CERTIFICATE','INCORPORATION_CERTIFICATE','CANCELLED_CHEQUE','ISO_CERTIFICATE'], status: 'VERIFIED' },
    { sup: aws,     types: ['PAN_CARD','GST_CERTIFICATE','INCORPORATION_CERTIFICATE','CANCELLED_CHEQUE'], status: 'VERIFIED' },
    { sup: msft,    types: ['PAN_CARD','GST_CERTIFICATE','INCORPORATION_CERTIFICATE','BANK_STATEMENT'],   status: 'VERIFIED' },
    { sup: wipro,   types: ['PAN_CARD','GST_CERTIFICATE','INCORPORATION_CERTIFICATE'],                     status: 'VERIFIED' },
    { sup: infosys, types: ['PAN_CARD','GST_CERTIFICATE'], status: 'PENDING' },
    { sup: zoom,    types: ['PAN_CARD'],                    status: 'PENDING' },
  ];
  for (const d of docData) {
    for (const type of d.types) {
      await p.supplierDocument.create({ data: { supplierId: d.sup.id, type, name: `${type.replace(/_/g,' ')} — ${d.sup.name}`, fileUrl: '#', status: d.status, verifiedAt: d.status === 'VERIFIED' ? new Date(now.getTime() - 30*86400000) : null } });
    }
  }
  console.log('  ✓  Suppliers: 8 (5 active, 3 in onboarding) + documents');

  // ── Requisitions ───────────────────────────────────────────────────────────
  async function createReq(data, lineItems, approvalSteps) {
    const count = await p.requisition.count({ where: { organizationId: oid } });
    const reqNum = `REQ-${String(count + 1).padStart(6, '0')}`;
    const subtotal = lineItems.reduce((s, l) => s + l.quantity * l.unit_price, 0);
    const tax = subtotal * 0.18;
    const req = await p.requisition.create({
      data: {
        organizationId: oid, requestorId: data.requestorId,
        requisitionNumber: reqNum, ...data,
        totalAmount: subtotal, taxAmount: tax, currency: 'INR',
        lineItems: {
          create: lineItems.map(l => ({
            description: l.description, quantity: l.quantity,
            unitPrice: l.unit_price, lineTotal: l.quantity * l.unit_price,
            taxRate: 0.18, taxAmount: l.quantity * l.unit_price * 0.18,
            supplierId: l.supplier_id || null, glAccount: l.gl_account || null,
          })),
        },
      },
    });
    for (const step of approvalSteps) {
      await p.approvalStep.create({ data: { requisitionId: req.id, ...step } });
    }
    return req;
  }

  // REQ-1: APPROVED — MacBook Pros
  const req1 = await createReq(
    { requestorId: eng1.id, title: 'MacBook Pro M3 — Engineering Team (10 units)', category: 'IT Hardware', priority: 'HIGH', status: 'APPROVED', department: 'Engineering', businessJustification: '10 new engineers joining for SaaS product launch. Laptops needed by Day 1.', submittedAt: new Date(now.getTime() - 8*86400000) },
    [
      { description: 'Apple MacBook Pro M3 14" 16GB/512GB', quantity: 10, unit_price: 149000, supplier_id: dell.id, gl_account: '6100' },
      { description: 'Apple Magic Mouse USB-C',              quantity: 10, unit_price: 6500,  supplier_id: dell.id, gl_account: '6100' },
      { description: 'Dell USB-C Hub 7-in-1',                quantity: 10, unit_price: 4500,  supplier_id: dell.id, gl_account: '6100' },
    ],
    [
      { stepType: 'MANAGER', sequence: 1, approverId: director.id, status: 'APPROVED', comment: 'Approved — critical for Q3 hiring.', decidedAt: new Date(now.getTime() - 5*86400000) },
      { stepType: 'FINANCE', sequence: 2, approverId: finance.id,  status: 'APPROVED', comment: 'Budget confirmed, proceed.', decidedAt: new Date(now.getTime() - 4*86400000) },
    ]
  );

  // REQ-2: SUBMITTED — AWS Infrastructure
  const req2 = await createReq(
    { requestorId: eng1.id, title: 'AWS Cloud Infrastructure — Q4 Production Launch', category: 'Cloud Services', priority: 'CRITICAL', status: 'SUBMITTED', department: 'Engineering', businessJustification: 'Production infrastructure for SaaS platform launching Oct 1. Reserved instances save 40%.', submittedAt: new Date(now.getTime() - 2*86400000) },
    [
      { description: 'AWS EC2 Reserved m6i.2xlarge × 2 (1yr)',  quantity: 2, unit_price: 165000, supplier_id: aws.id, gl_account: '6300' },
      { description: 'AWS RDS PostgreSQL db.r6g.xlarge (1yr)',   quantity: 1, unit_price: 248000, supplier_id: aws.id, gl_account: '6300' },
      { description: 'AWS S3 Standard — 100TB pre-paid block',   quantity: 1, unit_price: 85000,  supplier_id: aws.id, gl_account: '6300' },
    ],
    [
      { stepType: 'MANAGER', sequence: 1, approverId: director.id, status: 'PENDING' },
      { stepType: 'FINANCE', sequence: 2, approverId: finance.id,  status: 'PENDING' },
    ]
  );

  // REQ-3: MANAGER_APPROVAL — Microsoft 365
  const req3 = await createReq(
    { requestorId: admin.id, title: 'Microsoft 365 Business Premium — 50 Seats (Annual Renewal)', category: 'Software & Licenses', priority: 'HIGH', status: 'MANAGER_APPROVAL', department: 'IT', businessJustification: 'Annual renewal — licences expire Sep 1. All 50 users will lose access if not renewed.', submittedAt: new Date(now.getTime() - 1*86400000) },
    [
      { description: 'Microsoft 365 Business Premium 50 seats/yr', quantity: 50, unit_price: 5200, supplier_id: msft.id, gl_account: '6200' },
      { description: 'Microsoft Defender for Business — add-on',   quantity: 50, unit_price: 850,  supplier_id: msft.id, gl_account: '6200' },
    ],
    [
      { stepType: 'MANAGER', sequence: 1, approverId: director.id, status: 'PENDING' },
    ]
  );

  // REQ-4: PO_CREATED — Wipro Consulting
  const req4 = await createReq(
    { requestorId: admin.id, title: 'Wipro Digital Transformation — Phase 2 (6 months)', category: 'Consulting Services', priority: 'MEDIUM', status: 'PO_CREATED', department: 'IT', businessJustification: 'Phase 2 of digital roadmap. API migration and backend modernisation.', submittedAt: new Date(now.getTime() - 20*86400000) },
    [
      { description: 'Principal Consultant — API Architecture (6 mo)', quantity: 6, unit_price: 280000, supplier_id: wipro.id, gl_account: '6400' },
      { description: 'Senior Developer — Backend Migration (6 mo)',     quantity: 6, unit_price: 200000, supplier_id: wipro.id, gl_account: '6400' },
    ],
    [
      { stepType: 'MANAGER', sequence: 1, approverId: director.id, status: 'APPROVED', decidedAt: new Date(now.getTime() - 15*86400000) },
      { stepType: 'FINANCE', sequence: 2, approverId: finance.id,  status: 'APPROVED', decidedAt: new Date(now.getTime() - 13*86400000) },
    ]
  );

  // REQ-5: DRAFT
  const req5 = await createReq(
    { requestorId: eng1.id, title: 'Office Network Upgrade — Cisco Switching & Wi-Fi 6E', category: 'IT Hardware', priority: 'LOW', status: 'DRAFT', department: 'IT', businessJustification: 'Current network is 5 years old — bottlenecking WFH VPN performance.' },
    [
      { description: 'Cisco Catalyst 2960-X Switch 48-port', quantity: 3, unit_price: 92000, supplier_id: cisco.id, gl_account: '6100' },
      { description: 'Cisco Wi-Fi 6E Access Point',           quantity: 12, unit_price: 18500, supplier_id: cisco.id, gl_account: '6100' },
    ],
    []
  );

  // REQ-6: REJECTED
  const req6 = await createReq(
    { requestorId: eng1.id, title: 'Standing Desks — Engineering Floor Upgrade', category: 'Office Supplies', priority: 'LOW', status: 'REJECTED', department: 'Engineering', businessJustification: 'Ergonomic upgrade for 20 engineers.', submittedAt: new Date(now.getTime() - 30*86400000) },
    [
      { description: 'Autonomous SmartDesk Pro — height adjustable', quantity: 20, unit_price: 32000, gl_account: '6500' },
    ],
    [
      { stepType: 'MANAGER', sequence: 1, approverId: director.id, status: 'REJECTED', comment: 'Budget freeze until Q4. Please resubmit in October.', decidedAt: new Date(now.getTime() - 25*86400000) },
    ]
  );

  console.log('  ✓  Requisitions: 6 (Draft, Submitted, Manager Approval, Approved, PO Created, Rejected)');

  // ── Purchase Orders ────────────────────────────────────────────────────────
  async function createPO(reqId, supId, supEmail, data, lineItems) {
    const count = await p.purchaseOrder.count({ where: { organizationId: oid } });
    const poNum = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;
    return p.purchaseOrder.create({
      data: {
        organizationId: oid, requisitionId: reqId,
        supplierId: supId, createdById: procurement.id,
        poNumber: poNum, supplierEmail: supEmail,
        currency: 'INR', routingMethod: 'EMAIL',
        ...data,
        lineItems: { create: lineItems },
      },
    });
  }

  const po1 = await createPO(req1.id, dell.id, 'enterprise@dell.com',
    { status: 'SENT', paymentTerms: 'Net 30', issuedAt: new Date(now.getTime() - 3*86400000), expectedDelivery: new Date(now.getTime() + 7*86400000), subtotal: 1600000, taxAmount: 288000, totalAmount: 1888000, deliveryAddress: 'Ace Technologies, 5th Floor, Prestige Technostar, Bengaluru 560048', notes: 'Delivery required before Aug 15 — new hire start date.' },
    [
      { description: 'Apple MacBook Pro M3 14" × 10', supplierId: dell.id, quantity: 10, unitPrice: 149000, lineTotal: 1490000, glAccount: '6100' },
      { description: 'Apple Magic Mouse USB-C × 10',  supplierId: dell.id, quantity: 10, unitPrice: 6500,   lineTotal: 65000,   glAccount: '6100' },
      { description: 'Dell USB-C Hub × 10',            supplierId: dell.id, quantity: 10, unitPrice: 4500,   lineTotal: 45000,   glAccount: '6100' },
    ]
  );

  const po2 = await createPO(req4.id, wipro.id, 'vendor@wipro.com',
    { status: 'ACKNOWLEDGED', paymentTerms: 'Net 45', issuedAt: new Date(now.getTime() - 12*86400000), acknowledgedAt: new Date(now.getTime() - 10*86400000), expectedDelivery: new Date(now.getTime() + 180*86400000), subtotal: 2880000, taxAmount: 518400, totalAmount: 3398400, deliveryAddress: 'Ace Technologies HQ, Bengaluru' },
    [
      { description: 'Principal Consultant — API Architecture 6mo', supplierId: wipro.id, quantity: 6, unitPrice: 280000, lineTotal: 1680000, glAccount: '6400' },
      { description: 'Senior Developer — Backend Migration 6mo',    supplierId: wipro.id, quantity: 6, unitPrice: 200000, lineTotal: 1200000, glAccount: '6400' },
    ]
  );

  // Mark reqs as PO_CREATED
  await p.requisition.update({ where: { id: req4.id }, data: { status: 'PO_CREATED' } });

  console.log('  ✓  Purchase Orders: 2 (SENT + ACKNOWLEDGED)');

  // ── API Clients (Developer) ────────────────────────────────────────────────
  const crypto = require('crypto');

  const [apiClient1, apiClient2] = await Promise.all([
    p.apiClient.create({ data: { organizationId: oid, name: 'Ace ERP Integration', description: 'Connects internal ERP system to Veltriance procurement API', clientId: 'ace_erp_' + crypto.randomBytes(8).toString('hex'), clientSecretHash: crypto.createHash('sha256').update('demo_secret_erp_001').digest('hex'), scopes: ['requisitions:read','requisitions:write','purchase_orders:read','suppliers:read'], active: true, createdById: admin.id } }),
    p.apiClient.create({ data: { organizationId: oid, name: 'Finance System Webhook', description: 'Finance approval system integration for auto-approval workflows', clientId: 'ace_fin_' + crypto.randomBytes(8).toString('hex'), clientSecretHash: crypto.createHash('sha256').update('demo_secret_fin_002').digest('hex'), scopes: ['requisitions:read','purchase_orders:read','purchase_orders:write'], active: true, createdById: admin.id } }),
  ]);
  console.log('  ✓  API Clients: 2 (ERP Integration + Finance Webhook)');

  // ── Integrations ───────────────────────────────────────────────────────────
  await p.integration.createMany({ data: [
    { organizationId: oid, connectorKey: 'sap_s4hana', name: 'SAP S/4HANA', status: 'CONNECTED', config: { host: 'ace-sap.internal', client: '100', systemId: 'ACE' }, lastSyncAt: new Date(now.getTime() - 2*3600000), syncCount: 1248, errorCount: 0 },
    { organizationId: oid, connectorKey: 'slack',       name: 'Slack',       status: 'CONNECTED', config: { workspace: 'ace-technologies', channel: '#procurement-alerts' }, lastSyncAt: new Date(now.getTime() - 30*60000), syncCount: 89, errorCount: 0 },
    { organizationId: oid, connectorKey: 'coupa',       name: 'Coupa',       status: 'ERROR',     config: { host: 'ace.coupahost.com' }, lastSyncAt: new Date(now.getTime() - 48*3600000), syncCount: 302, errorCount: 12 },
    { organizationId: oid, connectorKey: 'quickbooks',  name: 'QuickBooks',  status: 'DISCONNECTED', config: {}, syncCount: 0, errorCount: 0 },
  ]});
  console.log('  ✓  Integrations: 4 (SAP Connected, Slack Connected, Coupa Error, QuickBooks Disconnected)');

  // ── Supplier messages ──────────────────────────────────────────────────────
  await p.supplierMessage.createMany({ data: [
    { supplierId: dell.id,    fromPortal: false, senderName: 'Priya Mehta', subject: 'Delivery Confirmation — PO-2025-001', body: 'Hi Rajesh, please confirm delivery schedule for PO-2025-001. We need the 10 MacBooks by Aug 12.' },
    { supplierId: dell.id,    fromPortal: true,  senderName: 'Rajesh Kumar (Dell)', subject: 'RE: Delivery Confirmation', body: 'Hi Priya, confirmed delivery on Aug 11 via Blue Dart. AWB: 12345678. All 10 units will arrive by 2pm.' },
    { supplierId: wipro.id,   fromPortal: false, senderName: 'Priya Mehta', subject: 'SOW Review — Phase 2 Engagement', body: 'Suresh, please review the attached Statement of Work and sign by Friday. PO is already issued.' },
    { supplierId: infosys.id, fromPortal: false, senderName: 'Priya Mehta', subject: 'Pending Documents — Onboarding', body: 'Kiran, we still need your ISO certificate and bank statement to complete verification. Please upload at the earliest.' },
  ]});
  console.log('  ✓  Supplier messages: 4');

  console.log(`
╔══════════════════════════════════════════════════════╗
║  ✅  ace.localhost:3000 seeded successfully!          ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║  Org:       Ace Technologies Pvt. Ltd.               ║
║  Slug:      ace                                      ║
║  URL:       http://ace.localhost:3000                ║
║                                                      ║
║  Users:                                              ║
║    saurav@ace.tech          ADMIN (you)              ║
║    priya.mehta@ace.tech     PROCUREMENT              ║
║    rahul.gupta@ace.tech     APPROVER (Director)      ║
║    sneha.patel@ace.tech     APPROVER (Finance)       ║
║    vikram.singh@ace.tech    REQUESTOR                ║
║    ananya.roy@ace.tech      PENDING INVITE           ║
║    deepak.nair@ace.tech     PENDING INVITE           ║
║                                                      ║
║  Data seeded:                                        ║
║    Suppliers:       8 (5 active, 3 onboarding)       ║
║    Requisitions:    6 (all workflow states)          ║
║    Purchase Orders: 2 (SENT + ACKNOWLEDGED)          ║
║    Approval chains: 4 tiers                          ║
║    Custom fields:   8 (REQ + Supplier + PO)          ║
║    Lookups:         39                               ║
║    GL accounts:     9                                ║
║    Roles:           3 workspace roles                ║
║    Content groups:  3                                ║
║    API clients:     2 (ERP + Finance)                ║
║    Integrations:    4                                ║
╚══════════════════════════════════════════════════════╝
`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => p.$disconnect());
