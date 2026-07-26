const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
const OID='85c48fe0-7934-4ac6-86ad-07e8e25af811';
const data=[
  {name:'Tata Consultancy Services',code:'SUP-101',cat:'Consulting Services',city:'Mumbai',tier:'Tier 1',rating:92,otd:94,qs:91,ia:97,rs:89,risk:'LOW',rs2:8,ce:'vendor@tcs.com',cn:'Amit Verma',ph:'+91-22-6778-9999',pt:'Net 30'},
  {name:'HCL Technologies Ltd.',code:'SUP-102',cat:'IT Hardware',city:'Noida',tier:'Tier 1',rating:88,otd:90,qs:87,ia:94,rs:85,risk:'LOW',rs2:12,ce:'procurement@hcl.com',cn:'Pradeep Sharma',ph:'+91-120-6125000',pt:'Net 30'},
  {name:'Lenovo India Pvt. Ltd.',code:'SUP-103',cat:'IT Hardware',city:'Bengaluru',tier:'Tier 1',rating:91,otd:93,qs:90,ia:96,rs:88,risk:'LOW',rs2:10,ce:'orders@lenovo.com',cn:'Sunil Mehta',ph:'+91-80-4015-5000',pt:'Net 30'},
  {name:'Adobe Systems India',code:'SUP-104',cat:'Software & Licenses',city:'Bengaluru',tier:'Tier 1',rating:96,otd:99,qs:98,ia:99,rs:95,risk:'LOW',rs2:5,ce:'india@adobe.com',cn:'Neha Kapoor',ph:'+91-80-4150-4000',pt:'Net 45'},
  {name:'Google Cloud India',code:'SUP-105',cat:'Cloud Services',city:'Hyderabad',tier:'Tier 1',rating:97,otd:99,qs:99,ia:99,rs:96,risk:'LOW',rs2:4,ce:'gcp-billing@google.com',cn:'Rohan Das',ph:'+91-40-6721-8000',pt:'Net 30'},
  {name:'Accenture Solutions Pvt. Ltd.',code:'SUP-106',cat:'Consulting Services',city:'Mumbai',tier:'Tier 1',rating:87,otd:85,qs:89,ia:92,rs:84,risk:'LOW',rs2:15,ce:'vendor@accenture.com',cn:'Kavita Rao',ph:'+91-22-6660-0000',pt:'Net 45'},
  {name:'HP India Sales Pvt. Ltd.',code:'SUP-107',cat:'IT Hardware',city:'Bengaluru',tier:'Tier 2',rating:85,otd:87,qs:84,ia:91,rs:82,risk:'LOW',rs2:18,ce:'enterprise@hp.com',cn:'Manish Tiwari',ph:'+91-80-2559-5000',pt:'Net 30'},
  {name:'Salesforce India Pvt. Ltd.',code:'SUP-108',cat:'Software & Licenses',city:'Hyderabad',tier:'Tier 1',rating:94,otd:97,qs:96,ia:98,rs:93,risk:'LOW',rs2:6,ce:'india@salesforce.com',cn:'Divya Menon',ph:'+91-40-4022-6000',pt:'Net 45'},
  {name:'Siemens India Ltd.',code:'SUP-109',cat:'Facilities',city:'Mumbai',tier:'Tier 2',rating:83,otd:82,qs:85,ia:90,rs:80,risk:'MEDIUM',rs2:25,ce:'vendor@siemens.com',cn:'Arjun Pillai',ph:'+91-22-3967-7000',pt:'Net 45'},
  {name:'Jio Business Solutions',code:'SUP-110',cat:'Cloud Services',city:'Mumbai',tier:'Tier 2',rating:80,otd:82,qs:79,ia:88,rs:78,risk:'LOW',rs2:20,ce:'enterprise@jio.com',cn:'Vikrant Shah',ph:'+91-22-3555-5000',pt:'Net 30'},
  {name:'IBM India Pvt. Ltd.',code:'SUP-111',cat:'Consulting Services',city:'Bengaluru',tier:'Tier 1',rating:90,otd:91,qs:92,ia:95,rs:88,risk:'LOW',rs2:11,ce:'vendor@ibm.com',cn:'Sanjay Gupta',ph:'+91-80-4139-3000',pt:'Net 45'},
  {name:'Ericsson India Global Services',code:'SUP-112',cat:'IT Hardware',city:'Gurgaon',tier:'Tier 2',rating:82,otd:84,qs:83,ia:89,rs:80,risk:'LOW',rs2:22,ce:'india@ericsson.com',cn:'Pooja Nair',ph:'+91-124-4178-000',pt:'Net 30'},
  {name:'Atlassian India Pvt. Ltd.',code:'SUP-113',cat:'Software & Licenses',city:'Bengaluru',tier:'Tier 1',rating:95,otd:98,qs:97,ia:99,rs:94,risk:'LOW',rs2:5,ce:'india@atlassian.com',cn:'Aisha Khan',ph:'+91-80-4917-0000',pt:'Net 30'},
  {name:'Schneider Electric India',code:'SUP-114',cat:'Facilities',city:'Bengaluru',tier:'Tier 2',rating:81,otd:80,qs:83,ia:87,rs:79,risk:'MEDIUM',rs2:28,ce:'vendor@schneider.com',cn:'Ravi Krishnan',ph:'+91-80-6107-5000',pt:'Net 45'},
  {name:'Godrej Interio',code:'SUP-115',cat:'Office Supplies',city:'Mumbai',tier:'Tier 2',rating:79,otd:80,qs:81,ia:86,rs:77,risk:'LOW',rs2:24,ce:'orders@godrejinterio.com',cn:'Nisha Joshi',ph:'+91-22-6796-4800',pt:'Net 30'},
  {name:'Tata Communications Ltd.',code:'SUP-116',cat:'Cloud Services',city:'Mumbai',tier:'Tier 1',rating:86,otd:88,qs:87,ia:92,rs:84,risk:'LOW',rs2:16,ce:'enterprise@tatacommunications.com',cn:'Ashok Pillai',ph:'+91-22-6659-1000',pt:'Net 30'},
  {name:'Mphasis Ltd.',code:'SUP-117',cat:'Consulting Services',city:'Bengaluru',tier:'Tier 2',rating:84,otd:83,qs:86,ia:91,rs:82,risk:'LOW',rs2:19,ce:'vendor@mphasis.com',cn:'Deepa Iyer',ph:'+91-80-3352-5000',pt:'Net 45'},
  {name:'Konica Minolta India',code:'SUP-118',cat:'Office Supplies',city:'Delhi',tier:'Tier 2',rating:78,otd:79,qs:80,ia:85,rs:76,risk:'LOW',rs2:26,ce:'orders@konicaminolta.in',cn:'Vijay Saxena',ph:'+91-11-4666-5000',pt:'Net 30'},
  {name:'NTT Data India Pvt. Ltd.',code:'SUP-119',cat:'Consulting Services',city:'Bengaluru',tier:'Tier 1',rating:88,otd:89,qs:90,ia:93,rs:86,risk:'LOW',rs2:13,ce:'vendor@nttdata.com',cn:'Meghna Bose',ph:'+91-80-6741-0000',pt:'Net 45'},
  {name:'Bharti Airtel Business',code:'SUP-120',cat:'Cloud Services',city:'Delhi',tier:'Tier 2',rating:82,otd:84,qs:81,ia:89,rs:80,risk:'LOW',rs2:21,ce:'enterprise@airtel.com',cn:'Rahul Bajaj',ph:'+91-11-4266-5000',pt:'Net 30'},
];
async function main(){
  const kate=await p.user.findFirst({where:{email:'Kate@ace.com'}});
  if(!kate){console.log('Kate not found');return;}
  let created=0,skipped=0;
  for(const s of data){
    const ex=await p.supplier.findFirst({where:{organizationId:OID,code:s.code}});
    if(ex){skipped++;continue;}
    await p.supplier.create({data:{
      organizationId:OID,name:s.name,code:s.code,
      status:'ACTIVE',onboardingStage:'ACTIVE',
      category:s.cat,city:s.city,country:'India',
      tier:s.tier,preferred:s.tier==='Tier 1',
      rating:s.rating,onTimeDelivery:s.otd,qualityScore:s.qs,
      invoiceAccuracy:s.ia,responsivenessScore:s.rs,
      riskLevel:s.risk,riskScore:s.rs2,
      contactName:s.cn,contactEmail:s.ce,contactPhone:s.ph,
      currency:'INR',paymentTerms:s.pt,requestedById:kate.id,
    }});
    console.log('Created:',s.code,s.name);
    created++;
  }
  const total=await p.supplier.count({where:{organizationId:OID}});
  console.log('\nDone. Created:',created,'Skipped:',skipped,'Total in DB:',total);
}
main().catch(e=>console.error('ERROR:',e.message)).finally(()=>p.$disconnect());
