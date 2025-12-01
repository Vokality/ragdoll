import { RagdollAPIServer } from "../src/api/server";
import { CharacterController } from "@vokality/ragdoll";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read port from environment variables or default to 3001
const port = Number.parseInt(
  process.env.PORT || process.env.RAGDOLL_API_PORT || "3001",
  10,
);

// Create and start the API server
const server = new RagdollAPIServer(port);

// In production, serve static files from the built frontend
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "..", "dist");
  server.serveStaticFiles(distPath);
  console.log(`✓ Serving static files from: ${distPath}`);
}

// Create a character controller for the default session (backward compatibility)
const characterController = new CharacterController();
server.setCharacterController(characterController);

// Update all character controllers at 60fps
// The server manages multiple sessions internally, each with its own controller
setInterval(() => {
  server.updateAllControllers(1 / 60);
}, 1000 / 60);

const frontendPort = process.env.VITE_PORT || "5173";

server
  .start()
  .then(() => {
    console.log("✓ Ragdoll API server started successfully");
    console.log("✓ Character controller initialized");
    console.log(
      `✓ Interact with the character via the web interface at http://localhost:${frontendPort}`,
    );
    console.log(`✓ Or use the API directly at http://localhost:${port}/api`);
  })
  .catch((error) => {
    console.error("Failed to start API server:", error);
    process.exit(1);
  });

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down API server...");
  await server.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Shutting down API server...");
  await server.stop();
  process.exit(0);
});
