export interface Activity {
  time?: string;
  activity: string;
  location?: string;
  description?: string;
}

export interface DayPlan {
  day: number;
  theme?: string;
  activities: Activity[];
}

export interface Itinerary {
  id?: string;
  _id?: string;
  title: string;
  destination: string;
  duration: string;
  days: DayPlan[];
  additionalNotes?: string;
  createdAt?: string;
  creatorName?: string;
  shareId?: string;
  rawText?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
}
