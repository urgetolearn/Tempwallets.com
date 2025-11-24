"use client";

import UpperBar from "@/components/dashboard/upper-bar";
import WalletInfo from "@/components/dashboard/wallet-info";
import { BalanceTransactionsToggle } from "@/components/dashboard/balance-transactions-toggle";
import { DashboardTracker } from "@/components/analytics/dashboard-tracker";

export default function DashboardPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <DashboardTracker />
      {/* Upper Bar - Mobile Only */}
      <UpperBar />

      {/* Main Content with padding for wallet info */}
      <div className="pt-16 lg:pt-20 py-8 px-4 sm:px-6 lg:px-8 space-y-6 flex-shrink-0">
        <WalletInfo />
      </div>
      
      {/* Balance/Transactions Toggle - Full width on mobile, constrained on desktop */}
      <div className="flex-1 flex flex-col">
        <BalanceTransactionsToggle />
      </div>
    </div>
  );
}

