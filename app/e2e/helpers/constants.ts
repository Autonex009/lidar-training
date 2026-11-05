export const PASSWORD = "E2e-Passw0rd!";
export const ADMIN = { name: "E2E Admin", email: "admin.e2e@example.com", password: PASSWORD };
export const REVIEWER = { name: "E2E Reviewer", email: "reviewer.e2e@example.com", password: PASSWORD };
export const ALICE = { name: "Alice E2E", email: "alice.e2e@example.com", password: PASSWORD };
export const BOB = { name: "Bob E2E", email: "bob.e2e@example.com", password: PASSWORD };
export const SETUP_TOKEN = "e2e-setup-token";
export const CAROL = { name: "Carol E2E", email: "carol.e2e@example.com", password: PASSWORD };
/** Every guided tour key (mirrors src/components/tour/registry.ts). Fixtures mark these COMPLETED so tours never block other specs. */
export const ALL_TOUR_KEYS = ["welcome", "navigation-3d", "task-cuboid", "task-segmentation", "task-tracking", "task-inspection", "task-identification", "task-error-detection", "review-first-open", "lesson-cuboid"];
