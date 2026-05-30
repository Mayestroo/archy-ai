import PricingSection from "@/components/PricingSection";

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground font-sans flex flex-col items-center">
      <div className="w-full flex-1 flex flex-col items-center">
        <PricingSection />
      </div>
    </main>
  );
}
