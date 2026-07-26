const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
const OID='85c48fe0-7934-4ac6-86ad-07e8e25af811';
async function main(){
  const kate=await p.user.findFirst({where:{email:'Kate@ace.com'}});
  if(!kate){console.error('Kate not found');process.exit(1);}
  const sups=[
    {n:'Tata Consultancy Services',c:'SUP-101',cat:'IT Services',ci:'Mumbai',t:'Tier 1',r:92,ri:'LOW',rs:8,ce:'vendor@tcs.com',cn:'Amit Verma',pt:'Net 30'},
    {n:'HCL Technologies Ltd.',c:'SUP-102',cat:'IT Hardware',ci:'Noida',t:'Tier 1',r:88,ri:'LOW',rs:12,ce:'procurement@hcl.com',cn:'Pradeep Sharma',pt:'Net 30'},
    {n:'Lenovo India Pvt. Ltd.',c:'SUP-103',cat:'IT Hardware',ci:'Bengaluru',t:'Tier 1',r:91,ri:'LOW',rs:10,ce:'orders@lenovo.com',cn:'Sunil Mehta',pt:'Net 30'},
    {n:'Adobe Systems India',c:'SUP-104',cat:'Software & Licenses',ci:'Bengaluru',t:'Tier 1',r:96,ri:'LOW',rs:5,ce:'india@adobe.com',cn:'Neha Kapoor',pt:'Net 45'},
    {n:'Google Cloud India',c:'SUP-105',cat:'Cloud Services',ci:'Hyderabad',t:'Tier 1',r:97,ri:'LOW',rs:4,ce:'gcp@google.com',cn:'Rohan Das',pt:'Net 30'},
    {n:'Accenture Solutions',c:'SUP-106',cat:'Consulting',ci:'Mumbai',t:'Tier 1',r:87,ri:'LOW',rs:15,ce:'vendor@accenture.com',cn:'Kavita Rao',pt:'Net 45'},
    {n:'HP India Sales Pvt. Ltd.',c:'SUP-107',cat:'IT Hardware',ci:'Bengaluru',t:'Tier 2',r:85,ri:'LOW',rs:18,ce:'enterprise@hp.com',cn:'Manish Tiwari',pt:'Net 30'},
    {n:'Salesforce India Pvt. Ltd.',c:'SUP-108',cat:'Software & Licenses',ci:'Hyderabad',t:'Tier 1',r:94,ri:'LOW',rs:6,ce:'india@salesforce.com',cn:'Divya Menon',pt:'Net 45'},
    {n:'IBM India Pvt. Ltd.',c:'SUP-109',cat:'Consulting',ci:'Bengaluru',t:'Tier 1',r:90,ri:'LOW',rs:11,ce:'vendor@ibm.com',cn:'Sanjay Gupta',pt:'Net 45'},
    {n:'Atlassian India Pvt. Ltd.',c:'SUP-110',cat:'Software & Licenses',ci:'Bengaluru',t:'Tier 1',r:95,ri:'LOW',rs:5,ce:'india@atlassian.com',cn:'Aisha Khan',pt:'Net 30'},
    {n:'Microsoft India Pvt. Ltd.',c:'SUP-111',cat:'Software & Licenses',ci:'Hyderabad',t:'Tier 1',r:98,ri:'LOW',rs:3,ce:'enterprise@microsoft.com',cn:'Priya Menon',pt:'Net 30'},
    {n:'Cisco Systems India',c:'SUP-112',cat:'Networking',ci:'Bengaluru',t:'Tier 1',r:93,ri:'LOW',rs:7,ce:'cisco@cisco.com',cn:'Vikram Nair',pt:'Net 45'},
    {n:'AWS India Pvt. Ltd.',c:'SUP-113',cat:'Cloud Services',ci:'Hyderabad',t:'Tier 1',r:97,ri:'LOW',rs:4,ce:'aws@amazon.com',cn:'Sneha Rao',pt:'Net 30'},
    {n:'Wipro Ltd.',c:'SUP-114',cat:'IT Services',ci:'Bengaluru',t:'Tier 1',r:89,ri:'LOW',rs:14,ce:'vendor@wipro.com',cn:'Arjun Singh',pt:'Net 45'},
    {n:'Dell Technologies India',c:'SUP-115',cat:'IT Hardware',ci:'Bengaluru',t:'Tier 1',r:91,ri:'LOW',rs:9,ce:'enterprise@dell.com',cn:'Ravi Kumar',pt:'Net 30'},
    {n:'Zoom Video India',c:'SUP-116',cat:'Software & Licenses',ci:'Hyderabad',t:'Tier 2',r:88,ri:'LOW',rs:12,ce:'enterprise@zoom.us',cn:'Meera Patel',pt:'Net 30'},
    {n:'Tata Communications',c:'SUP-117',cat:'Cloud Services',ci:'Mumbai',t:'Tier 1',r:86,ri:'LOW',rs:16,ce:'enterprise@tatacommunications.com',cn:'Ashok Pillai',pt:'Net 30'},
    {n:'Infosys BPM Ltd.',c:'SUP-118',cat:'IT Services',ci:'Pune',t:'Tier 2',r:87,ri:'LOW',rs:16,ce:'vendor@infosys.com',cn:'Kavya Sharma',pt:'Net 30'},
    {n:'Bharti Airtel Business',c:'SUP-119',cat:'Telecom',ci:'Delhi',t:'Tier 2',r:82,ri:'LOW',rs:21,ce:'enterprise@airtel.com',cn:'Rahul Bajaj',pt:'Net 30'},
    {n:'Siemens India Ltd.',c:'SUP-120',cat:'Facilities & Infra',ci:'Mumbai',t:'Tier 2',r:83,ri:'MEDIUM',rs:25,ce:'vendor@siemens.com',cn:'Rahul Pillai',pt:'Net 45'},
  ];
  let sc=0;
  for(const s of sups){
    const ex=await p.supplier.findFirst({where:{organizationId:OID,code:s.c}});
    if(ex){continue;}
    await p.supplier.create({data:{organizationId:OID,name:s.n,code:s.c,status:'ACTIVE',onboardingStage:'ACTIVE',category:s.cat,city:s.ci,country:'India',tier:s.t,preferred:s.t==='Tier 1',rating:s.r,onTimeDelivery:s.r-3,qualityScore:s.r-2,invoiceAccuracy:Math.min(s.r+1,100),responsivenessScore:s.r-4,riskLevel:s.ri,riskScore:s.rs,contactName:s.cn,contactEmail:s.ce,currency:'INR',paymentTerms:s.pt,requestedById:kate.id}});
    console.log('  Supplier:',s.c,s.n);sc++;
  }
  console.log('Suppliers created:',sc);
  const addrs=[
    {code:'ADDR-BLR-HQ',label:'Ace HQ — 8th Floor, Prestige Tech Park, Outer Ring Road, Bengaluru 560103'},
    {code:'ADDR-DEL-01',label:'Ace Delhi Office — Tower B, 14th Floor, DLF Cyber City, Gurugram 122002'},
    {code:'ADDR-MUM-01',label:'Ace Mumbai Office — Level 9, One BKC, Bandra Kurla Complex, Mumbai 400051'},
    {code:'ADDR-HYD-01',label:'Ace Hyderabad Office — Plot 12, HITEC City, Madhapur, Hyderabad 500081'},
    {code:'ADDR-CHE-01',label:'Ace Chennai Office — Block A, Tidel Park, Taramani, Chennai 600113'},
    {code:'ADDR-PUN-01',label:'Ace Pune Office — 5th Floor, Cerebrum IT Park, Kalyani Nagar, Pune 411014'},
    {code:'ADDR-WH-01',label:'Warehouse — Survey No 45, KIADB Industrial Area, Dobbaspet, Bengaluru 562163'},
    {code:'ADDR-DC-01',label:'Data Centre — Sify Technologies, Rabale MIDC, Navi Mumbai 400701'},
  ];
  let ac=0;
  for(let i=0;i<addrs.length;i++){
    const a=addrs[i];
    const ex=await p.lookup.findFirst({where:{organizationId:OID,type:'DELIVERY_ADDRESS',code:a.code}});
    if(ex) continue;
    await p.lookup.create({data:{organizationId:OID,type:'DELIVERY_ADDRESS',code:a.code,label:a.label,sortOrder:i+1,isActive:true}});
    console.log('  Address:',a.code);ac++;
  }
  console.log('Addresses created:',ac);
  const allSups=await p.supplier.findMany({where:{organizationId:OID,status:'ACTIVE'},take:15});
  const existReqs=await p.requisition.count({where:{organizationId:OID}});
  console.log('Existing requisitions:',existReqs);
  if(existReqs<8&&allSups.length>0){
    const items=[
      {title:'MacBook Pro 14 Engineering — 5 units',amt:1425000,cat:'IT Hardware',st:'PO_CREATED',pri:'HIGH',gl:'6100',days:25},
      {title:'Adobe Creative Cloud 10 seats Annual',amt:95000,cat:'Software & Licenses',st:'APPROVED',pri:'MEDIUM',gl:'6200',days:18},
      {title:'AWS Reserved Instances Q3 2025',amt:420000,cat:'Cloud Services',st:'MANAGER_APPROVAL',pri:'HIGH',gl:'6300',days:12},
      {title:'Office 365 E3 Renewal 50 seats',amt:180000,cat:'Software & Licenses',st:'SUBMITTED',pri:'MEDIUM',gl:'6200',days:8},
      {title:'Cisco Network Switch Catalyst 9300',amt:165000,cat:'Networking',st:'SUBMITTED',pri:'MEDIUM',gl:'6100',days:5},
      {title:'Ergonomic Chairs Finance Floor 20 units',amt:72000,cat:'Facilities & Infra',st:'APPROVED',pri:'LOW',gl:'6500',days:15},
      {title:'Zoom Enterprise 100 seats Annual',amt:48000,cat:'Software & Licenses',st:'PO_CREATED',pri:'LOW',gl:'6200',days:30},
      {title:'Dell PowerEdge R750 Server',amt:520000,cat:'IT Hardware',st:'DIRECTOR_APPROVAL',pri:'HIGH',gl:'6100',days:3},
    ];
    let rc=0;
    for(let i=0;i<items.length;i++){
      const item=items[i];const sup=allSups[i%allSups.length];
      const createdAt=new Date(Date.now()-item.days*24*60*60*1000);
      const num='REQ-2025-'+String(existReqs+rc+1).padStart(3,'0');
      const req=await p.requisition.create({data:{organizationId:OID,requestorId:kate.id,requisitionNumber:num,title:item.title,category:item.cat,priority:item.pri,status:item.st,currency:'INR',subtotal:item.amt,totalTax:item.amt*0.18,totalAmount:item.amt*1.18,department:'Engineering',deliveryLocation:'Ace HQ — 8th Floor, Prestige Tech Park, Bengaluru',businessJustification:'Required for business operations.',createdAt,updatedAt:createdAt}});
      await p.requisitionLineItem.create({data:{requisitionId:req.id,description:item.title,quantity:1,unitPrice:item.amt,lineTotal:item.amt,taxRate:0.18,taxAmount:item.amt*0.18,supplierId:sup.id,glAccount:item.gl}});
      if(['APPROVED','PO_CREATED','DIRECTOR_APPROVAL'].includes(item.st)){
        await p.approvalStep.create({data:{requisitionId:req.id,organizationId:OID,sequence:1,stepType:'MANAGER',stepLabel:'Line Manager',approverId:kate.id,status:'APPROVED',decidedAt:new Date(createdAt.getTime()+86400000),comments:'Approved.'}});
      }
      if(item.st==='PO_CREATED'){
        const epoc=await p.purchaseOrder.count({where:{organizationId:OID}});
        await p.purchaseOrder.create({data:{organizationId:OID,requisitionId:req.id,supplierId:sup.id,poNumber:'PO-2025-'+String(epoc+1).padStart(3,'0'),status:'SENT',currency:'INR',subtotal:item.amt,totalTax:item.amt*0.18,totalAmount:item.amt*1.18,paymentTerms:sup.paymentTerms||'Net 30',deliveryLocation:'Ace HQ — Bengaluru',issuedAt:new Date(createdAt.getTime()+2*86400000),createdAt,updatedAt:createdAt}});
      }
      console.log('  Req:',num,item.st);rc++;
    }
    console.log('Requisitions created:',rc);
  }
  const ts=await p.supplier.count({where:{organizationId:OID}});
  const tr=await p.requisition.count({where:{organizationId:OID}});
  const tp=await p.purchaseOrder.count({where:{organizationId:OID}});
  const ta=await p.lookup.count({where:{organizationId:OID,type:'DELIVERY_ADDRESS'}});
  console.log('\n=== DONE ===');
  console.log('Suppliers:',ts,'| Requisitions:',tr,'| POs:',tp,'| Addresses:',ta);
}
main().catch(e=>{console.error('FATAL:',e.message);process.exit(1);}).finally(()=>p.$disconnect());
