import { NextFunction, Request, Response } from "express";
import * as tracking from "../services/tracking.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";
import { assertStudentAccess } from "../utils/studentAccess";
const wrap = (fn: (req: Request) => Promise<unknown>, status = 200) => async (req: Request, res: Response, next: NextFunction) => { try { return sendSuccess(res, await fn(req), status); } catch (error) { return next(error); } };
export const startTrip = wrap((req) => tracking.startTrip(resolveSchoolId(req), req.user!.id, req.body.direction), 201);
export const recordLocation = wrap((req) => tracking.recordLocation(resolveSchoolId(req), req.user!.id, req.params.tripId, req.body), 201);
export const endTrip = wrap((req) => tracking.endTrip(resolveSchoolId(req), req.user!.id, req.params.tripId));
export const myVehicles = wrap((req) => tracking.myVehicles(resolveSchoolId(req), req.user!.id));
export const markStudentStatus = wrap(
  (req) => tracking.markStudentStatus(resolveSchoolId(req), req.user!.id, req.params.tripId, req.params.studentId, req.body.status),
  201
);
export const listTripStudentStatus = wrap((req) => tracking.listTripStudentStatus(resolveSchoolId(req), req.params.tripId));
export const listMyTripStudentStatus = wrap((req) => tracking.listMyTripStudentStatus(resolveSchoolId(req), req.user!.id, req.params.tripId));
export const activeVehicles = wrap((req) => tracking.activeVehicles(resolveSchoolId(req), { roles: req.user!.roles, userId: req.user!.id }));

export const listTripHistory = wrap((req) => {
  const { vehicleId, driverId, routeId, dateFrom, dateTo, page, pageSize } = req.query as unknown as {
    vehicleId?: string;
    driverId?: string;
    routeId?: string;
    dateFrom?: string;
    dateTo?: string;
    page: number;
    pageSize: number;
  };
  return tracking.listTripHistory(resolveSchoolId(req), { vehicleId, driverId, routeId, dateFrom, dateTo, page, pageSize });
});

export const getTripEta = wrap((req) => tracking.getTripEta(resolveSchoolId(req), req.params.tripId));

export const getStudentTripStatus = wrap(async (req) => {
  await assertStudentAccess(req, req.params.id);
  return tracking.getStudentTripStatus(resolveSchoolId(req), req.params.id);
});

export const listStudentTransportHistory = wrap(async (req) => {
  await assertStudentAccess(req, req.params.id);
  return tracking.listStudentTransportHistory(resolveSchoolId(req), req.params.id);
});

export const recordMyLocation = wrap(async (req) => {
  await assertStudentAccess(req, req.params.id);
  return tracking.recordMyLocation(resolveSchoolId(req), req.params.id, req.user!.id, req.body);
}, 201);
