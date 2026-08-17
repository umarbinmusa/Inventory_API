export const notificationTypeDefs = `#graphql
  enum NotificationType {
    LOW_STOCK
    OUT_OF_STOCK
    EXPIRING_PRODUCT
    NEW_ORDER
    NEW_BOOKING
    BOOKING_CANCELLED
  }

  type Notification {
    id: ID!
    type: NotificationType!
    message: String!
    product: Product
    sale: Sale
    order: Order
    read: Boolean!
    createdAt: String!
  }

  extend type Query {
    notifications(unreadOnly: Boolean): [Notification!]!
    unreadNotificationCount: Int!
  }

  extend type Mutation {
    markNotificationRead(id: ID!): Notification!
    markAllNotificationsRead: MessageResponse!
  }
`;
