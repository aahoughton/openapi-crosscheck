import { createAdapter } from "./src/adapters/openapi-request-validator";
import { serve } from "./src/container/server";

/**
 * This container's entry point. The only file in the image that names which
 * adapter is being served; everything it calls is library-agnostic.
 */
const port = Number(process.env.PORT ?? "8080");
await serve(createAdapter(), port);
