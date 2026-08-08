import { Router } from "express";
import * as userController from "../controllers/user.controller";
import { requireAuth, requirePermission } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  createUserSchema,
  updateUserSchema,
  assignRoleSchema,
  listUsersQuerySchema,
  resetPasswordSchema,
  bulkUserIdsSchema,
  bulkCreateUsersSchema,
} from "../validators/user.validator";

const router = Router();

router.use(requireAuth);
router.use(requirePermission("users.view"));

router.get("/", validate(listUsersQuerySchema), userController.listUsers);

router.post("/", requirePermission("users.manage"), validate(createUserSchema), userController.createUser);

// --- Bulk operations (must precede /:id so "bulk*" isn't swallowed by it) ---
router.post(
  "/bulk-activate",
  requirePermission("users.manage"),
  validate(bulkUserIdsSchema),
  userController.bulkActivate
);
router.post(
  "/bulk-deactivate",
  requirePermission("users.manage"),
  validate(bulkUserIdsSchema),
  userController.bulkDeactivate
);
router.post(
  "/bulk-create",
  requirePermission("users.manage"),
  validate(bulkCreateUsersSchema),
  userController.bulkCreateUsers
);
router.post(
  "/bulk-delete",
  requirePermission("users.manage"),
  validate(bulkUserIdsSchema),
  userController.bulkDeleteUsers
);

router.get("/:id", userController.getUser);

router.patch(
  "/:id",
  requirePermission("users.manage"),
  validate(updateUserSchema),
  userController.updateUser
);
router.delete("/:id", requirePermission("users.manage"), userController.deactivateUser);

router.post(
  "/:id/reset-password",
  requirePermission("users.manage"),
  validate(resetPasswordSchema),
  userController.resetPassword
);

router.get("/:id/roles", userController.listUserRoles);
router.post(
  "/:id/roles",
  requirePermission("roles.manage"),
  validate(assignRoleSchema),
  userController.assignRole
);
router.delete("/:id/roles/:roleId", requirePermission("roles.manage"), userController.revokeRole);

export default router;
