import { useMemo } from 'react';
import {
  ClipboardList, Users, Globe2, FileSignature, TrendingUp, Package, ShoppingCart,
  IndianRupee, MapPin, FolderOpen, Clock, CalendarClock,
} from 'lucide-react';
import { KpiCard } from '@/components/KpiCard';
import { ChartCard } from '@/components/ChartCard';
import { BarChart } from '@/components/charts/BarChart';
import { LineChart } from '@/components/charts/LineChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { HBarChart } from '@/components/charts/HBarChart';
import { EmptyState } from '@/components/EmptyState';
import { useActivities } from '@/hooks/useActivities';
import {
  computeBuyerDataKpis, computeKpis, monthlyActivities, officePerformance, countryDistribution,
  productDistribution, mouVsOrders, upcomingFollowups, recentActivities,
  topPerformingOffices, formatCurrency,
} from '@/data/analytics';
import type { Activity } from '@/types';
import { officeName, officeCode } from '@/types';

function statusBadge(status: Activity['status']) {
  const map: Record<Activity['status'], string> = {
    Draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    'Follow-up Required': 'bg-saffron-100 text-saffron-700 dark:bg-saffron-900/50 dark:text-saffron-200',
    'In Process': 'bg-fieo-100 text-fieo-700 dark:bg-fieo-900/50 dark:text-fieo-200',
    Completed: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-200',
    Cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200',
  };
  return <span className={`badge ${map[status]}`}>{status}</span>;
}

