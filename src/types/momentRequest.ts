export interface MomentRequest {
  id: string;
  senderId: string;
  receiverId: string;
  startTime: Date;
  endTime: Date;
  title: string;
  description: string | null;
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
