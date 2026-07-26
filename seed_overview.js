const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
const OID='85c48fe0-7934-4ac6-86ad-07e8e25af811';
async function main(){
  const kate=await p.user.findFirst({where:{email:'Kate@ace.com'}});
  if(!kate){console.error('Kate not found');process.exit(1);}
  const allSups=await p.supplier.findMany({where:{organizationId:OID,status:'ACTIVE'},take:15});
  if(allSups.length===0){console.error('No suppliers - run seed_all.js first');process.exit(1);}
  const existReqs=await p.requisition.count({where:{organizationId:OID}});
  console.log('Existing reqs:',existReqs);
  const items=[
    {title:'MacBook Pro 14 for Engineering — 5 units',amt:1425000,cat:'IT Hardware',st:'PO_CREATED',pri:'HIGH',gl:'6100',days:25,si:0},
    {title:'Adobe Creative Cloud 10 seats Annual',amt:95000,cat:'Software & Licenses',st:'APPROVED',pri:'MEDIUM',gl:'6200',days:18,si:3},
    {title:'AWS Reserved Instances Q3 2025',amt:420000,cat:'Cloud Services',st:'MANAGER_APPROVAL',pri:'HIGH',gl:'6300',days:12,si:4},
    {title:'Office 365 E3 Renewal 50 seats',amt:180000,cat:'Software & Licenses',st:'SUBMITTED',pri:'MEDIUM',gl:'6200',days:8,si:2},
    {title:'Cisco Network Switch Catalyst 9300',amt:165000,cat:'Networking',st:'SUBMITTED',pri:'MEDIUM',gl:'6100',days:5,si:5},
    {title:'Ergonomic Chairs Finance Floor 20 units',amt:72000,cat:'Facilities & Infra',st:'APPROVED',pri:'LOW',gl:'6500',days:15,si:6},
    {title:'Zoom Enterprise 100 seats Annual',amt:48000,cat:'Software & Licenses',st:'PO_CREATED',pri:'LOW',gl:'6200',days:30,si:1},
    {title:'Dell PowerEdge R750 Server',amt:520000,cat:'IT Hardware',st:'DIRECTOR_APPROVAL',pri:'HIGH',gl:'6100',days:3,si:7},
    {title:'Salesforce CRM 5 Additional Licenses',amt:110000,cat:'Software & Licenses',st:'MANAGER_APPROVAL',pri:'MEDIUM',gl:'6200',days:7,si:2},
    {title:'UPS APC Smart-UPS 3000VA for Server Room',amt:38000,cat:'Facilities & Infra',st:'APPROVED',pri:'LOW',gl:'6500',days:20,si:8},
    {title:'GitHub Enterprise 100 seats',amt:290000,cat:'Software & Licenses',st:'PO_CREATED',pri:'HIGH',gl:'6200',days:35,si:3},
    {title:'Lenovo ThinkPad X1 — 3 units for Sales',amt:285000,cat:'IT Hardware',st:'SUBMITTED',pri:'MEDIUM',gl:'6100',days:2,si:2},
  ];
  let rc=0;
  for(let i=0;i<items.length;i++){
    const item=items[i];
    const sup=allSups[item.si%allSups.length];
    const createdAt=new Date(Date.now()-item.days*24*60*60*1000);
    const num='REQ-2025-'+String(existReqs+rc+1).padStart(3,'0');
    const req=await p.requisition.create({data:{
      organizationId:OID,requestorId:kate.id,requisitionNumber:num,
      title:item.title,category:item.cat,priority:item.pri,status:item.st,
      currency:'INR',subtotal:item.amt,totalTax:item.amt*0.18,totalAmount:item.amt*1.18,
      department:['Engineering','Finance','IT','Operations'][i%4],
      deliveryLocation:'Ace HQ — 8th Floor, Prestige Tech Park, Bengaluru 560103',
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
      }});
    }
    if(item.st==='PO_CREATED'){
      const epoc=await p.purchaseOrder.count({where:{organizationId:OID}});
      await p.purchaseOrder.create({data:{
        organizationId:OID,requisitionId:req.id,supplierId:sup.id,
        poNumber:'PO-2025-'+String(epoc+1).padStart(3,'0'),
        status:'SENT',currency:'INR',subtotal:item.amt,
        totalTax:item.amt*0.18,totalAmount:item.amt*1.18,
        paymentTerms:sup.paymentTerms||'Net 30',
        deliveryLocation:'Ace HQ — Bengaluru',
        issuedAt:new Date(createdAt.getTime()+2*86400000),
        createdAt,updatedAt:createdAt,
      }});
    }
    console.log('  Created:',num,item.st,item.title.substring(0,40));rc++;
  }
  const tr=await p.requisition.count({where:{organizationId:OID}});
  const tp=await p.purchaseOrder.count({where:{organizationId:OID}});
  const ts=await p.supplier.count({where:{organizationId:OID}});
  console.log('\n=== SEED COMPLETE ===');
  console.log('Requisitions:',tr,'| POs:',tp,'| Suppliers:',ts);
}
main().catch(e=>{console.error('FATAL:',e.message);process.exit(1);}).finally(()=>p.$disconnect());
