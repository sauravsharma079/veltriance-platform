import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentSlug, getCurrentOrganization } from "@/lib/tenant";

export default async function Home() {
  const slug = await getCurrentSlug();

  // Root domain — no tenant context. The only thing to do here is create one.
  if (!slug) {
    redirect("/create-organization");
  }

  const organization = await getCurrentOrganization();
  if (!organization) {
    redirect("/workspace-not-found");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/dashboard" : "/login");
}
