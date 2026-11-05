import type { TourDefinition } from "./types";
import { welcomeTour } from "./tours/welcome";
import { navigationTour } from "./tours/navigation-3d";
import { taskCuboidTour, taskErrorDetectionTour, taskIdentificationTour, taskInspectionTour, taskSegmentationTour, taskTrackingTour } from "./tours/tasks";
import { reviewFirstOpenTour } from "./tours/review";
import { lessonCuboidTour } from "./tours/lesson-cuboid";

export const TOURS: Record<string, TourDefinition> = Object.fromEntries(
  [welcomeTour, navigationTour, taskCuboidTour, taskSegmentationTour, taskTrackingTour, taskInspectionTour, taskIdentificationTour, taskErrorDetectionTour, reviewFirstOpenTour, lessonCuboidTour].map((t) => [t.key, t]),
);

/** Tour key for the first open of a task of this annotation type. */
export function taskTourKey(type: string): string | null {
  switch (type) {
    case "CUBOID": case "MIXED": return "task-cuboid";
    case "SEMANTIC_SEG": case "INSTANCE_SEG": return "task-segmentation";
    case "TRACKING": return "task-tracking";
    case "INSPECTION": return "task-inspection";
    case "IDENTIFICATION": return "task-identification";
    case "ERROR_DETECTION": return "task-error-detection";
    default: return null;
  }
}
