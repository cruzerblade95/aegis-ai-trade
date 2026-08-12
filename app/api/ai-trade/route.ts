import {NextResponse} from "next/server";
import {getCurrentUser} from "../../auth/session";
import {getAiTradeLogs,getAiTradingSettings,runAiTradeCycle,saveAiTradingSettings} from "../../../db/ai-trading";
import {getUserPlan} from "../../../db/plans";
export const dynamic="force-dynamic";
export async function GET(){
 const user=await getCurrentUser();
 if(!user)return NextResponse.json({error:"Sign in required."},{status:401});
 const [settings,logs,plan]=await Promise.all([getAiTradingSettings(user.id),getAiTradeLogs(user.id,30),getUserPlan(user.id)]);
 return NextResponse.json({settings,logs,plan:{name:plan.name,scanIntervalSeconds:plan.scanIntervalSeconds}},{headers:{"Cache-Control":"no-store"}});
}
export async function PATCH(request:Request){const user=await getCurrentUser();if(!user)return NextResponse.json({error:"Sign in required."},{status:401});try{const body=await request.json() as Record<string,unknown>;const settings=await saveAiTradingSettings(user.id,{
 isEnabled:typeof body.isEnabled==="boolean"?body.isEnabled:undefined,
 environment:body.environment==="current"?"current":body.environment==="virtual"?"virtual":undefined,
 preferredStrategy:typeof body.preferredStrategy==="string"?body.preferredStrategy:undefined,
 volume:typeof body.volume==="number"?body.volume:undefined,
 takeProfitBps:typeof body.takeProfitBps==="number"?body.takeProfitBps:undefined,
 stopLossBps:typeof body.stopLossBps==="number"?body.stopLossBps:undefined,
 autoClose:typeof body.autoClose==="boolean"?body.autoClose:undefined,
});return NextResponse.json({settings});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to save AI settings."},{status:400});}}
export async function POST(request:Request){const user=await getCurrentUser();if(!user)return NextResponse.json({error:"Sign in required."},{status:401});try{const body=await request.json() as {force?:unknown};const result=await runAiTradeCycle(user.id,body.force===true);return NextResponse.json(result);}catch(error){console.error(error);return NextResponse.json({error:error instanceof Error?error.message:"AI scan failed."},{status:400});}}
