import { getD1 } from "./index";

export type PlanCode = "starter" | "pro" | "elite";
export type BillingCycle = "monthly" | "yearly";
export type TradingPlan = {
  id: string; code: PlanCode; name: string; description: string;
  priceMinor: number; yearlyPriceMinor: number; currency: string; strategyLevel: number;
  maxOpenPositions: number; scanIntervalSeconds: number; riskPerTradeBps: number;
};
export type UserPlan = TradingPlan & {
  status: "active" | "none"; startedAt: number | null; endsAt: number | null;
  billingCycle: BillingCycle | null;
};

type PlanRow = Omit<TradingPlan,"code"> & { code:string };
const columns = `p.id,p.code,p.name,p.description,p.price_minor AS priceMinor,p.yearly_price_minor AS yearlyPriceMinor,p.currency,p.strategy_level AS strategyLevel,p.max_open_positions AS maxOpenPositions,p.scan_interval_seconds AS scanIntervalSeconds,p.risk_per_trade_bps AS riskPerTradeBps`;

export async function listTradingPlans():Promise<TradingPlan[]> {
 const rows=await getD1().prepare(`SELECT id,code,name,description,price_minor AS priceMinor,yearly_price_minor AS yearlyPriceMinor,currency,strategy_level AS strategyLevel,max_open_positions AS maxOpenPositions,scan_interval_seconds AS scanIntervalSeconds,risk_per_trade_bps AS riskPerTradeBps FROM plans WHERE is_active=1 ORDER BY price_minor`).all<PlanRow>();
 return rows.results.filter(r=>["starter","pro","elite"].includes(r.code)).map(r=>({...r,code:r.code as PlanCode}));
}
export async function getUserPlan(userId:string):Promise<UserPlan>{
 const now=Date.now();
 await getD1().prepare(`UPDATE subscriptions SET status='expired',updated_at=? WHERE user_id=? AND status='active' AND ends_at IS NOT NULL AND ends_at<=?`).bind(now,userId,now).run();
 const row=await getD1().prepare(`SELECT ${columns},s.status,s.started_at AS startedAt,s.ends_at AS endsAt,s.billing_cycle AS billingCycle FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.user_id=? AND s.status='active' LIMIT 1`).bind(userId).first<PlanRow & {status:string;startedAt:number;endsAt:number|null;billingCycle:BillingCycle}>();
 if(row && ["starter","pro","elite"].includes(row.code)) return {...row,code:row.code as PlanCode,status:"active"};
 return {id:"plan_starter",code:"starter",name:"Starter AI",description:"Core AI strategy scanning.",priceMinor:0,yearlyPriceMinor:0,currency:"USD",strategyLevel:1,maxOpenPositions:1,scanIntervalSeconds:120,riskPerTradeBps:50,status:"none",startedAt:null,endsAt:null,billingCycle:null};
}
export async function purchasePlan(userId:string,planId:string,billingCycle:BillingCycle){
 const db=getD1();
 const plan=await db.prepare(`SELECT id,code,price_minor AS priceMinor,yearly_price_minor AS yearlyPriceMinor FROM plans WHERE id=? AND is_active=1 LIMIT 1`).bind(planId).first<{id:string;code:string;priceMinor:number;yearlyPriceMinor:number}>();
 if(!plan) throw new Error("Plan not found.");
 if(!["monthly","yearly"].includes(billingCycle)) throw new Error("Choose monthly or yearly billing.");
 const charge=plan.code==="starter"?0:(billingCycle==="yearly"?plan.yearlyPriceMinor:plan.priceMinor);
 let wallet=await db.prepare(`SELECT id,balance_minor AS balanceMinor FROM current_wallets WHERE user_id=? AND currency='USD' LIMIT 1`).bind(userId).first<{id:string;balanceMinor:number}>();
 if(!wallet){const id=crypto.randomUUID();const created=Date.now();await db.prepare(`INSERT INTO current_wallets(id,user_id,currency,balance_minor,created_at,updated_at) VALUES(?,?,'USD',0,?,?)`).bind(id,userId,created,created).run();wallet={id,balanceMinor:0};}
 if(wallet.balanceMinor<charge) throw new Error("Current Balance is too low to purchase this plan.");
 const now=Date.now();
 const duration=plan.code==="starter"?null:(billingCycle==="yearly"?365:30)*24*60*60*1000;
 const endsAt=duration===null?null:now+duration;
 await db.batch([
  db.prepare(`UPDATE current_wallets SET balance_minor=?,updated_at=? WHERE id=?`).bind(wallet.balanceMinor-charge,now,wallet.id),
  db.prepare(`INSERT INTO subscriptions(id,user_id,plan_id,status,started_at,ends_at,billing_cycle,created_at,updated_at) VALUES(?,?,?,'active',?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET plan_id=excluded.plan_id,status='active',started_at=excluded.started_at,ends_at=excluded.ends_at,billing_cycle=excluded.billing_cycle,updated_at=excluded.updated_at`).bind(crypto.randomUUID(),userId,plan.id,now,endsAt,billingCycle,now,now),
 ]);
}
