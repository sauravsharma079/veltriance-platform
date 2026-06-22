import Link from "next/link";
import { MessageSquareText, ListChecks } from "lucide-react";

export default function IntakePage() {
  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-xl font-semibold text-gray-900">New request</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">Choose how you&apos;d like to submit your request.</p>

      <div className="grid sm:grid-cols-2 gap-4">
        <Link
          href="/dashboard/intake/chat"
          className="group bg-white border border-gray-200 rounded-xl p-6 hover:border-[#1A2A52] hover:shadow-sm transition-all"
        >
          <div className="size-10 rounded-lg bg-[#1A2A52]/10 flex items-center justify-center mb-4 group-hover:bg-[#1A2A52]/15">
            <MessageSquareText className="size-5 text-[#1A2A52]" />
          </div>
          <h2 className="font-medium text-gray-900">Ask the assistant</h2>
          <p className="text-sm text-gray-500 mt-1">
            Describe what you need in plain language — e.g. &quot;I need 20 laptops for new employees&quot; — and we&apos;ll ask follow-up questions.
          </p>
        </Link>

        <Link
          href="/dashboard/intake/form"
          className="group bg-white border border-gray-200 rounded-xl p-6 hover:border-[#1A2A52] hover:shadow-sm transition-all"
        >
          <div className="size-10 rounded-lg bg-[#C8A04D]/10 flex items-center justify-center mb-4 group-hover:bg-[#C8A04D]/15">
            <ListChecks className="size-5 text-[#C8A04D]" />
          </div>
          <h2 className="font-medium text-gray-900">Fill out a form</h2>
          <p className="text-sm text-gray-500 mt-1">
            Prefer a structured form? Fill in the fields directly — quicker if you already know exactly what you need.
          </p>
        </Link>
      </div>
    </div>
  );
}
