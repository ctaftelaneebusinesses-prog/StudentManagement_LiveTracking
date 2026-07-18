import { Router } from "express";
import { sendSuccess } from "../utils/ApiResponse";

const router = Router();

router.get("/", (_req, res) => sendSuccess(res, { status: "ok", timestamp: new Date().toISOString() }));

export default router;
