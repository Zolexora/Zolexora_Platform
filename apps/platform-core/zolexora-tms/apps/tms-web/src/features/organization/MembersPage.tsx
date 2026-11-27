import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Shield,
  ShieldAlert,
  Key,
  UserPlus,
  Mail,
  Trash2,
  Ban,
  CheckCircle2,
  RotateCcw,
  Copy,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import {
  createCentralInvite,
  createEmployeeDirect,
  getMemberAccess,
  getPermissionCatalog,
  listCentralInvites,
  listCentralMembers,
  listCentralRoles,
  removeCentralMember,
  resetEmployeePassword,
  revokeCentralInvite,
  setMemberPermissionOverride,
  setMemberProductRole,
  updateCentralMember,
  type CentralMember,
} from '../../lib/authServiceApi';

const inputCls =
  'w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none';

export function MembersPage() {
  const queryClient = useQueryClient();
  const { zolexoraOrgId, isCommander, hasAuthPermission } = useAuth();

  const canInvite = isCommander || hasAuthPermission('org:team:invite');
  const canManage = isCommander || hasAuthPermission('org:team:manage');
  const canAssignProductRole = isCommander || hasAuthPermission('org:roles:assign');
  const canOverride = isCommander || hasAuthPermission('org:access:override');

  const [selectedMember, setSelectedMember] = useState<CentralMember | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [explainMemberId, setExplainMemberId] = useState<string | null>(null);

  // Invite form state
  const [inviteKind, setInviteKind] = useState<'person' | 'employee'>('person');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteOrgRoleId, setInviteOrgRoleId] = useState('');
  const [inviteTmsRoleId, setInviteTmsRoleId] = useState('');
  const [shareLink, setShareLink] = useState<string | null>(null);

  // Direct create employee form state
  const [empEmail, setEmpEmail] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  const [empPassword, setEmpPassword] = useState('');
  const [empOrgRoleId, setEmpOrgRoleId] = useState('');
  const [empTmsRoleId, setEmpTmsRoleId] = useState('');

  // Override picker inside Manage Modal
  const [overridePerm, setOverridePerm] = useState('');
  const [overrideEffect, setOverrideEffect] = useState<'grant' | 'block'>('grant');

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['central-members', zolexoraOrgId],
    queryFn: () => listCentralMembers(zolexoraOrgId!),
    enabled: !!zolexoraOrgId,
  });

  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['central-roles', zolexoraOrgId],
    queryFn: () => listCentralRoles(zolexoraOrgId!),
    enabled: !!zolexoraOrgId,
  });

  const { data: invites = [] } = useQuery({
    queryKey: ['central-invites', zolexoraOrgId],
    queryFn: () => listCentralInvites(zolexoraOrgId!),
    enabled: !!zolexoraOrgId && canInvite,
  });

  const { data: catalog } = useQuery({
    queryKey: ['central-catalog', 'tms'],
    queryFn: () => getPermissionCatalog('tms'),
    enabled: !!zolexoraOrgId && canOverride,
  });

  const { data: memberAccess, isLoading: accessLoading } = useQuery({
    queryKey: ['central-member-access', zolexoraOrgId, explainMemberId],
    queryFn: () => getMemberAccess(zolexoraOrgId!, explainMemberId!),
    enabled: !!zolexoraOrgId && !!explainMemberId,
  });

  const orgRoles = roles.filter((r) => r.scope === 'org' && !r.disabled);
  const tmsRoles = roles.filter((r) => r.scope === 'tms' && !r.disabled);

  const refreshTeam = () => {
    queryClient.invalidateQueries({ queryKey: ['central-members', zolexoraOrgId] });
    queryClient.invalidateQueries({ queryKey: ['central-invites', zolexoraOrgId] });
    if (explainMemberId) {
      queryClient.invalidateQueries({ queryKey: ['central-member-access', zolexoraOrgId, explainMemberId] });
    }
  };

  const updateMemberMutation = useMutation({
    mutationFn: ({ memberId, patch }: { memberId: string; patch: { org_role_id?: string; status?: 'active' | 'suspended' } }) =>
      updateCentralMember(zolexoraOrgId!, memberId, patch),
    onSuccess: (updated) => {
      toast.success('Member updated');
      setSelectedMember(updated);
      refreshTeam();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const assignProductRoleMutation = useMutation({
    mutationFn: ({ memberId, roleId }: { memberId: string; roleId: string | null }) =>
      setMemberProductRole(zolexoraOrgId!, memberId, 'tms', roleId),
    onSuccess: () => {
      toast.success('TMS role updated');
      refreshTeam();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const overrideMutation = useMutation({
    mutationFn: ({ memberId, permission, effect }: { memberId: string; permission: string; effect: 'grant' | 'block' | null }) =>
      setMemberPermissionOverride(zolexoraOrgId!, memberId, permission, effect),
    onSuccess: () => {
      toast.success('Permission override saved');
      setOverridePerm('');
      refreshTeam();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => removeCentralMember(zolexoraOrgId!, memberId),
    onSuccess: () => {
      toast.success('Member removed');
      setSelectedMember(null);
      refreshTeam();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (memberId: string) => resetEmployeePassword(zolexoraOrgId!, memberId),
    onSuccess: (res) => {
      if (res.link) {
        setShareLink(res.link);
        toast.success('Reset link generated');
      } else {
        toast.success('Password reset link sent via email');
      }
      refreshTeam();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      createCentralInvite(zolexoraOrgId!, {
        kind: inviteKind,
        email: inviteEmail.trim() || undefined,
        phone_number: inviteKind === 'employee' && invitePhone.trim() ? invitePhone.trim() : undefined,
        org_role_id: inviteOrgRoleId || undefined,
        product_roles: inviteTmsRoleId ? { tms: inviteTmsRoleId } : undefined,
      }),
    onSuccess: (res) => {
      toast.success('Invitation created');
      setShowInviteModal(false);
      setInviteEmail('');
      setInvitePhone('');
      if (res.link) setShareLink(res.link);
      refreshTeam();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createEmployeeMutation = useMutation({
    mutationFn: () =>
      createEmployeeDirect({
        org_id: zolexoraOrgId!,
        email: empEmail.trim() || undefined,
        phone_number: empPhone.trim() || undefined,
        password: empPassword,
        org_role_id: empOrgRoleId || undefined,
        product_roles: empTmsRoleId ? { tms: empTmsRoleId } : undefined,
      }),
    onSuccess: (res) => {
      toast.success(`Staff account created (${res.employee.zolexora_id})`);
      setShowEmployeeModal(false);
      setEmpEmail('');
      setEmpPhone('');
      setEmpPassword('');
      refreshTeam();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revokeInviteMutation = useMutation({
    mutationFn: (inviteId: string) => revokeCentralInvite(zolexoraOrgId!, inviteId),
    onSuccess: () => {
      toast.success('Invitation revoked');
      refreshTeam();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!zolexoraOrgId) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-sm text-slate-300">
        Link this workspace to a centralised Zolexora business in <strong>Workspace & RBAC</strong> first to manage team members, invites, and roles.
      </div>
    );
  }

  if (membersLoading || rolesLoading) {
    return <div className="p-8 text-slate-400">Loading centralised team directory…</div>;
  }

  const allCatalogPerms = [
    ...(catalog?.org || []),
    ...(catalog?.common || []),
    ...(catalog?.products?.filter((p) => p.status === 'active').map((p) => ({ key: p.key, description: p.description })) || []),
  ];

  const liveSelected = selectedMember
    ? members.find((m) => m.id === selectedMember.id) || selectedMember
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-cyan-400" />
            Team & User Management
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Centralised people, staff logins, business &amp; TMS roles, overrides, and invitations for{' '}
            <span className="font-mono text-slate-300">{zolexoraOrgId}</span>.
          </p>
        </div>

        {canInvite && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowEmployeeModal(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              <Key className="h-4 w-4" /> Create Staff Login
            </button>
            <button
              type="button"
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500"
            >
              <UserPlus className="h-4 w-4" /> Invite Member
            </button>
          </div>
        )}
      </div>

      {shareLink && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-cyan-700/40 bg-cyan-950/30 p-4 text-xs">
          <div className="min-w-0">
            <p className="font-semibold text-cyan-300">Share this secure link (valid 7 days):</p>
            <p className="font-mono text-slate-200 truncate mt-1">{shareLink}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(shareLink);
                toast.success('Copied link');
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-cyan-700/40 px-3 py-1.5 text-cyan-200 hover:bg-cyan-900/40"
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
            <button
              type="button"
              onClick={() => setShareLink(null)}
              className="rounded-lg px-2 py-1 text-slate-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Team Members Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/50">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-slate-400">User</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Type</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Business Role</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-slate-400">TMS Role</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Status</th>
              <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {members.map((member) => {
              const orgRole = member.roles.find((r) => r.scope === 'org');
              const tmsRole = member.roles.find((r) => r.scope === 'tms');
              const isOwner = orgRole?.key === 'owner';
              return (
                <tr key={member.id} className="hover:bg-slate-800/40 transition">
                  <td className="px-5 py-4">
                    <div className="font-medium text-white">
                      {member.display_name || member.email || member.phone_number || member.zolexora_id}
                    </div>
                    <div className="text-xs text-slate-400">
                      <span className="font-mono">{member.zolexora_id}</span>
                      {(member.email || member.phone_number) && (
                        <span> · {member.email || member.phone_number}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-0.5 text-xs text-slate-300 capitalize">
                      {member.kind}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {isOwner ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
                        <ShieldAlert className="h-3.5 w-3.5" /> Owner
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 border border-slate-700 px-2.5 py-0.5 text-xs font-medium text-slate-200">
                        {orgRole?.name || 'Member'}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {isOwner ? (
                      <span className="text-xs text-slate-400 italic">Full TMS Access</span>
                    ) : tmsRole ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-cyan-950/60 border border-cyan-700/30 px-2.5 py-0.5 text-xs font-medium text-cyan-300">
                        <Shield className="h-3 w-3" /> {tmsRole.name}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">No TMS role</span>
                    )}
                    {member.overrides.length > 0 && (
                      <span className="ml-2 text-[11px] text-slate-400">
                        ({member.overrides.length} override{member.overrides.length === 1 ? '' : 's'})
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                        member.status === 'active'
                          ? 'bg-emerald-950/40 text-emerald-300 border-emerald-700/30'
                          : 'bg-red-950/40 text-red-300 border-red-700/30'
                      }`}
                    >
                      {member.status === 'active' ? <CheckCircle2 className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
                      {member.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right space-x-3 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setExplainMemberId(member.id)}
                      className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-cyan-300"
                    >
                      <Eye className="h-3.5 w-3.5" /> Explain
                    </button>
                    {!isOwner && (canManage || canAssignProductRole || canOverride) && (
                      <button
                        type="button"
                        onClick={() => setSelectedMember(member)}
                        className="text-xs font-medium text-cyan-400 hover:text-cyan-300"
                      >
                        Manage
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pending Invitations */}
      {canInvite && invites.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Mail className="h-4 w-4 text-cyan-400" />
            Pending Invitations ({invites.length})
          </h3>
          <div className="divide-y divide-slate-800">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-2.5 text-xs">
                <div>
                  <span className="font-medium text-slate-200">{inv.email || inv.phone_number}</span>
                  <span className="ml-2 text-slate-400 capitalize">({inv.kind}{inv.reset ? ' password reset' : ''})</span>
                  <span className="ml-2 text-slate-500">Expires {new Date(inv.expires_at).toLocaleDateString()}</span>
                </div>
                <button
                  type="button"
                  onClick={() => revokeInviteMutation.mutate(inv.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manage Member Modal */}
      {liveSelected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div>
              <h3 className="text-lg font-semibold text-white">
                Manage {liveSelected.display_name || liveSelected.email || liveSelected.zolexora_id}
              </h3>
              <p className="text-xs font-mono text-slate-400">{liveSelected.zolexora_id} · {liveSelected.kind}</p>
            </div>

            {canManage && (
              <label className="block text-xs font-medium text-slate-300">
                Business Role
                <select
                  className={`${inputCls} mt-1.5`}
                  value={liveSelected.roles.find((r) => r.scope === 'org')?.role_id || ''}
                  disabled={updateMemberMutation.isPending}
                  onChange={(e) =>
                    updateMemberMutation.mutate({ memberId: liveSelected.id, patch: { org_role_id: e.target.value } })
                  }
                >
                  {orgRoles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </label>
            )}

            {canAssignProductRole && (
              <label className="block text-xs font-medium text-slate-300">
                TMS Product Role
                <select
                  className={`${inputCls} mt-1.5`}
                  value={liveSelected.roles.find((r) => r.scope === 'tms')?.role_id || ''}
                  disabled={assignProductRoleMutation.isPending}
                  onChange={(e) =>
                    assignProductRoleMutation.mutate({ memberId: liveSelected.id, roleId: e.target.value || null })
                  }
                >
                  <option value="">-- No TMS Access --</option>
                  {tmsRoles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </label>
            )}

            {canOverride && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-300">Permission Overrides</p>
                <div className="flex gap-2">
                  <select className={`${inputCls} flex-1`} value={overridePerm} onChange={(e) => setOverridePerm(e.target.value)}>
                    <option value="">Select permission…</option>
                    {allCatalogPerms.map((p) => (
                      <option key={p.key} value={p.key}>{p.key}</option>
                    ))}
                  </select>
                  <select className={`${inputCls} w-28`} value={overrideEffect} onChange={(e) => setOverrideEffect(e.target.value as 'grant' | 'block')}>
                    <option value="grant">Grant</option>
                    <option value="block">Block</option>
                  </select>
                  <button
                    type="button"
                    disabled={!overridePerm || overrideMutation.isPending}
                    onClick={() => overrideMutation.mutate({ memberId: liveSelected.id, permission: overridePerm, effect: overrideEffect })}
                    className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Apply
                  </button>
                </div>
                {liveSelected.overrides.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {liveSelected.overrides.map((ov) => (
                      <span
                        key={ov.permission_key}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] border ${
                          ov.effect === 'grant'
                            ? 'border-emerald-700/40 bg-emerald-950/40 text-emerald-300'
                            : 'border-red-700/40 bg-red-950/40 text-red-300'
                        }`}
                      >
                        {ov.effect}: {ov.permission_key}
                        <button
                          type="button"
                          onClick={() => overrideMutation.mutate({ memberId: liveSelected.id, permission: ov.permission_key, effect: null })}
                          className="ml-1 hover:text-white"
                          title="Clear override"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {canManage && (
              <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() =>
                    updateMemberMutation.mutate({
                      memberId: liveSelected.id,
                      patch: { status: liveSelected.status === 'active' ? 'suspended' : 'active' },
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-xs font-medium text-amber-300 hover:bg-amber-950/60"
                >
                  <Ban className="h-3.5 w-3.5" />
                  {liveSelected.status === 'active' ? 'Suspend' : 'Reactivate'}
                </button>
                {liveSelected.kind === 'employee' && (
                  <button
                    type="button"
                    onClick={() => resetPasswordMutation.mutate(liveSelected.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Force Password Reset
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Remove this member and revoke all their sessions?')) {
                      removeMemberMutation.mutate(liveSelected.id);
                    }
                  }}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-red-800/60 bg-red-950/40 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-900/50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedMember(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Explain Access Modal */}
      {explainMemberId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-white">Effective Access &amp; Explanation</h3>
            {accessLoading ? (
              <div className="text-sm text-slate-400">Resolving access rules…</div>
            ) : memberAccess ? (
              <div className="space-y-4 text-xs">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-slate-200">
                    Role: {memberAccess.role || 'member'}
                  </span>
                  {memberAccess.is_owner && (
                    <span className="rounded-full border border-amber-600/40 bg-amber-950/40 px-3 py-1 text-amber-300">
                      Owner (Full Access)
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-slate-300 mb-2">
                    Granted Permissions ({memberAccess.permissions.length})
                  </p>
                  <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-slate-800 bg-slate-950 p-3">
                    {memberAccess.permissions.map((p) => (
                      <div key={p} className="flex items-center justify-between gap-2">
                        <span className="font-mono text-cyan-300">{p}</span>
                        <span className="text-slate-500">{(memberAccess.explain[p] || []).join(', ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setExplainMemberId(null)}
                className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <form
            className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              inviteMutation.mutate();
            }}
          >
            <h3 className="text-lg font-semibold text-white">Invite Team Member</h3>
            <div className="grid grid-cols-2 rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs">
              {(['person', 'employee'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setInviteKind(k)}
                  className={`py-2 rounded-lg font-medium capitalize ${inviteKind === k ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
                >
                  {k === 'person' ? 'Person (Zolexora Account)' : 'Staff / Employee'}
                </button>
              ))}
            </div>
            <label className="block text-xs font-medium text-slate-300">
              Email {inviteKind === 'employee' ? '(or leave blank for phone invite)' : ''}
              <input
                type="email"
                required={inviteKind === 'person'}
                className={`${inputCls} mt-1.5`}
                placeholder={inviteKind === 'person' ? 'person@example.com' : 'staff@company.com'}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </label>
            {inviteKind === 'employee' && (
              <label className="block text-xs font-medium text-slate-300">
                Phone Number (E.164, optional)
                <input
                  type="tel"
                  className={`${inputCls} mt-1.5`}
                  placeholder="+919876543210"
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                />
              </label>
            )}
            <label className="block text-xs font-medium text-slate-300">
              Business Role
              <select className={`${inputCls} mt-1.5`} value={inviteOrgRoleId} onChange={(e) => setInviteOrgRoleId(e.target.value)}>
                <option value="">Default (Member)</option>
                {orgRoles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-300">
              TMS Role (optional)
              <select className={`${inputCls} mt-1.5`} value={inviteTmsRoleId} onChange={(e) => setInviteTmsRoleId(e.target.value)}>
                <option value="">None</option>
                {tmsRoles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowInviteModal(false)} className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Cancel</button>
              <button type="submit" disabled={inviteMutation.isPending} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50">
                {inviteMutation.isPending ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Direct Create Employee Modal */}
      {showEmployeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <form
            className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              createEmployeeMutation.mutate();
            }}
          >
            <h3 className="text-lg font-semibold text-white">Create Staff Login Directly</h3>
            <p className="text-xs text-slate-400">Creates a Track 2 employee login (`ZX-...`) belonging to {zolexoraOrgId}.</p>
            <label className="block text-xs font-medium text-slate-300">
              Corporate Email (optional if phone set)
              <input type="email" className={`${inputCls} mt-1.5`} placeholder="staff@company.com" value={empEmail} onChange={(e) => setEmpEmail(e.target.value)} />
            </label>
            <label className="block text-xs font-medium text-slate-300">
              Phone Number (E.164, optional if email set)
              <input type="tel" className={`${inputCls} mt-1.5`} placeholder="+919876543210" value={empPhone} onChange={(e) => setEmpPhone(e.target.value)} />
            </label>
            <label className="block text-xs font-medium text-slate-300">
              Initial Password (12+ characters)
              <input type="password" required minLength={12} className={`${inputCls} mt-1.5`} value={empPassword} onChange={(e) => setEmpPassword(e.target.value)} />
            </label>
            <label className="block text-xs font-medium text-slate-300">
              Business Role
              <select className={`${inputCls} mt-1.5`} value={empOrgRoleId} onChange={(e) => setEmpOrgRoleId(e.target.value)}>
                <option value="">Default (Member)</option>
                {orgRoles.filter((r) => r.key !== 'owner').map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-300">
              TMS Role (optional)
              <select className={`${inputCls} mt-1.5`} value={empTmsRoleId} onChange={(e) => setEmpTmsRoleId(e.target.value)}>
                <option value="">None</option>
                {tmsRoles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowEmployeeModal(false)} className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Cancel</button>
              <button type="submit" disabled={createEmployeeMutation.isPending} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50">
                {createEmployeeMutation.isPending ? 'Creating…' : 'Create Staff'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
