"use client";
import { SupplierAgent } from "@/components/SupplierAgent";

export default function SuppliersLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SupplierAgent />
    </>
  );
}
