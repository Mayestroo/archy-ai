export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-background text-foreground font-sans flex flex-col items-center">
      <div className="w-full max-w-[1300px] px-6 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="h-8 w-48 bg-secondary/50 animate-pulse rounded-lg"></div>
          <div className="h-10 w-32 bg-secondary/50 animate-pulse rounded-lg"></div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl overflow-hidden h-[280px]">
              <div className="aspect-video bg-secondary/30 animate-pulse"></div>
              <div className="p-4 space-y-3">
                <div className="h-4 w-3/4 bg-secondary/50 animate-pulse rounded"></div>
                <div className="h-3 w-1/4 bg-secondary/30 animate-pulse rounded"></div>
                <div className="pt-4 flex gap-2">
                  <div className="h-8 flex-1 bg-secondary/50 animate-pulse rounded-lg"></div>
                  <div className="h-8 w-8 bg-secondary/50 animate-pulse rounded-lg"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