export function DashboardPage({ workflowType }: { workflowType: 'feedback' | 'buyer-data' }) {
  const { activities, loading, error, refresh } = useActivities();
  const workflowActivities = useMemo(() => activities.filter((a) => a.workflowType === workflowType), [activities, workflowType]);
  const kpis = useMemo(() => computeKpis(workflowActivities), [workflowActivities]);
  const buyerKpis = useMemo(() => computeBuyerDataKpis(workflowActivities), [workflowActivities]);
  const monthly = useMemo(() => monthlyActivities(workflowActivities), [workflowActivities]);
  const office = useMemo(() => officePerformance(workflowActivities), [workflowActivities]);
  const countries = useMemo(() => countryDistribution(workflowActivities), [workflowActivities]);
  const products = useMemo(() => productDistribution(workflowActivities), [workflowActivities]);
  const mouOrders = useMemo(() => mouVsOrders(workflowActivities), [workflowActivities]);
  const followups = useMemo(() => upcomingFollowups(workflowActivities), [workflowActivities]);
  const recent = useMemo(() => recentActivities(workflowActivities), [workflowActivities]);
  const topOffices = useMemo(() => topPerformingOffices(workflowActivities), [workflowActivities]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl skeleton" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-6 text-center space-y-3">
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        <button className="btn-secondary mx-auto" onClick={() => void refresh()}>Retry</button>
      </div>
    );
  }

  if (workflowType === 'buyer-data') {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Buyer Data Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Buyer coverage and data-collection overview.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard label="No. of Activities" value={buyerKpis.activities} icon={<ClipboardList size={20} />} accent="blue" />
          <KpiCard label="No. of Foreign Buyers" value={buyerKpis.foreignBuyers} icon={<Users size={20} />} accent="saffron" />
          <KpiCard label="No. of Countries Covered" value={buyerKpis.countriesCovered} icon={<Globe2 size={20} />} accent="green" />
          <KpiCard label="Regional Offices Covered" value={buyerKpis.regionalOfficesCovered} icon={<MapPin size={20} />} accent="blue" />
          <KpiCard label="Unique Products / Sectors" value={buyerKpis.uniqueProducts} icon={<Package size={20} />} accent="saffron" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <KpiCard label="Total Activities" value={kpis.totalActivities} icon={<ClipboardList size={20} />} accent="blue" />
        <KpiCard label="Exporters Participated" value={kpis.totalExporters} icon={<Users size={20} />} accent="saffron" />
        <KpiCard label="Foreign Buyers" value={kpis.totalForeignBuyers} icon={<Users size={20} />} accent="blue" />
        <KpiCard label="Countries Covered" value={kpis.countriesCovered} icon={<Globe2 size={20} />} accent="green" />
        <KpiCard label="MoUs Signed" value={kpis.mouSigned} icon={<FileSignature size={20} />} accent="saffron" />
        <KpiCard label="MoU Expected Value" value={formatCurrency(kpis.mouExpectedValue)} icon={<TrendingUp size={20} />} accent="saffron" hint="USD equivalent" />
        <KpiCard label="Orders In Process" value={kpis.ordersInProcess} icon={<Package size={20} />} accent="blue" />
        <KpiCard label="Estimated Order Value" value={formatCurrency(kpis.estimatedOrderValue)} icon={<TrendingUp size={20} />} accent="blue" />
        <KpiCard label="Orders Placed" value={kpis.ordersPlaced} icon={<ShoppingCart size={20} />} accent="green" />
        <KpiCard label="Confirmed Order Value" value={formatCurrency(kpis.confirmedOrderValue)} icon={<IndianRupee size={20} />} accent="green" />
        <KpiCard label="Regional Offices Active" value={kpis.regionalOfficesActive} icon={<MapPin size={20} />} accent="gray" />
        <KpiCard label="Documents Uploaded" value={kpis.documentsUploaded} icon={<FolderOpen size={20} />} accent="gray" />
        <KpiCard label="Pending Follow-ups" value={kpis.pendingFollowups} icon={<Clock size={20} />} accent="red" />
        <KpiCard label="Total Value Tracked" value={formatCurrency(kpis.mouExpectedValue + kpis.estimatedOrderValue + kpis.confirmedOrderValue)} icon={<TrendingUp size={20} />} accent="blue" hint="MoU + Est. + Confirmed" />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Monthly Activities" subtitle={`${new Date().getFullYear()} — count per month`} className="lg:col-span-2">
          <LineChart data={monthly} />
        </ChartCard>
        <ChartCard title="MoUs vs Orders" subtitle="Outcome funnel">
          <BarChart
            data={[
              { label: 'MoUs', value: mouOrders.MoUs },
              { label: 'In Process', value: mouOrders['In Process'] },
              { label: 'Placed', value: mouOrders.Placed },
            ]}
            color="#df7620"
            height={220}
          />
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Regional Office Performance" subtitle="Activities per office">
          <HBarChart data={office} />
        </ChartCard>
        <ChartCard title="Buyer Country Distribution" subtitle="Top destinations">
          <DonutChart data={countries} />
        </ChartCard>
      </div>

      {/* Charts row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Product Category Distribution" subtitle="Exporter product mix">
          <HBarChart data={products} color="#df7620" />
        </ChartCard>
        <ChartCard title="Top Performing Offices" subtitle="By total value tracked (USD)">
          <HBarChart data={topOffices} valueFormat={(v) => formatCurrency(v)} />
        </ChartCard>
      </div>

      {/* Tables row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Recent Activities" subtitle="Latest updated records">
          {recent.length === 0 ? (
            <EmptyState title="No activities yet" message="Create your first Buyer-Seller Meet record to see it here." />
          ) : (
            <div className="space-y-2">
              {recent.map((a) => (
                <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                  <div className="w-9 h-9 rounded-lg bg-fieo-50 dark:bg-fieo-900/40 text-fieo-600 dark:text-fieo-300 flex items-center justify-center text-xs font-semibold shrink-0">
                    {officeCode(a.event.regionalOffice)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{a.exporter.exporterName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{a.buyer.buyerName} · {a.buyer.country}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {statusBadge(a.status)}
                    <p className="text-[10px] text-gray-400 mt-1">{a.event.eventDate}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ChartCard>

        <ChartCard title="Upcoming Follow-ups" subtitle="Scheduled next actions">
          {followups.length === 0 ? (
            <EmptyState title="No pending follow-ups" message="All caught up — no follow-ups scheduled." icon={<CalendarClock size={28} />} />
          ) : (
            <div className="space-y-2">
              {followups.map((a) => (
                <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                  <div className="w-9 h-9 rounded-lg bg-saffron-50 dark:bg-saffron-900/40 text-saffron-600 dark:text-saffron-300 flex items-center justify-center shrink-0">
                    <Clock size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{a.exporter.exporterName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{a.buyer.buyerName} · {officeName(a.event.regionalOffice)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium text-saffron-600 dark:text-saffron-300">{a.remarks.nextFollowUpDate}</p>
                    <p className="text-[10px] text-gray-400">{a.buyer.country}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
