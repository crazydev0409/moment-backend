export interface Moment {
  id: number;
  userId: string;
  startTime: Date;
  endTime: Date;
  availability: 'public' | 'private';
  note?: string | null;
  icon?: string | null;
  allDay: boolean;
  sharedWith: string[]; // Array of user IDs who can see this moment's details
  createdAt: Date;
  updatedAt: Date;
}

export interface MomentCreate {
  startTime: Date | string;
  endTime: Date | string;
  availability: 'public' | 'private';
  note?: string | null;
  icon?: string | null;
  allDay?: boolean;
  sharedWith?: string[]; // Optional list of users to share with
}
