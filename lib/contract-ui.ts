// Presentation constants shared by the contract pages (client-safe).
export const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600", NEGOTIATION: "bg-blue-50 text-blue-700", PENDING_APPROVAL: "bg-amber-50 text-amber-700",
  PENDING_SIGNATURE: "bg-purple-50 text-purple-700", ACTIVE: "bg-emerald-50 text-emerald-700",
  EXPIRED: "bg-orange-50 text-orange-700", TERMINATED: "bg-red-50 text-red-700", CANCELLED: "bg-gray-100 text-gray-400",
};
export const CONTRACT_TYPE_OPTIONS = [
  ["MSA", "Master Services Agreement"], ["NDA", "Non-Disclosure Agreement"], ["SOW", "Statement of Work"],
  ["PURCHASE_AGREEMENT", "Purchase Agreement"], ["SLA", "Service Level Agreement"], ["OTHER", "Other"],
] as const;
export const statusLabel = (s: string) => s.replace(/_/g, " ").toLowerCase();
