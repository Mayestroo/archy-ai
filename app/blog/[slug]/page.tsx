import { notFound } from "next/navigation";
import Link from "next/link";

const posts: Record<string, {
  title: string; date: string; readTime: string; category: string;
  content: string[];
}> = {
  "future-of-ai-in-architecture": {
    title: "The Future of AI in Residential Architecture",
    date: "March 20, 2026", readTime: "5 min read", category: "Industry",
    content: [
      "Generative AI has crossed a threshold in 2026 — it is no longer a novelty tool but a genuine collaborator in the design process. Residential architects who once spent weeks on preliminary layouts now iterate in minutes.",
      "The shift started with language models becoming spatial reasoners. When you describe a 'cozy open-plan apartment with a north-facing bedroom and a kitchen island,' a well-trained model understands not just the words, but the relationships between spaces: the need for natural light, the logic of traffic flow, the privacy gradient from public to private rooms.",
      "Archy AI's two-stage pipeline exemplifies this: the AI selects from architectural templates validated against real-world constraints, then a deterministic layout engine positions rooms with pixel-perfect precision. This hybrid approach avoids the hallucination problem that plagued early AI floor planners, which would produce geometrically impossible rooms.",
      "Where does this leave human architects? Firmly in control. AI handles the combinatorial explosion of 'what if' scenarios — what if we add a study nook, what if the garage is detached, what if we flip the orientation 90 degrees. The architect evaluates, curates, and adds the cultural and emotional intelligence that no model yet possesses.",
      "The next five years will likely bring real-time structural analysis layered on top of AI layouts, automatic code compliance checking, and cost estimation embedded in the generation step. The floor plan of 2031 will be born in a conversation.",
    ],
  },
  "top-5-interior-design-trends-2026": {
    title: "Top 5 Interior Design Trends for 2026",
    date: "March 15, 2026", readTime: "4 min read", category: "Design",
    content: [
      "Interior design in 2026 is defined by a reaction against the maximalist interiors of the early 2020s. The aesthetic is quieter, warmer, and more considered — but far from minimal in its ambition.",
      "**1. Biophilic Integration** — Plants are no longer decorative accents. They are structural elements. Living walls, moss ceilings, and indoor tree columns are appearing in residential projects that would have been commercial-only five years ago. AI layout tools now include 'biophilic zone' as a room type.",
      "**2. Tactile Materialism** — Screen fatigue has driven a hunger for texture. Rough-hewn stone, handmade ceramic tiles, linen walls, and burnished brass are dominating mood boards. The key is contrast: smooth against rough, matte against gloss.",
      "**3. The Return of the Corridor** — Open-plan living is giving way to a more articulated floor plan. Architects and their clients are rediscovering that corridors provide acoustic separation, thermal buffering, and the psychological pleasure of transition.",
      "**4. Adaptive Rooms** — With remote work normalised, rooms are being designed for multiple lives: the bedroom that becomes a podcast studio, the dining room that converts to a home office. Fold-flat furniture and modular joinery are the technical enablers.",
      "**5. Dark Kitchens** — The all-white kitchen is receding. Deep forest greens, charcoal, inky navy, and even black are taking over cabinetry, with unlacquered brass and warm lighting providing counterpoint. It is a kitchen you want to cook in, not just photograph.",
    ],
  },
  "sketch-to-3d-success-story": {
    title: "From Sketch to 3D: A Success Story",
    date: "March 10, 2026", readTime: "6 min read", category: "Case Study",
    content: [
      "Mia Chen had 18 hours to win a renovation pitch. The client — a family of four converting an ageing bungalow into a contemporary family home — had already met with two firms. Mia had a laptop, an Archy AI subscription, and a flight to catch in the morning.",
      "She started at 9 PM with a single prompt: 'Open-plan ground floor for a family of 4, kitchen island connecting to dining and living, separate study, large rear glazing, 3 bedrooms upstairs with shared bathroom and master ensuite.' The first layout was 80% right. She refined it twice — adjusting the hallway width and swapping the laundry position — and by midnight had a 2D blueprint she was proud of.",
      "The 3D preview was the moment that changed everything. Rotating the model, she noticed the master bedroom window aligned perfectly with the client's rear garden. She screenshotted that view and led with it in her presentation deck.",
      "The pitch lasted 40 minutes. The family signed the letter of engagement that afternoon.",
      "'I've been doing this for 11 years,' Mia told us afterward. 'The tool doesn't replace the relationship or the knowledge. But it compressed the part that used to cost me a week of unpaid speculative work into one evening. That changes the economics of pitching entirely.'",
      "Mia now uses Archy AI for every preliminary client conversation. She prints the 2D blueprint, scribbles on it with a red pen, and re-generates. The clients love watching the room evolve in real time.",
    ],
  },
  "how-to-write-better-floor-plan-prompts": {
    title: "How to Write Better Floor Plan Prompts",
    date: "April 2, 2026", readTime: "7 min read", category: "Tutorial",
    content: [
      "The quality of your floor plan is directly proportional to the precision of your prompt. Here is a framework that consistently produces better results.",
      "**Start with the household.** Before room types, describe who lives there. 'A couple who work from home' implies a need for two studies. 'A family with a teenager' implies acoustic separation and a second bathroom. The AI uses this context to weight its template selection.",
      "**Name your non-negotiables first.** 'I need a double garage and a ground-floor bedroom' should appear in the first sentence. These are hard constraints, and leading with them prevents the AI from generating a layout you have to discard entirely.",
      "**Use cardinal directions for light.** 'South-facing living room' or 'east-facing master bedroom' are precise, actionable instructions. 'Good light' is not. If you don't know the site orientation yet, specify the room relationship instead: 'living and kitchen on the same side, separate from bedrooms.'",
      "**Describe flow, not just rooms.** 'I want to be able to see the garden from the kitchen while cooking' describes a spatial relationship that shapes the whole layout. 'Open plan' is often a proxy for this — but being explicit gets better results.",
      "**Include area where you know it.** '90 sqm', '1,500 sq ft', '3-bedroom detached' all give the AI a size anchor that dramatically narrows the template selection. Without it, you might get a studio when you wanted a villa.",
      "**Iterate ruthlessly.** The best prompt is rarely the first one. Generate, evaluate what is right and wrong, then refine. Treat the AI like a junior drafter who needs clear feedback, not a magic box that always gets it right first time.",
    ],
  },
  "open-plan-vs-cellular-layouts": {
    title: "Open Plan vs Cellular Layouts: What AI Recommends",
    date: "April 10, 2026", readTime: "8 min read", category: "Research",
    content: [
      "We analysed 500 floor plan generations across Archy AI's user base and found a clear pattern: 67% of prompts that included the word 'family' resulted in partially cellular layouts, while prompts focused on 'entertaining' or 'professionals' skewed heavily open-plan.",
      "This mirrors real-world architectural practice, where the open-plan trend of the 2010s is being revisited by families who discovered that open-plan living means everyone hears everything, and the kitchen smell permeates the entire house.",
      "The AI has absorbed this shift. When the prompt includes family context, Archy AI's layout engine tends to produce a connected kitchen-dining zone with a clearly separated living room — a 'broken-plan' layout that preserves connection while allowing acoustic separation.",
      "For professionals and entertainers, the AI optimises for social flow: island kitchens that face the living area, continuous sightlines from entry to rear, and a generous dining zone positioned for conversation across the cooking space.",
      "What is most interesting is what happens with ambiguous prompts. 'Modern 3-bedroom house' — with no occupant context — tends to produce a hybrid: open-plan ground floor with a door option between kitchen and living. The AI defaults to flexibility.",
      "The research suggests that the best AI floor plan prompts are also the best client briefing questions: who lives here, how do they use space, what does a Sunday morning look like, what bothers them about where they live now? The answers to those questions produce the inputs that produce the best plans.",
    ],
  },
  "archy-2d-to-3d-explained": {
    title: "How Archy AI Converts Your 2D Blueprint to 3D in Seconds",
    date: "April 18, 2026", readTime: "6 min read", category: "Technology",
    content: [
      "When you click '3D Preview' in Archy AI, a small pipeline fires in about 200 milliseconds. Here is what actually happens.",
      "**Stage 1: The room graph.** Archy AI's layout engine stores each room as a rectangle with four properties: x position, y position, width, and height — all in pixel units on a fixed canvas. This is the source of truth for both the 2D and 3D views.",
      "**Stage 2: Extrusion.** The 3D engine reads the room graph and extrudes each rectangle upward into a box — essentially converting a 2D floor plan into a set of three-dimensional cells. Each room gets a standard ceiling height (2.7m by default) unless the prompt specified something different.",
      "**Stage 3: Wall generation.** Shared edges between adjacent rooms become interior walls. External edges become exterior walls with slightly greater thickness. This is handled by Three.js geometry merging, which means the 3D model has no gaps or overlapping geometry.",
      "**Stage 4: Material assignment.** Each room type gets a material: living rooms receive a warm off-white, kitchens a slightly cooler tone, bathrooms a near-white with higher specularity. Bedrooms and studies use a neutral mid-tone. These are not configurable yet — full material customisation is on the roadmap.",
      "**Stage 5: Lighting.** A single directional light at 45 degrees provides primary illumination, supplemented by a hemisphere light for ambient fill. This combination creates the soft shadow gradients that make the 3D preview readable without needing a full ray-trace render.",
      "The result is a schematic 3D view — not a photorealistic render, but something precise enough to communicate spatial relationships in a client meeting. Full render export and daylight simulation are features we are actively developing.",
    ],
  },
};

