import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { createAirankRouter } from "./routes/airank";
import { createPublicCheckRouter } from "./routes/public-check";
import { registerPublicCheckPages, redactPublicPath } from "./routes/public-check-pages";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: redactPublicPath(req.url),
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// Mount before generic parsers/CORS so app routes retain strict same-origin policy and limits.
app.use("/api/airank", createAirankRouter());
app.use("/api/public-check", createPublicCheckRouter());
registerPublicCheckPages(app);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
