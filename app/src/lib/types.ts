export interface Court {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  courtCount: number;
  surface: string | null;
  indoorOutdoor: string | null;
  amenities: string[];
  accessType: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  bookingLink: string | null;
  priceInfo: string | null;
  heroImageUrl: string | null;
  isPartner: boolean;
  distance?: number;
  rating?: number;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  skillLevel: number;
  skillSource: string;
  homeLat: number | null;
  homeLng: number | null;
  homeLocationName: string | null;
  onboardingStep: number;
  onboardingCompleted: boolean;
  createdAt: string;
}

export interface Game {
  id: string;
  title: string;
  eventType: 'game' | 'meet' | 'competition';
  format: 'quick' | 'weekly' | 'round_robin' | 'tournament';
  courtId: string;
  court: Court | null;
  organizerId: string;
  organizer: User | null;
  coHostId: string | null;
  skillMin: number;
  skillMax: number;
  playerLimit: number;
  gameDate: string;
  startTime: string;
  endTime: string;
  visibility: 'public' | 'private';
  description: string | null;
  isRecurring: boolean;
  paymentNote: string | null;
  beginnerFriendly: boolean;
  playType: 'singles' | 'doubles' | 'open';
  status: 'upcoming' | 'in_progress' | 'completed' | 'cancelled';
  participantCount: number;
  currentUserStatus: 'none' | 'pending' | 'confirmed' | 'declined' | 'waitlisted';
  createdAt: string;
}

export interface Club {
  id: string;
  name: string;
  description: string;
  visibility: 'public' | 'private';
  skillMin: number | null;
  skillMax: number | null;
  photoUrl: string | null;
  rulesText: string | null;
  createdBy: string;
  memberCount: number;
  isMember: boolean;
  createdAt: string;
  rating?: number;
  tags?: string[];
  courts?: string[];
}

export interface Message {
  id: string;
  sender: string;
  body: string;
  time: string;
}
