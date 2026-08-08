import { Router } from "express";
import * as controller from "../controllers/transport.controller";
import { requireAuth, requirePermission, requireRole } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  assignPickupSchema,
  createMaintenanceSchema,
  driverIdParamSchema,
  driverSchema,
  maintenanceIdParamSchema,
  maintenanceVehicleParamSchema,
  pickupIdParamSchema,
  pickupSchema,
  routeIdParamSchema,
  routeSchema,
  routeStudentsParamSchema,
  searchStudentsQuerySchema,
  setTransportFeeSchema,
  updateDriverSchema,
  updateMaintenanceSchema,
  updatePickupSchema,
  updateRouteSchema,
  updateVehicleSchema,
  vehicleIdParamSchema,
  vehicleSchema,
} from "../validators/transport.validator";
const router = Router();
router.use(requireAuth);
router.get("/driver/dashboard", requireRole("driver"), controller.driverDashboard);
router.get("/vehicles", requirePermission("transport.manage"), controller.listVehicles); router.post("/vehicles", requirePermission("transport.manage"), validate(vehicleSchema), controller.createVehicle);
router.get("/drivers", requirePermission("transport.manage"), controller.listDrivers); router.post("/drivers", requirePermission("transport.manage"), validate(driverSchema), controller.createDriver);
router.get("/routes", requirePermission("transport.manage"), controller.listRoutes); router.post("/routes", requirePermission("transport.manage"), validate(routeSchema), controller.createRoute);
router.post("/pickup-points", requirePermission("transport.manage"), validate(pickupSchema), controller.createPickupPoint);
router.post("/student-pickups", requirePermission("transport.manage"), validate(assignPickupSchema), controller.assignStudentPickup);

// --- Vehicles --------------------------------------------------------------
router.get("/vehicles/:id", requirePermission("transport.manage"), validate(vehicleIdParamSchema), controller.getVehicle);
router.patch("/vehicles/:id", requirePermission("transport.manage"), validate(updateVehicleSchema), controller.updateVehicle);
router.delete("/vehicles/:id", requirePermission("transport.manage"), validate(vehicleIdParamSchema), controller.deleteVehicle);
router.get("/vehicles/:id/students", requirePermission("transport.manage"), validate(vehicleIdParamSchema), controller.listStudentsForVehicle);

// --- Drivers -----------------------------------------------------------------
router.get("/drivers/:id", requirePermission("transport.manage"), validate(driverIdParamSchema), controller.getDriver);
router.patch("/drivers/:id", requirePermission("transport.manage"), validate(updateDriverSchema), controller.updateDriver);
router.post("/drivers/:id/deactivate", requirePermission("transport.manage"), validate(driverIdParamSchema), controller.deactivateDriver);
router.get("/drivers/:id/students", requirePermission("transport.manage"), validate(driverIdParamSchema), controller.listStudentsForDriver);

// --- Routes & stops ----------------------------------------------------------
router.get("/routes/:id", requirePermission("transport.manage"), validate(routeIdParamSchema), controller.getRoute);
router.patch("/routes/:id", requirePermission("transport.manage"), validate(updateRouteSchema), controller.updateRoute);
router.delete("/routes/:id", requirePermission("transport.manage"), validate(routeIdParamSchema), controller.deleteRoute);
router.get("/routes/:id/students", requirePermission("transport.manage"), validate(routeStudentsParamSchema), controller.listStudentsForRoute);
router.patch("/pickup-points/:id", requirePermission("transport.manage"), validate(updatePickupSchema), controller.updatePickupPoint);
router.delete("/pickup-points/:id", requirePermission("transport.manage"), validate(pickupIdParamSchema), controller.deletePickupPoint);

// --- Student assignment search ------------------------------------------------
router.get("/students/search", requirePermission("transport.manage"), validate(searchStudentsQuerySchema), controller.searchStudentsForAssignment);

// --- Transport fee (admin/principal, via transport.manage) --------------------
router.get("/fees", requirePermission("transport.manage"), controller.listTransportFees);
router.post("/student-pickups/:studentId/fee", requirePermission("transport.manage"), validate(setTransportFeeSchema), controller.setTransportFee);
router.patch("/student-pickups/:studentId/fee", requirePermission("transport.manage"), validate(setTransportFeeSchema), controller.setTransportFee);

// --- Maintenance --------------------------------------------------------------
router.get("/maintenance", requirePermission("transport.manage"), controller.listAllMaintenanceRecords);
router.get(
  "/vehicles/:vehicleId/maintenance",
  requirePermission("transport.manage"),
  validate(maintenanceVehicleParamSchema),
  controller.listMaintenanceRecords
);
router.post(
  "/vehicles/:vehicleId/maintenance",
  requirePermission("transport.manage"),
  validate(createMaintenanceSchema),
  controller.createMaintenanceRecord
);
router.patch("/maintenance/:id", requirePermission("transport.manage"), validate(updateMaintenanceSchema), controller.updateMaintenanceRecord);
router.delete("/maintenance/:id", requirePermission("transport.manage"), validate(maintenanceIdParamSchema), controller.deleteMaintenanceRecord);

export default router;
