import Link from "next/link";

export const metadata = {
  title: "Blog | Archy AI",
  description: "Insights, updates, and architectural stories from the Archy AI team.",
};

const posts = [
  {
    slug: "future-of-ai-in-architecture",
    title: "The Future of AI in Residential Architecture",
    excerpt: "How generative models are changing the way we think about home design and spatial planning.",
    date: "March 20, 2026",
    readTime: "5 min read",
    category: "Industry",
    gradient: "from-[#5D5DFF]/10 to-[#5D5DFF]/5",
  },
  {
    slug: "top-5-interior-design-trends-2026",
    title: "Top 5 Interior Design Trends for 2026",
    excerpt: "Explore the minimalist and organic aesthetics taking over the architectural world this year.",
    date: "March 15, 2026",
    readTime: "4 min read",
    category: "Design",
    gradient: "from-emerald-500/10 to-emerald-500/5",
  },
  {
    slug: "sketch-to-3d-success-story",
    title: "From Sketch to 3D: A Success Story",
    excerpt: "How one designer used Archy AI to close a construction deal in less than 24 hours.",
    date: "March 10, 2026",
    readTime: "6 min read",
    category: "Case Study",
    gradient: "from-amber-500/10 to-amber-500/5",
  },
  {
    slug: "how-to-write-better-floor-plan-prompts",
    title: "How to Write Better Floor Plan Prompts",
    excerpt: "The difference between a vague request and a precise one can mean a completely different layout. Learn the patterns that get the best results.",
    date: "April 2, 2026",
    readTime: "7 min read",
    category: "Tutorial",
    gradient: "from-rose-500/10 to-rose-500/5",
  },
  {
    slug: "open-plan-vs-cellular-layouts",
    title: "Open Plan vs Cellular Layouts: What AI Recommends",
    excerpt: "We ran 500 prompts through Archy AI and analyzed the results. Here's what the data says about modern spatial preferences.",
    date: "April 10, 2026",
    readTime: "8 min read",
    category: "Research",
    gradient: "from-sky-500/10 to-sky-500/5",
  },
  {
    slug: "archy-2d-to-3d-explained",
    title: "How Archy AI Converts Your 2D Blueprint to 3D in Seconds",
    excerpt: "A deep-dive into the two-stage pipeline behind Archy AI's layout engine and 3D preview technology.",
    date: "April 18, 2026",
    readTime: "6 min read",
    category: "Technology",
    gradient: "from-violet-500/10 to-violet-500/5",
  },
];

const categoryColors: Record<string, string> = {
  Industry:   "bg-[#5D5DFF]/10 text-[#4B4BE5] dark:text-[#5D5DFF] border-[#5D5DFF]/20",
  Design:     "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  "Case Study": "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  Tutorial:   "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  Research:   "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  Technology: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
};

export default function BlogPage() {
  const [featured, ...rest] = posts;

  return (
    <main className="flex-1 max-w-5xl mx-auto px-6 py-20 w-full">
      <div className="mb-14">
        <p className="text-xs font-bold text-[#4B4BE5] dark:text-[#5D5DFF] uppercase tracking-[0.2em] mb-3">Journal</p>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">Blog</h1>
        <p className="text-muted-foreground text-lg max-w-xl">
          Insights, updates, and stories from the Archy AI team.
        </p>
      </div>

      {/* Featured post */}
      <Link href={`/blog/${featured.slug}`} className="group block mb-12">
        <article className={`relative rounded-[32px] border border-border bg-linear-to-br ${featured.gradient} p-10 overflow-hidden hover:border-muted transition-all hover:shadow-xl hover:shadow-black/5 hover:-translate-y-1 duration-300`}>
          <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-[#5D5DFF]/5 blur-3xl rounded-full pointer-events-none" />
          <div className="flex items-center gap-3 mb-5">
            <span className={`text-[11px] font-bold px-3 py-1 rounded-full border uppercase tracking-widest ${categoryColors[featured.category]}`}>
              {featured.category}
            </span>
            <span className="text-xs text-muted-foreground">{featured.date} · {featured.readTime}</span>
          </div>
          <h2 className="text-3xl font-extrabold mb-3 tracking-tight group-hover:text-[#4B4BE5] dark:group-hover:text-[#5D5DFF] transition-colors">{featured.title}</h2>
          <p className="text-muted-foreground leading-relaxed max-w-2xl mb-6">{featured.excerpt}</p>
          <div className="flex items-center gap-2 text-sm font-bold group-hover:gap-3 transition-all">
            Read article
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </article>
      </Link>

      {/* Rest of posts */}
      <div className="grid sm:grid-cols-2 gap-6">
        {rest.map((post) => (
          <Link key={post.slug} href={`/blog/${post.slug}`} className="group">
            <article className={`h-full rounded-[28px] border border-border bg-linear-to-br ${post.gradient} p-8 hover:border-muted transition-all hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 duration-300 flex flex-col`}>
              <div className="flex items-center gap-2 mb-4">
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-widest ${categoryColors[post.category]}`}>
                  {post.category}
                </span>
                <span className="text-xs text-muted-foreground">{post.readTime}</span>
              </div>
              <h2 className="text-xl font-bold mb-3 tracking-tight group-hover:text-[#4B4BE5] dark:group-hover:text-[#5D5DFF] transition-colors flex-1">{post.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">{post.excerpt}</p>
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground group-hover:text-foreground group-hover:gap-3 transition-all">
                Read more <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </main>
  );
}
