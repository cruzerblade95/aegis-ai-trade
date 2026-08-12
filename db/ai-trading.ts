import { getD1 } from "./index";
import { getUserPlan } from "./plans";
import { closeVirtualPosition, getVirtualTradingState, placeVirtualOrder, syncVirtualLimitOrders, type TradingEnvironment, type VirtualTradingState } from "./virtual-trading";
import { getMarketSnapshot, type MarketCandle, type MarketSymbol } from "../lib/market-data";

const symbols:MarketSymbol[]=["BTCUSD","ETHUSD","SOLUSD"];
export type AiTradingSettings={isEnabled:boolean;environment:TradingEnvironment;preferredStrategy:string;volume:number;takeProfitBps:number;stopLossBps:number;autoClose:boolean;lastScanAt:number|null};
export type AiTradeLog={id:string;environment:TradingEnvironment;marketSymbol:string;strategy:string;signal:string;confidence:number;reason:string;positionId:string|null;createdAt:number};
type Signal={side:"buy"|"sell"|"hold";strategy:string;confidence:number;reason:string};

export async function getAiTradingSettings(userId:string):Promise<AiTradingSettings>{
 const row=await getD1().prepare(`SELECT is_enabled AS isEnabled,environment,preferred_strategy AS preferredStrategy,volume,take_profit_bps AS takeProfitBps,stop_loss_bps AS stopLossBps,auto_close AS autoClose,last_scan_at AS lastScanAt FROM ai_trading_settings WHERE user_id=?`).bind(userId).first<{isEnabled:number;environment:TradingEnvironment;preferredStrategy:string;volume:string;takeProfitBps:number;stopLossBps:number;autoClose:number;lastScanAt:number|null}>();
 return row?{...row,isEnabled:Boolean(row.isEnabled),volume:Number(row.volume),autoClose:Boolean(row.autoClose)}:{isEnabled:false,environment:"virtual",preferredStrategy:"auto",volume:.01,takeProfitBps:90,stopLossBps:50,autoClose:true,lastScanAt:null};
}
export async function saveAiTradingSettings(userId:string,input:Partial<AiTradingSettings>):Promise<AiTradingSettings>{
 const old=await getAiTradingSettings(userId);
 const next={...old,...input};
 if(!Number.isFinite(next.volume)||next.volume<=0||next.volume>1_000_000)throw new Error("Enter a valid position volume.");
 if(!Number.isInteger(next.takeProfitBps)||next.takeProfitBps<10||next.takeProfitBps>10000)throw new Error("Take Profit must be between 0.10% and 100%.");
 if(!Number.isInteger(next.stopLossBps)||next.stopLossBps<10||next.stopLossBps>5000)throw new Error("Stop Loss must be between 0.10% and 50%.");
 const now=Date.now();
 await getD1().prepare(`INSERT INTO ai_trading_settings(user_id,is_enabled,environment,preferred_strategy,volume,take_profit_bps,stop_loss_bps,auto_close,last_scan_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET is_enabled=excluded.is_enabled,environment=excluded.environment,preferred_strategy=excluded.preferred_strategy,volume=excluded.volume,take_profit_bps=excluded.take_profit_bps,stop_loss_bps=excluded.stop_loss_bps,auto_close=excluded.auto_close,updated_at=excluded.updated_at`).bind(userId,next.isEnabled?1:0,next.environment,next.preferredStrategy,String(next.volume),next.takeProfitBps,next.stopLossBps,next.autoClose?1:0,next.lastScanAt,now).run();
 if(old.isEnabled!==next.isEnabled){await log(userId,next.environment,"SYSTEM",{side:next.isEnabled?"enabled":"disabled",strategy:"AI Auto Trade",confidence:100,reason:next.isEnabled?"AI Auto Trade was enabled. Background scans will continue while the subscription remains active.":"AI Auto Trade was disabled by the user."},null);}
 return next;
}

