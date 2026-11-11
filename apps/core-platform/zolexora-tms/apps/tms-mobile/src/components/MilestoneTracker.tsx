import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../lib/theme';
import { DutyStatus } from '../types/tms';

interface MilestoneTrackerProps {
  currentStatus: DutyStatus;
}

const MILESTONES = [
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'ARRIVED_PICKUP', label: 'At Pickup' },
  { key: 'IN_TRANSIT', label: 'In Transit' },
  { key: 'ARRIVED_DROP', label: 'At Drop' },
  { key: 'DUTY_COMPLETED', label: 'Completed' },
];

export const MilestoneTracker: React.FC<MilestoneTrackerProps> = ({ currentStatus }) => {
  const getStepIndex = (status: DutyStatus): number => {
    switch (status) {
      case DutyStatus.UNASSIGNED:
      case DutyStatus.ASSIGNED:
      case DutyStatus.DRIVER_ACCEPTANCE_PENDING:
        return -1;
      case DutyStatus.ACCEPTED:
      case DutyStatus.DISPATCHED:
        return 0;
      case DutyStatus.ARRIVED_PICKUP:
        return 1;
      case DutyStatus.IN_TRANSIT:
        return 2;
      case DutyStatus.ARRIVED_DROP:
        return 3;
      case DutyStatus.DUTY_COMPLETED:
        return 4;
      default:
        return -1;
    }
  };

  const currentIndex = getStepIndex(currentStatus);

  return (
    <View style={styles.container}>
      <View style={styles.stepRow}>
        {MILESTONES.map((step, idx) => {
          const isDone = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const isFuture = idx > currentIndex;

          return (
            <React.Fragment key={step.key}>
              <View style={styles.nodeWrapper}>
                <View
                  style={[
                    styles.node,
                    isDone && styles.nodeDone,
                    isCurrent && styles.nodeCurrent,
                    isFuture && styles.nodeFuture,
                  ]}
                >
                  <Text
                    style={[
                      styles.nodeText,
                      isDone && styles.nodeTextDone,
                      isCurrent && styles.nodeTextCurrent,
                      isFuture && styles.nodeTextFuture,
                    ]}
                  >
                    {isDone ? '✓' : idx + 1}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.label,
                    isCurrent && styles.labelCurrent,
                    isDone && styles.labelDone,
                  ]}
                  numberOfLines={1}
                >
                  {step.label}
                </Text>
              </View>
              {idx < MILESTONES.length - 1 && (
                <View
                  style={[
                    styles.connector,
                    idx < currentIndex ? styles.connectorDone : styles.connectorFuture,
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: theme.spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nodeWrapper: {
    alignItems: 'center',
    width: 62,
  },
  node: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  nodeDone: {
    backgroundColor: theme.colors.success,
  },
  nodeCurrent: {
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: theme.colors.primaryLight,
  },
  nodeFuture: {
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  nodeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  nodeTextDone: {
    color: '#FFFFFF',
  },
  nodeTextCurrent: {
    color: '#FFFFFF',
  },
  nodeTextFuture: {
    color: theme.colors.textMuted,
  },
  label: {
    fontSize: 10,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  labelCurrent: {
    color: theme.colors.primaryLight,
    fontWeight: '700',
  },
  labelDone: {
    color: theme.colors.textSecondary,
  },
  connector: {
    flex: 1,
    height: 2,
    marginBottom: 20,
  },
  connectorDone: {
    backgroundColor: theme.colors.success,
  },
  connectorFuture: {
    backgroundColor: theme.colors.border,
  },
});
