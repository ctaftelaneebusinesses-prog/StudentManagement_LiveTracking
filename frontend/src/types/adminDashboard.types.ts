export type TrendDirection = "up" | "down" | "flat";

export interface StatTrend {
  direction: TrendDirection;
  /** Percentage change vs the prior period, always positive — direction carries the sign. */
  percent: number;
  /** Whether an "up" move is the desirable outcome for this metric (false for e.g. absences). */
  upIsGood: boolean;
}

export interface StatCardData {
  id: string;
  label: string;
  value: number;
  /** Pre-formatted display value (currency, percent, etc.) — falls back to `value` if absent. */
  displayValue?: string;
  description: string;
  trend: StatTrend;
  /** 12-point sparkline series, oldest first. */
  spark: number[];
  icon: string;
}

export interface SeriesPoint {
  label: string;
  value: number;
}

export interface MultiSeriesPoint {
  label: string;
  [seriesKey: string]: string | number;
}

export interface CategorySlice {
  label: string;
  value: number;
}

export type ActivityKind =
  | "student"
  | "teacher"
  | "fee"
  | "announcement"
  | "leave"
  | "transport";

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  subtitle: string;
  timestamp: string;
}

export interface AdminDashboardOverview {
  stats: StatCardData[];
  charts: {
    monthlyFeeCollection: SeriesPoint[];
    studentAttendance: SeriesPoint[];
    teacherAttendance: MultiSeriesPoint[];
    classDistribution: CategorySlice[];
    feeTrend: SeriesPoint[];
    transportUsage: CategorySlice[];
  };
  activity: ActivityItem[];
}

export interface SchoolOption {
  id: string;
  name: string;
  shortName: string;
  studentCount: number;
}
