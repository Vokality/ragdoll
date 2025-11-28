import { RagdollAPIServer } from '../src/packages/api/server';
import { CharacterController } from '../src/packages/character/controllers/character-controller';

// Create and start the API server
const server = new RagdollAPIServer(3001);

// Create a character controller for the API server
const characterController = new CharacterController();
server.setCharacterController(characterController);

// Update the character controller at 60fps
setInterval(() => {
  characterController.update(1 / 60);
}, 1000 / 60);

server.start().then(() => {
  console.log('✓ Ragdoll API server started successfully');
  console.log('✓ Character controller initialized');
  console.log('✓ Interact with the character via the web interface at http://localhost:5173');
  console.log('✓ Or use the API directly at http://localhost:3001/api');
}).catch((error) => {
  console.error('Failed to start API server:', error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down API server...');
  await server.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down API server...');
  await server.stop();
  process.exit(0);
});
