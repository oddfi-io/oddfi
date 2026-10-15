export interface CollateralPosition {
  id: string;
  matchTitle: string; // "France vs Spain — World Cup Final"
  matchDate: string; // "Wed, Mar 11 1:45 AM"
  homeTeamLogo: string;
  awayTeamLogo: string;
  principal: number; // 520000
  returnMultiplier: number; // 2.10
  creditLimit: number | null; // 100 or null (already borrowed)
  isBorrowed: boolean;
}

export interface ActiveBorrow {
  id: string;
  matchTitle: string; // "England vs Spain · Draw"
  collateralInfo: string; // "Collateral: England vs Spain Away Win · #A003"
  homeTeamLogo: string;
  awayTeamLogo: string;
  borrowedAmount: number;
  status: "active" | "principal_frozen";
  times?: number;
  potentialReturn?: number;
  netProfit?: number;
  principalFrozen?: number;
}

export type LendingTab = "borrow" | "repay";
