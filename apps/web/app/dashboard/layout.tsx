import "@repo/ui/globals.css";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black text-white">
      <main className="mx-auto max-w-7xl py-8">
        {children}
      </main>
    </div>
  );
}

