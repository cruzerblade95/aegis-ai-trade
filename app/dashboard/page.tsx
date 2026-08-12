import {requireUser} from "../auth/session";
import {ProtectedLayout} from "../components/protected-layout";
import {TradingDashboard} from "../components/trading-dashboard";
import {getDashboardData} from "../../db/dashboard";
export const dynamic="force-dynamic";
export default async function DashboardPage(){const user=await requireUser("/dashboard");const data=await getDashboardData(user.id);return <ProtectedLayout user={user}><section className="dashboard-content"><TradingDashboard data={data} name={user.displayName} email={user.email}/></section></ProtectedLayout>}
