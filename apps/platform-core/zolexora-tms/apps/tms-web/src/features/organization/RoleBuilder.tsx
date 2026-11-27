import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { X, Shield, Check } from 'lucide-react';
import {
  createCentralRole,
  getPermissionCatalog,
  updateCentralRole,
  type CatalogPermissionItem,
  type CentralRole,
} from '../../lib/authServiceApi';

interface RoleBuilderProps {
  orgId: string;
  role: CentralRole | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function RoleBuilder({ orgId, role, onClose, onSuccess }: RoleBuilderProps) {
  const [scope, setScope] = useState<'tms' | 'org'>((role?.scope as 'tms' | 'org') || 'tms');
  const [name, setName] = useState(role?.name || '');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set(role?.permissions || []));
  const [blockedKeys, setBlockedKeys] = useState<Set<string>>(new Set(role?.blocks || []));
  const [error, setError] = useState('');

  const { data: catalog, isLoading } = useQuery({
    queryKey: ['central-catalog', 'tms'],
    queryFn: () => getPermissionCatalog('tms'),
  });

  useEffect(() => {
    if (role) {
      setScope((role.scope as 'tms' | 'org') || 'tms');
      setName(role.name);
      setSelectedKeys(new Set(role.permissions || []));
      setBlockedKeys(new Set(role.blocks || []));
    }
  }, [role]);

  const isBuiltIn = !!role?.built_in;

  const availablePermissions: CatalogPermissionItem[] = (() => {
    if (!catalog) return [];
    const common = catalog.common || [];
    if (scope === 'org') {
      return [...(catalog.org || []), ...common];
    }
    const productPerms = (catalog.products || [])
      .filter((p) => p.product === 'tms' && p.status === 'active')
      .map((p) => ({ key: p.key, description: p.description }));
    return [...productPerms, ...common];
  })();

  const saveMutation = useMutation({
    mutationFn: () => {
      if (role) {
        if (isBuiltIn) {
          return updateCentralRole(orgId, role.id, { blocks: [...blockedKeys] });
        }
        return updateCentralRole(orgId, role.id, { name: name.trim(), permissions: [...selectedKeys] });
      }
      return createCentralRole(orgId, { scope, name: name.trim(), permissions: [...selectedKeys] });
    },
    onSuccess: () => onSuccess(),
    onError: (err: Error) => setError(err.message || 'Failed to save role'),
  });

  const toggleKey = (key: string) => {
    if (isBuiltIn) {
      setBlockedKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    } else {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isBuiltIn && !name.trim()) {
      setError('Role name is required');
      return;
    }
    saveMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-cyan-400" />
            <h3 className="text-lg font-semibold text-white">
              {isBuiltIn ? `Configure Built-in Role: ${role?.name}` : role ? `Edit Role: ${role.name}` : 'Create Centralised Role'}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Role Scope</label>
                <select
                  value={scope}
                  disabled={!!role}
                  onChange={(e) => {
                    setScope(e.target.value as 'tms' | 'org');
                    setSelectedKeys(new Set());
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none disabled:opacity-60"
                >
                  <option value="tms">TMS Product Role (tms:* &amp; common:*)</option>
                  <option value="org">Business Role (org:* &amp; common:*)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Role Name</label>
                <input
                  type="text"
                  required
                  disabled={isBuiltIn}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Fleet Dispatcher"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">
                {isBuiltIn
                  ? 'Select permissions to BLOCK from this built-in role'
                  : `Select Permissions (${selectedKeys.size} selected)`}
              </h4>

              {isLoading ? (
                <div className="py-8 text-center text-slate-400">Loading permission catalog…</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {availablePermissions.map((perm) => {
                    const checked = isBuiltIn ? blockedKeys.has(perm.key) : selectedKeys.has(perm.key);
                    return (
                      <label
                        key={perm.key}
                        onClick={() => toggleKey(perm.key)}
                        className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition ${
                          checked
                            ? isBuiltIn
                              ? 'border-red-700/50 bg-red-950/30'
                              : 'border-cyan-600/50 bg-cyan-950/30'
                            : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            checked
                              ? isBuiltIn
                                ? 'bg-red-600 border-red-600 text-white'
                                : 'bg-cyan-600 border-cyan-600 text-white'
                              : 'border-slate-600 bg-slate-900'
                          }`}
                        >
                          {checked && <Check className="h-3 w-3" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-mono text-xs text-white truncate">{perm.key}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{perm.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-800 bg-slate-900/50 px-6 py-4">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="rounded-lg bg-cyan-600 px-6 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Saving…' : isBuiltIn ? 'Save Blocks' : role ? 'Update Role' : 'Create Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
