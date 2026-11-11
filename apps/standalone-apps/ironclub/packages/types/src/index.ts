/**
 * Zolexora IronClub — Smart Gym & Health Club Management System
 * Core Shared Domain Types and Contracts
 */

export type UUID = string;

// Membership & User Roles
export type UserRole =
  | 'SUPER_ADMIN'
  | 'BRANCH_MANAGER'
  | 'FRONT_DESK'
  | 'TRAINER'
  | 'MEMBER'
  | 'MAINTENANCE_TECH';

export type MembershipTier =
  | 'BRONZE'         // Standard Gym Access (Off-Peak)
  | 'SILVER'         // All-Hours Gym Access
  | 'GOLD'           // Gym + Group Classes + Sauna/Recovery
  | 'BLACK_IRON_VIP'; // Unlimited 24/7 Multi-Branch + PT + VIP Recovery + Pro-Shop 15% off

export type MembershipStatus =
  | 'ACTIVE'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'FROZEN'
  | 'SUSPENDED'
  | 'PENDING_PAYMENT';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';

// Smart Turnstile & IoT Access Control
export type GateDeviceType =
  | 'TURNSTILE_TRIPOD'
  | 'FLAP_BARRIER'
  | 'SWING_SPEED_GATE'
  | 'RFID_WALL_READER'
  | 'FACIAL_BIOMETRIC_TERMINAL';

export type GateZone =
  | 'MAIN_ENTRY'
  | 'MAIN_EXIT'
  | 'FREE_WEIGHTS'
  | 'STUDIO_A'
  | 'STUDIO_B'
  | 'VIP_LOUNGE'
  | 'RECOVERY_SAUNA'
  | 'LOCKER_ROOM_MALE'
  | 'LOCKER_ROOM_FEMALE';

export type AccessDecision =
  | 'GRANTED'
  | 'DENIED_EXPIRED'
  | 'DENIED_UNPAID'
  | 'DENIED_OFF_PEAK'
  | 'DENIED_WRONG_BRANCH'
  | 'DENIED_FROZEN'
  | 'DENIED_OVER_CAPACITY'
  | 'DENIED_ANTI_PASSBACK'
  | 'DENIED_UNKNOWN_CREDENTIAL';

export interface AccessVerificationRequest {
  deviceId: string;
  credentialType: 'RFID_TAG' | 'QR_DYNAMIC_TOKEN' | 'BIOMETRIC_ID' | 'PIN';
  credentialValue: string;
  gateZone: GateZone;
  direction: 'ENTRY' | 'EXIT';
  timestamp: string;
}

export interface AccessVerificationResponse {
  decision: AccessDecision;
  accessGranted: boolean;
  memberId?: string;
  memberName?: string;
  memberPhotoUrl?: string;
  membershipTier?: MembershipTier;
  message: string;
  unlockDurationMs: number;
  currentGymOccupancy?: number;
  maxGymCapacity?: number;
}

export interface AccessLogEvent {
  id: string;
  timestamp: string;
  memberId?: string;
  memberName: string;
  memberPhotoUrl?: string;
  membershipTier?: MembershipTier;
  deviceId: string;
  deviceName: string;
  zone: GateZone;
  direction: 'ENTRY' | 'EXIT';
  decision: AccessDecision;
  reason?: string;
}

// Facility & Branch
export interface GymBranch {
  id: string;
  code: string; // e.g. "IC-BLR-01"
  name: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  maxCapacity: number;
  currentOccupancy: number;
  activeGateDevicesCount: number;
  openHours: {
    weekdays: string; // "05:30 - 23:00"
    weekends: string; // "06:00 - 21:00"
  };
  amenities: string[];
}

export interface GateDevice {
  id: string;
  branchId: string;
  name: string;
  type: GateDeviceType;
  zone: GateZone;
  ipAddress: string;
  macAddress: string;
  isOnline: boolean;
  lastHeartbeat: string;
  latencyMs: number;
  todayCyclesCount: number;
  firmwareVersion: string;
  isLockedDown: boolean;
}

// Gym Member
export interface GymMember {
  id: string;
  membershipNumber: string; // e.g. "IC-88910"
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: Gender;
  dob: string;
  avatarUrl: string;
  homeBranchId: string;
  tier: MembershipTier;
  status: MembershipStatus;
  joinDate: string;
  expiryDate: string;
  rfidTagId?: string;
  dynamicQrSecret?: string;
  emergencyContact: {
    name: string;
    phone: string;
    relation: string;
  };
  assignedTrainerId?: string;
  healthConditions?: string[];
  lockerNumber?: string;
  stats: {
    totalWorkouts: number;
    monthVisits: number;
    streakDays: number;
    lastVisit?: string;
  };
}

