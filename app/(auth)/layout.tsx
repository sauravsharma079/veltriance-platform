import { getCurrentOrganization } from "@/lib/tenant";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const organization = await getCurrentOrganization();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0F19] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2">
            <div className="size-8 rounded bg-gradient-to-br from-[#1A2A52] to-[#C8A04D]" />
            <span className="text-xl font-semibold text-white tracking-tight">Veltriance</span>
          </div>
          <p className="text-sm text-white/40 mt-1">
            {organization ? organization.name : "Procurement Platform"}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">{children}</div>
      </div>
    </div>
  );
}
