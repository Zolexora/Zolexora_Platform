import type { RuntimeConfiguration } from '../types/runtime';

export interface ServiceConfig {
  service_provider: boolean;
  cargo: boolean;
  passenger: boolean;
  client: boolean;
}

export function resolveServiceConfig(
  runtime: RuntimeConfiguration | undefined,
  workspaceType?: string | null
): ServiceConfig {
  const saved = runtime?.extensions?.service_config as Partial<ServiceConfig> | undefined;
  if (saved && typeof saved === 'object') {
    return {
      service_provider: saved.service_provider ?? true,
      cargo: saved.cargo ?? true,
      passenger: saved.passenger ?? true,
      client: saved.client ?? false,
    };
  }
  if (workspaceType === 'CLIENT') {
    return {
      service_provider: false,
      cargo: false,
      passenger: false,
      client: true,
    };
  }
  return {
    service_provider: true,
    cargo: true,
    passenger: true,
    client: false,
  };
}
