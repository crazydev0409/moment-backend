export interface MomentRequest {
  id: string;
  senderId: string;
  receiverId: string;
  startTime: Date;
  endTime: Date;
  title: string;
  description: string | null;
  meetingType?: string | null;
  locationType?: string;
  locationLabel?: string | null;
  locationAddress?: string | null;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
  status: 'pending' | 'approved' | 'rejected' | 'rescheduled';
  createdAt: Date;
  updatedAt: Date;
  momentId?: number | null;
  sender?: {
    id: string;
    name: string | null;
    phoneNumber: string;
    avatar: string | null;
  };
  receiver?: {
    id: string;
    name: string | null;
    phoneNumber: string;
    avatar: string | null;
  };
}
