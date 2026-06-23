export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'browser' | 'other';
  os: string;
  browser: string;
  browserVersion?: string;
  ipAddress: string;
  userAgent: string;
  fingerprint: string;
}

export interface DeviceApprovalRequest {
  deviceId: string;
  approvalToken: string;
}

export interface DeviceResponse {
  success: boolean;
  device?: any;
  devices?: any[];
  isTrusted?: boolean;
  error?: string;
}