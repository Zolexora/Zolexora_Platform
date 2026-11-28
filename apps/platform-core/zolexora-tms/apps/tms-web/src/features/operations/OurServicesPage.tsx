import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  Plus,
  Pencil,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
  Package,
  Users,
} from 'lucide-react';
import { apiClient } from '../../lib/api';
import { useAuth } from '../auth/useAuth';
import { useApplicationRuntime } from '../../providers/ApplicationRuntimeProvider';
import { resolveServiceConfig } from '../../lib/serviceConfig';
import type {
  BookingServiceType,
  OrganisationService,
  OrganisationServiceCreate,
} from '../../types';

export function OurServicesPage() {
  const queryClient = useQueryClient();
  const { authMe } = useAuth();
  const runtime = useApplicationRuntime();
  const serviceConfig = resolveServiceConfig(runtime, authMe?.workspace_type);

  const defaultCat: BookingServiceType = serviceConfig.passenger ? 'PASSENGER' : 'CARGO';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<OrganisationService | null>(null);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState<OrganisationServiceCreate>({
    name: '',
    code: '',
    service_category: defaultCat,
    description: '',
    is_active: true,
  });

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['organisation-services'],
    queryFn: () => apiClient<OrganisationService[]>('/api/v1/services'),
  });

  const visibleServices = services.filter((s) => {
    if (serviceConfig.service_provider) {
      if (s.service_category === 'CARGO' && !serviceConfig.cargo) return false;
      if (s.service_category === 'PASSENGER' && !serviceConfig.passenger) return false;
    }
    return true;
  });

  const createMutation = useMutation({
    mutationFn: (payload: OrganisationServiceCreate) =>
      apiClient<OrganisationService>('/api/v1/services', {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          name: payload.name.trim(),
          code: payload.code?.trim() || undefined,
          description: payload.description?.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organisation-services'] });
      closeModal();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<OrganisationServiceCreate> }) =>
      apiClient<OrganisationService>(`/api/v1/services/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organisation-services'] });
      closeModal();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/api/v1/services/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['organisation-services'] }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', code: '', service_category: defaultCat, description: '', is_active: true });
    setFormError('');
    setIsModalOpen(true);
  };

  const openEdit = (svc: OrganisationService) => {
    setEditing(svc);
    setForm({
      name: svc.name,
      code: svc.code,
      service_category: svc.service_category,
      description: svc.description || '',
      is_active: svc.is_active,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
    setFormError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = form.name.trim();
    if (!cleanName) {
      setFormError('Service name is required.');
      return;
    }
    const duplicate = services.some(
      (s) => s.id !== editing?.id && s.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate) {
      setFormError(`Service "${cleanName}" already exists.`);
      return;
    }
    if (editing) {
      updateMutation.mutate({
        id: editing.id,
        payload: {
          name: cleanName,
          service_category: form.service_category,
          description: form.description?.trim() || '',
          is_active: form.is_active,
        },
      });
    } else {
      createMutation.mutate(form);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Create Services</h1>
          <p className="text-sm text-slate-400">
            Define your own transport service types. Active services appear in the Booking Type dropdown.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-navy-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-navy-800/30 hover:bg-navy-500 transition self-start"
        >
          <Plus className="h-4 w-4" />
          Add Service
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="border-b border-slate-800 bg-slate-950/80 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-5 py-3.5">Service Name</th>
              <th className="px-5 py-3.5">Code</th>
              <th className="px-5 py-3.5">Category</th>
              <th className="px-5 py-3.5">Description</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                  Loading services...
                </td>
              </tr>
            ) : visibleServices.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center">
                  <Briefcase className="mx-auto h-8 w-8 text-slate-600 mb-2" />
                  <p className="text-sm font-semibold text-slate-300">No services added yet</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Click &ldquo;Add Service&rdquo; to create your own booking types (e.g. Airport Transfer, ETS Shuttle, Cold Chain).
                  </p>
                </td>
              </tr>
            ) : (
              visibleServices.map((svc) => (
                <tr key={svc.id} className="hover:bg-slate-800/30 transition">
                  <td className="px-5 py-4 font-semibold text-white">{svc.name}</td>
                  <td className="px-5 py-4 font-mono text-xs text-silver-300">{svc.code}</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-200">
                      {svc.service_category === 'CARGO' ? (
                        <Package className="h-3 w-3 text-amber-300" />
                      ) : (
                        <Users className="h-3 w-3 text-indigo-300" />
                      )}
                      {svc.service_category}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-400 max-w-xs truncate">
                    {svc.description || '—'}
                  </td>
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() =>
                        updateMutation.mutate({ id: svc.id, payload: { is_active: !svc.is_active } })
                      }
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border transition ${
                        svc.is_active
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                          : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {svc.is_active && <CheckCircle2 className="h-3 w-3" />}
                      {svc.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openEdit(svc)}
                        className="rounded bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white transition"
                        title="Edit service"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(svc.id)}
                        disabled={deleteMutation.isPending}
                        className="rounded bg-rose-500/10 p-1.5 text-rose-400 hover:bg-rose-500/20 transition"
                        title="Delete service"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white">
                {editing ? 'Edit Service' : 'Add New Service'}
              </h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-sm text-rose-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-300">Service Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Airport Transfer, ETS Shuttle, Express Cargo"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
                />
              </div>

              {!editing && (
                <div>
                  <label className="block text-xs font-medium text-slate-300">Service Code (optional)</label>
                  <input
                    type="text"
                    value={form.code || ''}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="Auto-generated from name if left blank"
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white focus:border-navy-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300">Category *</label>
                <select
                  value={form.service_category}
                  onChange={(e) => setForm({ ...form, service_category: e.target.value as BookingServiceType })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
                >
                  {(!serviceConfig.service_provider || serviceConfig.passenger) && (
                    <option value="PASSENGER">Passenger</option>
                  )}
                  {(!serviceConfig.service_provider || serviceConfig.cargo) && (
                    <option value="CARGO">Cargo</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300">Description</label>
                <textarea
                  rows={2}
                  value={form.description || ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional details about this service..."
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl px-4 py-2 text-sm text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="rounded-xl bg-navy-600 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-500 disabled:opacity-50 transition"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editing
                    ? 'Save Changes'
                    : 'Add Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