export async function generateStaticParams() {
  return Object.keys(posts).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = posts[slug];
  if (!post) return {};
  return { title: `${post.title} | Archy AI Blog`, description: post.content[0].slice(0, 160) };
}

const categoryColors: Record<string, string> = {
  Industry:   "bg-[#5D5DFF]/10 text-[#4B4BE5] dark:text-[#5D5DFF] border-[#5D5DFF]/20",
  Design:     "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  "Case Study": "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  Tutorial:   "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  Research:   "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  Technology: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
};

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = posts[slug];
  if (!post) notFound();

  return (
    <main className="flex-1 max-w-2xl mx-auto px-6 py-20 w-full">
      <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-10">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M19 12H5M5 12l7-7M5 12l7 7" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Back to Blog
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <span className={`text-[11px] font-bold px-3 py-1 rounded-full border uppercase tracking-widest ${categoryColors[post.category] ?? ""}`}>
          {post.category}
        </span>
        <span className="text-xs text-muted-foreground">{post.date} · {post.readTime}</span>
      </div>

      <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight mb-8">{post.title}</h1>
      <div className="h-px bg-border mb-10" />

      <div className="flex flex-col gap-6 text-[16px] leading-[1.8] text-muted-foreground">
        {post.content.map((para, i) => {
          // Render bold markdown **text**
          const parts = para.split(/(\*\*[^*]+\*\*)/g);
          return (
            <p key={i}>
              {parts.map((part, j) =>
                part.startsWith("**") && part.endsWith("**")
                  ? <strong key={j} className="text-foreground font-semibold">{part.slice(2, -2)}</strong>
                  : part
              )}
            </p>
          );
        })}
      </div>

      <div className="mt-16 pt-10 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <p className="text-sm font-semibold text-foreground mb-1">Try it yourself</p>
          <p className="text-xs text-muted-foreground">Generate a professional floor plan in seconds with Archy AI.</p>
        </div>
        <Link href="/" className="shrink-0 px-6 py-3 bg-foreground text-background text-sm font-bold rounded-xl hover:opacity-90 transition-all shadow-lg">
          Start Designing →
        </Link>
      </div>
    </main>
  );
}
