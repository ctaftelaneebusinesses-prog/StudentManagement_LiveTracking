import { RoleName } from "./auth.types";

export interface Role {
  id: number;
  name: RoleName;
}

export interface Permission {
  id: number;
  code: string;
  description: string;
}

export interface RolePermissionPair {
  role_id: number;
  permission_id: number;
}
