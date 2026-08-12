import {NextResponse} from "next/server";
import {getCurrentUser} from "../../auth/session";
import {getUserPlan,listTradingPlans,purchasePlan,type BillingCycle} from "../../../db/plans";
export const dynamic="force-dynamic";
export async function GET(){const user=await getCurrentUser();if(!user)return NextResponse.json({error:"Sign in required."},{status:401});return NextResponse.json({plans:await listTradingPlans(),currentPlan:await getUserPlan(user.id)});}
export async function POST(request:Request){const user=await getCurrentUser();if(!user)return NextResponse.json({error:"Sign in required."},{status:401});try{const body=await request.json() as {planId?:unknown;billingCycle?:unknown};if(typeof body.planId!=="string")throw new Error("Choose a valid plan.");const billingCycle:BillingCycle=body.billingCycle==="yearly"?"yearly":"monthly";await purchasePlan(user.id,body.planId,billingCycle);return NextResponse.json({currentPlan:await getUserPlan(user.id)});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to purchase plan."},{status:400});}}
