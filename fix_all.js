const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
const OID='85c48fe0-7934-4ac6-86ad-07e8e25af811';

async function main(){
  console.log('Starting comprehensive fix seed...');
  const kate=await p.user.findFirst({where:{email:'Kate@ace.com'}});
  if(!kate){console.error('Kate not found - is DB reachable?');process.exit(1);}

  // ── 1. SUPPLIERS (ACTIVE) ──────────────────────────────────────────────────
  const suppliers=[
    {name:'Tata Consultancy Services',code:'SUP-101',cat:'IT Services',city:'Mumbai',tier:'Tier 1',rating:92,risk:'LOW',rs:8,ce:'vendor@tcs.com',cn:'Amit Verma',pt:'Net 30'},
    {name:'HCL Technologies Ltd.',code:'SUP-102',cat:'IT Hardware',city:'Noida',tier:'Tier 1',rating:88,risk:'LOW',rs:12,ce:'procurement@hcl.com',cn:'Pradeep Sharma',pt:'Net 30'},
    {name:'Lenovo India Pvt. Ltd.',code:'SUP-103',cat:'IT Hardware',city:'Bengaluru',tier:'Tier 1',rating:91,risk:'LOW',rs:10,ce:'orders@lenovo.com',cn:'Sunil Mehta',pt:'Net 30'},
    {name:'Adobe Systems India',code:'SUP-104',cat:'Software & Licenses',city:'Bengaluru',tier:'Tier 1',rating:96,risk:'LOW',rs:5,ce:'india@adobe.com',cn:'Neha Kapoor',pt:'Net 45'},
    {name:'Google Cloud India',code:'SUP-105',cat:'Cloud Services',city:'Hyderabad',tier:'Tier 1',rating:97,risk:'LOW',rs:4,ce:'gcp@google.com',cn:'Rohan Das',pt:'Net 30'},
    {name:'Accenture Solutions Pvt. Ltd.',code:'SUP-106',cat:'Consulting',city:'Mumbai',tier:'Tier 1',rating:87,risk:'LOW',rs:15,ce:'vendor@accenture.com',cn:'Kavita Rao',pt:'Net 45'},
    {name:'HP India Sales Pvt. Ltd.',code:'SUP-107',cat:'IT Hardware',city:'Bengaluru',tier:'Tier 2',rating:85,risk:'LOW',rs:18,ce:'enterprise@hp.com',cn:'Manish Tiwari',pt:'Net 30'},
    {name:'Salesforce India Pvt. Ltd.',code:'SUP-108',cat:'Software & Licenses',city:'Hyderabad',tier:'Tier 1',rating:94,risk:'LOW',rs:6,ce:'india@salesforce.com',cn:'Divya Menon',pt:'Net 45'},
    {name:'IBM India Pvt. Ltd.',code:'SUP-109',cat:'Consulting',city:'Bengaluru',tier:'Tier 1',rating:90,risk:'LOW',rs:11,ce:'vendor@ibm.com',cn:'Sanjay Gupta',pt:'Net 45'},
    {name:'Atlassian India Pvt. Ltd.',code:'SUP-110',cat:'Software & Licenses',city:'Bengaluru',tier:'Tier 1',rating:95,risk:'LOW',rs:5,ce:'india@atlassian.com',cn:'Aisha Khan',pt:'Net 30'},
    {name:'Tata Communications Ltd.',code:'SUP-111',cat:'Cloud Services',city:'Mumbai',tier:'Tier 1',rating:86,risk:'LOW',rs:16,ce:'enterprise@tatacommunications.com',cn:'Ashok Pillai',pt:'Net 30'},
    {name:'Mphasis Ltd.',code:'SUP-112',cat:'Consulting',city:'Bengaluru',tier:'Tier 2',rating:84,risk:'LOW',rs:19,ce:'vendor@mphasis.com',cn:'Deepa Iyer',pt:'Net 45'},
    {name:'NTT Data India Pvt. Ltd.',code:'SUP-113',cat:'IT Services',city:'Bengaluru',tier:'Tier 1',rating:88,risk:'LOW',rs:13,ce:'vendor@nttdata.com',cn:'Meghna Bose',pt:'Net 45'},
    {name:'Bharti Airtel Business',code:'SUP-114',cat:'Telecom',city:'Delhi',tier:'Tier 2',rating:82,risk:'LOW',rs:21,ce:'enterprise@airtel.com',cn:'Rahul Bajaj',pt:'Net 30'},
    {name:'Microsoft India Pvt. Ltd.',code:'SUP-115',cat:'Software & Licenses',city:'Hyderabad',tier:'Tier 1',rating:98,risk:'LOW',rs:3,ce:'enterprise@microsoft.com',cn:'Priya Menon',pt:'Net 30'},
    {name:'Cisco Systems India Pvt.',code:'SUP-116',cat:'Networking',city:'Bengaluru',tier:'Tier 1',rating:93,risk:'LOW',rs:7,ce:'cisco@cisco.com',cn:'Vikram Nair',pt:'Net 45'},
    {name:'AWS India Pvt. Ltd.',code:'SUP-117',cat:'Cloud Services',city:'Hyderabad',tier:'Tier 1',rating:97,risk:'LOW',rs:4,ce:'aws@amazon.com',cn:'Sneha Rao',pt:'Net 30'},
    {name:'Wipro Ltd.',code:'SUP-118',cat:'IT Services',city:'Bengaluru',tier:'Tier 1',rating:89,risk:'LOW',rs:14,ce:'vendor@wipro.com',cn:'Arjun Singh',pt:'Net 45'},
    {name:'Infosys BPM Ltd.',code:'SUP-119',cat:'IT Services',city:'Pune',tier:'Tier 2',rating:87,risk:'LOW',rs:16,ce:'vendor@infosys.com',cn:'Kavya Sharma',pt:'Net 30'},
    {name:'Siemens India Ltd.',code:'SUP-120',cat:'Facilities & Infra',city:'Mumbai',tier:'Tier 2',rating:83,risk:'MEDIUM',rs:25,ce:'vendor@siemens.com',cn:'Rahul Pillai',pt:'Net 45'},
  ];
  let sc=0,ss=0;
  for(const s of suppliers){
    const ex=await p.supplier.findFirst({where:{organizationId:OID,code:s.code}});
    if(ex){ss++;continue;}
    await p.supplier.create({data:{
      organizationId:OID,name:s.name,code:s.code,status:'ACTIVE',onboardingStage:'ACTIVE',
      category:s.cat,city:s.city,country:'India',tier:s.tier,preferred:s.tier==='Tier 1',
      rating:s.rating,onTimeDelivery:s.rating-2,qualityScore:s.rating-1,
      invoiceAccuracy:Math.min(s.rating+1,100),responsivenessScore:s.rating-3,
      riskLevel:s.risk,riskScore:s.rs,
      contactName:s.cn,contactEmail:s.ce,currency:'INR',paymentTerms:s.pt,
      requestedById:kate.id,
    }});
    console.log('  Supplier:',s.code,s.name);sc++;
  }
  console.log('Suppliers: created='+sc+' skipped='+ss);

  // ── 2. DELIVERY ADDRESSES as Lookups ────────────────────────────────────────
  const addresses=[
    {code:'ADDR-BLR-HQ',label:'Ace HQ — 8th Floor, Prestige Tech Park, Outer Ring Road, Bengaluru 560103'},
    {code:'ADDR-DEL-01',label:'Ace Delhi Office — Tower B, 14th Floor, DLF Cyber City, Gurugram 122002'},
    {code:'ADDR-MUM-01',label:'Ace Mumbai Office — Level 9, One BKC, Bandra Kurla Complex, Mumbai 400051'},
    {code:'ADDR-HYD-01',label:'Ace Hyderabad Office — Plot 12, HITEC City, Madhapur, Hyderabad 500081'},
    {code:'ADDR-CHE-01',label:'Ace Chennai Office — Block A, Tidel Park, Taramani, Chennai 600113'},
    {code:'ADDR-PUN-01',label:'Ace Pune Office — 5th Floor, Cerebrum IT Park, Kalyani Nagar, Pune 411014'},
    {code:'ADDR-WH-01',label:'Warehouse — Survey No 45, KIADB Industrial Area, Dobbaspet, Bengaluru 562163'},
    {code:'ADDR-DC-01',label:'Data Centre — Sify Technologies, Rabale MIDC, Navi Mumbai 400701'},
  ];
  let ac=0,as=0;
  for(let i=0;i<addresses.length;i++){
    const a=addresses[i];
    const ex=await p.lookup.findFirst({where:{organizationId:OID,type:'DELIVERY_ADDRESS',code:a.code}});
    if(ex){as++;continue;}
    await p.lookup.create({data:{organizationId:OID,type:'DELIVERY_ADDRESS',code:a.code,label:a.label,sortOrder:i+1,isActive:true}});
    console.log('  Address:',a.code);ac++;
  }
  console.log('Addresses: created='+ac+' skipped='+as);

  // ── 3. OVERVIEW DATA — more requisitions ────────────────────────────────────
  const existingReqs=await p.requisition.count({where:{organizationId:OID}});
  const existingSuppliers=await p.supplier.findMany({where:{organizationId:OID,status:'ACTIVE'},take:10});
  const approver=await p.user.findFirst({where:{organizationId:OID,role:'APPROVER'}});
  
  if(existingReqs<12 && existingSuppliers.length>0){
    const items=[
      {title:'MacBook Pro 14 for Engineering Team',amt:285000,cat:'IT Hardware',st:'SUBMITTED'},
      {title:'Adobe Creative Cloud Annual License 10 seats',amt:95000,cat:'Software & Licenses',st:'MANAGER_APPROVAL'},
      {title:'AWS EC2 Reserved Instances Q3 2025',amt:420000,cat:'Cloud Services',st:'APPROVED'},
      {title:'Office 365 E3 Renewal 50 seats',amt:180000,cat:'Software & Licenses',st:'PO_CREATED'},
      {title:'Network Switch Cisco Catalyst 9300',amt:165000,cat:'Networking',st:'SUBMITTED'},
      {title:'Ergonomic Chairs for Finance Floor 20 units',amt:72000,cat:'Facilities & Infra',st:'APPROVED'},
      {title:'Zoom Meetings Annual Subscription 100 seats',amt:48000,cat:'Software & Licenses',st:'MANAGER_APPROVAL'},
      {title:'Dell PowerEdge Server Upgrade',amt:520000,cat:'IT Hardware',st:'DIRECTOR_APPROVAL'},
      {title:'Salesforce CRM Additional Licenses 5 seats',amt:110000,cat:'Software & Licenses',st:'PO_CREATED'},
      {title:'UPS APC Smart-UPS 3000VA',amt:38000,cat:'Facilities & Infra',st:'DRAFT'},
    ];
    const glAccounts=['6100','6200','6300','6400','6500'];
    let rc=0;
    for(let i=0;i<items.length;i++){
      const item=items[i];
      const supplier=existingSuppliers[i%existingSuppliers.length];
      const daysAgo=Math.floor(Math.random()*25)+1;
      const createdAt=new Date(Date.now()-daysAgo*24*60*60*1000);
      const num='REQ-2025-'+String(existingReqs+rc+1).padStart(3,'0');
      const req=await p.requisition.create({data:{
        organizationId:OID,requestorId:kate.id,requisitionNumber:num,
        title:item.title,category:item.cat,priority:i%3===0?'HIGH':i%3===1?'MEDIUM':'LOW',
        status:item.st,currency:'INR',subtotal:item.amt,totalTax:item.amt*0.18,
        totalAmount:item.amt*1.18,department:'Engineering',
        deliveryLocation:'Ace HQ — 8th Floor, Prestige Tech Park, Bengaluru 560103',
        businessJustification:'Required for business operations.',
        createdAt,updatedAt:createdAt,
      }});
      await p.requisitionLineItem.create({data:{
        requisitionId:req.id,description:item.title,quantity:1,unitPrice:item.amt,
        lineTotal:item.amt,taxRate:0.18,taxAmount:item.amt*0.18,
        supplierId:supplier.id,
        glAccount:glAccounts[i%glAccounts.length],
      }});
      if(item.st!=='DRAFT'&&item.st!=='SUBMITTED'&&approver){
        await p.approvalStep.create({data:{
          requisitionId:req.id,organizationId:OID,sequence:1,stepType:'MANAGER',
          stepLabel:'Line Manager',approverId:approver.id,status:'APPROVED',
          decidedAt:createdAt,comments:'Approved.',
        }});
      }
      rc++;console.log('  Requisition:',num,item.title.substring(0,40));
    }
    console.log('Requisitions created: '+rc);
  } else {
    console.log('Requisitions: already have '+existingReqs+', skipping');
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  const totSup=await p.supplier.count({where:{organizationId:OID}});
  const totReq=await p.requisition.count({where:{organizationId:OID}});
  const totLook=await p.lookup.count({where:{organizationId:OID}});
  console.log('\n=========== SEED COMPLETE ===========');
  console.log('Total Suppliers: '+totSup);
  console.log('Total Requisitions: '+totReq);
  console.log('Total Lookups: '+totLook);
}
main().catch(e=>{console.error('FATAL ERROR:',e.message,e.stack);process.exit(1);}).finally(()=>p.$disconnect());
