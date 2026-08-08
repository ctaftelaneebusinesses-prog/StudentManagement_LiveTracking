import { Router } from "express";
import * as rbacController from "../controllers/rbac.controller";
import { requireAuth, requirePermission } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requirePermission("users.view"));

router.get("/roles", rbacController.listRoles);
router.get("/permissions", rbacController.listPermissions);
router.get("/role-permissions", rbacController.listRolePermissionMatrix);

export default router;
