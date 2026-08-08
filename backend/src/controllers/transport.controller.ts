import { NextFunction, Request, Response } from "express";
import * as transport from "../services/transport.service";
import * as vehicleMaintenance from "../services/vehicleMaintenance.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";
import { assertStudentAccess } from "../utils/studentAccess";
const wrap = (fn: (req: Request) => Promise<unknown>, status = 200) => async (req: Request, res: Response, next: NextFunction) => { try { return sendSuccess(res, await fn(req), status); } catch (error) { return next(error); } };
export const listVehicles = wrap((req) => transport.listVehicles(resolveSchoolId(req)));
export const createVehicle = wrap((req) => transport.createVehicle(resolveSchoolId(req), req.body), 201);
export const listDrivers = wrap((req) => transport.listDrivers(resolveSchoolId(req)));
export const createDriver = wrap((req) => transport.createDriver(resolveSchoolId(req), req.body), 201);
export const listRoutes = wrap((req) => transport.listRoutes(resolveSchoolId(req)));
export const getRoute = wrap((req) => transport.getRoute(resolveSchoolId(req), req.params.id));
export const createRoute = wrap((req) => transport.createRoute(resolveSchoolId(req), req.body), 201);
export const createPickupPoint = wrap((req) => transport.createPickupPoint(resolveSchoolId(req), req.body), 201);
export const assignStudentPickup = wrap((req) => transport.assignStudentPickup(resolveSchoolId(req), req.body), 201);
export const driverDashboard = wrap((req) => transport.getDriverDashboard(resolveSchoolId(req), req.user!.id));
export const getStudentTransport = wrap(async (req) => {
  await assertStudentAccess(req, req.params.id);
  return transport.getStudentTransport(resolveSchoolId(req), req.params.id);
});
export const assignStudentTransport = wrap(
  (req) =>
    transport.assignStudentPickup(resolveSchoolId(req), {
      student_id: req.params.id,
      pickup_point_id: req.body.pickup_point_id,
      transport_direction: req.body.transport_direction,
    }),
  201
);

// ----------------------------------------------------------------------------
// Vehicle / driver / route / pickup-point update-and-delete + student
// assignment lookups.
// ----------------------------------------------------------------------------

export const getVehicle = wrap((req) => transport.getVehicle(resolveSchoolId(req), req.params.id));
export const updateVehicle = wrap((req) => transport.updateVehicle(resolveSchoolId(req), req.params.id, req.body));
export const deleteVehicle = wrap(async (req) => {
  await transport.deleteVehicle(resolveSchoolId(req), req.params.id);
  return { message: "Vehicle deleted" };
});
export const listStudentsForVehicle = wrap((req) => transport.listStudentsForVehicle(resolveSchoolId(req), req.params.id));

export const getDriver = wrap((req) => transport.getDriver(resolveSchoolId(req), req.params.id));
export const updateDriver = wrap((req) => transport.updateDriver(resolveSchoolId(req), req.params.id, req.body));
export const deactivateDriver = wrap(async (req) => {
  await transport.deactivateDriver(resolveSchoolId(req), req.params.id);
  return { message: "Driver deactivated" };
});
export const listStudentsForDriver = wrap((req) => transport.listStudentsForDriver(resolveSchoolId(req), req.params.id));

export const updateRoute = wrap((req) => transport.updateRoute(resolveSchoolId(req), req.params.id, req.body));
export const deleteRoute = wrap(async (req) => {
  await transport.deleteRoute(resolveSchoolId(req), req.params.id);
  return { message: "Route deleted" };
});

export const updatePickupPoint = wrap((req) => transport.updatePickupPoint(resolveSchoolId(req), req.params.id, req.body));
export const deletePickupPoint = wrap(async (req) => {
  await transport.deletePickupPoint(resolveSchoolId(req), req.params.id);
  return { message: "Pickup point deleted" };
});

export const unassignStudentTransport = wrap(async (req) => {
  await transport.unassignStudentTransport(resolveSchoolId(req), req.params.id);
  return { message: "Transport assignment removed" };
});

export const listTransportFees = wrap((req) => transport.listTransportFees(resolveSchoolId(req)));

export const setTransportFee = wrap((req) =>
  transport.setTransportFee(resolveSchoolId(req), req.params.studentId, req.user!.id, req.body)
);

export const listStudentsForRoute = wrap((req) => transport.listStudentsForRoute(resolveSchoolId(req), req.params.id));
export const searchStudentsForAssignment = wrap((req) =>
  transport.searchStudentsForAssignment(resolveSchoolId(req), req.query.search as string)
);

// ----------------------------------------------------------------------------
// Vehicle maintenance.
// ----------------------------------------------------------------------------

export const listMaintenanceRecords = wrap((req) => vehicleMaintenance.listMaintenanceRecords(resolveSchoolId(req), req.params.vehicleId));
export const listAllMaintenanceRecords = wrap((req) => vehicleMaintenance.listMaintenanceRecords(resolveSchoolId(req)));
export const createMaintenanceRecord = wrap(
  (req) => vehicleMaintenance.createMaintenanceRecord(resolveSchoolId(req), req.params.vehicleId, req.user!.id, req.body),
  201
);
export const updateMaintenanceRecord = wrap((req) => vehicleMaintenance.updateMaintenanceRecord(resolveSchoolId(req), req.params.id, req.body));
export const deleteMaintenanceRecord = wrap(async (req) => {
  await vehicleMaintenance.deleteMaintenanceRecord(resolveSchoolId(req), req.params.id);
  return { message: "Maintenance record deleted" };
});
