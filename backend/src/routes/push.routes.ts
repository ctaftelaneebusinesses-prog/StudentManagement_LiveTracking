import { Router } from "express";
import * as pushController from "../controllers/push.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { subscribeSchema, unsubscribeSchema } from "../validators/push.validator";

const router = Router();

router.use(requireAuth);

// Every authenticated user manages only their own subscription — no
// permission gate beyond being logged in.
router.post("/subscribe", validate(subscribeSchema), pushController.subscribe);
router.post("/unsubscribe", validate(unsubscribeSchema), pushController.unsubscribe);

export default router;
