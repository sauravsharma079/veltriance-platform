import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { GlobalSearch } from "@/components/GlobalSearch";
import { PageAgent } from "@/components/PageAgent";

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

  return (
    <div className="flex min-h-screen bg-[#F7F8FA]">
      <GlobalSearch />
      <Sidebar
        role={result.profile.role}
        name={result.profile.name}
        email={result.profile.email}
        organizationName={result.organization.name}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        {result.impersonating && (
          <ImpersonationBanner
            userName={result.profile.name}
            userRole={result.profile.role}
            adminName={result.impersonating.realAdmin.name}
          />
        )}
        <main className="flex-1">{children}</main>
      </div>
      <PageAgent />
    </div>
  );
}
