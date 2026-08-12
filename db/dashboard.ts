import { getLatestMarketPrice, isMarketSymbol, type MarketSymbol } from "../lib/market-data";
import { getD1 } from "./index";
import { getUserPlan, type UserPlan } from "./plans";

export type DashboardEnvironment = "current" | "virtual";
export type DashboardSummary = {
  environment: DashboardEnvironment;
  currency: string;
  balanceMinor: number;
  openPositions: number;
  pendingOrders: number;
  realizedPnlMinor: number;
  unrealizedPnlMinor: number;
  totalPnlMinor: number;
  tradedVolumeMinor: number;
  winningTrades: number;
  losingTrades: number;
  recentTrades: Array<{ id:string; marketSymbol:string; side:string; status:string; price:number|null; quantity:number; createdAt:number }>;
};
export type TradingDashboardData = { current: DashboardSummary; virtual: DashboardSummary; plan: UserPlan };

type WalletRow={currency:string;balanceMinor:number};
type PositionRow={marketSymbol:string;side:"buy"|"sell";quantity:string;entryPrice:string};
type AggregateRow={realizedPnlMinor:number;winningTrades:number;losingTrades:number};
type OrderRow={id:string;marketSymbol:string;side:string;status:string;executedPrice:string|null;quantity:string;createdAt:number;quoteAmountMinor:number|null};

export async function getDashboardData(userId:string):Promise<TradingDashboardData>{
  const database=getD1();
  await ensureCurrentWallet(userId);
  const [current, virtual, plan]=await Promise.all([
    buildSummary(userId,"current"),
    buildSummary(userId,"virtual"),
    getUserPlan(userId),
  ]);
  return {current,virtual,plan};
}

async function buildSummary(userId:string, environment:DashboardEnvironment):Promise<DashboardSummary>{
  const db=getD1();
  const walletTable=environment==="virtual"?"virtual_wallets":"current_wallets";
  const [wallet,positions,pending,aggregate,recent]=await Promise.all([
    db.prepare(`SELECT currency,balance_minor AS balanceMinor FROM ${walletTable} WHERE user_id=? AND currency='USD' LIMIT 1`).bind(userId).first<WalletRow>(),
    db.prepare(`SELECT market_symbol AS marketSymbol,side,quantity,entry_price AS entryPrice FROM virtual_trade_position_lots WHERE user_id=? AND environment=? AND closed_at IS NULL`).bind(userId,environment).all<PositionRow>(),
    db.prepare(`SELECT COUNT(*) AS count FROM virtual_trade_orders WHERE user_id=? AND environment=? AND status='pending'`).bind(userId,environment).first<{count:number}>(),
    db.prepare(`SELECT COALESCE(SUM(realized_pnl_minor),0) AS realizedPnlMinor, COALESCE(SUM(CASE WHEN realized_pnl_minor>0 THEN 1 ELSE 0 END),0) AS winningTrades, COALESCE(SUM(CASE WHEN realized_pnl_minor<0 THEN 1 ELSE 0 END),0) AS losingTrades FROM virtual_trade_position_lots WHERE user_id=? AND environment=? AND closed_at IS NOT NULL`).bind(userId,environment).first<AggregateRow>(),
    db.prepare(`SELECT id,market_symbol AS marketSymbol,side,status,executed_price AS executedPrice,quantity,created_at AS createdAt,quote_amount_minor AS quoteAmountMinor FROM virtual_trade_orders WHERE user_id=? AND environment=? ORDER BY created_at DESC LIMIT 8`).bind(userId,environment).all<OrderRow>(),
  ]);
  const symbols=[...new Set(positions.results.map(p=>p.marketSymbol).filter(isMarketSymbol))] as MarketSymbol[];
  const prices=new Map<MarketSymbol,number>();
  await Promise.all(symbols.map(async symbol=>{try{prices.set(symbol,(await getLatestMarketPrice(symbol)).price)}catch{}}));
  let unrealizedPnlMinor=0;
  for(const position of positions.results){
    if(!isMarketSymbol(position.marketSymbol))continue;
    const current=prices.get(position.marketSymbol); if(!current)continue;
    const entry=Number(position.entryPrice), quantity=Number(position.quantity);
    const pnl=position.side==="buy"?(current-entry)*quantity:(entry-current)*quantity;
    unrealizedPnlMinor+=Math.round(pnl*100);
  }
  const realizedPnlMinor=Number(aggregate?.realizedPnlMinor??0);
  return {
    environment,currency:wallet?.currency??"USD",balanceMinor:wallet?.balanceMinor??0,
    openPositions:positions.results.length,pendingOrders:Number(pending?.count??0),
    realizedPnlMinor,unrealizedPnlMinor,totalPnlMinor:realizedPnlMinor+unrealizedPnlMinor,
    tradedVolumeMinor:recent.results.reduce((sum,row)=>sum+Math.abs(Number(row.quoteAmountMinor??0)),0),
    winningTrades:Number(aggregate?.winningTrades??0),losingTrades:Number(aggregate?.losingTrades??0),
    recentTrades:recent.results.map(row=>({id:row.id,marketSymbol:row.marketSymbol,side:row.side,status:row.status,price:row.executedPrice===null?null:Number(row.executedPrice),quantity:Number(row.quantity),createdAt:row.createdAt})),
  };
}

async function ensureCurrentWallet(userId:string){
  const db=getD1(); const existing=await db.prepare(`SELECT id FROM current_wallets WHERE user_id=? AND currency='USD' LIMIT 1`).bind(userId).first();
  if(existing)return;
  const now=Date.now(); await db.prepare(`INSERT INTO current_wallets(id,user_id,currency,balance_minor,created_at,updated_at) VALUES(?,?,'USD',0,?,?)`).bind(crypto.randomUUID(),userId,now,now).run();
}