export async function getAiTradeLogs(userId:string,limit=30):Promise<AiTradeLog[]>{
 const safeLimit=Math.max(1,Math.min(30,Math.trunc(limit)));
 const rows=await getD1().prepare(`SELECT id,environment,market_symbol AS marketSymbol,strategy,signal,confidence,reason,position_id AS positionId,created_at AS createdAt FROM ai_trade_decisions WHERE user_id=? ORDER BY created_at DESC LIMIT ?`).bind(userId,safeLimit).all<AiTradeLog>();
 return rows.results;
}

export async function runAiTradeCycle(userId:string,force=false):Promise<{state:VirtualTradingState;decision:Signal & {marketSymbol?:string;quantity?:number;takeProfit?:number;stopLoss?:number};settings:AiTradingSettings}>{
 const settings=await getAiTradingSettings(userId);const plan=await getUserPlan(userId);const now=Date.now();
 if(!force&&!settings.isEnabled)return {state:await getVirtualTradingState(userId,settings.environment),decision:{side:"hold",strategy:"disabled",confidence:100,reason:"AI Auto Trade is disabled."},settings};
 if(!force&&settings.lastScanAt&&now-settings.lastScanAt<plan.scanIntervalSeconds*1000)return {state:await getVirtualTradingState(userId,settings.environment),decision:{side:"hold",strategy:"scan-timer",confidence:100,reason:"The next plan scan is not due yet."},settings};
 await syncVirtualLimitOrders(userId);
 let best:{symbol:MarketSymbol;signal:Signal;price:number}|null=null;
 for(const symbol of symbols){const snap=await getMarketSnapshot(symbol,"5min");const signal=analyse(snap.candles,plan.strategyLevel,settings.preferredStrategy);const price=snap.candles.at(-1)?.close??0;if(!best||signal.confidence>best.signal.confidence)best={symbol,signal,price};}
 await getD1().prepare(`UPDATE ai_trading_settings SET last_scan_at=?,updated_at=? WHERE user_id=?`).bind(now,now,userId).run();
 let state=await getVirtualTradingState(userId,settings.environment);
 if(best&&settings.autoClose&&best.signal.side!=="hold"&&best.signal.confidence>=65){
   const managed=await getD1().prepare(`SELECT DISTINCT d.position_id AS positionId FROM ai_trade_decisions d JOIN virtual_trade_position_lots p ON p.id=d.position_id WHERE d.user_id=? AND d.environment=? AND d.position_id IS NOT NULL AND p.closed_at IS NULL AND p.side<>?`).bind(userId,settings.environment,best.signal.side).all<{positionId:string}>();
   for(const row of managed.results){try{await closeVirtualPosition(userId,row.positionId,settings.environment)}catch{}}
   state=await getVirtualTradingState(userId,settings.environment);
 }
 if(!best||best.signal.side==="hold"||best.signal.confidence<58){const signal=best?.signal??{side:"hold" as const,strategy:"multi-strategy",confidence:0,reason:"No valid signal."};await log(userId,settings.environment,best?.symbol??"BTCUSD",signal,null);return {state,decision:signal,settings:{...settings,lastScanAt:now}};}
 if(state.positions.length>=plan.maxOpenPositions){const decision={side:"hold" as const,strategy:"risk-control",confidence:100,reason:`Plan limit of ${plan.maxOpenPositions} open position(s) reached.`};await log(userId,settings.environment,best.symbol,decision,null);return {state,decision,settings:{...settings,lastScanAt:now}};}
 const quantity=settings.volume;const tpPct=settings.takeProfitBps/10000,slPct=settings.stopLossBps/10000;
 const tp=best.signal.side==="buy"?best.price*(1+tpPct):best.price*(1-tpPct);const sl=best.signal.side==="buy"?best.price*(1-slPct):best.price*(1+slPct);
 await placeVirtualOrder(userId,{environment:settings.environment,marketSymbol:best.symbol,side:best.signal.side,orderType:"market",quantity,takeProfit:tp,stopLoss:sl});
 const next=await getVirtualTradingState(userId,settings.environment);const id=next.positions.find(p=>p.marketSymbol===best!.symbol&&p.side===best!.signal.side)?.id??null;await log(userId,settings.environment,best.symbol,best.signal,id);
 return {state:next,decision:{...best.signal,marketSymbol:best.symbol,quantity,takeProfit:tp,stopLoss:sl},settings:{...settings,lastScanAt:now}};
}
export async function runDueAiTraders(limit=50){
 const rows=await getD1().prepare(`SELECT s.user_id AS userId FROM ai_trading_settings s JOIN subscriptions sub ON sub.user_id=s.user_id AND sub.status='active' JOIN plans p ON p.id=sub.plan_id WHERE s.is_enabled=1 AND (sub.ends_at IS NULL OR sub.ends_at>?) AND (s.last_scan_at IS NULL OR s.last_scan_at + p.scan_interval_seconds*1000 <= ?) LIMIT ?`).bind(Date.now(),Date.now(),limit).all<{userId:string}>();
 for(const row of rows.results){try{await runAiTradeCycle(row.userId,false)}catch(error){console.error("AI background cycle failed",row.userId,error)}}
}
function analyse(c:MarketCandle[],level:number,preferred:string):Signal{const closes=c.slice(-30).map(x=>x.close);if(closes.length<20)return {side:"hold",strategy:"insufficient-data",confidence:0,reason:"Not enough candles."};const last=closes.at(-1)!;const avg=closes.reduce((a,b)=>a+b,0)/closes.length;const sd=Math.sqrt(closes.reduce((a,b)=>a+(b-avg)**2,0)/closes.length);const upper=avg+2*sd,lower=avg-2*sd;let gains=0,losses=0;for(let i=closes.length-14;i<closes.length;i++){const d=closes[i]-closes[i-1];if(d>0)gains+=d;else losses-=d;}const rsi=losses===0?100:100-(100/(1+gains/losses));const momentum=(last-closes[closes.length-6])/closes[closes.length-6];let buy=0,sell=0;const reasons:string[]=[];const useRsi=preferred==="auto"||preferred==="rsi";const useBands=preferred==="auto"||preferred==="bollinger";const useMomentum=preferred==="auto"||preferred==="scalping";if(useRsi&&rsi<35){buy+=32;reasons.push(`RSI oversold at ${rsi.toFixed(1)}`)}if(useRsi&&rsi>65){sell+=32;reasons.push(`RSI overbought at ${rsi.toFixed(1)}`)}if(useBands&&last<lower){buy+=30;reasons.push("price below lower Bollinger Band")}if(useBands&&last>upper){sell+=30;reasons.push("price above upper Bollinger Band")}if(useMomentum&&momentum>0.002){buy+=level>=2?24:16;reasons.push("positive short-term momentum")}if(useMomentum&&momentum<-0.002){sell+=level>=2?24:16;reasons.push("negative short-term momentum")}if(level>=3&&preferred==="auto"){const trend=closes.slice(-10).reduce((a,b)=>a+b,0)/10-closes.slice(-20,-10).reduce((a,b)=>a+b,0)/10;if(trend>0)buy+=18;else sell+=18;reasons.push("multi-window trend confirmation")}const score=Math.max(buy,sell);if(score<45)return {side:"hold",strategy:preferred==="auto"?"multi-strategy":preferred,confidence:score,reason:reasons.join("; ")||"Indicators are neutral."};return {side:buy>=sell?"buy":"sell",strategy:preferred==="auto"?(level===1?"RSI scalping":level===2?"RSI + Bollinger":"multi-strategy confirmation"):preferred,confidence:Math.min(92,score),reason:reasons.join("; ")};}
async function log(userId:string,environment:string,symbol:string,s:Signal,positionId:string|null){await getD1().prepare(`INSERT INTO ai_trade_decisions(id,user_id,environment,market_symbol,strategy,signal,confidence,reason,position_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),userId,environment,symbol,s.strategy,s.side,s.confidence,s.reason,positionId,Date.now()).run();}
