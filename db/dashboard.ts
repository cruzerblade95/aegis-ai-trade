import { getD1 } from "./index";

export type DashboardPlan = {
  code: string;
  name: string;
  status: string;
  monthlyVirtualCredits: number;
};

export type DashboardWallet = {
  id: string;
  currency: string;
  balanceMinor: number;
};

export type DashboardLedgerEntry = {
  id: string;
  type: string;
  amountMinor: number;
  balanceAfterMinor: number;
  note: string | null;
  createdAt: number;
};

export type DashboardData = {
  plan: DashboardPlan | null;
  wallet: DashboardWallet | null;
  ledgerEntries: DashboardLedgerEntry[];
};

export async function getDashboardData(
  userId: string,
): Promise<DashboardData> {
  const database = getD1();

  const plan = await database
    .prepare(
      `SELECT
        plans.code,
        plans.name,
        subscriptions.status,
        plans.monthly_virtual_credits
          AS monthlyVirtualCredits
      FROM subscriptions
      INNER JOIN plans
        ON plans.id = subscriptions.plan_id
      WHERE subscriptions.user_id = ?
        AND subscriptions.status = 'active'
        AND plans.is_active = 1
      ORDER BY subscriptions.started_at DESC
      LIMIT 1`,
    )
    .bind(userId)
    .first<DashboardPlan>();

  const wallet = await database
    .prepare(
      `SELECT
        id,
        currency,
        balance_minor AS balanceMinor
      FROM virtual_wallets
      WHERE user_id = ?
      LIMIT 1`,
    )
    .bind(userId)
    .first<DashboardWallet>();

  let ledgerEntries: DashboardLedgerEntry[] = [];

  if (wallet) {
    const result = await database
      .prepare(
        `SELECT
          virtual_ledger_entries.id,
          virtual_ledger_entries.type,
          virtual_ledger_entries.amount_minor
            AS amountMinor,
          virtual_ledger_entries.balance_after_minor
            AS balanceAfterMinor,
          virtual_ledger_entries.note,
          virtual_ledger_entries.created_at
            AS createdAt
        FROM virtual_ledger_entries
        INNER JOIN virtual_wallets
          ON virtual_wallets.id =
            virtual_ledger_entries.wallet_id
        WHERE virtual_wallets.user_id = ?
          AND virtual_ledger_entries.wallet_id = ?
        ORDER BY
          virtual_ledger_entries.created_at DESC,
          virtual_ledger_entries.id DESC
        LIMIT 5`,
      )
      .bind(userId, wallet.id)
      .all<DashboardLedgerEntry>();

    ledgerEntries = result.results;
  }

  return {
    plan: plan ?? null,
    wallet: wallet ?? null,
    ledgerEntries,
  };
}