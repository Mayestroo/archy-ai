import { getSharedFloorPlan } from "@/app/actions";
import SharedPlanClient from "@/components/share/SharedPlanClient";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sharedPlan = await getSharedFloorPlan(token);
  if (!sharedPlan) return { title: "Shared plan not found | Archy AI" };

  return {
    title: `${sharedPlan.prompt || "Shared Floor Plan"} | Archy AI`,
    description: "Read-only client preview of an Archy AI floor plan.",
  };
}

export default async function SharedPlanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sharedPlan = await getSharedFloorPlan(token);

  if (!sharedPlan) notFound();

  return (
    <SharedPlanClient
      title={sharedPlan.prompt || "Archy AI Floor Plan"}
      floorPlan={sharedPlan.floor_plan_json}
      createdAt={sharedPlan.created_at}
      sharedAt={sharedPlan.shared_at}
    />
  );
}
