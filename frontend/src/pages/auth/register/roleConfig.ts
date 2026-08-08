import { GraduationCap, Users, Crown, Calculator, Car, Music } from "lucide-react";
import { RegistrationRole } from "@/services/registration.service";

export interface RoleCardConfig {
  role: RegistrationRole;
  label: string;
  description: string;
  icon: typeof GraduationCap;
}

/** Support Staff is deliberately excluded — spec §1 removes it from self-registration entirely (it stays available to Admin's own "Add user" flow, unchanged). */
export const REGISTRATION_ROLE_CARDS: RoleCardConfig[] = [
  { role: "student", label: "Student", description: "Register yourself as a student", icon: Users },
  { role: "teacher", label: "Teacher", description: "Class teacher or subject teacher", icon: GraduationCap },
  { role: "principal", label: "Principal", description: "Approved by your School Admin", icon: Crown },
  { role: "accountant", label: "Accountant", description: "Approved by your Principal", icon: Calculator },
  { role: "driver", label: "Driver", description: "Approved by your Principal", icon: Car },
  { role: "extracurricular_staff", label: "Extracurricular Staff", description: "Dance, Music, Sports, and more", icon: Music },
];
