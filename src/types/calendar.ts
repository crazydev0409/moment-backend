export type CalendarProvider = 'google' | 'microsoft' | 'icloud';
export type CalendarIntegrationStatus = 'connected' | 'error';
export type MeetingLocationType = 'remote' | 'onsite';

export interface AvailabilitySlotInput {
  weekday: number;
  startMinutes: number;
  endMinutes: number;
}

export interface AvailabilityScheduleResponse {
  timezone: string;
  slots: AvailabilitySlotInput[];
}

export interface BookableUser {
  id: string;
  displayName: string;
  avatar?: string | null;
  isContact: boolean;
  timezone: string;
}

export interface CalendarEventSummary {
  id: string;
  source: 'catch' | CalendarProvider;
  sourceType: 'internal' | 'external';
  title: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  status?: string;
  meetingType?: string | null;
  locationType?: string;
  locationLabel?: string | null;
  locationAddress?: string | null;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
  compact: boolean;
}
