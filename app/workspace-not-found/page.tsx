import Link from "next/link";

export default function WorkspaceNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0F19] px-4">
      <div className="text-center max-w-sm">
        <div className="size-10 rounded bg-gradient-to-br from-[#1A2A52] to-[#C8A04D] mx-auto mb-5" />
        <h1 className="text-white text-lg font-semibold mb-2">This workspace doesn&apos;t exist</h1>
        <p className="text-white/50 text-sm mb-6">
          We couldn&apos;t find a Veltriance workspace at this address. Double-check the link you were given, or create a new workspace for your company.
        </p>
        <Link
          href={`${process.env.NODE_ENV === "production" ? "https" : "http"}://${process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000"}/create-organization`}
          className="inline-block bg-[#1A2A52] text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-[#243766] transition-colors"
        >
          Create a workspace
        </Link>
      </div>
    </div>
  );
}
