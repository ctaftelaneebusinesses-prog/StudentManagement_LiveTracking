export interface PortalTodayPractice {
  id: string;
  batch_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  venue: string | null;
  extracurricular_batches: {
    activities?: { name: string } | null;
    classes?: { name: string; section: string } | null;
  } | null;
}

export interface PortalUpcomingEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  activities: { name: string } | null;
}

export interface PortalPracticeWork {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  attachment_url: string | null;
  created_at: string;
}

export interface PortalAchievement {
  id: string;
  activity_id: string | null;
  title: string;
  description: string | null;
  achieved_on: string | null;
  file_name: string;
  uploaded_at: string;
  signed_url?: string;
  activities: { name: string } | null;
}

export interface PortalActivityAnnouncement {
  id: string;
  title: string;
  message: string;
  type: string;
  created_at: string;
}

export interface PortalExtracurricularOverview {
  todaysPractice: PortalTodayPractice[];
  upcomingEvents: PortalUpcomingEvent[];
  practiceWork: PortalPracticeWork[];
  achievements: PortalAchievement[];
  gallery: PortalAchievement[];
  announcements: PortalActivityAnnouncement[];
}
