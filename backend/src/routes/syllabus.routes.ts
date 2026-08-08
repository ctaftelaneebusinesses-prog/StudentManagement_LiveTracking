import { Router } from "express";
import * as syllabusController from "../controllers/syllabus.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  listSyllabusQuerySchema,
  syllabusIdParamSchema,
  createSyllabusSchema,
  updateSyllabusSchema,
} from "../validators/syllabus.validator";

const STAFF_AND_TEACHER = ["school_admin", "super_admin", "principal", "teacher"];
const STAFF_ONLY = ["school_admin", "super_admin", "principal"];

const router = Router();
router.use(requireAuth);

// Student portal — published-only, scoped to their own class.
router.get("/my-class", requireRole("student"), syllabusController.listForOwnClass);

router.get("/", requireRole(...STAFF_AND_TEACHER), validate(listSyllabusQuerySchema), syllabusController.list);
router.get("/:id", requireRole(...STAFF_AND_TEACHER), validate(syllabusIdParamSchema), syllabusController.get);
router.post("/", requireRole(...STAFF_AND_TEACHER), validate(createSyllabusSchema), syllabusController.create);
router.patch("/:id", requireRole(...STAFF_AND_TEACHER), validate(updateSyllabusSchema), syllabusController.update);
// Delete stays staff-only — Teacher's capability list never includes Delete.
router.delete("/:id", requireRole(...STAFF_ONLY), validate(syllabusIdParamSchema), syllabusController.remove);

export default router;
