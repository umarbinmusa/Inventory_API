import { GraphQLError } from "graphql";
import Notification from "../../models/Notification.js";
import { requireAuth } from "../../middleware/auth.js";

const POPULATE = ["product", "sale", "order"];

export const notificationResolvers = {
  Query: {
    notifications: async (_p, { unreadOnly }, context) => {
      requireAuth(context);
      const filter = unreadOnly ? { read: false } : {};
      return Notification.find(filter).populate(POPULATE).sort({ createdAt: -1 }).limit(100);
    },
    unreadNotificationCount: async (_p, _a, context) => {
      requireAuth(context);
      return Notification.countDocuments({ read: false });
    },
  },

  Mutation: {
    markNotificationRead: async (_p, { id }, context) => {
      requireAuth(context);
      const notification = await Notification.findByIdAndUpdate(
        id,
        { read: true },
        { new: true }
      ).populate(POPULATE);
      if (!notification) {
        throw new GraphQLError("Notification not found.", { extensions: { code: "NOT_FOUND" } });
      }
      return notification;
    },

    markAllNotificationsRead: async (_p, _a, context) => {
      requireAuth(context);
      await Notification.updateMany({ read: false }, { read: true });
      return { success: true, message: "All notifications marked as read." };
    },
  },
};
