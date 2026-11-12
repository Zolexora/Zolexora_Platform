export const theme = {
  colors: {
    background: '#0B0F19',
    surface: '#151E2E',
    surfaceSubtle: '#1E293B',
    surfaceHighlight: '#2A374D',
    border: '#334155',
    borderSubtle: '#1E293B',
    
    // Brand
    primary: '#2563EB',
    primaryHover: '#1D4ED8',
    primaryLight: '#60A5FA',
    primaryMuted: 'rgba(37, 99, 235, 0.15)',
    
    // Status colors
    success: '#10B981',
    successMuted: 'rgba(16, 185, 129, 0.15)',
    warning: '#F59E0B',
    warningMuted: 'rgba(245, 158, 11, 0.15)',
    danger: '#EF4444',
    dangerMuted: 'rgba(239, 68, 68, 0.15)',
    info: '#0284C7',
    infoMuted: 'rgba(2, 132, 199, 0.15)',
    
    // Typography
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    textInverse: '#0B0F19',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  radius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 1.41,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
  },
};

export function getStatusColor(status: string): { bg: string; text: string; border: string } {
  switch (status) {
    case 'DUTY_COMPLETED':
      return { bg: theme.colors.successMuted, text: theme.colors.success, border: theme.colors.success };
    case 'IN_TRANSIT':
      return { bg: theme.colors.primaryMuted, text: theme.colors.primaryLight, border: theme.colors.primary };
    case 'ARRIVED_PICKUP':
    case 'ARRIVED_DROP':
      return { bg: theme.colors.infoMuted, text: theme.colors.info, border: theme.colors.info };
    case 'ASSIGNED':
    case 'DISPATCHED':
      return { bg: theme.colors.warningMuted, text: theme.colors.warning, border: theme.colors.warning };
    case 'DRIVER_ACCEPTANCE_PENDING':
      return { bg: 'rgba(168, 85, 247, 0.15)', text: '#C084FC', border: '#A855F7' };
    case 'CANCELLED':
      return { bg: theme.colors.dangerMuted, text: theme.colors.danger, border: theme.colors.danger };
    default:
      return { bg: theme.colors.surfaceSubtle, text: theme.colors.textSecondary, border: theme.colors.border };
  }
}
