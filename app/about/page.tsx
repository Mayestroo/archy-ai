export default function AboutPage() {
  return (
    <main className="flex-1 max-w-4xl mx-auto px-6 py-20">
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">About Archy AI</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          We&apos;re on a mission to democratize architectural design by putting powerful AI tools in the hands of everyone.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-20">
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Our Vision</h2>
          <p className="text-muted-foreground leading-relaxed">
            Archy AI was born out of a simple idea: designing a home or office should be as easy as describing it. We believe that professional-grade architectural tools should be accessible, intuitive, and fast.
          </p>
        </div>
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">The Technology</h2>
          <p className="text-muted-foreground leading-relaxed">
            By leveraging state-of-the-art generative AI and custom spatial algorithms, Archy AI transforms natural language into accurate 2D blueprints and immersive 3D visualizations instantly.
          </p>
        </div>
      </div>

      <div className="bg-secondary/30 rounded-[32px] p-12 border border-border/50 text-center">
        <h2 className="text-3xl font-bold mb-6">Built for Creators</h2>
        <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
          Whether you&apos;re a homeowner planning a renovation, a real estate agent visualizing potential, or an interior designer rapid-prototyping, Archy AI is built for you.
        </p>
        <div className="flex justify-center gap-4">
          <div className="px-6 py-3 bg-foreground text-background font-bold rounded-full transition-transform hover:scale-105 cursor-pointer">
            View Pricing
          </div>
        </div>
      </div>
    </main>
  );
}
