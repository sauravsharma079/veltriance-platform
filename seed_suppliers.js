const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const OID = '85c48fe0-7934-4ac6-86ad-07e8e25af811';

const suppliers = [
  { name:'Tata Consultancy Services Ltd.', code:'SUP-010', category:'Consulting Services', city:'Mumbai', tier:'Tier 1', rating:92, onTimeDelivery:94, qualityScore:91, invoiceAccuracy:97, responsivenessScore:89, riskLevel:'LOW', riskScore:8, contactName:'Amit Verma', contactEmail:'vendor@tcs.com', contactPhone:'+91-22-6778-9999', paymentTerms:'Net 30' },
  { name:'HCL Technologies Ltd.', code:'SUP-011', category:'IT Hardware', city:'Noida', tier:'Tier 1', rating:88, onTimeDelivery:90, qualityScore:87, invoiceAccuracy:94, responsivenessScore:85, riskLevel:'LOW', riskScore:12, contactName:'Pradeep Sharma', contactEmail:'procurement@hcl.com', contactPhone:'+91-120-6125000', paymentTerms:'Net 30' },
  { name:'Lenovo India Pvt. Ltd.', code:'SUP-012', category:'IT Hardware', city:'Bengaluru', tier:'Tier 1', rating:91, onTimeDelivery:93, qualityScore:90, invoiceAccuracy:96, responsivenessScore:88, riskLevel:'LOW', riskScore:10, contactName:'Sunil Mehta', contactEmail:'orders@lenovo.com', contactPhone:'+91-80-4015-5000', paymentTerms:'Net 30' },
  { name:'Adobe Systems India Pvt. Ltd.', code:'SUP-013', category:'Software & Licenses', city:'Bengaluru', tier:'Tier 1', rating:96, onTimeDelivery:99, qualityScore:98, invoiceAccuracy:99, responsivenessScore:95, riskLevel:'LOW', riskScore:5, contactName:'Neha Kapoor', contactEmail:'india@adobe.com', contactPhone:'+91-80-4150-4000', paymentTerms:'Net 45' },
  { name:'Google Cloud India Pvt. Ltd.', code:'SUP-014', category:'Cloud Services', city:'Hyderabad', tier:'Tier 1', rating:97, onTimeDelivery:99, qualityScore:99, invoiceAccuracy:99, responsivenessScore:96, riskLevel:'LOW', riskScore:4, contactName:'Rohan Das', contactEmail:'gcp-billing@google.com', contactPhone:'+91-40-6721-8000', paymentTerms:'Net 30' },
  { name:'Accenture Solutions Pvt. Ltd.', code:'SUP-015', category:'Consulting Services', city:'Mumbai', tier:'Tier 1', rating:87, onTimeDelivery:85, qualityScore:89, invoiceAccuracy:92, responsivenessScore:84, riskLevel:'LOW', riskScore:15, contactName:'Kavita Rao', contactEmail:'vendor@accenture.com', contactPhone:'+91-22-6660-0000', paymentTerms:'Net 45' },
  { name:'HP India Sales Pvt. Ltd.', code:'SUP-016', category:'IT Hardware', city:'Bengaluru', tier:'Tier 2', rating:85, onTimeDelivery:87, qualityScore:84, invoiceAccuracy:91, responsivenessScore:82, riskLevel:'LOW', riskScore:18, contactName:'Manish Tiwari', contactEmail:'enterprise@hp.com', contactPhone:'+91-80-2559-5000', paymentTerms:'Net 30' },
  { name:'Salesforce India Pvt. Ltd.', code:'SUP-017', category:'Software & Licenses', city:'Hyderabad', tier:'Tier 1', rating:94, onTimeDelivery:97, qualityScore:96, invoiceAccuracy:98, responsivenessScore:93, riskLevel:'LOW', riskScore:6, contactName:'Divya Menon', contactEmail:'india@salesforce.com', contactPhone:'+91-40-4022-6000', paymentTerms:'Net 45' },
  { name:'Siemens India Ltd.', code:'SUP-018', category:'Facilities', city:'Mumbai', tier:'Tier 2', rating:83, onTimeDelivery:82, qualityScore:85, invoiceAccuracy:90, responsivenessScore:80, riskLevel:'MEDIUM', riskScore:25, contactName:'Arjun Pillai', contactEmail:'vendor@siemens.com', contactPhone:'+91-22-3967-7000', paymentTerms:'Net 45' },
  { name:'Jio Business Solutions Ltd.', code:'SUP-019', category:'Cloud Services', city:'Mumbai', tier:'Tier 2', rating:80, onTimeDelivery:82, qualityScore:79, invoiceAccuracy:88, responsivenessScore:78, riskLevel:'LOW', riskScore:20, contactName:'Vikrant Shah', contactEmail:'enterprise@jio.com', contactPhone:'+91-22-3555-5000', paymentTerms:'Net 30' },
  { name:'IBM India Pvt. Ltd.', code:'SUP-020', category:'Consulting Services', city:'Bengaluru', tier:'Tier 1', rating:90, onTimeDelivery:91, qualityScore:92, invoiceAccuracy:95, responsivenessScore:88, riskLevel:'LOW', riskScore:11, contactName:'Sanjay Gupta', contactEmail:'vendor@ibm.com', contactPhone:'+91-80-4139-3000', paymentTerms:'Net 45' },
  { name:'Ericsson India Global Services', code:'SUP-021', category:'IT Hardware', city:'Gurgaon', tier:'Tier 2', rating:82, onTimeDelivery:84, qualityScore:83, invoiceAccuracy:89, responsivenessScore:80, riskLevel:'LOW', riskScore:22, contactName:'Pooja Nair', contactEmail:'india@ericsson.com', contactPhone:'+91-124-4178-000', paymentTerms:'Net 30' },
  { name:'Atlassian India Pvt. Ltd.', code:'SUP-022', category:'Software & Licenses', city:'Bengaluru', tier:'Tier 1', rating:95, onTimeDelivery:98, qualityScore:97, invoiceAccuracy:99, responsivenessScore:94, riskLevel:'LOW', riskScore:5, contactName:'Aisha Khan', contactEmail:'india@atlassian.com', contactPhone:'+91-80-4917-0000', paymentTerms:'Net 30' },
  { name:'Schneider Electric India Pvt. Ltd.', code:'SUP-023', category:'Facilities', city:'Bengaluru', tier:'Tier 2', rating:81, onTimeDelivery:80, qualityScore:83, invoiceAccuracy:87, responsivenessScore:79, riskLevel:'MEDIUM', riskScore:28, contactName:'Ravi Krishnan', contactEmail:'vendor@schneider.com', contactPhone:'+91-80-6107-5000', paymentTerms:'Net 45' },
  { name:'Godrej Interio', code:'SUP-024', category:'Office Supplies', city:'Mumbai', tier:'Tier 2', rating:79, onTimeDelivery:80, qualityScore:81, invoiceAccuracy:86, responsivenessScore:77, riskLevel:'LOW', riskScore:24, contactName:'Nisha Joshi', contactEmail:'orders@godrejinterio.com', contactPhone:'+91-22-6796-4800', paymentTerms:'Net 30' },
  { name:'Tata Communications Ltd.', code:'SUP-025', category:'Cloud Services', city:'Mumbai', tier:'Tier 1', rating:86, onTimeDelivery:88, qualityScore:87, invoiceAccuracy:92, responsivenessScore:84, riskLevel:'LOW', riskScore:16, contactName:'Ashok Pillai', contactEmail:'enterprise@tatacommunications.com', contactPhone:'+91-22-6659-1000', paymentTerms:'Net 30' },
  { name:'Mphasis Ltd.', code:'SUP-026', category:'Consulting Services', city:'Bengaluru', tier:'Tier 2', rating:84, onTimeDelivery:83, qualityScore:86, invoiceAccuracy:91, responsivenessScore:82, riskLevel:'LOW', riskScore:19, contactName:'Deepa Iyer', contactEmail:'vendor@mphasis.com', contactPhone:'+91-80-3352-5000', paymentTerms:'Net 45' },
  { name:'Konica Minolta India Pvt. Ltd.', code:'SUP-027', category:'Office Supplies', city:'Delhi', tier:'Tier 2', rating:78, onTimeDelivery:79, qualityScore:80, invoiceAccuracy:85, responsivenessScore:76, riskLevel:'LOW', riskScore:26, contactName:'Vijay Saxena', contactEmail:'orders@konicaminolta.in', contactPhone:'+91-11-4666-5000', paymentTerms:'Net 30' },
  { name:'NTT Data India Pvt. Ltd.', code:'SUP-028', category:'Consulting Services', city:'Bengaluru', tier:'Tier 1', rating:88, onTimeDelivery:89, qualityScore:90, invoiceAccuracy:93, responsivenessScore:86, riskLevel:'LOW', riskScore:13, contactName:'Meghna Bose', contactEmail:'vendor@nttdata.com', contactPhone:'+91-80-6741-0000', paymentTerms:'Net 45' },
  { name:'Bharti Airtel Business', code:'SUP-029', category:'Cloud Services', city:'Delhi', tier:'Tier 2', rating:82, onTimeDelivery:84, qualityScore:81, invoiceAccuracy:89, responsivenessScore:80, riskLevel:'LOW', riskScore:21, contactName:'Rahul Bajaj', contactEmail:'enterprise@airtel.com', contactPhone:'+91-11-4266-5000', paymentTerms:'Net 30' },
];

