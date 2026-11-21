// Nested paths such as /api/users/5/approve are served by the same router as the root catch-all.
export { default } from "../[...route].js";
