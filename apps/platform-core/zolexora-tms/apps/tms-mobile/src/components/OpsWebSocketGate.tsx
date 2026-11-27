/**
 * OpsWebSocketGate – thin component that connects the real-time ops WebSocket
 * when the user is authenticated. Renders nothing.
 *
 * Mounted inside <AuthProvider> so it always has access to the org ID.
 * The hook itself manages reconnects and clean-up on unmount.
 */

import { useAuth } from '../context/AuthContext';
import { useOpsWebSocket } from '../lib/useOpsWebSocket';

export function OpsWebSocketGate() {
  const { organisation, isAuthenticated } = useAuth();
  const orgId = isAuthenticated ? organisation?.id : null;
  useOpsWebSocket(orgId);
  return null;
}