async function main() {
  console.log('Creating 20 suppliers...');
  const kate = await p.user.findFirst({ where: { email: 'Kate@ace.com' } });
  if (!kate) { console.log('Kate not found!'); return; }

  for (const s of suppliers) {
    const exists = await p.supplier.findFirst({ where: { organizationId: OID, code: s.code } });
    if (exists) { console.log(`  SKIP ${s.code} — already exists`); continue; }
    await p.supplier.create({
      data: {
        organizationId: OID,
        name: s.name, code: s.code,
        status: 'ACTIVE', onboardingStage: 'ACTIVE',
        category: s.category, city: s.city, country: 'India',
        tier: s.tier, preferred: s.tier === 'Tier 1',
        rating: s.rating, onTimeDelivery: s.onTimeDelivery,
        qualityScore: s.qualityScore, invoiceAccuracy: s.invoiceAccuracy,
        responsivenessScore: s.responsivenessScore,
        riskLevel: s.riskLevel, riskScore: s.riskScore,
        contactName: s.contactName, contactEmail: s.contactEmail,
        contactPhone: s.contactPhone, currency: 'INR',
        paymentTerms: s.paymentTerms, requestedById: kate.id,
      },
    });
    console.log(`  ✓  ${s.code} — ${s.name}`);
  }
  console.log('\nAll 20 suppliers created!');
}

main().catch(e => console.error('FAILED:', e.message)).finally(() => p.$disconnect());
