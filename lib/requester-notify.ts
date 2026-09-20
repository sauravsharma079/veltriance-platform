import { sendEmail } from "@/lib/email";

const host = () => (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "app.veltriance.com").replace(/^https?:\/\//, "");

/** Closes the loop with whoever asked for something, who otherwise never hears what happened to it. */
export async function tellRequester(
  req: { requisitionNumber: string; title: string; requestor: { name: string; email: string } },
  outcome: "approved" | "rejected" | "sourcing" | "ordered",
  extra: { by?: string; comment?: string; poNumber?: string } = {},
) {
  const name = req.requestor.name;
  const text = {
    approved: `Hello ${name},\n\nGood news — your request "${req.title}" (${req.requisitionNumber}) has been approved.${extra.poNumber ? `\n\nPurchase order ${extra.poNumber} has been raised.` : ""}\n\nTrack it here: https://${host()}/dashboard/requisitions\n`,
    rejected: `Hello ${name},\n\nYour request "${req.title}" (${req.requisitionNumber}) was not approved${extra.by ? ` by ${extra.by}` : ""}.${extra.comment ? `\n\nTheir comment: ${extra.comment}` : ""}\n\nYou can revise and resubmit it: https://${host()}/dashboard/requisitions\n`,
    sourcing: `Hello ${name},\n\nYour request "${req.title}" (${req.requisitionNumber}) has been approved. Because of its value it's going out for competitive quotes first, so the best offer is chosen — you don't need to do anything.\n\nWe'll let you know when an order is placed: https://${host()}/dashboard/requisitions\n`,
    ordered: `Hello ${name},\n\nWe've chosen a supplier for "${req.title}" (${req.requisitionNumber}) and raised purchase order ${extra.poNumber ?? ""}.\n\nTrack it here: https://${host()}/dashboard/requisitions\n`,
  }[outcome];
  await sendEmail({ to: req.requestor.email, subject: `${req.requisitionNumber} ${outcome === "rejected" ? "not approved" : outcome === "sourcing" ? "approved — going out for quotes" : outcome}: ${req.title}`, text }).catch(() => {});
}
