const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
const OID='85c48fe0-7934-4ac6-86ad-07e8e25af811';
async function main(){
  const sups=await p.supplier.findMany({where:{organizationId:OID,status:'ACTIVE'},take:6});
  if(!sups.length){console.log('No suppliers found');return;}
  const S=(n)=>sups.find(s=>s.name.toLowerCase().includes(n.toLowerCase()))||sups[0];

  const catalogs=[
    {
      name:'Lenovo IT Hardware Catalog',type:'HOSTED_CATALOG',provider:'HOSTED',
      sup:S('Lenovo'),items:[
        {sku:'LEN-X1C-G12',name:'ThinkPad X1 Carbon Gen 12 (14", i7, 16GB, 512GB)',unitPrice:142000,currency:'INR',category:'IT Hardware',gl:'6100',unit:'Each',leadDays:7,description:'Intel Core Ultra 7, 14" IPS display, fingerprint reader'},
        {sku:'LEN-T14S-G4',name:'ThinkPad T14s Gen 4 (AMD Ryzen 7, 16GB, 512GB)',unitPrice:98000,currency:'INR',category:'IT Hardware',gl:'6100',unit:'Each',leadDays:5,description:'Business ultrabook with AMD Ryzen 7 Pro'},
        {sku:'LEN-P16S-G2',name:'ThinkPad P16s Gen 2 Mobile Workstation',unitPrice:175000,currency:'INR',category:'IT Hardware',gl:'6100',unit:'Each',leadDays:10,description:'AMD Ryzen 7 Pro, NVIDIA RTX 500 Ada, 32GB RAM'},
        {sku:'LEN-M14-AIO',name:'ThinkCentre M90a Gen 3 All-in-One (23.8")',unitPrice:89000,currency:'INR',category:'IT Hardware',gl:'6100',unit:'Each',leadDays:7,description:'All-in-one desktop for business users'},
        {sku:'LEN-L27Q-30',name:'ThinkVision L27q-30 27" QHD Monitor',unitPrice:32000,currency:'INR',category:'IT Hardware',gl:'6100',unit:'Each',leadDays:3,description:'27" QHD IPS, USB-C connectivity'},
        {sku:'LEN-DOCK-G3',name:'ThinkPad Universal USB-C Smart Dock Gen 3',unitPrice:18500,currency:'INR',category:'IT Hardware',gl:'6100',unit:'Each',leadDays:3,description:'12-in-1 docking station, 100W charging'},
        {sku:'LEN-KBD-PRO',name:'ThinkPad TrackPoint Keyboard II',unitPrice:8500,currency:'INR',category:'IT Hardware',gl:'6100',unit:'Each',leadDays:2,description:'Wireless keyboard with TrackPoint'},
      ]
    },
    {
      name:'Microsoft Software & Cloud Catalog',type:'HOSTED_CATALOG',provider:'HOSTED',
      sup:S('Microsoft'),items:[
        {sku:'MS-O365-E3',name:'Microsoft 365 E3 (Annual, per user)',unitPrice:4800,currency:'INR',category:'Software & Licenses',gl:'6200',unit:'User/Year',leadDays:1,description:'Full Office suite + Teams + SharePoint + 100GB mailbox'},
        {sku:'MS-O365-E1',name:'Microsoft 365 E1 (Annual, per user)',unitPrice:2400,currency:'INR',category:'Software & Licenses',gl:'6200',unit:'User/Year',leadDays:1,description:'Web apps + Teams + 50GB mailbox'},
        {sku:'MS-WIN-11-PRO',name:'Windows 11 Pro License',unitPrice:15500,currency:'INR',category:'Software & Licenses',gl:'6200',unit:'Each',leadDays:1,description:'Windows 11 Professional OEM license'},
        {sku:'MS-AZURE-001',name:'Azure Reserved VM Instances (1 Year, D4s v5)',unitPrice:180000,currency:'INR',category:'Cloud Services',gl:'6300',unit:'Instance/Year',leadDays:1,description:'4 vCPUs, 16GB RAM reserved compute'},
        {sku:'MS-DEFENDER',name:'Microsoft Defender for Endpoint P2 (Annual, per user)',unitPrice:3600,currency:'INR',category:'Software & Licenses',gl:'6200',unit:'User/Year',leadDays:1,description:'Endpoint security with threat analytics'},
        {sku:'MS-COPILOT',name:'Microsoft 365 Copilot (Annual, per user)',unitPrice:25000,currency:'INR',category:'Software & Licenses',gl:'6200',unit:'User/Year',leadDays:1,description:'AI assistant across Office, Teams & more'},
      ]
    },
    {
      name:'Adobe Creative & Document Cloud',type:'HOSTED_CATALOG',provider:'HOSTED',
      sup:S('Adobe'),items:[
        {sku:'ADO-CC-ALL',name:'Adobe Creative Cloud All Apps (Annual, per user)',unitPrice:18000,currency:'INR',category:'Software & Licenses',gl:'6200',unit:'User/Year',leadDays:1,description:'Photoshop, Illustrator, Premiere Pro, and 20+ more'},
        {sku:'ADO-ACRO-PRO',name:'Adobe Acrobat Pro (Annual, per user)',unitPrice:7200,currency:'INR',category:'Software & Licenses',gl:'6200',unit:'User/Year',leadDays:1,description:'Create, edit, sign and protect PDFs'},
        {sku:'ADO-SIGN',name:'Adobe Acrobat Sign Business (Annual, per user)',unitPrice:12000,currency:'INR',category:'Software & Licenses',gl:'6200',unit:'User/Year',leadDays:1,description:'E-signatures and document workflows'},
        {sku:'ADO-STOCK-SM',name:'Adobe Stock Small Plan (10 images/month)',unitPrice:8400,currency:'INR',category:'Software & Licenses',gl:'6200',unit:'Year',leadDays:1,description:'10 standard assets per month'},
      ]
    },
    {
      name:'AWS Cloud Services Catalog',type:'HOSTED_CATALOG',provider:'HOSTED',
      sup:S('AWS'),items:[
        {sku:'AWS-EC2-R1Y',name:'AWS EC2 Reserved Instance — t3.xlarge (1 Year)',unitPrice:42000,currency:'INR',category:'Cloud Services',gl:'6300',unit:'Instance/Year',leadDays:1,description:'4 vCPU, 16GB RAM — standard reserved'},
        {sku:'AWS-EC2-M5-R1',name:'AWS EC2 Reserved Instance — m5.2xlarge (1 Year)',unitPrice:95000,currency:'INR',category:'Cloud Services',gl:'6300',unit:'Instance/Year',leadDays:1,description:'8 vCPU, 32GB RAM — general purpose'},
        {sku:'AWS-S3-10TB',name:'AWS S3 Storage — 10TB Annual Commitment',unitPrice:25000,currency:'INR',category:'Cloud Services',gl:'6300',unit:'Year',leadDays:1,description:'Standard storage with lifecycle policies'},
        {sku:'AWS-RDS-MYSQL',name:'AWS RDS MySQL db.r6g.large (1 Year Reserved)',unitPrice:68000,currency:'INR',category:'Cloud Services',gl:'6300',unit:'Instance/Year',leadDays:1,description:'2 vCPU, 16GB RAM managed MySQL'},
        {sku:'AWS-SUPPORT-B',name:'AWS Business Support Plan',unitPrice:120000,currency:'INR',category:'Cloud Services',gl:'6300',unit:'Year',leadDays:1,description:'24/7 technical support, <1hr response for critical'},
      ]
    },
  ];

  // Punchout configs
  const punchouts=[
    {sup:S('Cisco'),url:'https://punchout.cisco.com/cxml/posr',protocol:'cXML',secret:'cxml_secret_cisco_001'},
    {sup:S('HP'),url:'https://ecommerce.hp.com/cxml/punchout',protocol:'cXML',secret:'cxml_secret_hp_001'},
    {sup:S('Salesforce'),url:'https://store.salesforce.com/oci/punchout',protocol:'OCI',secret:'oci_secret_sf_001'},
  ];

  let cc=0,pc=0;
  for(const cat of catalogs){
    const ex=await p.integration.findFirst({where:{organizationId:OID,name:cat.name}});
    if(ex){continue;}
    await p.integration.create({data:{
      organizationId:OID,name:cat.name,type:cat.type,
      status:'ACTIVE',provider:cat.provider,
      config:{
        description:cat.name,
        supplierId:cat.sup?.id||null,
        supplierName:cat.sup?.name||'',
        items:cat.items,
      },
    }});
    console.log('  Catalog:',cat.name,'('+cat.items.length+' items)');cc++;
  }
  for(const po of punchouts){
    const name=po.sup?.name+' Punchout';
    const ex=await p.integration.findFirst({where:{organizationId:OID,name}});
    if(ex){continue;}
    await p.integration.create({data:{
      organizationId:OID,name,type:'PUNCHOUT',
      status:'ACTIVE',provider:po.protocol,
      config:{
        supplierId:po.sup?.id||null,
        supplierName:po.sup?.name||'',
        punchoutUrl:po.url,
        protocol:po.protocol,
        secret:po.secret,
        items:[],
      },
    }});
    console.log('  Punchout:',name);pc++;
  }
  const tot=await p.integration.count({where:{organizationId:OID,type:{in:['HOSTED_CATALOG','PUNCHOUT']}}});
  console.log('
Catalogs created:'+cc+' Punchouts created:'+pc+' Total:'+tot);
}
main().catch(e=>{console.error('FATAL:',e.message);process.exit(1);}).finally(()=>p.$disconnect());
