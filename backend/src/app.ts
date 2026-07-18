import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { requestLogger } from "./middleware/requestLogger.middleware";
import { notFoundHandler, errorHandler } from "./middleware/error.middleware";
import routes from "./routes";

export function createApp(): Application {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(requestLogger);

  app.use("/api/v1", routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
