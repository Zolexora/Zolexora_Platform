import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, Plus, Edit2, Trash2, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import {
  deleteCentralRole,
  listCentralRoles,
  updateCentralRole,
  type CentralRole,
} from '../../lib/authServiceApi';
import { RoleBuilder } from './RoleBuilder';

export function RolesPage() {
  const queryClient = useQueryClient();
  const { zolexoraOrgId, isCommander, hasAuthPermission } = useAuth();
  const canManageRoles = isCommander || hasAuthPermission('org:roles:manage');

  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CentralRole | null>(null);
  const [scopeFilter, setScopeFilter] = useState<'all' | 'tms' | 'org'>('all');

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['central-roles', zolexoraOrgId],
    queryFn: () => listCentralRoles(zolexoraOrgId!),
    enabled: !!zolexoraOrgId,
  });

  const deleteRoleMutation = useMutation({
    mutationFn: ({ roleId, moveTo }: { roleId: string; moveTo?: string }) =>
      deleteCentralRole(zolexoraOrgId!, roleId, moveTo),
    onSuccess: () => {
      toast.success('Role deleted');
      queryClient.invalidateQueries({ queryKey: ['central-roles', zolexoraOrgId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleDisableMutation = useMutation({
    mutationFn: ({ role, disabled, moveTo }: { role: CentralRole; disabled: boolean; moveTo?: string | null }) =>
      updateCentralRole(zolexoraOrgId!, role.id, { disabled, ...(moveTo !== undefined ? { move_to: moveTo } : {}) }),
    onSuccess: () => {
      toast.success('Role status updated');
      queryClient.invalidateQueries({ queryKey: ['central-roles', zolexoraOrgId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!zolexoraOrgId) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-sm text-slate-300">
        Link this workspace to a centralised Zolexora business first to manage business &amp; TMS roles.
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-8 text-slate-400">Loading centralised roles…</div>;
  }

  const filteredRoles = roles.filter((r) => scopeFilter === 'all' || r.scope === scopeFilter);

  const handleDeleteOrDisable = (role: CentralRole, action: 'delete' | 'disable') => {
    let moveTo: string | undefined;
    if ((role.members ?? 0) > 0 && role.scope === 'org') {
      const replacement = roles.find((other) => other.scope === role.scope && other.id !== role.id && !other.disabled && other.key !== 'owner');
      if (!replacement) {
        toast.error('Create or enable another role to move existing holders to first.');
        return;
      }
      moveTo = replacement.id;
    }
    if (action === 'delete') {
      deleteRoleMutation.mutate({ roleId: role.id, moveTo });
    } else {
      toggleDisableMutation.mutate({ role, disabled: true, moveTo: moveTo ?? null });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
            <Shield className="h-6 w-6 text-cyan-400" />
            Roles &amp; Permissions
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Centralised Business roles &amp; Zolexora TMS product roles stored in Auth Service.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900 p-1 text-xs">
            {(['all', 'tms', 'org'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScopeFilter(s)}
                className={`rounded-md px-3 py-1.5 font-medium uppercase ${
                  scopeFilter === s ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {s === 'all' ? 'All' : s === 'tms' ? 'TMS Roles' : 'Business Roles'}
              </button>
            ))}
          </div>

          {canManageRoles && (
            <button
              type="button"
              onClick={() => {
                setEditingRole(null);
                setIsBuilderOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
            >
              <Plus className="h-4 w-4" />
              Create Role
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
        <table className="min-w-full divide-y divide-slate-800">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Role Name</th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Scope</th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Permissions</th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Members</th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Status</th>
              <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filteredRoles.map((role) => (
              <tr key={role.id} className="hover:bg-slate-800/50 transition">
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="font-medium text-white">{role.name}</div>
                  {role.built_in && (
                    <span className="mt-1 inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-300">
                      Built-in
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-0.5 text-xs uppercase text-cyan-300">
                    {role.scope}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-400">
                  {role.permissions.length} permission{role.permissions.length === 1 ? '' : 's'}
                </td>
                <td className="px-6 py-4 text-sm text-slate-400">
                  {role.members ?? 0} member{(role.members ?? 0) === 1 ? '' : 's'}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      !role.disabled
                        ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-700/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {role.disabled ? 'DISABLED' : 'ACTIVE'}
                  </span>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                  {canManageRoles && role.key !== 'owner' && (
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRole(role);
                          setIsBuilderOpen(true);
                        }}
                        className="text-slate-400 hover:text-cyan-300"
                        title="Edit Role"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {!role.disabled ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteOrDisable(role, 'disable')}
                          className="text-slate-400 hover:text-amber-300"
                          title="Disable Role"
                        >
                          <Ban className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleDisableMutation.mutate({ role, disabled: false })}
                          className="text-xs text-cyan-400 hover:text-cyan-300"
                        >
                          Enable
                        </button>
                      )}
                      {!role.built_in && (
                        <button
                          type="button"
                          onClick={() => handleDeleteOrDisable(role, 'delete')}
                          className="text-slate-400 hover:text-red-400"
                          title="Delete Role"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {filteredRoles.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">
                  No roles found. Create a TMS role to assign product permissions to your team.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isBuilderOpen && (
        <RoleBuilder
          orgId={zolexoraOrgId}
          role={editingRole}
          onClose={() => setIsBuilderOpen(false)}
          onSuccess={() => {
            setIsBuilderOpen(false);
            queryClient.invalidateQueries({ queryKey: ['central-roles', zolexoraOrgId] });
          }}
        />
      )}
    </div>
  );
}
