const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
const OID='85c48fe0-7934-4ac6-86ad-07e8e25af811';
async function main(){
  const kate=await p.user.findFirst({where:{email:'Kate@ace.com'}});
  if(!kate){console.error('Kate not found');process.exit(1);}

  // ── LOOKUPS ─────────────────────────────────────────────────────────────────
  const lookups=[
    // Departments
    {t:'DEPARTMENT',c:'ENG',l:'Engineering',s:1},{t:'DEPARTMENT',c:'FIN',l:'Finance',s:2},
    {t:'DEPARTMENT',c:'IT',l:'Information Technology',s:3},{t:'DEPARTMENT',c:'OPS',l:'Operations',s:4},
    {t:'DEPARTMENT',c:'HR',l:'Human Resources',s:5},{t:'DEPARTMENT',c:'MKT',l:'Marketing',s:6},
    {t:'DEPARTMENT',c:'SAL',l:'Sales',s:7},{t:'DEPARTMENT',c:'PRD',l:'Product',s:8},
    // Cost Centers
    {t:'COST_CENTER',c:'CC-1001',l:'Engineering — R&D',s:1},{t:'COST_CENTER',c:'CC-1002',l:'Engineering — Infrastructure',s:2},
    {t:'COST_CENTER',c:'CC-2001',l:'Finance — Corporate',s:3},{t:'COST_CENTER',c:'CC-3001',l:'IT — Operations',s:4},
    {t:'COST_CENTER',c:'CC-4001',l:'HR — Talent & Culture',s:5},{t:'COST_CENTER',c:'CC-5001',l:'Marketing — Brand',s:6},
    // Categories
    {t:'CATEGORY',c:'CAT-IT',l:'IT Hardware',s:1},{t:'CATEGORY',c:'CAT-SW',l:'Software & Licenses',s:2},
    {t:'CATEGORY',c:'CAT-CL',l:'Cloud & Hosting Services',s:3},{t:'CATEGORY',c:'CAT-CS',l:'Consulting Services',s:4},
    {t:'CATEGORY',c:'CAT-FC',l:'Facilities & Infrastructure',s:5},{t:'CATEGORY',c:'CAT-OF',l:'Office Supplies',s:6},
    {t:'CATEGORY',c:'CAT-MK',l:'Marketing & Advertising',s:7},{t:'CATEGORY',c:'CAT-TR',l:'Training & Development',s:8},
    // GL Accounts
    {t:'GL_ACCOUNT',c:'6100',l:'6100 — IT Hardware & Equipment',s:1},
    {t:'GL_ACCOUNT',c:'6200',l:'6200 — Software & Licenses',s:2},
    {t:'GL_ACCOUNT',c:'6300',l:'6300 — Cloud & Hosting Services',s:3},
    {t:'GL_ACCOUNT',c:'6400',l:'6400 — Professional & Consulting Services',s:4},
    {t:'GL_ACCOUNT',c:'6500',l:'6500 — Facilities & Infrastructure',s:5},
    {t:'GL_ACCOUNT',c:'6600',l:'6600 — Office Supplies & Stationery',s:6},
    {t:'GL_ACCOUNT',c:'6700',l:'6700 — Travel & Expenses',s:7},
    {t:'GL_ACCOUNT',c:'6800',l:'6800 — Marketing & Advertising',s:8},
    {t:'GL_ACCOUNT',c:'6900',l:'6900 — Training & Development',s:9},
    // Payment Terms
    {t:'PAYMENT_TERMS',c:'NET15',l:'Net 15 Days',s:1},{t:'PAYMENT_TERMS',c:'NET30',l:'Net 30 Days',s:2},
    {t:'PAYMENT_TERMS',c:'NET45',l:'Net 45 Days',s:3},{t:'PAYMENT_TERMS',c:'NET60',l:'Net 60 Days',s:4},
    {t:'PAYMENT_TERMS',c:'ADV50',l:'50% Advance + 50% on Delivery',s:5},
    // Delivery Addresses
    {t:'DELIVERY_ADDRESS',c:'ADDR-BLR-HQ',l:'Ace HQ — 8th Floor, Prestige Tech Park, Outer Ring Road, Bengaluru 560103',s:1},
    {t:'DELIVERY_ADDRESS',c:'ADDR-DEL-01',l:'Ace Delhi Office — Tower B, 14th Floor, DLF Cyber City, Gurugram 122002',s:2},
    {t:'DELIVERY_ADDRESS',c:'ADDR-MUM-01',l:'Ace Mumbai Office — Level 9, One BKC, Bandra Kurla Complex, Mumbai 400051',s:3},
    {t:'DELIVERY_ADDRESS',c:'ADDR-HYD-01',l:'Ace Hyderabad Office — Plot 12, HITEC City, Madhapur, Hyderabad 500081',s:4},
    {t:'DELIVERY_ADDRESS',c:'ADDR-CHE-01',l:'Ace Chennai Office — Block A, Tidel Park, Taramani, Chennai 600113',s:5},
    {t:'DELIVERY_ADDRESS',c:'ADDR-PUN-01',l:'Ace Pune Office — 5th Floor, Cerebrum IT Park, Kalyani Nagar, Pune 411014',s:6},
    {t:'DELIVERY_ADDRESS',c:'ADDR-WH-01',l:'Warehouse — Survey No 45, KIADB Industrial Area, Dobbaspet, Bengaluru 562163',s:7},
  ];
  let lc=0,ls=0;
  for(const lk of lookups){
    const ex=await p.lookup.findFirst({where:{organizationId:OID,type:lk.t,code:lk.c}});
    if(ex){ls++;continue;}
    await p.lookup.create({data:{organizationId:OID,type:lk.t,code:lk.c,label:lk.l,sortOrder:lk.s,isActive:true}});
    lc++;
  }
  console.log('Lookups: created='+lc+' skipped='+ls);

  // ── FIX EXISTING REQUISITIONS (link to Kate as requestor) ───────────────────
  const reqCount=await p.requisition.count({where:{organizationId:OID}});
  console.log('Existing requisitions:',reqCount);

  // Update any requisitions with null requestorId
  await p.requisition.updateMany({
    where:{organizationId:OID,requestorId:null},
    data:{requestorId:kate.id}
  }).catch(()=>{});

  // ── ADD MORE OVERVIEW DATA if needed ────────────────────────────────────────
  const allSups=await p.supplier.findMany({where:{organizationId:OID,status:'ACTIVE'},take:10});
  if(reqCount<5&&allSups.length>0){
    const items=[
      {title:'MacBook Pro 14 for Engineering — 5 units',amt:1425000,cat:'IT Hardware',st:'PO_CREATED',pri:'HIGH',gl:'6100',si:0,days:25},
      {title:'Adobe Creative Cloud 10 seats Annual',amt:95000,cat:'Software & Licenses',st:'APPROVED',pri:'MEDIUM',gl:'6200',si:3,days:18},
      {title:'AWS Reserved Instances Q3 2025',amt:420000,cat:'Cloud Services',st:'MANAGER_APPROVAL',pri:'HIGH',gl:'6300',si:4,days:12},
      {title:'Office 365 E3 Renewal 50 seats',amt:180000,cat:'Software & Licenses',st:'SUBMITTED',pri:'MEDIUM',gl:'6200',si:2,days:8},
      {title:'Cisco Network Switch Catalyst 9300',amt:165000,cat:'Networking',st:'SUBMITTED',pri:'MEDIUM',gl:'6100',si:5,days:5},
      {title:'Ergonomic Chairs Finance Floor',amt:72000,cat:'Facilities & Infra',st:'APPROVED',pri:'LOW',gl:'6500',si:6,days:15},
      {title:'Zoom Enterprise 100 seats Annual',amt:48000,cat:'Software & Licenses',st:'PO_CREATED',pri:'LOW',gl:'6200',si:1,days:30},
      {title:'Dell PowerEdge R750 Server',amt:520000,cat:'IT Hardware',st:'DIRECTOR_APPROVAL',pri:'HIGH',gl:'6100',si:7,days:3},
    ];
    let rc=0;
    for(let i=0;i<items.length;i++){
      const item=items[i];
      const sup=allSups[item.si%allSups.length];
      const createdAt=new Date(Date.now()-item.days*24*60*60*1000);
      const num='REQ-2025-'+String(reqCount+rc+1).padStart(3,'0');
      const req=await p.requisition.create({data:{
        organizationId:OID,requestorId:kate.id,requisitionNumber:num,
        title:item.title,category:item.cat,priority:item.pri,status:item.st,
        currency:'INR',subtotal:item.amt,totalTax:item.amt*0.18,totalAmount:item.amt*1.18,
        department:['Engineering','Finance','IT','Operations'][i%4],
        deliveryLocation:'Ace HQ — Prestige Tech Park, Bengaluru 560103',
        businessJustification:'Required for business operations and productivity.',
        createdAt,updatedAt:createdAt,
      }});
      await p.requisitionLineItem.create({data:{
        requisitionId:req.id,description:item.title,quantity:1,unitPrice:item.amt,
        lineTotal:item.amt,taxRate:0.18,taxAmount:item.amt*0.18,
        supplierId:sup.id,glAccount:item.gl,
      }});
      if(['APPROVED','PO_CREATED','DIRECTOR_APPROVAL'].includes(item.st)){
        await p.approvalStep.create({data:{
          requisitionId:req.id,organizationId:OID,sequence:1,stepType:'MANAGER',
          stepLabel:'Line Manager',approverId:kate.id,status:'APPROVED',
          decidedAt:new Date(createdAt.getTime()+86400000),comments:'Approved.',
        }}).catch(()=>{});
      }
      if(item.st==='PO_CREATED'){
        const poc=await p.purchaseOrder.count({where:{organizationId:OID}});
        await p.purchaseOrder.create({data:{
          organizationId:OID,requisitionId:req.id,supplierId:sup.id,
          poNumber:'PO-2025-'+String(poc+1).padStart(3,'0'),
          status:'SENT',currency:'INR',subtotal:item.amt,
          totalTax:item.amt*0.18,totalAmount:item.amt*1.18,
          paymentTerms:sup.paymentTerms||'Net 30',
          deliveryLocation:'Ace HQ — Bengaluru',
          issuedAt:new Date(createdAt.getTime()+2*86400000),
          createdAt,updatedAt:createdAt,
        }}).catch(()=>{});
      }
      console.log('  Req:',num,item.st);rc++;
    }
    console.log('Requisitions created:',rc);
  }

  // ── FIX OVERVIEW API ─────────────────────────────────────────────────────────
  const totSup=await p.supplier.count({where:{organizationId:OID,status:'ACTIVE'}});
  const totReq=await p.requisition.count({where:{organizationId:OID}});
  const totPO=await p.purchaseOrder.count({where:{organizationId:OID}});
  const totLook=await p.lookup.count({where:{organizationId:OID}});
  console.log('\n=== FINAL COUNTS ===');
  console.log('Active Suppliers:',totSup);
  console.log('Requisitions:',totReq);
  console.log('Purchase Orders:',totPO);
  console.log('Lookups:',totLook);
}
main().catch(e=>{console.error('FATAL:',e.message);process.exit(1);}).finally(()=>p.$disconnect());
