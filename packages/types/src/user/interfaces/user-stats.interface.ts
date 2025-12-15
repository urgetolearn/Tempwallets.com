export interface UserStats {
  walletCount: number;
  transactionCount: number;
  totalBalance: string;
  activeWallets: number;
  createdAt: string;
  lastLoginAt: string;
}

export interface UserActivity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

