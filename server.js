import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";

import connectDB from "./config/db.js";
import schema from "./graphql/schema.js";
import { buildContext } from "./middleware/auth.js";
import { upload } from "./middleware/upload.js";
import { verifyAccessToken } from "./utils/generateTokens.js";

const startServer = async () => {
  await connectDB();

  const app = express();
  const httpServer = http.createServer(app);

  // Security headers. contentSecurityPolicy disabled here because it can
  // interfere with GraphQL Playground/Sandbox in development; re-enable
  // with a proper policy for production behind your actual frontend domain.
  // crossOriginResourcePolicy is relaxed to "cross-origin" because product
  // images served from /uploads are meant to be loaded by the frontend on
  // a different origin/port (e.g. localhost:5173 -> localhost:4000) -
  // helmet's default "same-origin" value silently blocks that in the
  // browser (no server-side error, the <img> just fails to render).
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://app.assalamtelecom.com.ng"
  ],
  credentials: true
}));

  app.use(express.json({ limit: "5mb" }));

  // Basic API-wide rate limiting; tighten further per-resolver if needed
  // (e.g. a stricter limiter specifically on login/forgotPassword).
  const limiter = rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    max: Number(process.env.RATE_LIMIT_MAX || 200),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
  });
  app.use("/graphql", limiter);

  // Serve uploaded product images / QR codes / barcodes.
  app.use("/uploads", express.static("uploads"));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Simple bearer-token check for REST routes (GraphQL uses buildContext instead).
  const requireAuthHeader = (req, res, next) => {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    try {
      verifyAccessToken(token);
      next();
    } catch {
      return res.status(401).json({ error: "Invalid or expired token." });
    }
  };

  app.post("/api/upload", requireAuthHeader, upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });
    const url = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    res.json({ url });
  });

  app.use((err, req, res, next) => {
    if (err && !res.headersSent && req.originalUrl?.startsWith("/api/upload")) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  });

  const apolloServer = new ApolloServer({
    schema,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    formatError: (formattedError, error) => {
      // Avoid leaking stack traces to clients in production.
      if (process.env.NODE_ENV === "production") {
        const { message, extensions } = formattedError;
        return { message, extensions };
      }
      console.error(error);
      return formattedError;
    },
  });

  await apolloServer.start();

  app.use(
    "/graphql",
    expressMiddleware(apolloServer, {
      context: buildContext,
    })
  );

  const PORT = process.env.PORT || 4000;

  await new Promise((resolve) => httpServer.listen({ port: PORT }, resolve));
  console.log(`[server] Ready at http://localhost:${PORT}/graphql`);
};

startServer().catch((err) => {
  console.error("[server] Failed to start:", err);
  process.exit(1);
});
