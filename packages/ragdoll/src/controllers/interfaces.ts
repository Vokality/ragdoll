/**
 * Interfaces for controllers to enable testability
 */

import type { HeadPose } from "../types";

/**
 * Interface for head pose control
 */
export interface IHeadPoseController {
  setTargetPose(pose: Partial<HeadPose>, duration?: number): void;
  lookForward(duration?: number): void;
  getPose(): HeadPose;
  update(deltaTime: number): void;
}



