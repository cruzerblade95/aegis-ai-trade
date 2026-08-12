"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import {usePathname} from "next/navigation";
import type {AiTradeLog,AiTradingSettings} from "../../db/ai-trading";

type MonitorPayload={
 settings:AiTradingSettings;
 logs:AiTradeLog[];
 plan:{name:string;scanIntervalSeconds:number};
};

export function AiTradeMonitor(){
 const pathname=usePathname();
 const [allowed,setAllowed]=useState(false);
 const [payload,setPayload]=useState<MonitorPayload|null>(null);
 const [open,setOpen]=useState(false);
 const [loading,setLoading]=useState(true);

 const refresh=useCallback(async()=>{
  try{
   const me=await fetch("/api/auth/me",{cache:"no-store"});
   const auth=await me.json() as {authenticated?:boolean;user?:{role?:string}|null};
   const canShow=Boolean(auth.authenticated&&auth.user?.role==="user"&&!pathname.startsWith("/admin"));
   setAllowed(canShow);
   if(!canShow){setPayload(null);return;}
   const response=await fetch("/api/ai-trade",{cache:"no-store"});
   if(!response.ok){setPayload(null);return;}
   const data=await response.json() as MonitorPayload;
   setPayload({...data,logs:data.logs.slice(0,30)});
  }catch{setPayload(null);}finally{setLoading(false);}
 },[pathname]);

 useEffect(()=>{void refresh();},[refresh]);
 useEffect(()=>{
  if(!allowed||!payload?.settings.isEnabled)return;
  const timer=window.setInterval(()=>void refresh(),10_000);
  return()=>window.clearInterval(timer);
 },[allowed,payload?.settings.isEnabled,refresh]);

 const nextScan=useMemo(()=>{
  if(!payload?.settings.lastScanAt)return "Waiting for first scan";
  const at=payload.settings.lastScanAt+payload.plan.scanIntervalSeconds*1000;
  return new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(at);
 },[payload]);

 if(loading||!allowed||!payload?.settings.isEnabled)return null;
 const logs=[...payload.logs].reverse();
 return <aside className={`ai-monitor ${open?"ai-monitor-open":"ai-monitor-closed"}`} aria-label="AI Trade activity monitor">
  {open?<div className="ai-monitor-window">
   <header className="ai-monitor-header">
    <div><span className="ai-monitor-pulse"/><strong>AI Trade running</strong><small>{payload.plan.name} · {payload.settings.environment} balance</small></div>
    <button aria-label="Minimise AI Trade monitor" onClick={()=>setOpen(false)} type="button">—</button>
   </header>
   <section className="ai-monitor-summary">
    <span><b>Strategy</b>{payload.settings.preferredStrategy}</span>
    <span><b>Volume</b>{payload.settings.volume}</span>
    <span><b>Next scan</b>{nextScan}</span>
   </section>
   <div className="ai-monitor-log" role="log" aria-live="polite">
    {logs.length===0?<p className="ai-monitor-empty">AI is enabled. Waiting for the first scheduled decision…</p>:logs.map(item=><article className={`ai-log-row ai-log-${item.signal}`} key={item.id}>
     <time>{new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(item.createdAt)}</time>
     <div><strong>{item.marketSymbol==="SYSTEM"?item.strategy:`${item.marketSymbol} · ${item.signal.toUpperCase()}`}</strong><span>{item.reason}</span><small>{item.marketSymbol!=="SYSTEM"?`${item.strategy} · ${item.confidence}% confidence`:item.environment}</small></div>
    </article>)}
   </div>
   <footer><span>Latest {payload.logs.length}/30 logs</span><button onClick={()=>void refresh()} type="button">Refresh</button></footer>
  </div>:<button className="ai-monitor-launcher" onClick={()=>setOpen(true)} type="button" aria-label="Open AI Trade monitor"><span className="ai-monitor-pulse"/><b>AI</b><small>Running</small></button>}
 </aside>;
}
