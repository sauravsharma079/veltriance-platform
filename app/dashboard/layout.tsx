import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { GlobalSearch } from "@/components/GlobalSearch";
import { PageAgent } from "@/components/PageAgent";
import { activeModules, isLicenseExpired } from "@/lib/licensing";
import { planLabel, type LicenseModuleKey } from "@/lib/license-catalog";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const result = await getCurrentUser();

  if (!result || !result.profile) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  if (!result.profile.onboardingComplete && !result.impersonating) {
    redirect("/onboarding");
  }

  const org = result.organization;
  const modules = activeModules(org) as LicenseModuleKey[];
  const expired = isLicenseExpired(org);

  return (
    <div className="flex min-h-screen bg-[#F7F8FA]">
      <GlobalSearch />
      <Sidebar
        role={result.profile.role}
        name={result.profile.name}
        email={result.profile.email}
        organizationName={result.organization.name}
        modules={modules}
        planName={planLabel(org.plan)}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        {result.impersonating && (
          <ImpersonationBanner
            userName={result.profile.name}
            userRole={result.profile.role}
            adminName={result.impersonating.realAdmin.name}
          />
        )}
        <main className="flex-1">
          {expired ? (
            <div className="p-8 max-w-xl">
              <h1 className="text-xl font-semibold text-gray-900">Your license has expired</h1>
              <p className="text-sm text-gray-500 mt-2">
                Access to {result.organization.name}&apos;s workspace is paused. Your data is safe —
                contact your account manager to renew and pick up where you left off.
              </p>
            </div>
          ) : children}
        </main>
      </div>
      <PageAgent />
    </div>
  );
}
