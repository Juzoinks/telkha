export type Status = "operational" | "degraded" | "down" | "unknown";
export type DeviceType = "ap" | "switch" | "gateway" | "controller";
export type Priority = "critical" | "high" | "medium" | "low";
export type TicketStatus = "open" | "in_progress" | "resolved";
export type RootCause =
  | "CLOUD_OUTAGE"
  | "SITE_NETWORK_DOWN"
  | "DEVICE_FAILURE"
  | "ISP_OR_UPSTREAM"
  | "UNVERIFIED_USER_ISSUE"
  | "PERFORMANCE_DEGRADATION";

export interface Device {
  id: string;
  schoolId: string;
  name: string;
  type: DeviceType;
  status: Status;
  lastSeen: number;
}

export interface School {
  id: string;
  name: string;
  region: string;
  devices: Device[];
  gatewayReachable: boolean;
  internetCheckOk: boolean;
  status: Status;
}

export interface TeacherReport {
  id: string;
  schoolId: string;
  type: "no_internet" | "slow_internet" | "device_not_working";
  message?: string;
  timestamp: number;
}

export interface CloudStatus {
  service: string;
  status: Status;
  latencyMs: number;
  lastCheck: number;
}

export interface Ticket {
  id: string;
  rootCause: RootCause;
  priority: Priority;
  status: TicketStatus;
  title: string;
  description: string;
  schoolIds: string[];
  deviceIds: string[];
  reportIds: string[];
  assignee?: string;
  createdAt: number;
  updatedAt: number;
}
