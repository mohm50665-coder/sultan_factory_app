import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Enable CORS for all routes - reflect the request origin to support credentials
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-session-id",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // File upload endpoint
  app.post("/api/upload", async (req, res) => {
    try {
      const { storagePut } = await import("../storage");
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", async () => {
        try {
          const body = Buffer.concat(chunks);
          // Parse multipart form data manually or use raw body
          const contentType = req.headers["content-type"] || "";
          if (contentType.includes("multipart/form-data")) {
            // Extract boundary
            const boundary = contentType.split("boundary=")[1];
            if (!boundary) {
              res.status(400).json({ error: "No boundary found" });
              return;
            }
            // Find file content between boundaries
            const bodyStr = body.toString("binary");
            const parts = bodyStr.split(`--${boundary}`);
            for (const part of parts) {
              if (part.includes("filename=")) {
                const headerEnd = part.indexOf("\r\n\r\n");
                if (headerEnd === -1) continue;
                const headers = part.substring(0, headerEnd);
                const fileContent = part.substring(headerEnd + 4).replace(/\r\n$/, "");
                // Extract filename
                const filenameMatch = headers.match(/filename="([^"]+)"/);
                const filename = filenameMatch ? filenameMatch[1] : `file_${Date.now()}`;
                // Extract content type
                const ctMatch = headers.match(/Content-Type:\s*(.+?)\r\n/);
                const fileCt = ctMatch ? ctMatch[1].trim() : "application/octet-stream";
                // Upload to storage
                const fileBuffer = Buffer.from(fileContent, "binary");
                const result = await storagePut(`uploads/${filename}`, fileBuffer, fileCt);
                res.json({ url: result.url, key: result.key });
                return;
              }
            }
            res.status(400).json({ error: "No file found in upload" });
          } else {
            // Raw body upload
            const filename = `file_${Date.now()}`;
            const result = await storagePut(`uploads/${filename}`, body, contentType || "application/octet-stream");
            res.json({ url: result.url, key: result.key });
          }
        } catch (uploadErr: any) {
          console.error("Upload processing error:", uploadErr);
          res.status(500).json({ error: uploadErr.message || "Upload failed" });
        }
      });
    } catch (err: any) {
      console.error("Upload error:", err);
      res.status(500).json({ error: err.message || "Upload failed" });
    }
  });

  // Web login endpoint (for web-based login forms)
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        res.status(400).json({ error: "Username and password are required" });
        return;
      }

      // Import getDb and users table
      const { getDb } = await import("../db.js");
      const { users: usersTable } = await import("../../drizzle/schema.js");
      const { eq } = await import("drizzle-orm");
      const { getSessionCookieOptions } = await import("./cookies.js");

      const db = await getDb();
      if (!db) {
        res.status(500).json({ error: "Database unavailable" });
        return;
      }

      const result = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.username, username))
        .limit(1);

      const user = result[0];

      if (!user || user.password !== password) {
        res.status(401).json({ error: "Invalid username or password" });
        return;
      }

      if (!user.isActive) {
        res.status(403).json({ error: "Account is not activated" });
        return;
      }

      // Set session cookie
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie("session_id", user.id.toString(), cookieOptions);

      res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          phone: user.phone,
          position: user.position,
          department: user.department,
          role: user.role,
          isActive: user.isActive,
          allowedSections: user.allowedSections,
          toolPermissions: user.toolPermissions,
        },
      });
    } catch (error) {
      console.error("[Web Auth] Login failed:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
  });
}

startServer().catch(console.error);
