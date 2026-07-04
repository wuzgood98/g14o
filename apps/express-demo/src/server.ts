import express from "express";
import { demoAuth } from "./middleware/demo-auth.js";
import { chatHandler } from "./routes/chat";
import { statusHandler, statusMiddleware } from "./routes/status";
import {
  userActionHandler,
  userActionMiddleware,
} from "./routes/user-action.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    routes: [
      "GET /api/status",
      "POST /api/chat",
      "POST /api/user-action (demo auth via x-user-id header)",
    ],
  });
});

app.get("/api/status", statusMiddleware, statusHandler);
app.post("/api/chat", chatHandler);
app.post("/api/user-action", demoAuth, userActionMiddleware, userActionHandler);

app.listen(port, () => {
  console.log(`express-demo listening on http://localhost:${port}`);
});