// Classes & Group Training
export type FitnessCategory =
  | 'HIIT'
  | 'POWERLIFTING'
  | 'CROSSFIT'
  | 'SPIN_CYCLING'
  | 'YOGA'
  | 'BOXING'
  | 'CALISTHENICS'
  | 'PILATES';

export interface FitnessClass {
  id: string;
  title: string;
  category: FitnessCategory;
  branchId: string;
  instructorId: string;
  instructorName: string;
  instructorAvatar: string;
  room: string;
  startTime: string; // ISO 8601
  endTime: string;
  durationMinutes: number;
  capacity: number;
  enrolledCount: number;
  waitlistCount: number;
  intensityLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'ALL_LEVELS';
  burnCaloriesEstimate: number;
  description: string;
}

export interface ClassBooking {
  id: string;
  classId: string;
  memberId: string;
  bookingTime: string;
  status: 'CONFIRMED' | 'ATTENDED' | 'CANCELLED' | 'WAITLISTED' | 'NO_SHOW';
}

// Trainer & Personal Training
export interface Trainer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatarUrl: string;
  specialties: string[];
  bio: string;
  experienceYears: number;
  activeClientsCount: number;
  rating: number;
  reviewsCount: number;
  hourlyRate: number;
  certifications: string[];
}

// Workout Routine & Nutrition
export interface ExerciseSet {
  setNumber: number;
  targetReps: number;
  targetWeightKg: number;
  completedReps?: number;
  completedWeightKg?: number;
  rpe?: number; // Rate of Perceived Exertion (1-10)
  isCompleted: boolean;
}

export interface WorkoutExercise {
  id: string;
  exerciseName: string;
  muscleGroup: 'CHEST' | 'BACK' | 'LEGS' | 'SHOULDERS' | 'ARMS' | 'CORE' | 'CARDIO';
  sets: ExerciseSet[];
  notes?: string;
  restTimerSeconds: number;
}

export interface DailyWorkoutRoutine {
  id: string;
  title: string;
  dayOfWeek: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
  targetMuscleGroups: string[];
  exercises: WorkoutExercise[];
  estimatedDurationMins: number;
}

export interface DailyNutritionGoal {
  calorieTarget: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  waterLiters: number;
}

export interface BodyCompositionRecord {
  id: string;
  memberId: string;
  date: string;
  weightKg: number;
  bodyFatPercentage?: number;
  muscleMassKg?: number;
  bmi: number;
  notes?: string;
}

// Smart Equipment Tracking
export type EquipmentHealth =
  | 'OPTIMAL'
  | 'INSPECTION_DUE'
  | 'REPAIR_SCHEDULED'
  | 'OUT_OF_SERVICE';

export interface SmartEquipment {
  id: string;
  assetTag: string; // e.g. "EQ-SMITH-04"
  name: string;
  category: 'FREE_WEIGHT' | 'SELECTORIZED_MACHINE' | 'PLATE_LOADED' | 'CARDIO' | 'CABLE_STATION' | 'RECOVERY';
  brand: string;
  zone: GateZone;
  status: EquipmentHealth;
  installedDate: string;
  lastMaintenanceDate: string;
  nextServiceDueDate: string;
  totalUsageHours: number;
  maintenanceTicketsCount: number;
}

// POS Pro-Shop & Invoicing
export interface PosItem {
  id: string;
  sku: string;
  name: string;
  category: 'SUPPLEMENTS' | 'BEVERAGES' | 'GEAR_APPAREL' | 'SNACKS' | 'DAY_PASS';
  price: number;
  stockQty: number;
  imageUrl?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  memberId: string;
  memberName: string;
  amount: number;
  taxAmount: number; // GST
  totalAmount: number;
  status: 'PAID' | 'PENDING' | 'OVERDUE' | 'REFUNDED';
  paymentGateway?: 'RAZORPAY' | 'CASHFREE' | 'UPI_QR' | 'CARD' | 'CASH';
  paymentDate?: string;
  dueDate: string;
  itemsDescription: string;
}

// Executive KPI & Analytics
export interface GymExecutiveStats {
  liveOccupancy: number;
  maxCapacity: number;
  occupancyPercentage: number;
  totalActiveMembers: number;
  todayCheckIns: number;
  mrrAmount: number;
  newJoinersThisMonth: number;
  activeClassesToday: number;
  equipmentHealthScore: number; // e.g. 96%
  peakHoursDistribution: { hour: string; count: number }[];
}
