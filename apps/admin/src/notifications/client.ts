import { api } from "../api";
import type { Notifications } from "./model";

export const notificationsApi = { get: () => api<Notifications>("/api/v1/notifications") };
