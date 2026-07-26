
# Veltriance Platform — Client Demo Guide
## Nexcore Technologies Use Case

---

## THE STORY

**Nexcore Technologies** is a fast-growing Indian IT company about to launch a FinTech product.  
They need to equip **5 new engineers** urgently with laptops, software, and cloud infrastructure —  
totalling **₹25 lakh** across 3 purchase requests.

**What you will demonstrate:**
✅ End-to-end procurement (Requisition → Approval → Purchase Order)  
✅ Multi-level approval workflow with business rules  
✅ Real-time spend visibility on the dashboard  
✅ Supplier management and vendor directory  
✅ ERP + platform integrations (Coupa, SAP, Oracle, Dynamics)  

---

## PRE-DEMO SETUP (5 mins before meeting)

1. Open browser, go to: `http://localhost:3000`
2. Log in as: `arjun.sharma@nexcore.in` (Admin/IT Head)
3. The dashboard should show all seed data
4. Keep these tabs open:
   - Tab 1: Dashboard
   - Tab 2: Approvals  
   - Tab 3: Requisitions

---

## DEMO SCRIPT (25 minutes)

### 1. DASHBOARD — "This is your command centre" (3 mins)

> *"The moment Arjun logs in, he sees everything that matters — no spreadsheets, no emails."*

**Point out:**
- **₹26.45L total spend** — real-time, no manual reporting
- **2 pending approvals** — flagged for immediate action
- **5 active suppliers** — verified vendor directory
- **2 open POs** — live delivery tracking
- Spend trend chart — 6-month view, shows growth
- Spend by category — Hardware vs Cloud vs Software at a glance
- Pending Approvals panel — Microsoft 365 renewal is URGENT (3 days to expiry)

---

### 2. CREATE NEW REQUISITION — "Let's create a live request" (8 mins)

> *"Vikram, a senior engineer, needs 5 laptops for the product launch team."*

Click **New Request** →

**Step 1 — What do you need?**
- Title: `Laptop Setup — Product Launch Team`
- Category: `IT Hardware`
- Priority: `HIGH`
- Required by: [select next week's date]
- Justification: `5 engineers joining for FinTech launch. Equipment needed by Day 1.`

**Step 2 — Line items** (add these):
| Item | Qty | Unit Price |
|------|-----|-----------|
| Apple MacBook Pro M3 14-inch | 5 | ₹1,25,000 |
| Microsoft 365 Business (annual) | 5 | ₹5,400 |
| USB-C Hub + Accessories | 5 | ₹8,500 |

*Point out: Total auto-calculates, GST computed automatically — ₹7,67,900 incl. tax*

**Step 3 — Delivery & GL**
- Supplier: Dell Technologies India
- Delivery: Nexcore HQ, Hyderabad
- GL Coding: Business Area: ENG | Cost Centre: CC002 | GL Account: 6100

Click **Submit for Approval** →

> *"The system instantly identifies the right approval chain — this is above ₹5L, so it goes to the Engineering Director and Finance Controller automatically."*

---

### 3. APPROVAL WORKFLOW — "The right people see it instantly" (5 mins)

> *"Switch to Rahul's view — he's the Engineering Director."*

Click **Approvals** in sidebar →

- Show the new request at the top — `HIGH` priority, ₹7.67L
- Click into it — full details, line items, GL coding, justification all visible
- Click **Approve** → add comment: `Confirmed — critical for Q3 launch`

> *"Now it goes to Finance. Sneha sees it next."*

- Filter/show the Finance step  
- Click **Approve** → `Budget available in CC002`

> *"Approved in under 2 minutes. In a traditional setup, this would take 3-5 days of emails."*

---

### 4. PURCHASE ORDER — "One click to PO" (3 mins)

Go to **Requisitions** → click the approved request →

Click **Create Purchase Order** →

- PO number auto-generated: `PO-2025-003`
- Supplier, line items, amounts pre-filled
- Payment terms: Net 30
- Routing: Email to `enterprise@dell.com`

Click **Send to Supplier** →

> *"The PO is out. Dell gets it immediately. Status changes to SENT — visible to everyone in real time."*

Go back to **Dashboard** — point out the metrics have updated.

---

### 5. SUPPLIER DIRECTORY (2 mins)

Click **Suppliers** →

> *"All vendors are pre-verified and tiered. No more emailing purchasing to 'check if we have a vendor for X'."*

Click **Dell Technologies India** →
- Show: rating 92/100, on-time delivery 95%, risk score: LOW
- Show: contact details, payment terms, tier classification

---

### 6. INTEGRATIONS — "Connects to everything you already use" (3 mins)

Click **Connections** →

> *"Veltriance doesn't replace your ERP — it connects to it. Whether you're on SAP, Oracle, NetSuite, or Dynamics 365."*

Click **SAP S/4HANA** card →
- Show the configuration panel
- *"Once connected, POs flow directly into SAP MM module. COA, vendor master, GL accounts all sync automatically."*

Click **Coupa** card →
- *"If you're already on Coupa for some spend categories, Veltriance integrates — no double entry."*

Click **Slack** card →
- *"Your approvers get approval requests directly in Slack — no need to log into another system."*

---

### 7. ADMIN — "Built for your business rules" (1 min)

Click **Admin** →

> *"Approval chains, roles, chart of accounts, cost centres, custom fields — all configurable by your admin, not by us. You own it."*

Show:
- Approval Rules: 3-tier system (₹5L / ₹25L / Above)
- Roles & Permissions: REQUESTOR, APPROVER, PROCUREMENT, ADMIN
- Chart of Accounts: India Operations COA with 4 segments

---

## KEY VALUE POINTS TO HIT

| Problem | Veltriance Solution |
|---------|-------------------|
| "We track POs in Excel" | Real-time dashboard, automated PO creation |
| "Approvals take a week" | Rule-based workflow, mobile-friendly, Slack integration |
| "We don't know our spend" | Live spend analytics by category, supplier, cost centre |
| "Our SAP/Oracle is complex" | Veltriance sits on top — user-friendly front end |
| "Custom fields for our process" | Fully configurable — no code changes |
| "Vendor risk is a black box" | Supplier scorecard, risk scoring, tier management |

---

## QUESTIONS TO EXPECT

**"How does it integrate with our ERP?"**  
> "We have native connectors for SAP S/4HANA, Oracle ERP, NetSuite, and Dynamics 365. Once connected, POs, vendor master, and GL data sync bi-directionally. We can show you the technical API documentation."

**"How long to implement?"**  
> "A standard deployment is 6–8 weeks. We handle data migration, configuration, and training. Your team is live before the first PO."

**"What about data security?"**  
> "Multi-tenant architecture — your data is completely isolated. SOC 2 Type I certification in progress. Hosted on Vercel + Supabase (AWS) with enterprise-grade encryption."

**"Can we customise approval chains?"**  
> "Fully. You define conditions — amount thresholds, category, department, any combination. No code required."

**"How is this better than SAP Ariba?"**  
> "Ariba is built for Fortune 500 — complex, expensive, 18-month implementation. Veltriance is built for mid-market India enterprises — 6 weeks to go live, fraction of the cost, and we integrate WITH Ariba if you already use it."

---

## DEMO TIPS

- Go **slow on the approval flow** — this is the most impressive part  
- Let them click around — it's responsive and fast  
- Mention INR support, GST auto-calculation, Indian COA structure  
- Emphasise: "No training required — your team can use this today"  
- End with: "What part of your current procurement process causes you the most pain?"
