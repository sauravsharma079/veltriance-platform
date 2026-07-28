const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
const OID='85c48fe0-7934-4ac6-86ad-07e8e25af811';

const CATALOGS=[
  {
    name:'Lenovo IT Hardware Catalog',type:'HOSTED_CATALOG',provider:'HOSTED',supName:'Lenovo',
    items:[
      {sku:'LEN-X1C-G12',name:'ThinkPad X1 Carbon Gen 12 14-inch i7 16GB 512GB',unitPrice:142000,currency:'INR',category:'IT Hardware',gl:'6100',unit:'Each',leadDays:7,description:'Intel Core Ultra 7, 14in IPS display, fingerprint reader'},
      {sku:'LEN-T14S-G4',name:'ThinkPad T14s Gen 4 AMD Ryzen 7 16GB 512GB',unitPrice:98000,currency:'INR',category:'IT Hardware',gl:'6100',unit:'Each',leadDays:5,description:'Business ultrabook with AMD Ryzen 7 Pro'},
      {sku:'LEN-P16S-G2',name:'ThinkPad P16s Gen 2 Mobile Workstation',unitPrice:175000,currency:'INR',category:'IT Hardware',gl:'6100',unit:'Each',leadDays:10,description:'AMD Ryzen 7 Pro, NVIDIA RTX 500 Ada, 32GB RAM'},
      {sku:'LEN-M90A-AIO',name:'ThinkCentre M90a Gen 3 All-in-One 23.8-inch',unitPrice:89000,currency:'INR',category:'IT Hardware',gl:'6100',unit:'Each',leadDays:7,description:'All-in-one desktop for business users'},
      {sku:'LEN-L27Q-30',name:'ThinkVision L27q-30 27-inch QHD Monitor',unitPrice:32000,currency:'INR',category:'IT Hardware',gl:'6100',unit:'Each',leadDays:3,description:'27in QHD IPS, USB-C connectivity'},
      {sku:'LEN-DOCK-G3',name:'ThinkPad Universal USB-C Smart Dock Gen 3',unitPrice:18500,currency:'INR',category:'IT Hardware',gl:'6100',unit:'Each',leadDays:3,description:'12-in-1 docking station, 100W charging'},
      {sku:'LEN-KBD-PRO',name:'ThinkPad TrackPoint Keyboard II Wireless',unitPrice:8500,currency:'INR',category:'IT Hardware',gl:'6100',unit:'Each',leadDays:2,description:'Wireless keyboard with TrackPoint'},
    ]
  },
  {
    name:'Microsoft Software and Cloud Catalog',type:'HOSTED_CATALOG',provider:'HOSTED',supName:'Microsoft',
    items:[
      {sku:'MS-O365-E3',name:'Microsoft 365 E3 Annual per user',unitPrice:4800,currency:'INR',category:'Software & Licenses',gl:'6200',unit:'User/Year',leadDays:1,description:'Full Office suite plus Teams SharePoint 100GB mailbox'},
      {sku:'MS-O365-E1',name:'Microsoft 365 E1 Annual per user',unitPrice:2400,currency:'INR',category:'Software & Licenses',gl:'6200',unit:'User/Year',leadDays:1,description:'Web apps plus Teams 50GB mailbox'},
      {sku:'MS-WIN-11-PRO',name:'Windows 11 Pro License OEM',unitPrice:15500,currency:'INR',category:'Software & Licenses',gl:'6200',unit:'Each',leadDays:1,description:'Windows 11 Professional OEM license'},
      {sku:'MS-AZURE-D4SV5',name:'Azure Reserved VM D4s v5 1 Year',unitPrice:180000,currency:'INR',category:'Cloud Services',gl:'6300',unit:'Instance/Year',leadDays:1,description:'4 vCPUs 16GB RAM reserved compute'},
      {sku:'MS-DEFENDER-P2',name:'Microsoft Defender for Endpoint P2 Annual per user',unitPrice:3600,currency:'INR',category:'Software & Licenses',gl:'6200',unit:'User/Year',leadDays:1,description:'Endpoint security with threat analytics'},
      {sku:'MS-COPILOT-365',name:'Microsoft 365 Copilot Annual per user',unitPrice:25000,currency:'INR',category:'Software & Licenses',gl:'6200',unit:'User/Year',leadDays:1,description:'AI assistant across Office Teams and more'},
    ]
  },
  {
    name:'Adobe Creative and Document Cloud',type:'HOSTED_CATALOG',provider:'HOSTED',supName:'Adobe',
    items:[
      {sku:'ADO-CC-ALL',name:'Adobe Creative Cloud All Apps Annual per user',unitPrice:18000,currency:'INR',category:'Software & Licenses',gl:'6200',unit:'User/Year',leadDays:1,description:'Photoshop Illustrator Premiere Pro and 20 plus apps'},
      {sku:'ADO-ACRO-PRO',name:'Adobe Acrobat Pro Annual per user',unitPrice:7200,currency:'INR',category:'Software & Licenses',gl:'6200',unit:'User/Year',leadDays:1,description:'Create edit sign and protect PDFs'},
      {sku:'ADO-SIGN-BIZ',name:'Adobe Acrobat Sign Business Annual per user',unitPrice:12000,currency:'INR',category:'Software & Licenses',gl:'6200',unit:'User/Year',leadDays:1,description:'E-signatures and document workflows'},
      {sku:'ADO-STOCK-SM',name:'Adobe Stock Small Plan 10 images per month',unitPrice:8400,currency:'INR',category:'Software & Licenses',gl:'6200',unit:'Year',leadDays:1,description:'10 standard assets per month'},
    ]
  },
  {
    name:'AWS Cloud Services Catalog',type:'HOSTED_CATALOG',provider:'HOSTED',supName:'AWS',
    items:[
      {sku:'AWS-EC2-T3XL-1Y',name:'AWS EC2 Reserved Instance t3.xlarge 1 Year',unitPrice:42000,currency:'INR',category:'Cloud Services',gl:'6300',unit:'Instance/Year',leadDays:1,description:'4 vCPU 16GB RAM standard reserved'},
      {sku:'AWS-EC2-M5-2XL',name:'AWS EC2 Reserved Instance m5.2xlarge 1 Year',unitPrice:95000,currency:'INR',category:'Cloud Services',gl:'6300',unit:'Instance/Year',leadDays:1,description:'8 vCPU 32GB RAM general purpose'},
      {sku:'AWS-S3-10TB',name:'AWS S3 Storage 10TB Annual Commitment',unitPrice:25000,currency:'INR',category:'Cloud Services',gl:'6300',unit:'Year',leadDays:1,description:'Standard storage with lifecycle policies'},
      {sku:'AWS-RDS-MYSQL-LG',name:'AWS RDS MySQL db.r6g.large 1 Year Reserved',unitPrice:68000,currency:'INR',category:'Cloud Services',gl:'6300',unit:'Instance/Year',leadDays:1,description:'2 vCPU 16GB RAM managed MySQL'},
      {sku:'AWS-SUPPORT-BIZ',name:'AWS Business Support Plan Annual',unitPrice:120000,currency:'INR',category:'Cloud Services',gl:'6300',unit:'Year',leadDays:1,description:'24x7 technical support 1hr response critical'},
    ]
  },
  {
    name:'Salesforce CRM Catalog',type:'HOSTED_CATALOG',provider:'HOSTED',supName:'Salesforce',
    items:[
      {sku:'SF-SALES-ENT',name:'Salesforce Sales Cloud Enterprise Annual per user',unitPrice:22000,currency:'INR',category:'Software & Licenses',gl:'6200',unit:'User/Year',leadDays:1,description:'Complete CRM with advanced sales features'},
      {sku:'SF-SERVICE-ENT',name:'Salesforce Service Cloud Enterprise Annual per user',unitPrice:22000,currency:'INR',category:'Software & Licenses',gl:'6200',unit:'User/Year',leadDays:1,description:'Customer service and support platform'},
      {sku:'SF-PLATFORM',name:'Salesforce Platform Annual per user',unitPrice:9600,currency:'INR',category:'Software & Licenses',gl:'6200',unit:'User/Year',leadDays:1,description:'App building on Salesforce platform'},
    ]
  },
];

