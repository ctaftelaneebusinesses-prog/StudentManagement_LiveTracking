// import express, { Application } from "express";
// import cors from "cors";
// import helmet from "helmet";
// import { env } from "./config/env";
// import { requestLogger } from "./middleware/requestLogger.middleware";
// import { notFoundHandler, errorHandler } from "./middleware/error.middleware";
// import routes from "./routes";
// import attendanceRoutes from './routes/attendance.routes';
//   app.use('/api/attendance', attendanceRoutes);
// export function createApp(): Application {
//   const app = express();

//   app.use(helmet());
//   app.use(
//     cors({
//       origin: env.CORS_ORIGIN,
//       credentials: true,
//     })
//   );
//   app.use(express.json({ limit: "1mb" }));
//   app.use(requestLogger);

//   app.use("/api/v1", routes);

//   app.use(notFoundHandler);
//   app.use(errorHandler);

//   return app;
// }
import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { env } from "./config/env";
import { requestLogger } from "./middleware/requestLogger.middleware";
import { notFoundHandler, errorHandler } from "./middleware/error.middleware";
import { apiLimiter } from "./middleware/rateLimit.middleware";
import routes from "./routes";

// CORS_ORIGIN may be a single origin or a comma-separated list (e.g. the
// apex domain plus a Vercel preview URL) — split once at startup.
const allowedOrigins = env.CORS_ORIGIN.split(",").map((origin) => origin.trim());

export function createApp(): Application {
  const app = express();

  // Both Vercel and most container hosts (Render, Railway, Fly, etc.) put
  // the app behind a reverse proxy — trust its X-Forwarded-* headers so
  // rate limiting and request logging see the real client IP, not the
  // proxy's.
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(compression());
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(requestLogger);
  app.use(apiLimiter);

  app.use("/api/v1", routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}