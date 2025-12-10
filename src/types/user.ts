export interface User {
  id: string;
  phoneNumber: string;
  verified: boolean;
  name?: string | null;
  avatar?: string | null;
  timezone: string;
  bio?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BlockedContact {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: Date;
  blocked?: {
    id: string;
    name?: string | null;
    avatar?: string | null;
    phoneNumber: string;
  };
}
