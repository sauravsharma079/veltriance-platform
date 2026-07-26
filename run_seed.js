const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const p = new PrismaClient();
const OID = '85c48fe0-7934-4ac6-86ad-07e8e25af811';

async function upsertUser(data) {
  return p.user.upsert({ where: { email: data.email }, update: { organizationId: OID }, create: data });
}

async function main() {
  console.log('Seeding...');

  const kate   = await upsertUser({ organizationId: OID, email: 'Kate@ace.com',   name: 'Kate Williams', role: 'ADMIN',        jobTitle: 'CEO',                  department: 'Executive',    currency: 'INR', inviteStatus: 'ACTIVE' });
  const priya  = await upsertUser({ organizationId: OID, email: 'priya@ace.tech', name: 'Priya Mehta',   role: 'PROCUREMENT',  jobTitle: 'Procurement Manager',  department: 'Procurement',  currency: 'INR', inviteStatus: 'ACTIVE' });
  const rahul  = await upsertUser({ organizationId: OID, email: 'rahul@ace.tech', name: 'Rahul Gupta',   role: 'APPROVER',     jobTitle: 'Engineering Director', department: 'Engineering',  currency: 'INR', inviteStatus: 'ACTIVE' });
  const sneha  = await upsertUser({ organizationId: OID, email: 'sneha@ace.tech', name: 'Sneha Patel',   role: 'APPROVER',     jobTitle: 'Finance Controller',   department: 'Finance',      currency: 'INR', inviteStatus: 'ACTIVE' });
  const vikram = await upsertUser({ organizationId: OID, email: 'vikram@ace.tech',name: 'Vikram Singh',  role: 'REQUESTOR',    jobTitle: 'Senior Engineer',      department: 'Engineering',  currency: 'INR', inviteStatus: 'ACTIVE' });
  await upsertUser({ organizationId: OID, email: 'ananya@ace.tech', name: 'Ananya Roy',  role: 'REQUESTOR', jobTitle: 'Product Manager', department: 'Product', currency: 'INR', inviteStatus: 'PENDING' });
  await upsertUser({ organizationId: OID, email: 'deepak@ace.tech', name: 'Deepak Nair', role: 'REQUESTOR', jobTitle: 'HR Manager',       department: 'HR',      currency: 'INR', inviteStatus: 'PENDING' });
  console.log('Users done');

  // Roles — skip if already exist
  const existingRoles = await p.workspaceRole.count({ where: { organizationId: OID } });
  if (existingRoles === 0) {
    const [ar, pr, vr] = await Promise.all([
      p.workspaceRole.create({ data: { organizationId: OID, name: 'Admin', description: 'Full access', isSystem: true, permissions: ['ALL'] }}),
      p.workspaceRole.create({ data: { organizationId: OID, name: 'Procurement Officer', description: 'Manage suppliers and orders', isSystem: false, permissions: ['SUPPLIERS_READ','SUPPLIERS_WRITE','REQUISITIONS_READ','REQUISITIONS_WRITE','PO_READ','PO_WRITE'] }}),
      p.workspaceRole.create({ data: { organizationId: OID, name: 'Viewer', description: 'Read-only', isSystem: false, permissions: ['REQUISITIONS_READ','PO_READ','SUPPLIERS_READ'] }}),
    ]);
    await p.workspaceRoleMember.create({ data: { user: { connect: { id: kate.id } }, workspaceRole: { connect: { id: ar.id } } }});
    await p.workspaceRoleMember.create({ data: { user: { connect: { id: priya.id } }, workspaceRole: { connect: { id: pr.id } } }});
    await p.workspaceRoleMember.create({ data: { user: { connect: { id: vikram.id } }, workspaceRole: { connect: { id: vr.id } } }});
  }
  console.log('Roles done');

  // Content Groups
  const existingCG = await p.contentGroup.count({ where: { organizationId: OID } });
  if (existingCG === 0) {
    const [cg1, cg2, cg3] = await Promise.all([
      p.contentGroup.create({ data: { organizationId: OID, name: 'IT & Engineering', description: 'Technology purchases', color: '#1A2A52' }}),
      p.contentGroup.create({ data: { organizationId: OID, name: 'Finance & Admin', description: 'Finance operations', color: '#C8A04D' }}),
      p.contentGroup.create({ data: { organizationId: OID, name: 'Operations', description: 'Facilities and supplies', color: '#10B981' }}),
    ]);
    await p.contentGroupMember.create({ data: { contentGroup: { connect: { id: cg1.id } }, user: { connect: { id: vikram.id } } }});
    await p.contentGroupMember.create({ data: { contentGroup: { connect: { id: cg2.id } }, user: { connect: { id: sneha.id } } }});
    await p.contentGroupMember.create({ data: { contentGroup: { connect: { id: cg3.id } }, user: { connect: { id: priya.id } } }});
  }
  console.log('Content groups done');

  // Lookups
  const existingLookups = await p.lookup.count({ where: { organizationId: OID } });
  if (existingLookups === 0) {
    await p.lookup.createMany({ data: [
      { organizationId: OID, type: 'DEPARTMENT', code: 'ENG', label: 'Engineering', sortOrder: 1 },
      { organizationId: OID, type: 'DEPARTMENT', code: 'FIN', label: 'Finance', sortOrder: 2 },
      { organizationId: OID, type: 'DEPARTMENT', code: 'IT', label: 'IT', sortOrder: 3 },
      { organizationId: OID, type: 'DEPARTMENT', code: 'OPS', label: 'Operations', sortOrder: 4 },
      { organizationId: OID, type: 'DEPARTMENT', code: 'HR', label: 'Human Resources', sortOrder: 5 },
      { organizationId: OID, type: 'DEPARTMENT', code: 'MKT', label: 'Marketing', sortOrder: 6 },
      { organizationId: OID, type: 'COST_CENTER', code: 'CC001', label: 'IT Infrastructure', sortOrder: 1 },
      { organizationId: OID, type: 'COST_CENTER', code: 'CC002', label: 'Engineering R&D', sortOrder: 2 },
      { organizationId: OID, type: 'COST_CENTER', code: 'CC003', label: 'Finance and Compliance', sortOrder: 3 },
      { organizationId: OID, type: 'COST_CENTER', code: 'CC004', label: 'Operations', sortOrder: 4 },
      { organizationId: OID, type: 'CATEGORY', code: 'IT_HW', label: 'IT Hardware', sortOrder: 1 },
      { organizationId: OID, type: 'CATEGORY', code: 'IT_SW', label: 'Software and Licenses', sortOrder: 2 },
      { organizationId: OID, type: 'CATEGORY', code: 'CLOUD', label: 'Cloud Services', sortOrder: 3 },
      { organizationId: OID, type: 'CATEGORY', code: 'CONS', label: 'Consulting Services', sortOrder: 4 },
      { organizationId: OID, type: 'CATEGORY', code: 'OFFICE', label: 'Office Supplies', sortOrder: 5 },
      { organizationId: OID, type: 'GL_ACCOUNT', code: '6100', label: 'IT Equipment and Assets', sortOrder: 1 },
      { organizationId: OID, type: 'GL_ACCOUNT', code: '6200', label: 'Software Subscriptions', sortOrder: 2 },
      { organizationId: OID, type: 'GL_ACCOUNT', code: '6300', label: 'Cloud Infrastructure', sortOrder: 3 },
      { organizationId: OID, type: 'GL_ACCOUNT', code: '6400', label: 'Professional Services', sortOrder: 4 },
      { organizationId: OID, type: 'GL_ACCOUNT', code: '6500', label: 'Office and Admin', sortOrder: 5 },
      { organizationId: OID, type: 'PAYMENT_TERMS', code: 'NET30', label: 'Net 30', sortOrder: 1 },
      { organizationId: OID, type: 'PAYMENT_TERMS', code: 'NET45', label: 'Net 45', sortOrder: 2 },
      { organizationId: OID, type: 'PAYMENT_TERMS', code: 'NET60', label: 'Net 60', sortOrder: 3 },
    ]});
  }
  console.log('Lookups done');

  // COA
  const existingCOA = await p.chartOfAccount.count({ where: { organizationId: OID } });
  if (existingCOA === 0) {
    const coa = await p.chartOfAccount.create({ data: { organizationId: OID, name: 'Ace Technologies India COA', code: 'ACE-IN01', companyCode: 'ACETEC-IN', currency: 'INR', taxRegNumber: '29AABCA1234A1ZX', taxType: 'GST', billingCity: 'Bengaluru', billingState: 'Karnataka', billingCountry: 'India' }});
    const s1 = await p.coaSegment.create({ data: { chartOfAccountId: coa.id, position: 1, name: 'Company', linkedLookupType: null }});
    await p.coaSegment.create({ data: { chartOfAccountId: coa.id, position: 2, name: 'Business Area', linkedLookupType: 'DEPARTMENT' }});
    await p.coaSegment.create({ data: { chartOfAccountId: coa.id, position: 3, name: 'Cost Centre', linkedLookupType: 'COST_CENTER' }});
    await p.coaSegment.create({ data: { chartOfAccountId: coa.id, position: 4, name: 'GL Account', linkedLookupType: 'GL_ACCOUNT' }});
    await p.coaSegmentValue.createMany({ data: [{ segmentId: s1.id, code: 'ACETEC', label: 'Ace Technologies', isActive: true },{ segmentId: s1.id, code: 'ACELAB', label: 'Ace Labs', isActive: true }]});
  }
  console.log('COA done');

  // Custom Fields
  const existingCF = await p.customField.count({ where: { organizationId: OID } });
  if (existingCF === 0) {
    await p.customField.createMany({ data: [
      { organizationId: OID, module: 'REQUISITION', fieldName: 'project_code', label: 'Project Code', fieldType: 'TEXT', required: true, sortOrder: 1, placeholder: 'e.g. PRJ-2025-001' },
      { organizationId: OID, module: 'REQUISITION', fieldName: 'budget_year', label: 'Budget Year', fieldType: 'SELECT', required: true, sortOrder: 2, options: ['FY 2024-25','FY 2025-26'] },
      { organizationId: OID, module: 'REQUISITION', fieldName: 'capex_opex', label: 'CAPEX / OPEX', fieldType: 'SELECT', required: true, sortOrder: 3, options: ['CAPEX','OPEX'] },
      { organizationId: OID, module: 'REQUISITION', fieldName: 'is_recurring', label: 'Recurring Purchase', fieldType: 'BOOLEAN', required: false, sortOrder: 4 },
      { organizationId: OID, module: 'SUPPLIER', fieldName: 'vendor_class', label: 'Vendor Classification', fieldType: 'SELECT', required: true, sortOrder: 1, options: ['Strategic','Preferred','Approved','Conditional'] },
      { organizationId: OID, module: 'SUPPLIER', fieldName: 'csr_score', label: 'CSR Score', fieldType: 'NUMBER', required: false, sortOrder: 2, placeholder: '0-100' },
      { organizationId: OID, module: 'PURCHASE_ORDER', fieldName: 'incoterms', label: 'Incoterms', fieldType: 'SELECT', required: false, sortOrder: 1, options: ['EXW','FOB','CIF','DDP'] },
    ]});
  }
  console.log('Custom fields done');

  // Approval Rules
  const existingRules = await p.approvalRule.count({ where: { organizationId: OID } });
  if (existingRules === 0) {
    const [r1,r2,r3,r4] = await Promise.all([
      p.approvalRule.create({ data: { organizationId: OID, name: 'Up to 1 Lakh - Manager Only', priority: 10, active: true, maxAmount: 100000 }}),
      p.approvalRule.create({ data: { organizationId: OID, name: '1L to 10L - Manager and Finance', priority: 20, active: true, minAmount: 100001, maxAmount: 1000000 }}),
      p.approvalRule.create({ data: { organizationId: OID, name: '10L to 50L - Full Approval', priority: 30, active: true, minAmount: 1000001, maxAmount: 5000000 }}),
      p.approvalRule.create({ data: { organizationId: OID, name: 'Above 50L - Board Level', priority: 40, active: true, minAmount: 5000001 }}),
    ]);
    await p.approvalRuleStep.createMany({ data: [
      { ruleId: r1.id, sequence: 1, stepType: 'MANAGER', stepLabel: 'Line Manager' },
      { ruleId: r2.id, sequence: 1, stepType: 'MANAGER', stepLabel: 'Line Manager' },
      { ruleId: r2.id, sequence: 2, stepType: 'FINANCE', stepLabel: 'Finance Controller' },
      { ruleId: r3.id, sequence: 1, stepType: 'MANAGER', stepLabel: 'Line Manager' },
      { ruleId: r3.id, sequence: 2, stepType: 'DIRECTOR', stepLabel: 'Director' },
      { ruleId: r3.id, sequence: 3, stepType: 'FINANCE', stepLabel: 'Finance Sign-off' },
      { ruleId: r4.id, sequence: 1, stepType: 'MANAGER', stepLabel: 'Line Manager' },
      { ruleId: r4.id, sequence: 2, stepType: 'DIRECTOR', stepLabel: 'Director' },
      { ruleId: r4.id, sequence: 3, stepType: 'FINANCE', stepLabel: 'CFO' },
      { ruleId: r4.id, sequence: 4, stepType: 'EXECUTIVE', stepLabel: 'CEO' },
    ]});
  }
  console.log('Approval chains done');

  // Suppliers
  const existingSuppliers = await p.supplier.count({ where: { organizationId: OID } });
  if (existingSuppliers === 0) {
    const now = new Date();
    const [dell, aws, msft, wipro, cisco, infosys, zoom] = await Promise.all([
      p.supplier.create({ data: { organizationId: OID, name: 'Dell Technologies India', code: 'SUP-001', status: 'ACTIVE', onboardingStage: 'ACTIVE', category: 'IT Hardware', tier: 'Tier 1', preferred: true, rating: 94, onTimeDelivery: 96, qualityScore: 92, invoiceAccuracy: 98, responsivenessScore: 90, riskLevel: 'LOW', riskScore: 10, contactName: 'Rajesh Kumar', contactEmail: 'enterprise@dell.com', contactPhone: '+91-80-4150-0000', city: 'Bengaluru', country: 'India', currency: 'INR', paymentTerms: 'Net 30', requestedById: kate.id }}),
      p.supplier.create({ data: { organizationId: OID, name: 'Amazon Web Services India', code: 'SUP-002', status: 'ACTIVE', onboardingStage: 'ACTIVE', category: 'Cloud Services', tier: 'Tier 1', preferred: true, rating: 98, onTimeDelivery: 99, qualityScore: 99, invoiceAccuracy: 99, responsivenessScore: 96, riskLevel: 'LOW', riskScore: 5, contactName: 'Deepak Malhotra', contactEmail: 'aws-billing@amazon.com', contactPhone: '+91-80-4032-0000', city: 'Bengaluru', country: 'India', currency: 'INR', paymentTerms: 'Net 30', requestedById: kate.id }}),
      p.supplier.create({ data: { organizationId: OID, name: 'Microsoft India Pvt. Ltd.', code: 'SUP-003', status: 'ACTIVE', onboardingStage: 'ACTIVE', category: 'Software & Licenses', tier: 'Tier 1', preferred: true, rating: 96, onTimeDelivery: 98, qualityScore: 97, invoiceAccuracy: 99, responsivenessScore: 94, riskLevel: 'LOW', riskScore: 7, contactName: 'Anita Sharma', contactEmail: 'procurement@microsoft.com', city: 'Hyderabad', country: 'India', currency: 'INR', paymentTerms: 'Net 45', requestedById: kate.id }}),
      p.supplier.create({ data: { organizationId: OID, name: 'Wipro Limited', code: 'SUP-004', status: 'ACTIVE', onboardingStage: 'ACTIVE', category: 'Consulting Services', tier: 'Tier 2', preferred: false, rating: 83, onTimeDelivery: 81, qualityScore: 85, invoiceAccuracy: 90, responsivenessScore: 78, riskLevel: 'MEDIUM', riskScore: 30, contactName: 'Suresh Nair', contactEmail: 'vendor@wipro.com', city: 'Bengaluru', country: 'India', currency: 'INR', paymentTerms: 'Net 45', requestedById: priya.id }}),
      p.supplier.create({ data: { organizationId: OID, name: 'Cisco Systems India', code: 'SUP-005', status: 'ACTIVE', onboardingStage: 'ACTIVE', category: 'IT Hardware', tier: 'Tier 1', preferred: false, rating: 89, onTimeDelivery: 91, qualityScore: 90, invoiceAccuracy: 94, responsivenessScore: 86, riskLevel: 'LOW', riskScore: 14, contactName: 'Preeti Joshi', contactEmail: 'orders@cisco.com', city: 'Bengaluru', country: 'India', currency: 'INR', paymentTerms: 'Net 30', requestedById: priya.id }}),
      p.supplier.create({ data: { organizationId: OID, name: 'Infosys BPM Limited', code: 'SUP-006', status: 'PENDING_APPROVAL', onboardingStage: 'COMPLIANCE_REVIEW', category: 'Consulting Services', tier: 'Tier 2', riskLevel: 'MEDIUM', riskScore: 35, contactName: 'Kiran Rao', contactEmail: 'vendor@infosys.com', city: 'Bengaluru', country: 'India', currency: 'INR', requestedById: priya.id }}),
      p.supplier.create({ data: { organizationId: OID, name: 'Zoom Video India', code: 'SUP-007', status: 'PENDING_APPROVAL', onboardingStage: 'VALIDATION', category: 'Software & Licenses', contactName: 'Meera Nair', contactEmail: 'india@zoom.us', city: 'Mumbai', country: 'India', currency: 'INR', requestedById: vikram.id }}),
    ]);
    await Promise.all([
      p.supplierOnboardingProfile.create({ data: { supplierId: dell.id, legalName: 'Dell Technologies India Pvt. Ltd.', businessType: 'PRIVATE_LIMITED', panNumber: 'AABCD1234E', gstNumber: '29AABCD1234E1Z5', bankName: 'HDFC Bank', accountNumber: '50100123456789', ifscCode: 'HDFC0001234', beneficiaryName: 'Dell Technologies India', accountType: 'CURRENT', regCity: 'Bengaluru', regState: 'Karnataka', regPostal: '560048', completionScore: 100, submittedAt: new Date(now.getTime()-90*86400000) }}),
      p.supplierOnboardingProfile.create({ data: { supplierId: aws.id, legalName: 'Amazon Web Services India Pvt. Ltd.', businessType: 'PRIVATE_LIMITED', panNumber: 'AABCA1234G', gstNumber: '29AABCA1234G1Z3', bankName: 'DBS Bank', accountNumber: '9876543210', ifscCode: 'DBSS0001234', beneficiaryName: 'AWS India', accountType: 'CURRENT', regCity: 'Bengaluru', regState: 'Karnataka', completionScore: 100 }}),
      p.supplierOnboardingProfile.create({ data: { supplierId: msft.id, legalName: 'Microsoft India Pvt. Ltd.', businessType: 'PRIVATE_LIMITED', panNumber: 'AABCM1234F', gstNumber: '36AABCM1234F1Z1', bankName: 'Citibank', accountNumber: '0123456789', ifscCode: 'CITI0001234', beneficiaryName: 'Microsoft India', accountType: 'CURRENT', regCity: 'Hyderabad', regState: 'Telangana', completionScore: 100 }}),
      p.supplierOnboardingProfile.create({ data: { supplierId: wipro.id, legalName: 'Wipro Limited', businessType: 'PUBLIC_LIMITED', panNumber: 'AAACW1234C', gstNumber: '29AAACW1234C1Z3', bankName: 'ICICI Bank', accountNumber: '111122223333', ifscCode: 'ICIC0001234', beneficiaryName: 'Wipro Limited', accountType: 'CURRENT', regCity: 'Bengaluru', regState: 'Karnataka', completionScore: 100 }}),
      p.supplierOnboardingProfile.create({ data: { supplierId: infosys.id, legalName: 'Infosys BPM Limited', businessType: 'PUBLIC_LIMITED', panNumber: 'AABCI1234H', regCity: 'Bengaluru', regState: 'Karnataka', completionScore: 65, submittedAt: new Date(now.getTime()-7*86400000) }}),
      p.supplierOnboardingProfile.create({ data: { supplierId: zoom.id, legalName: 'Zoom Video Communications India', businessType: 'PRIVATE_LIMITED', panNumber: 'AABCZ1234J', regCity: 'Mumbai', regState: 'Maharashtra', completionScore: 30 }}),
    ]);
    for (const [sup, types, verified] of [[dell,['PAN_CARD','GST_CERTIFICATE','INCORPORATION_CERTIFICATE','CANCELLED_CHEQUE','ISO_CERTIFICATE'],true],[aws,['PAN_CARD','GST_CERTIFICATE','INCORPORATION_CERTIFICATE','CANCELLED_CHEQUE'],true],[msft,['PAN_CARD','GST_CERTIFICATE','INCORPORATION_CERTIFICATE'],true],[wipro,['PAN_CARD','GST_CERTIFICATE'],true],[infosys,['PAN_CARD'],false]]) {
      for (const type of types) {
        await p.supplierDocument.create({ data: { supplierId: sup.id, type, name: type.replace(/_/g,' ') + ' - ' + sup.name, fileUrl: '#', status: verified ? 'VERIFIED' : 'PENDING', verifiedAt: verified ? new Date(now.getTime()-30*86400000) : null }});
      }
    }
    console.log('Suppliers done');

    // Requisitions
    async function mkReq(m, lines, steps) {
      const count = await p.requisition.count({ where: { organizationId: OID } });
      const num = 'REQ-' + String(count+1).padStart(6,'0');
      const sub = lines.reduce((s,l) => s + l.qty * l.price, 0);
      const req = await p.requisition.create({ data: { organizationId: OID, requestorId: m.rid, requisitionNumber: num, title: m.title, category: m.cat, priority: m.pri, status: m.status, department: m.dept||null, businessJustification: m.just||null, submittedAt: m.sub||null, currency: 'INR', totalAmount: sub, taxAmount: sub*0.18, intakeSource: m.src||'FORM', lineItems: { create: lines.map(l => ({ description: l.desc, quantity: l.qty, unitPrice: l.price, lineTotal: l.qty*l.price, taxRate: 0.18, taxAmount: l.qty*l.price*0.18, supplierId: l.sid||null, glAccount: l.gl||null })) } }});
      for (const s of steps) await p.approvalStep.create({ data: { requisitionId: req.id, ...s }});
      return req;
    }
    const req1 = await mkReq({ rid:vikram.id, title:'MacBook Pro M3 - Engineering Team 10 units', cat:'IT Hardware', pri:'HIGH', status:'APPROVED', dept:'Engineering', just:'10 engineers joining for SaaS product launch.', sub:new Date(now.getTime()-8*86400000) },[{ desc:'Apple MacBook Pro M3 14in 16GB', qty:10, price:149000, sid:dell.id, gl:'6100' },{ desc:'Apple Magic Mouse USB-C', qty:10, price:6500, sid:dell.id, gl:'6100' },{ desc:'Dell USB-C Hub', qty:10, price:4500, sid:dell.id, gl:'6100' }],[{ stepType:'MANAGER', sequence:1, approverId:rahul.id, status:'APPROVED', comment:'Approved.', decidedAt:new Date(now.getTime()-5*86400000) },{ stepType:'FINANCE', sequence:2, approverId:sneha.id, status:'APPROVED', comment:'Budget confirmed.', decidedAt:new Date(now.getTime()-4*86400000) }]);
    const req2 = await mkReq({ rid:vikram.id, title:'AWS Cloud Infrastructure - Q4 Production Launch', cat:'Cloud Services', pri:'CRITICAL', status:'SUBMITTED', dept:'Engineering', just:'Production infra for SaaS platform.', sub:new Date(now.getTime()-2*86400000), src:'CHATBOT' },[{ desc:'AWS EC2 Reserved m6i.2xlarge x2 1yr', qty:2, price:165000, sid:aws.id, gl:'6300' },{ desc:'AWS RDS PostgreSQL 1yr', qty:1, price:248000, sid:aws.id, gl:'6300' },{ desc:'AWS S3 100TB block', qty:1, price:85000, sid:aws.id, gl:'6300' }],[{ stepType:'MANAGER', sequence:1, approverId:rahul.id, status:'PENDING' },{ stepType:'FINANCE', sequence:2, approverId:sneha.id, status:'PENDING' }]);
    const req3 = await mkReq({ rid:kate.id, title:'Microsoft 365 Business Premium - 50 Seats Annual Renewal', cat:'Software & Licenses', pri:'HIGH', status:'MANAGER_APPROVAL', dept:'IT', just:'Annual renewal - users lose access Sep 1.', sub:new Date(now.getTime()-86400000) },[{ desc:'Microsoft 365 Business Premium 50 seats', qty:50, price:5200, sid:msft.id, gl:'6200' },{ desc:'Microsoft Defender add-on', qty:50, price:850, sid:msft.id, gl:'6200' }],[{ stepType:'MANAGER', sequence:1, approverId:rahul.id, status:'PENDING' }]);
    const req4 = await mkReq({ rid:kate.id, title:'Wipro Digital Transformation Consulting - Phase 2', cat:'Consulting Services', pri:'MEDIUM', status:'APPROVED', dept:'IT', just:'Phase 2 digital roadmap.', sub:new Date(now.getTime()-20*86400000) },[{ desc:'Principal Consultant - API Architecture 6mo', qty:6, price:280000, sid:wipro.id, gl:'6400' },{ desc:'Senior Developer - Backend Migration 6mo', qty:6, price:200000, sid:wipro.id, gl:'6400' }],[{ stepType:'MANAGER', sequence:1, approverId:rahul.id, status:'APPROVED', decidedAt:new Date(now.getTime()-15*86400000) },{ stepType:'FINANCE', sequence:2, approverId:sneha.id, status:'APPROVED', decidedAt:new Date(now.getTime()-13*86400000) }]);
    const req5 = await mkReq({ rid:vikram.id, title:'Cisco Network Upgrade - HQ Switching and WiFi 6E', cat:'IT Hardware', pri:'LOW', status:'DRAFT', dept:'IT', just:'Current network 5 years old.' },[{ desc:'Cisco Catalyst Switch 48-port', qty:3, price:92000, sid:cisco.id, gl:'6100' },{ desc:'Cisco WiFi 6E Access Point', qty:12, price:18500, sid:cisco.id, gl:'6100' }],[]);
    const req6 = await mkReq({ rid:vikram.id, title:'Standing Desks - Engineering Floor Ergonomic Upgrade', cat:'Office Supplies', pri:'LOW', status:'REJECTED', dept:'Engineering', just:'Ergonomic upgrade for 20 engineers.', sub:new Date(now.getTime()-30*86400000) },[{ desc:'Autonomous SmartDesk Pro', qty:20, price:32000, gl:'6500' }],[{ stepType:'MANAGER', sequence:1, approverId:rahul.id, status:'REJECTED', comment:'Budget freeze until Q4.', decidedAt:new Date(now.getTime()-25*86400000) }]);
    console.log('Requisitions done');

    // POs
    const p1s=1600000;
    await p.purchaseOrder.create({ data: { organizationId:OID, requisitionId:req1.id, supplierId:dell.id, createdById:priya.id, poNumber:'PO-2025-001', supplierEmail:'enterprise@dell.com', currency:'INR', routingMethod:'EMAIL', status:'SENT', paymentTerms:'Net 30', issuedAt:new Date(now.getTime()-3*86400000), expectedDelivery:new Date(now.getTime()+7*86400000), deliveryAddress:'Ace Technologies, Bengaluru 560048', notes:'Delivery required before Aug 15.', subtotal:p1s, taxAmount:p1s*0.18, totalAmount:p1s*1.18, lineItems:{create:[{description:'MacBook Pro M3 x10',supplierId:dell.id,quantity:10,unitPrice:149000,lineTotal:1490000,glAccount:'6100'},{description:'Magic Mouse x10',supplierId:dell.id,quantity:10,unitPrice:6500,lineTotal:65000,glAccount:'6100'},{description:'USB-C Hub x10',supplierId:dell.id,quantity:10,unitPrice:4500,lineTotal:45000,glAccount:'6100'}]}}});
    const p2s=2880000;
    await p.purchaseOrder.create({ data: { organizationId:OID, requisitionId:req4.id, supplierId:wipro.id, createdById:priya.id, poNumber:'PO-2025-002', supplierEmail:'vendor@wipro.com', currency:'INR', routingMethod:'EMAIL', status:'ACKNOWLEDGED', paymentTerms:'Net 45', issuedAt:new Date(now.getTime()-12*86400000), acknowledgedAt:new Date(now.getTime()-10*86400000), expectedDelivery:new Date(now.getTime()+180*86400000), deliveryAddress:'Ace Technologies HQ, Bengaluru', subtotal:p2s, taxAmount:p2s*0.18, totalAmount:p2s*1.18, lineItems:{create:[{description:'Principal Consultant 6mo',supplierId:wipro.id,quantity:6,unitPrice:280000,lineTotal:1680000,glAccount:'6400'},{description:'Senior Developer 6mo',supplierId:wipro.id,quantity:6,unitPrice:200000,lineTotal:1200000,glAccount:'6400'}]}}});
    await p.requisition.update({ where:{id:req4.id}, data:{status:'PO_CREATED'}});
    console.log('Purchase Orders done');
  } else {
    console.log('Suppliers/Reqs/POs already exist - skipping');
  }

  // API Clients
  const existingAPI = await p.apiClient.count({ where: { organizationId: OID } });
  if (existingAPI === 0) {
    await Promise.all([
      p.apiClient.create({ data: { organizationId:OID, name:'Ace ERP Integration', description:'Connects ERP to Veltriance API', clientId:'ace_erp_prod_001', clientSecretHash:crypto.createHash('sha256').update('secret_erp_001').digest('hex'), scopes:['requisitions:read','requisitions:write','purchase_orders:read','suppliers:read'], active:true, createdById:kate.id }}),
      p.apiClient.create({ data: { organizationId:OID, name:'Finance Webhook', description:'Finance system integration', clientId:'ace_fin_prod_002', clientSecretHash:crypto.createHash('sha256').update('secret_fin_002').digest('hex'), scopes:['requisitions:read','purchase_orders:read','purchase_orders:write'], active:true, createdById:kate.id }}),
    ]);
  }
  console.log('API Clients done');

  // Integrations
  const existingInt = await p.integration.count({ where: { organizationId: OID } });
  if (existingInt === 0) {
    await p.integration.createMany({ data: [
      { organizationId:OID, connectorKey:'sap_s4hana', name:'SAP S/4HANA', status:'CONNECTED', config:{host:'ace-sap.internal',client:'100'}, lastSyncAt:new Date(Date.now()-7200000), syncCount:1248, errorCount:0 },
      { organizationId:OID, connectorKey:'slack', name:'Slack', status:'CONNECTED', config:{workspace:'ace-technologies',channel:'#procurement-alerts'}, lastSyncAt:new Date(Date.now()-1800000), syncCount:89, errorCount:0 },
      { organizationId:OID, connectorKey:'coupa', name:'Coupa', status:'ERROR', config:{host:'ace.coupahost.com'}, lastSyncAt:new Date(Date.now()-172800000), syncCount:302, errorCount:12 },
      { organizationId:OID, connectorKey:'quickbooks', name:'QuickBooks', status:'DISCONNECTED', config:{}, syncCount:0, errorCount:0 },
    ]});
  }
  console.log('Integrations done');

  console.log('');
  console.log('ALL DONE! Refresh http://ace.localhost:3000');
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1); }).finally(() => p.$disconnect());
