import { useState } from 'react';
import { WorkspaceSettingsPage } from '../organization/WorkspaceSettingsPage';
import { MembersPage } from '../organization/MembersPage';
import { RolesPage } from '../organization/RolesPage';

/** Client settings — centralised org profile, team management, and roles. */
export function ClientSettingsPage() {
  const [tab, setTab] = useState<'org' | 'team' | 'roles'>('org');

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-xl border border-slate-800 bg-slate-900 p-1 text-xs">
        {([
          ['org', 'Organisation Profile & Security'],
          ['team', 'Team & Invites'],
          ['roles', 'Roles & Permissions'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-2 font-medium transition ${
              tab === key ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'org' && <WorkspaceSettingsPage />}
      {tab === 'team' && <MembersPage />}
      {tab === 'roles' && <RolesPage />}
    </div>
  );
}