const PUNCHOUTS=[
  {supName:'Cisco',url:'https://punchout.cisco.com/cxml/posr',protocol:'cXML',secret:'cxml_secret_cisco_001'},
  {supName:'HP',url:'https://ecommerce.hp.com/cxml/punchout',protocol:'cXML',secret:'cxml_secret_hp_001'},
  {supName:'Atlassian',url:'https://marketplace.atlassian.com/punchout/oci',protocol:'OCI',secret:'oci_secret_atlassian_001'},
];

async function main(){
  console.log('Seeding catalogs...');

  const sups=await p.supplier.findMany({where:{organizationId:OID,status:'ACTIVE'}});
  const findSup=function(name){
    return sups.find(function(s){ return s.name.toLowerCase().includes(name.toLowerCase()); })||null;
  };

  var cc=0;
  for(var i=0;i<CATALOGS.length;i++){
    var cat=CATALOGS[i];
    var ex=await p.integration.findFirst({where:{organizationId:OID,name:cat.name}});
    if(ex){ console.log('  Skip (exists):',cat.name); continue; }
    var sup=findSup(cat.supName);
    await p.integration.create({data:{
      organizationId:OID,
      name:cat.name,
      type:cat.type,
      status:'ACTIVE',
      provider:cat.provider,
      config:{
        description:cat.name,
        supplierId:sup?sup.id:null,
        supplierName:sup?sup.name:cat.supName,
        punchoutUrl:null,
        protocol:null,
        items:cat.items,
      },
    }});
    console.log('  Created catalog:',cat.name,'with',cat.items.length,'items');
    cc++;
  }

  var pc=0;
  for(var j=0;j<PUNCHOUTS.length;j++){
    var po=PUNCHOUTS[j];
    var poName=po.supName+' Punchout';
    var pex=await p.integration.findFirst({where:{organizationId:OID,name:poName}});
    if(pex){ console.log('  Skip (exists):',poName); continue; }
    var psup=findSup(po.supName);
    await p.integration.create({data:{
      organizationId:OID,
      name:poName,
      type:'PUNCHOUT',
      status:'ACTIVE',
      provider:po.protocol,
      config:{
        description:po.supName+' punchout integration',
        supplierId:psup?psup.id:null,
        supplierName:psup?psup.name:po.supName,
        punchoutUrl:po.url,
        protocol:po.protocol,
        secret:po.secret,
        items:[],
      },
    }});
    console.log('  Created punchout:',poName);
    pc++;
  }

  var tot=await p.integration.count({where:{organizationId:OID,type:{in:['HOSTED_CATALOG','PUNCHOUT']}}});
  console.log('');
  console.log('=== DONE ===');
  console.log('Catalogs created:',cc);
  console.log('Punchouts created:',pc);
  console.log('Total in DB:',tot);
}

main().catch(function(e){ console.error('FATAL:',e.message); process.exit(1); }).finally(function(){ p.$disconnect(); });
