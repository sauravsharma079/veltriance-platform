"use client";
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <html><body style={{ margin: 0, background: "white" }}>{children}</body></html>;
}
