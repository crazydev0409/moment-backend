interface DependencyStatus {
  status: 'connected' | 'disconnected' | 'unknown';
  error: string | null;
}

interface MemoryStatus {
  used: {
    value: number;
    unit: 'MB';
  };
  total: {
    value: number;
    unit: 'MB';
  };
  percentage: number;
}

interface ErrorDetails {
  message: string;
  stack?: string;
}

interface HealthDetails {
  memory: MemoryStatus;
  error?: ErrorDetails;
}

export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  service: string;
  dependencies: {
    twilio: DependencyStatus;
  };
  details: HealthDetails;
}
