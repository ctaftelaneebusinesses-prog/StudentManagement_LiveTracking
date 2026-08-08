import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { startAnnouncementScheduler } from "./services/announcementScheduler";
import { startTeacherAttendanceScheduler } from "./services/teacherAttendanceScheduler";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`API server listening on port ${env.PORT} [${env.NODE_ENV}]`);
});

// Note: Socket.IO (live GPS, real-time notifications) will attach to this
// same HTTP `server` instance once the transport/notifications modules are
// approved and built — not wired up in this foundation pass.

startAnnouncementScheduler();
startTeacherAttendanceScheduler();

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  server.close(() => process.exit(0));
});
