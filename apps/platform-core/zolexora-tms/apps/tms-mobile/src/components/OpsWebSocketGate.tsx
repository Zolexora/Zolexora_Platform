/**
 * OpsWebSocketGate – thin component that connects the real-time ops WebSocket
 * when the user is authenticated. Also registers the push notification token.
 * Renders nothing.
 *
 * Mounted inside <AuthProvider> so it always has access to the org ID.
 */

import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { stopBackgroundTripTracking } from '../lib/backgroundLocationTask';
import { useOpsWebSocket } from '../lib/useOpsWebSocket';
import { usePushNotifications } from '../lib/usePushNotifications';

export function OpsWebSocketGate() {
  const { organisation, isAuthenticated } = useAuth();
  const orgId = isAuthenticated ? organisation?.id : null;
  useOpsWebSocket(orgId);
  usePushNotifications(isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      stopBackgroundTripTracking().catch(() => {});
    }
  }, [isAuthenticated]);

  return null;
}
