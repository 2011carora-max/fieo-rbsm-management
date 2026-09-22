import { useMemo, useState } from 'react';
import { TrendingUp, Globe2, Package, Handshake, ShoppingCart, BarChart3 } from 'lucide-react';
import { useActivities } from '@/hooks/useActivities';
import { ChartCard } from '@/components/ChartCard';
import { BarChart } from '@/components/charts/BarChart';
import { LineChart } from '@/components/charts/LineChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { HBarChart } from '@/components/charts/HBarChart';
import { KpiCard } from '@/components/KpiCard';
import {
  computeKpis, monthlyActivities, officePerformance, officeValuePerformance,
  buyerProductDistribution, computeBuyerDataKpis, countryDistribution, productDistribution, mouVsOrders, formatCurrency,
} from '@/data/analytics';
import { cn } from '@/lib/cn';

type Tab = 'overview' | 'offices' | 'countries' | 'products' | 'orders';

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: 'overview', label: 'Overview', icon: <BarChart3 size={16} /> },
  { id: 'offices', label: 'Offices', icon: <TrendingUp size={16} /> },
  { id: 'countries', label: 'Countries', icon: <Globe2 size={16} /> },
  { id: 'products', label: 'Products', icon: <Package size={16} /> },
  { id: 'orders', label: 'Orders & MoUs', icon: <ShoppingCart size={16} /> },
];

export function AnalyticsPage({ workflowType }: { workflowType: 'feedback' | 'buyer-data' }) {
  const { activities } = useActivities();
  const [tab, setTab] = useState<Tab>('overview');

  const workflowActivities = useMemo(() => activities.filter((a) => a.workflowType === workflowType), [activities, workflowType]);
  const kpis = useMemo(() => computeKpis(workflowActivities), [workflowActivities]);
  const buyerKpis = useMemo(() => computeBuyerDataKpis(workflowActivities), [workflowActivities]);
  const monthly = useMemo(() => monthlyActivities(workflowActivities), [workflowActivities]);
  const office = useMemo(() => officePerformance(workflowActivities), [workflowActivities]);
  const officeValue = useMemo(() => officeValuePerformance(workflowActivities), [workflowActivities]);
  const countries = useMemo(() => countryDistribution(workflowActivities), [workflowActivities]);
  const products = useMemo(() => productDistribution(workflowActivities), [workflowActivities]);
  const buyerProducts = useMemo(() => buyerProductDistribution(workflowActivities), [workflowActivities]);
  const mouOrders = useMemo(() => mouVsOrders(workflowActivities), [workflowActivities]);

  if (workflowType === 'buyer-data') {
    return (
      <div className="space-y-4 animate-fade-in">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Buyer Data Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Coverage insights for buyer data only.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard label="No. of Activities" value={buyerKpis.activities} icon={<BarChart3 size={20} />} accent="blue" />
          <KpiCard label="No. of Foreign Buyers" value={buyerKpis.foreignBuyers} icon={<Globe2 size={20} />} accent="saffron" />
          <KpiCard label="No. of Countries Covered" value={buyerKpis.countriesCovered} icon={<Globe2 size={20} />} accent="green" />
          <KpiCard label="Regional Offices Covered" value={buyerKpis.regionalOfficesCovered} icon={<TrendingUp size={20} />} accent="blue" />
          <KpiCard label="Unique Products / Sectors" value={buyerKpis.uniqueProducts} icon={<Package size={20} />} accent="saffron" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChartCard title="Activities by Regional Office" subtitle="Buyer-data records">
            <HBarChart data={office} />
          </ChartCard>
          <ChartCard title="Countries Covered" subtitle="Buyer countries">
            <DonutChart data={countries} />
          </ChartCard>
          <ChartCard title="Products / Sectors" subtitle="Buyer interest">
            <HBarChart data={buyerProducts} color="#df7620" limit={10} />
          </ChartCard>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Analytics</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Visual insights across offices, countries, products and outcomes.</p>
      </div>

      {/* Tabs */}
      <div className="card p-1.5 inline-flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition', tab === t.id ? 'bg-fieo-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800')}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total Activities" value={kpis.totalActivities} icon={<BarChart3 size={20} />} accent="blue" />
            <KpiCard label="Total Value Tracked" value={formatCurrency(kpis.mouExpectedValue + kpis.estimatedOrderValue + kpis.confirmedOrderValue)} icon={<TrendingUp size={20} />} accent="saffron" />
            <KpiCard label="Conversion Rate" value={`${kpis.totalActivities ? Math.round((kpis.ordersPlaced / kpis.totalActivities) * 100) : 0}%`} icon={<ShoppingCart size={20} />} accent="green" hint="Orders / Activities" />
            <KpiCard label="Avg Order Value" value={formatCurrency(kpis.ordersPlaced ? Math.round(kpis.confirmedOrderValue / kpis.ordersPlaced) : 0)} icon={<Handshake size={20} />} accent="blue" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Monthly Activities Trend" subtitle={`${new Date().getFullYear()}`}>
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
              />
            </ChartCard>
          </div>
        </div>
      )}

      {tab === 'offices' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Activities by Office" subtitle="Count per regional office">
            <HBarChart data={office} />
          </ChartCard>
          <ChartCard title="Value by Office" subtitle="Total value tracked (USD)" >
            <HBarChart data={officeValue} color="#df7620" valueFormat={(v) => formatCurrency(v)} />
          </ChartCard>
          <ChartCard title="Office Share of Activities" subtitle="Donut distribution" className="lg:col-span-2">
            <DonutChart data={office} />
          </ChartCard>
        </div>
      )}

      {tab === 'countries' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Buyer Country Distribution" subtitle="Top destinations">
            <DonutChart data={countries} />
          </ChartCard>
          <ChartCard title="Activities per Country" subtitle="Ranked bar">
            <HBarChart data={countries} color="#1f4a8a" />
          </ChartCard>
        </div>
      )}

      {tab === 'products' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Product Category Distribution" subtitle="Exporter product mix — top 10 by default">
            <HBarChart data={products} color="#df7620" limit={10} />
          </ChartCard>
          <ChartCard title="Product Share" subtitle="Donut view — top 10 by default">
            <DonutChart data={products} limit={10} />
          </ChartCard>
        </div>
      )}

      {tab === 'orders' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="MoUs Signed" value={kpis.mouSigned} icon={<Handshake size={20} />} accent="saffron" />
            <KpiCard label="MoU Expected Value" value={formatCurrency(kpis.mouExpectedValue)} icon={<TrendingUp size={20} />} accent="saffron" />
            <KpiCard label="Orders In Process" value={kpis.ordersInProcess} icon={<Package size={20} />} accent="blue" />
            <KpiCard label="Confirmed Order Value" value={formatCurrency(kpis.confirmedOrderValue)} icon={<ShoppingCart size={20} />} accent="green" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Outcome Funnel" subtitle="MoUs → In Process → Placed">
              <BarChart
                data={[
                  { label: 'MoUs', value: mouOrders.MoUs },
                  { label: 'In Process', value: mouOrders['In Process'] },
                  { label: 'Placed', value: mouOrders.Placed },
                ]}
                color="#1f4a8a"
              />
            </ChartCard>
            <ChartCard title="Monthly Activities" subtitle="Trend over the year">
              <LineChart data={monthly} color="#df7620" />
            </ChartCard>
          </div>
        </div>
      )}
    </div>
  );
}
