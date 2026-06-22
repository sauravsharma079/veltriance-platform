import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const result = await getCurrentUser();

  if (!result || !result.profile) {
    redirect("/login");
  }

  if (!result.profile.onboardingComplete) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-screen bg-[#F7F8FA]">
      <Sidebar
        role={result.profile.role}
        name={result.profile.name}
        email={result.profile.email}
        organizationName={result.organization.name}
      />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
