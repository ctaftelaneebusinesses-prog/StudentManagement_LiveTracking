/** A school_admin's request to add a new school, reviewed by a super_admin (068_school_creation_requests.sql). */

export interface SchoolRequestPayload {
  name: string;
  code?: string;
  branch_name?: string;
  principal_name?: string;
  address?: string;
  phone?: string;
  alternate_phone?: string;
  email?: string;
  city?: string;
  district?: string;
  state?: string;
  pin_code?: string;
  country?: string;
  logo_url?: string;
  requester_notes?: string;
}

export type SchoolRequestStatus = "pending" | "approved" | "rejected";

export interface SchoolRequest {
  id: string;
  requested_by: string;
  status: SchoolRequestStatus;
  payload: SchoolRequestPayload;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  created_school_id: string | null;
  created_at: string;
  users: { full_name: string; email: string } | null;
}
