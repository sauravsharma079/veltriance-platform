
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("🌱  Seeding Veltriance demo data...");

  // ── Clean up any existing demo data ──
  const existing = await prisma.organization.findUnique({ where: { slug: "nexcore-technologies" } });
  if (existing) {
    console.log("  Demo data already exists. Wiping and re-seeding...");
    await prisma.purchaseOrderLineItem.deleteMany({ where: { purchaseOrder: { organizationId: existing.id } } });
    await prisma.purchaseOrder.deleteMany({ where: { organizationId: existing.id } });
    await prisma.approvalStep.deleteMany({ where: { requisition: { organizationId: existing.id } } });
    await prisma.requisitionLineItem.deleteMany({ where: { requisition: { organizationId: existing.id } } });
    await prisma.attachment.deleteMany({ where: { requisition: { organizationId: existing.id } } });
    await prisma.requisition.deleteMany({ where: { organizationId: existing.id } });
    await prisma.supplier.deleteMany({ where: { organizationId: existing.id } });
    await prisma.lookup.deleteMany({ where: { organizationId: existing.id } });
    await prisma.approvalRuleStep.deleteMany({ where: { rule: { organizationId: existing.id } } });
    await prisma.approvalRule.deleteMany({ where: { organizationId: existing.id } });
    await prisma.coaSegmentValue.deleteMany({ where: { segment: { chartOfAccount: { organizationId: existing.id } } } });
    await prisma.coaSegment.deleteMany({ where: { chartOfAccount: { organizationId: existing.id } } });
    await prisma.chartOfAccount.deleteMany({ where: { organizationId: existing.id } });
    await prisma.workspaceRoleMember.deleteMany({ where: { user: { organizationId: existing.id } } });
    await prisma.workspaceRole.deleteMany({ where: { organizationId: existing.id } });
    await prisma.user.deleteMany({ where: { organizationId: existing.id } });
    await prisma.organization.delete({ where: { id: existing.id } });
  }

  // ── Organization ──────────────────────────────────────────────────────────
  const org = await prisma.organization.create({
    data: {
      name: "Nexcore Technologies Pvt. Ltd.",
      slug: "nexcore-technologies",
    },
  });
  console.log(`  ✓  Organization: ${org.name}`);

  // ── Users ─────────────────────────────────────────────────────────────────
  const [admin, procurement, manager, finance, requestor] = await Promise.all([
    prisma.user.create({ data: { organizationId: org.id, email: "arjun.sharma@nexcore.in",  name: "Arjun Sharma",  role: "ADMIN",       jobTitle: "Head of IT & Operations", department: "IT",       inviteStatus: "ACTIVE" } }),
    prisma.user.create({ data: { organizationId: org.id, email: "priya.mehta@nexcore.in",   name: "Priya Mehta",   role: "PROCUREMENT", jobTitle: "Procurement Manager",     department: "Procurement", inviteStatus: "ACTIVE" } }),
    prisma.user.create({ data: { organizationId: org.id, email: "rahul.gupta@nexcore.in",   name: "Rahul Gupta",   role: "APPROVER",    jobTitle: "Engineering Director",    department: "Engineering", inviteStatus: "ACTIVE" } }),
    prisma.user.create({ data: { organizationId: org.id, email: "sneha.patel@nexcore.in",   name: "Sneha Patel",   role: "APPROVER",    jobTitle: "Finance Controller",      department: "Finance",   inviteStatus: "ACTIVE" } }),
    prisma.user.create({ data: { organizationId: org.id, email: "vikram.singh@nexcore.in",  name: "Vikram Singh",  role: "REQUESTOR",   jobTitle: "Senior Software Engineer", department: "Engineering", inviteStatus: "ACTIVE" } }),
  ]);
  console.log("  ✓  Users (5)");

  // ── Lookups ───────────────────────────────────────────────────────────────
  const lookupData = [
    { type: "DEPARTMENT",   code: "IT",    label: "Information Technology", sortOrder: 1 },
    { type: "DEPARTMENT",   code: "ENG",   label: "Engineering",            sortOrder: 2 },
    { type: "DEPARTMENT",   code: "FIN",   label: "Finance",                sortOrder: 3 },
    { type: "DEPARTMENT",   code: "OPS",   label: "Operations",             sortOrder: 4 },
    { type: "DEPARTMENT",   code: "HR",    label: "Human Resources",        sortOrder: 5 },
    { type: "COST_CENTER",  code: "CC001", label: "IT Infrastructure",      sortOrder: 1 },
    { type: "COST_CENTER",  code: "CC002", label: "Engineering Projects",   sortOrder: 2 },
    { type: "COST_CENTER",  code: "CC003", label: "Finance & Admin",        sortOrder: 3 },
    { type: "COST_CENTER",  code: "CC004", label: "Business Development",   sortOrder: 4 },
    { type: "CATEGORY",     code: "IT_HW", label: "IT Hardware",            sortOrder: 1 },
    { type: "CATEGORY",     code: "IT_SW", label: "Software & Licenses",    sortOrder: 2 },
    { type: "CATEGORY",     code: "CLOUD", label: "Cloud Services",         sortOrder: 3 },
    { type: "CATEGORY",     code: "CONS",  label: "Consulting Services",    sortOrder: 4 },
    { type: "CATEGORY",     code: "OFFICE",label: "Office Supplies",        sortOrder: 5 },
    { type: "GL_ACCOUNT",   code: "6100",  label: "IT Equipment & Assets",  sortOrder: 1 },
    { type: "GL_ACCOUNT",   code: "6200",  label: "Software Subscriptions", sortOrder: 2 },
    { type: "GL_ACCOUNT",   code: "6300",  label: "Cloud Infrastructure",   sortOrder: 3 },
    { type: "GL_ACCOUNT",   code: "6400",  label: "Professional Services",  sortOrder: 4 },
  ];
  await prisma.lookup.createMany({ data: lookupData.map(l => ({ ...l, organizationId: org.id })) });
  console.log("  ✓  Lookups");

  // ── Chart of Accounts ─────────────────────────────────────────────────────
  const coa = await prisma.chartOfAccount.create({
    data: {
      organizationId: org.id,
      name: "India Operations COA",
      code: "IN01",
      companyCode: "NEXCORE-IN",
      currency: "INR",
      taxRegNumber: "27AABCN1234F1ZX",
      taxType: "GST",
      billingCity: "Hyderabad",
      billingState: "Telangana",
      billingCountry: "India",
    },
  });
  const segments = [
    { position: 1, name: "Business Area",  linkedLookupType: "DEPARTMENT" },
    { position: 2, name: "Cost Centre",    linkedLookupType: "COST_CENTER" },
    { position: 3, name: "GL Account",     linkedLookupType: "GL_ACCOUNT" },
    { position: 4, name: "Profit Centre",  linkedLookupType: null },
  ];
  for (const seg of segments) {
    await prisma.coaSegment.create({ data: { chartOfAccountId: coa.id, ...seg } });
  }
  console.log("  ✓  Chart of Accounts");

  // ── Approval Rules ────────────────────────────────────────────────────────
  const rule1 = await prisma.approvalRule.create({
    data: { organizationId: org.id, name: "Standard — Up to ₹5 Lakh", priority: 10, active: true, maxAmount: 500000 },
  });
  await prisma.approvalRuleStep.createMany({ data: [
    { ruleId: rule1.id, sequence: 1, stepType: "MANAGER",    stepLabel: "Line Manager Approval" },
  ]});

  const rule2 = await prisma.approvalRule.create({
    data: { organizationId: org.id, name: "High Value — ₹5L to ₹25L", priority: 20, active: true, minAmount: 500001, maxAmount: 2500000 },
  });
  await prisma.approvalRuleStep.createMany({ data: [
    { ruleId: rule2.id, sequence: 1, stepType: "MANAGER",    stepLabel: "Line Manager" },
    { ruleId: rule2.id, sequence: 2, stepType: "FINANCE",    stepLabel: "Finance Controller" },
  ]});

  const rule3 = await prisma.approvalRule.create({
    data: { organizationId: org.id, name: "Strategic — Above ₹25L", priority: 30, active: true, minAmount: 2500001 },
  });
  await prisma.approvalRuleStep.createMany({ data: [
    { ruleId: rule3.id, sequence: 1, stepType: "MANAGER",    stepLabel: "Line Manager" },
    { ruleId: rule3.id, sequence: 2, stepType: "DIRECTOR",   stepLabel: "Director Approval" },
    { ruleId: rule3.id, sequence: 3, stepType: "FINANCE",    stepLabel: "Finance Sign-off" },
  ]});
  console.log("  ✓  Approval rules (3 tiers)");

  // ── Suppliers ─────────────────────────────────────────────────────────────
  const [dell, microsoft, aws, wipro, cisco] = await Promise.all([
    prisma.supplier.create({ data: { organizationId: org.id, name: "Dell Technologies India Pvt. Ltd.", code: "SUP-001", category: "IT Hardware",        contactEmail: "enterprise@dell.com",      contactName: "Rajesh Kumar",    contactPhone: "+91-80-4150-0000", city: "Bengaluru", country: "India", paymentTerms: "Net 30", currency: "INR", status: "ACTIVE", tier: "Tier 1", preferred: true,  rating: 92, onTimeDelivery: 95, qualityScore: 90, riskLevel: "LOW",  riskScore: 12 } }),
    prisma.supplier.create({ data: { organizationId: org.id, name: "Microsoft India Pvt. Ltd.",         code: "SUP-002", category: "Software & Licenses", contactEmail: "procurement@microsoft.com", contactName: "Anita Sharma",    contactPhone: "+91-11-4130-3000", city: "Hyderabad", country: "India", paymentTerms: "Net 45", currency: "INR", status: "ACTIVE", tier: "Tier 1", preferred: true,  rating: 95, onTimeDelivery: 98, qualityScore: 97, riskLevel: "LOW",  riskScore: 8  } }),
    prisma.supplier.create({ data: { organizationId: org.id, name: "Amazon Web Services India Pvt. Ltd.",code: "SUP-003", category: "Cloud Services",      contactEmail: "aws-billing@amazon.com",   contactName: "Deepak Malhotra", contactPhone: "+91-80-4032-0000", city: "Bengaluru", country: "India", paymentTerms: "Net 30", currency: "INR", status: "ACTIVE", tier: "Tier 1", preferred: true,  rating: 98, onTimeDelivery: 99, qualityScore: 99, riskLevel: "LOW",  riskScore: 5  } }),
    prisma.supplier.create({ data: { organizationId: org.id, name: "Wipro Limited",                     code: "SUP-004", category: "Consulting Services", contactEmail: "vendor@wipro.com",          contactName: "Suresh Nair",     contactPhone: "+91-80-2844-0011", city: "Bengaluru", country: "India", paymentTerms: "Net 45", currency: "INR", status: "ACTIVE", tier: "Tier 2", preferred: false, rating: 84, onTimeDelivery: 82, qualityScore: 86, riskLevel: "MEDIUM", riskScore: 28 } }),
    prisma.supplier.create({ data: { organizationId: org.id, name: "Cisco Systems India Pvt. Ltd.",     code: "SUP-005", category: "IT Hardware",         contactEmail: "orders@cisco.com",          contactName: "Preeti Joshi",    contactPhone: "+91-80-4426-0000", city: "Bengaluru", country: "India", paymentTerms: "Net 30", currency: "INR", status: "ACTIVE", tier: "Tier 1", preferred: false, rating: 88, onTimeDelivery: 89, qualityScore: 91, riskLevel: "LOW",  riskScore: 15 } }),
  ]);
  console.log("  ✓  Suppliers (5)");

  // ── Requisitions ──────────────────────────────────────────────────────────
  const now = new Date();

  // 1. APPROVED — MacBook Pros (ready to become PO)
  const req1 = await prisma.requisition.create({
    data: {
      organizationId: org.id, requestorId: vikram.id,
      requisitionNumber: "REQ-000001",
      title: "MacBook Pro M3 — Engineering Team (Batch 1)",
      description: "Purchase of 10 MacBook Pro M3 14-inch laptops for new engineering hires joining Q3.",
      category: "IT Hardware", priority: "HIGH", status: "APPROVED",
      department: "Engineering", businessUnit: "Product Engineering",
      costCenter: "CC002", currency: "INR",
      totalAmount: 1500000, taxAmount: 270000,
      businessJustification: "10 new engineers joining for FinTech product launch. Laptops required before Day 1 (Aug 15).",
      requiredDate: new Date(now.getTime() + 7 * 86400000),
      submittedAt: new Date(now.getTime() - 5 * 86400000),
      glCoding: { "1": "ENG", "2": "CC002", "3": "6100" },
    },
  });
  await prisma.requisitionLineItem.createMany({ data: [
    { requisitionId: req1.id, supplierId: dell.id, description: "Apple MacBook Pro M3 14-inch 16GB/512GB — Space Black", partNumber: "MBP14-M3-SB", quantity: 10, unitPrice: 125000, lineTotal: 1250000, taxRate: 0.18, taxAmount: 225000, glAccount: "6100", category: "IT Hardware" },
    { requisitionId: req1.id, supplierId: dell.id, description: "Apple Magic Mouse (USB-C)", partNumber: "MMOUSE-C",    quantity: 10, unitPrice: 7500,   lineTotal: 75000,   taxRate: 0.18, taxAmount: 13500,  glAccount: "6100", category: "IT Hardware" },
    { requisitionId: req1.id, supplierId: dell.id, description: "Apple USB-C Hub 7-in-1",   partNumber: "USBC-HUB7",  quantity: 10, unitPrice: 17500,  lineTotal: 175000,  taxRate: 0.18, taxAmount: 31500,  glAccount: "6100", category: "IT Hardware" },
  ]});
  await prisma.approvalStep.createMany({ data: [
    { requisitionId: req1.id, stepType: "MANAGER",  sequence: 1, approverId: rahul.id,  status: "APPROVED", comment: "Approved. Critical for Q3 hiring plan.", decidedAt: new Date(now.getTime() - 3 * 86400000) },
    { requisitionId: req1.id, stepType: "FINANCE",  sequence: 2, approverId: sneha.id,  status: "APPROVED", comment: "Budget available. Approved.", decidedAt: new Date(now.getTime() - 2 * 86400000) },
  ]});

  // 2. MANAGER_APPROVAL — Microsoft 365
  const req2 = await prisma.requisition.create({
    data: {
      organizationId: org.id, requestorId: vikram.id,
      requisitionNumber: "REQ-000002",
      title: "Microsoft 365 Business Premium — Annual Renewal (50 seats)",
      description: "Annual renewal of Microsoft 365 Business Premium for 50 users. Current licence expires Aug 31.",
      category: "Software & Licenses", priority: "HIGH", status: "MANAGER_APPROVAL",
      department: "IT", costCenter: "CC001", currency: "INR",
      totalAmount: 315000, taxAmount: 48051,
      businessJustification: "Licence renewal — existing users will lose access on Sep 1 if not renewed.",
      requiredDate: new Date(now.getTime() + 3 * 86400000),
      submittedAt: new Date(now.getTime() - 1 * 86400000),
      glCoding: { "1": "IT", "2": "CC001", "3": "6200" },
    },
  });
  await prisma.requisitionLineItem.createMany({ data: [
    { requisitionId: req2.id, supplierId: microsoft.id, description: "Microsoft 365 Business Premium — Annual Subscription", partNumber: "M365-BP-50", quantity: 50, unitPrice: 5400, lineTotal: 270000, taxRate: 0.18, taxAmount: 48600, glAccount: "6200", category: "Software & Licenses" },
    { requisitionId: req2.id, supplierId: microsoft.id, description: "Microsoft Defender for Business — Add-on", partNumber: "MDB-ADD50",  quantity: 50, unitPrice: 900,  lineTotal: 45000,  taxRate: 0.18, taxAmount: 8100,  glAccount: "6200", category: "Software & Licenses" },
  ]});
  await prisma.approvalStep.createMany({ data: [
    { requisitionId: req2.id, stepType: "MANAGER", sequence: 1, approverId: rahul.id, status: "PENDING" },
  ]});

  // 3. PO_CREATED — AWS Cloud
  const req3 = await prisma.requisition.create({
    data: {
      organizationId: org.id, requestorId: vikram.id,
      requisitionNumber: "REQ-000003",
      title: "AWS Cloud Infrastructure — Q4 2025",
      description: "AWS reserved instances + S3 storage for production FinTech application launch.",
      category: "Cloud Services", priority: "CRITICAL", status: "PO_CREATED",
      department: "Engineering", costCenter: "CC002", currency: "INR",
      totalAmount: 744000, taxAmount: 134028,
      businessJustification: "Production infrastructure for FinTech app launching Oct 1. Reservation provides 40% cost saving vs on-demand.",
      requiredDate: new Date(now.getTime() + 14 * 86400000),
      submittedAt: new Date(now.getTime() - 10 * 86400000),
      glCoding: { "1": "ENG", "2": "CC002", "3": "6300" },
    },
  });
  await prisma.requisitionLineItem.createMany({ data: [
    { requisitionId: req3.id, supplierId: aws.id, description: "AWS EC2 Reserved Instance (m6i.2xlarge) — 1 Year",  quantity: 2,  unitPrice: 165000, lineTotal: 330000, taxRate: 0.18, taxAmount: 59400,  glAccount: "6300", category: "Cloud Services" },
    { requisitionId: req3.id, supplierId: aws.id, description: "AWS RDS PostgreSQL (db.r6g.xlarge) — 1 Year",      quantity: 1,  unitPrice: 248000, lineTotal: 248000, taxRate: 0.18, taxAmount: 44640,  glAccount: "6300", category: "Cloud Services" },
    { requisitionId: req3.id, supplierId: aws.id, description: "AWS S3 Storage — 50TB Pre-paid Block",              quantity: 50, unitPrice: 3280,   lineTotal: 164000, taxRate: 0.18, taxAmount: 29520,  glAccount: "6300", category: "Cloud Services" },
  ]});
  await prisma.approvalStep.createMany({ data: [
    { requisitionId: req3.id, stepType: "MANAGER", sequence: 1, approverId: rahul.id, status: "APPROVED", decidedAt: new Date(now.getTime() - 8 * 86400000) },
    { requisitionId: req3.id, stepType: "FINANCE", sequence: 2, approverId: sneha.id, status: "APPROVED", decidedAt: new Date(now.getTime() - 7 * 86400000) },
  ]});

  // 4. SUBMITTED — Wipro Consulting
  const req4 = await prisma.requisition.create({
    data: {
      organizationId: org.id, requestorId: admin.id,
      requisitionNumber: "REQ-000004",
      title: "Digital Transformation Consulting — Wipro (Phase 2)",
      description: "6-month engagement for API modernisation and legacy system migration.",
      category: "Consulting Services", priority: "MEDIUM", status: "SUBMITTED",
      department: "IT", costCenter: "CC001", currency: "INR",
      totalAmount: 3600000, taxAmount: 648000,
      businessJustification: "Phase 2 of digital transformation roadmap approved by board in Jan 2025.",
      requiredDate: new Date(now.getTime() + 30 * 86400000),
      submittedAt: new Date(now.getTime() - 2 * 86400000),
    },
  });
  await prisma.requisitionLineItem.createMany({ data: [
    { requisitionId: req4.id, supplierId: wipro.id, description: "Principal Consultant — API Architecture (6 months)",     quantity: 6, unitPrice: 250000, lineTotal: 1500000, taxRate: 0.18, taxAmount: 270000, glAccount: "6400", category: "Consulting Services" },
    { requisitionId: req4.id, supplierId: wipro.id, description: "Senior Developer — Backend Migration (6 months)",         quantity: 6, unitPrice: 180000, lineTotal: 1080000, taxRate: 0.18, taxAmount: 194400, glAccount: "6400", category: "Consulting Services" },
    { requisitionId: req4.id, supplierId: wipro.id, description: "QA Engineer — Testing & Automation (6 months)",          quantity: 6, unitPrice: 170000, lineTotal: 1020000, taxRate: 0.18, taxAmount: 183600, glAccount: "6400", category: "Consulting Services" },
  ]});
  await prisma.approvalStep.createMany({ data: [
    { requisitionId: req4.id, stepType: "MANAGER",  sequence: 1, approverId: rahul.id, status: "PENDING" },
    { requisitionId: req4.id, stepType: "DIRECTOR",  sequence: 2, status: "PENDING" },
    { requisitionId: req4.id, stepType: "FINANCE",  sequence: 3, approverId: sneha.id, status: "PENDING" },
  ]});

  // 5. DRAFT — Network Upgrade
  await prisma.requisition.create({
    data: {
      organizationId: org.id, requestorId: admin.id,
      requisitionNumber: "REQ-000005",
      title: "Office Network Upgrade — Hyderabad HQ",
      description: "Cisco switches + Wi-Fi 6E access points for new 5th floor expansion.",
      category: "IT Hardware", priority: "LOW", status: "DRAFT",
      department: "IT", costCenter: "CC001", currency: "INR",
      totalAmount: 425000,
    },
  });
  console.log("  ✓  Requisitions (5)");

  // ── Purchase Orders ───────────────────────────────────────────────────────
  const po1 = await prisma.purchaseOrder.create({
    data: {
      organizationId: org.id, requisitionId: req3.id,
      supplierId: aws.id, createdById: procurement.id,
      poNumber: "PO-2025-001",
      status: "ACKNOWLEDGED",
      routingMethod: "EMAIL",
      supplierEmail: "aws-billing@amazon.com",
      currency: "INR",
      subtotal: 742000, taxAmount: 133560, totalAmount: 875560,
      paymentTerms: "Net 30",
      deliveryAddress: "Nexcore Technologies, 8th Floor, Cyber Gateway, Hyderabad 500081",
      notes: "Reserved instance activation required by Sep 25 for Oct 1 launch.",
      issuedAt: new Date(now.getTime() - 6 * 86400000),
      acknowledgedAt: new Date(now.getTime() - 5 * 86400000),
      expectedDelivery: new Date(now.getTime() + 7 * 86400000),
    },
  });
  await prisma.purchaseOrderLineItem.createMany({ data: [
    { purchaseOrderId: po1.id, supplierId: aws.id, description: "AWS EC2 Reserved Instance (m6i.2xlarge) × 2",  quantity: 2,  unitPrice: 165000, lineTotal: 330000, glAccount: "6300" },
    { purchaseOrderId: po1.id, supplierId: aws.id, description: "AWS RDS PostgreSQL (db.r6g.xlarge) × 1",       quantity: 1,  unitPrice: 248000, lineTotal: 248000, glAccount: "6300" },
    { purchaseOrderId: po1.id, supplierId: aws.id, description: "AWS S3 Storage 50TB Block",                    quantity: 50, unitPrice: 3280,   lineTotal: 164000, glAccount: "6300" },
  ]});

  const po2 = await prisma.purchaseOrder.create({
    data: {
      organizationId: org.id, requisitionId: req1.id,
      supplierId: dell.id, createdById: procurement.id,
      poNumber: "PO-2025-002",
      status: "SENT",
      routingMethod: "EMAIL",
      supplierEmail: "enterprise@dell.com",
      currency: "INR",
      subtotal: 1500000, taxAmount: 270000, totalAmount: 1770000,
      paymentTerms: "Net 30",
      deliveryAddress: "Nexcore Technologies, 8th Floor, Cyber Gateway, Hyderabad 500081",
      notes: "Delivery required by Aug 12 (3 days before new hires join).",
      issuedAt: new Date(now.getTime() - 1 * 86400000),
      expectedDelivery: new Date(now.getTime() + 7 * 86400000),
    },
  });
  await prisma.purchaseOrderLineItem.createMany({ data: [
    { purchaseOrderId: po2.id, supplierId: dell.id, description: "Apple MacBook Pro M3 14-inch × 10",  quantity: 10, unitPrice: 125000, lineTotal: 1250000, glAccount: "6100" },
    { purchaseOrderId: po2.id, supplierId: dell.id, description: "Apple Magic Mouse (USB-C) × 10",     quantity: 10, unitPrice: 7500,   lineTotal: 75000,   glAccount: "6100" },
    { purchaseOrderId: po2.id, supplierId: dell.id, description: "Apple USB-C Hub 7-in-1 × 10",        quantity: 10, unitPrice: 17500,  lineTotal: 175000,  glAccount: "6100" },
  ]});

  console.log("  ✓  Purchase Orders (2)");
  console.log("\n✅  Demo data seeded successfully!");
  console.log("\n  Organisation:  Nexcore Technologies Pvt. Ltd.");
  console.log("  Requisitions:  5 (DRAFT, SUBMITTED, MANAGER_APPROVAL, APPROVED, PO_CREATED)");
  console.log("  POs:           2 (SENT, ACKNOWLEDGED)");
  console.log("  Suppliers:     5");
  console.log("  Users:         5");
  console.log("\n  Login with any of these emails (admin in Supabase or set authId):");
  console.log("    arjun.sharma@nexcore.in  (ADMIN)");
  console.log("    priya.mehta@nexcore.in   (PROCUREMENT)");
  console.log("    rahul.gupta@nexcore.in   (APPROVER — Manager)");
  console.log("    sneha.patel@nexcore.in   (APPROVER — Finance)");
  console.log("    vikram.singh@nexcore.in  (REQUESTOR)");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
