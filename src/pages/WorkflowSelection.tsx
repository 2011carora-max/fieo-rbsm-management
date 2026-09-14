import { Building2, ClipboardCheck } from 'lucide-react';
import { FieoLogo } from '@/components/FieoLogo';
import { useAuth } from '@/context/AuthContext';

type WorkflowType = 'feedback' | 'buyer-data';

interface WorkflowSelectionProps {
  onSelect: (workflow: WorkflowType) => void;
}

export function WorkflowSelection({ onSelect }: WorkflowSelectionProps) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Government header band */}
      <div className="bg-fieo-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between text-xs">
          <span className="flex items-center gap-2">
            <Building2 size={14} />
            Ministry of Commerce &amp; Industry, Government of India
          </span>
          <span className="hidden sm:inline">https://www.fieo.org</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-16">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-4">
            <FieoLogo size={56} />
            <div>
              <h1 className="font-serif text-2xl font-bold text-fieo-700 dark:text-white">FIEO</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">RBSM Management System</p>
            </div>
          </div>
          <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
            Select Workflow
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">
            Choose how you would like to proceed. You can add feedback from RBSM/BSM events or enter buyer data.
          </p>
          {user && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              Logged in as: {user.name} ({user.email})
            </p>
          )}
        </div>

        {/* Workflow Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
          {/* Feedback Card */}
          <button
            onClick={() => onSelect('feedback')}
            className="group card p-8 text-left hover:shadow-lg transition-all duration-200 border-2 border-transparent hover:border-fieo-600 focus:outline-none focus:ring-2 focus:ring-fieo-600"
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-fieo-100 dark:bg-fieo-900/50 flex items-center justify-center text-fieo-600 dark:text-fieo-300 group-hover:bg-fieo-600 group-hover:text-white transition-colors">
                <ClipboardCheck size={28} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-fieo-600 transition-colors">
                  Add RBSM/BSM Feedback
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                  Submit feedback from Buyer-Seller Meets and RBSM events. This data will be available in the Feedback Reports section based on your access permissions.
                </p>
                <div className="mt-4 flex items-center text-fieo-600 dark:text-fieo-400 text-sm font-medium group-hover:text-fieo-700">
                  Select this option
                  <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </button>

          {/* Buyer Data Card */}
          <button
            onClick={() => onSelect('buyer-data')}
            className="group card p-8 text-left hover:shadow-lg transition-all duration-200 border-2 border-transparent hover:border-saffron-600 focus:outline-none focus:ring-2 focus:ring-saffron-600"
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-saffron-100 dark:bg-saffron-900/50 flex items-center justify-center text-saffron-600 dark:text-saffron-300 group-hover:bg-saffron-600 group-hover:text-white transition-colors">
                <Building2 size={28} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-saffron-600 transition-colors">
                  Enter Buyer Data
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                  Enter detailed buyer information from events. This data will be stored separately and is only accessible to Admin users in the Buyer's Data reports.
                </p>
                <div className="mt-4 flex items-center text-saffron-600 dark:text-saffron-400 text-sm font-medium group-hover:text-saffron-700">
                  Select this option
                  <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Logout */}
        <div className="mt-10">
          <button
            onClick={logout}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline underline-offset-2"
          >
            Sign out
          </button>
        </div>
      </div>

      <footer className="px-4 lg:px-6 py-4 text-center text-xs text-gray-400 border-t border-gray-100 dark:border-gray-800">
        FIEO RBSM Management System · Federation of Indian Export Organisations · Ministry of Commerce &amp; Industry, Government of India
      </footer>
    </div>
  );
}
