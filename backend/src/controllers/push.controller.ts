import { Request, Response, NextFunction } from "express";
import * as pushService from "../services/push.service";
import { sendSuccess } from "../utils/ApiResponse";

export async function subscribe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    // schoolId may be null for a platform-level super_admin — delivery in
    // push.service.ts::sendToUserIds looks subscriptions up by user_id only,
    // never by school_id, so there's nothing to require here (see
    // 069_platform_notifications.sql).
    await pushService.saveSubscription(user.id, user.schoolId, req.body);
    return sendSuccess(res, { message: "Subscribed" }, 201);
  } catch (err) {
    return next(err);
  }
}

export async function unsubscribe(req: Request, res: Response, next: NextFunction) {
  try {
    await pushService.removeSubscription(req.body.endpoint);
    return sendSuccess(res, { message: "Unsubscribed" });
  } catch (err) {
    return next(err);
  }
}
