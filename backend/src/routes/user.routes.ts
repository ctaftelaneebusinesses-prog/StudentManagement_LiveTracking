import { Router } from "express";
import * as userController from "../controllers/user.controller";
import { requireAuth, requirePermission } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  createUserSchema,
  updateUserSchema,
  assignRoleSchema,
  listUsersQuerySchema,
} from "../validators/user.validator";

const router = Router();

router.use(requireAuth);
router.use(requirePermission("users.view"));

router.get("/", validate(listUsersQuerySchema), userController.listUsers);
router.get("/:id", userController.getUser);

router.post("/", requirePermission("users.manage"), validate(createUserSchema), userController.createUser);
router.patch(
  "/:id",
  requirePermission("users.manage"),
  validate(updateUserSchema),
  userController.updateUser
);
router.delete("/:id", requirePermission("users.manage"), userController.deactivateUser);

router.post(
  "/:id/roles",
  requirePermission("roles.manage"),
  validate(assignRoleSchema),
  userController.assignRole
);
router.delete("/:id/roles/:roleId", requirePermission("roles.manage"), userController.revokeRole);

export default router;
