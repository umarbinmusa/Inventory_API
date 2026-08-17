import Notification from "../models/Notification.js";

/**
 * Call this after any operation that changes a product's quantity
 * (purchase received, sale completed, stock in/out/adjustment/transfer).
 * Creates a notification if the product just became low/out of stock,
 * but avoids creating duplicates if an unread one already exists for it.
 */
export const syncStockNotifications = async (product) => {
  const existingUnread = await Notification.findOne({
    product: product._id,
    type: { $in: ["LOW_STOCK", "OUT_OF_STOCK"] },
    read: false,
  });

  if (product.quantity === 0) {
    if (!existingUnread || existingUnread.type !== "OUT_OF_STOCK") {
      if (existingUnread) await Notification.deleteOne({ _id: existingUnread._id });
      await Notification.create({
        type: "OUT_OF_STOCK",
        message: `${product.productName} is out of stock.`,
        product: product._id,
      });
    }
    return;
  }

  if (product.quantity <= product.minimumStock) {
    if (!existingUnread) {
      await Notification.create({
        type: "LOW_STOCK",
        message: `${product.productName} is low on stock (${product.quantity} left, minimum ${product.minimumStock}).`,
        product: product._id,
      });
    }
    return;
  }

  // Stock recovered above minimum - clear any stale low/out-of-stock alerts.
  if (existingUnread) {
    await Notification.deleteOne({ _id: existingUnread._id });
  }
};

export const createNewOrderNotification = async (sale) => {
  await Notification.create({
    type: "NEW_ORDER",
    message: `New sale recorded — total ${sale.total.toFixed(2)}.`,
    sale: sale._id,
  });
};

export const createNewBookingNotification = async (order) => {
  await Notification.create({
    type: "NEW_BOOKING",
    message: `New online order ${order.orderNumber} placed by ${order.customerName}.`,
    order: order._id,
  });
};

export const createBookingCancelledNotification = async (order) => {
  await Notification.create({
    type: "BOOKING_CANCELLED",
    message: `Order ${order.orderNumber} was cancelled.`,
    order: order._id,
  });
};
