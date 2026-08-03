import {
  MapPin, CalendarDays, Building2, Users, Handshake, ShoppingCart, Package,
  FileText, MessageSquare, Clock, Globe2, Phone, Mail, Hash, Tag,
} from 'lucide-react';
import { Modal } from '@/components/Modal';
import { formatFullCurrency } from '@/data/analytics';
import type { Activity } from '@/types';
import { officeName } from '@/types';

// Read-only detail view of a single activity, laid out as a printable summary.
export function ActivityViewModal({ open, onClose, activity }: { open: boolean; onClose: () => void; activity: Activity | null }) {
  if (!activity) return null;
  const a = activity;
  const isReverseBSM = a.event.eventType === 'Reverse BSM';

  const Section = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
    <div className="rounded-lg border border-gray-100 dark:border-gray-800 p-4">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-fieo-700 dark:text-fieo-200 mb-3">
        <span className="text-fieo-500">{icon}</span>
        {title}
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">{children}</div>
    </div>
  );

  const Row = ({ label, value, icon }: { label: string; value?: React.ReactNode; icon?: React.ReactNode }) => (
    <div className="flex items-start gap-2 py-1">
      {icon && <span className="text-gray-400 mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">
        <p className="text-[11px] text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-gray-700 dark:text-gray-200 break-words">{value || <span className="text-gray-300 dark:text-gray-600">—</span>}</p>
      </div>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title={`Activity ${a.id}`} subtitle={`${officeName(a.event.regionalOffice)} · ${a.event.eventDate}`} size="lg">
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className={`badge ${a.status === 'Completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-200' : a.status === 'In Process' ? 'bg-fieo-100 text-fieo-700 dark:bg-fieo-900/50 dark:text-fieo-200' : 'bg-saffron-100 text-saffron-700 dark:bg-saffron-900/50 dark:text-saffron-200'}`}>
            {a.status}
          </span>
          <span className="text-xs text-gray-400">Created by {a.createdByName} · Updated {new Date(a.updatedAt).toLocaleDateString()}</span>
        </div>

        <Section title="Event Details" icon={<CalendarDays size={16} />}>
          <Row label="BSM Name" value={a.event.bsmName} />
          <Row label="Regional Office" value={officeName(a.event.regionalOffice)} icon={<MapPin size={14} />} />
          <Row label="Event Date" value={a.event.eventDate} icon={<CalendarDays size={14} />} />
          <Row label="Event Type" value={a.event.eventType} icon={<Tag size={14} />} />
          <Row label="Venue" value={a.event.venue} />
          <Row label="City / State" value={`${a.event.city}, ${a.event.state}`} />
          <Row label="Country" value={a.event.country} icon={<Globe2 size={14} />} />
          <Row label="Exporters / Buyers" value={`${a.event.exporterCount} / ${a.event.buyerCount}`} icon={<Users size={14} />} />
        </Section>

        {isReverseBSM && (
          <Section title="Exporter" icon={<Building2 size={16} />}>
            <Row label="Exporter Name" value={a.exporter.exporterName} />
            <Row label="Company" value={a.exporter.companyName} />
            <Row label="IEC Number" value={a.exporter.iecNumber} icon={<Hash size={14} />} />
            <Row label="Product Category" value={a.exporter.productCategory} icon={<Tag size={14} />} />
            <Row label="Email" value={a.exporter.email} icon={<Mail size={14} />} />
            <Row label="Phone" value={a.exporter.phone} icon={<Phone size={14} />} />
            <Row label="Website" value={a.exporter.website} />
            <Row label="Address" value={a.exporter.address} />
          </Section>
        )}

        {!isReverseBSM && (
          <Section title="Buyer" icon={<Users size={16} />}>
            <Row label="Buyer Name" value={a.buyer.buyerName} />
            <Row label="Company Name" value={a.buyer.company} />
            <Row label="Country" value={a.buyer.country} icon={<Globe2 size={14} />} />
            <Row label="Phone / WhatsApp" value={a.buyer.phone} icon={<Phone size={14} />} />
            <Row label="Passport Number" value={a.buyer.passportNumber} icon={<Hash size={14} />} />
            <Row label="Interested Products" value={a.buyer.interestedProducts} />
          </Section>
        )}

        {isReverseBSM && (
        <Section title="Outcome Tracking" icon={<Handshake size={16} />}>
          <Row label="MoU Signed" value={a.mou.signed ? 'Yes' : 'No'} icon={<Handshake size={14} />} />
          {a.mou.signed && (
            <>
              <Row label="Expected Value" value={a.mou.expectedValue ? formatFullCurrency(a.mou.expectedValue, a.mou.currency) : '—'} />
              <Row label="Expected Timeline" value={a.mou.expectedTimeline} />
            </>
          )}
          <Row label="Order In Process" value={a.orderInProcess.active ? 'Yes' : 'No'} icon={<Package size={14} />} />
          {a.orderInProcess.active && (
            <>
              <Row label="Estimated Value" value={a.orderInProcess.estimatedValue ? formatFullCurrency(a.orderInProcess.estimatedValue, a.orderInProcess.currency) : '—'} />
              <Row label="Expected Closure" value={a.orderInProcess.expectedClosureDate} />
              <Row label="Probability" value={a.orderInProcess.probability ? `${a.orderInProcess.probability}%` : '—'} />
              <Row label="Remarks" value={a.orderInProcess.remarks} />
            </>
          )}
          <Row label="Order Placed" value={a.orderPlaced.placed ? 'Yes' : 'No'} icon={<ShoppingCart size={14} />} />
          {a.orderPlaced.placed && (
            <>
              <Row label="Final Value" value={a.orderPlaced.finalValue ? formatFullCurrency(a.orderPlaced.finalValue, a.orderPlaced.currency) : '—'} />
              <Row label="PO Number" value={a.orderPlaced.purchaseOrderNumber} />
              <Row label="Order Date" value={a.orderPlaced.orderDate} />
            </>
          )}
        </Section>
        )}

        {isReverseBSM && (
        <Section title="Remarks & Follow-up" icon={<MessageSquare size={16} />}>
          <Row label="General Remarks" value={a.remarks.general} />
          <Row label="Challenges Faced" value={a.remarks.challenges} />
          <Row label="Success Story" value={a.remarks.successStory} />
          <Row label="Follow-up Required" value={a.remarks.followUpRequired ? 'Yes' : 'No'} icon={<Clock size={14} />} />
          <Row label="Next Follow-up Date" value={a.remarks.nextFollowUpDate} icon={<CalendarDays size={14} />} />
        </Section>
        )}

        {a.documents.length > 0 && (
          <Section title="Documents" icon={<FileText size={16} />}>
            <div className="sm:col-span-2">
              <ul className="space-y-2">
                {a.documents.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
                    <span className="w-8 h-8 rounded-lg bg-fieo-100 dark:bg-fieo-900/50 text-fieo-600 flex items-center justify-center shrink-0">
                      <FileText size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{d.name}</p>
                      <p className="text-[11px] text-gray-400">{d.kind} · {(d.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <a href={d.dataUrl} download={d.name} className="btn-secondary text-xs py-1.5 px-3">Download</a>
                  </li>
                ))}
              </ul>
            </div>
          </Section>
        )}
      </div>
    </Modal>
  );
}
