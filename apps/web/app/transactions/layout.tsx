import "@repo/ui/globals.css";
// DashboardNavbar removed - MVP only shows Wallet section

export default function TransactionsLayout({
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
