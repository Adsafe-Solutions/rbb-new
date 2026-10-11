import type { Post } from "@rbb/content-schema";
import type { Route } from "../../http/router.ts";
import { contentRoutes } from "../content/routes.ts";
import type { StoryService } from "./service.ts";

/* /api/v1/stories — the content routes (content/routes.ts): list, one,
   create, edit, DELETE archives. Only stories: the store is scoped. */
export const storyRoutes = (service: () => Promise<StoryService>): Route[] => contentRoutes<Post & { title: string }>("stories", service);
