import { GraphQLError } from "graphql";
import Order from "../../models/Order.js";
import Product from "../../models/Product.js";
import Sale from "../../models/Sale.js";
import StockMovement from "../../models/StockMovement.js";
import { ROLES } from "../../config/roles.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { generateSequenceNumber } from "../../utils/sequenceNumber.js";
import {
  syncStockNotifications,
  createNewBookingNotification,
  createBookingCancelledNotification,
} from "../../utils/notifications.js";

const POPULATE = [{ path: "items.product" }, { path: "customer" }, { path: "convertedSale" }, { path: "processedBy" }];

// Which statuses an order can move to next. COMPLETED is only ever reached
// via convertOrderToSale (so stock deduction always happens through that
// one path), not via a direct status update.
const ALLOWED_TRANSITIONS = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["READY", "CANCELLED"],
  READY: ["CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const orderResolvers = {
  Order: {
    id: (parent) => parent._id.toString(),
  },

  Query: {
    orders: async (_p, { status }, context) => {
      requireAuth(context);
      const filter = status ? { status } : {};
      return Order.find(filter).populate(POPULATE).sort({ createdAt: -1 });
    },
    order: async (_p, { id }, context) => {
      requireAuth(context);
      return Order.findById(id).populate(POPULATE);
    },
    trackOrder: async (_p, { orderNumber }) => {
      // Deliberately public/unauthenticated - a customer only needs their
      // order number, per the "keep it simple" requirement.
      return Order.findOne({ orderNumber: orderNumber.trim().toUpperCase() }).populate(POPULATE);
    },
  },

  Mutation: {
    placeOrder: async (_p, { input }, context) => {
      if (!input.items || input.items.length === 0) {
        throw new GraphQLError("An order needs at least one product.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const productIds = input.items.map((i) => i.productId);
      const products = await Product.find({ _id: { $in: productIds } });
      const productMap = new Map(products.map((p) => [p._id.toString(), p]));

      // Booking a product doesn't hold stock (no reservation, per the
      // simplified workflow) but it must be a real, currently active
      // product so the storefront can't book garbage/inactive SKUs.
      const resolvedItems = input.items.map((item) => {
        const product = productMap.get(item.productId);
        if (!product) {
          throw new GraphQLError(`Product ${item.productId} not found.`, {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }
        if (product.status !== "ACTIVE") {
          throw new GraphQLError(`${product.productName} is not currently available.`, {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }
        if (item.quantity < 1) {
          throw new GraphQLError("Quantity must be at least 1.", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }
        return { product: product._id, quantity: item.quantity, price: product.sellingPrice };
      });

      const subtotal = resolvedItems.reduce((sum, i) => sum + i.quantity * i.price, 0);

      const orderNumber = await generateSequenceNumber(Order, "orderNumber", "ORD");

      const order = await Order.create({
        orderNumber,
        // If placed by a logged-in customer, use their saved details as a
        // fallback for anything left blank, and link the order to their
        // account so it shows up in "My Orders" - without requiring an
        // account for guest checkout, which still works exactly as before.
        customerName: input.customerName || context?.customer?.fullName,
        customerPhone: input.customerPhone || context?.customer?.phone,
        customerEmail: input.customerEmail || context?.customer?.email || "",
        customerAddress: input.customerAddress || context?.customer?.address || "",
        customer: context?.customer?._id || null,
        items: resolvedItems,
        subtotal,
        total: subtotal,
        notes: input.notes || "",
      });

      await createNewBookingNotification(order);

      return order.populate(POPULATE);
    },

    updateOrderStatus: async (_p, { id, status }, context) => {
      const user = requireRole(context, [ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER]);
      const order = await Order.findById(id);
      if (!order) {
        throw new GraphQLError("Order not found.", { extensions: { code: "NOT_FOUND" } });
      }

      const allowed = ALLOWED_TRANSITIONS[order.status] || [];
      if (!allowed.includes(status)) {
        throw new GraphQLError(
          `Order can't move from ${order.status} to ${status}.`,
          { extensions: { code: "BAD_USER_INPUT" } }
        );
      }

      order.status = status;
      order.processedBy = user._id;
      await order.save();

      if (status === "CANCELLED") {
        await createBookingCancelledNotification(order);
      }

      return order.populate(POPULATE);
    },

    convertOrderToSale: async (_p, { id, input }, context) => {
      const user = requireRole(context, [ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER]);

      const order = await Order.findById(id).populate("items.product");
      if (!order) {
        throw new GraphQLError("Order not found.", { extensions: { code: "NOT_FOUND" } });
      }
      if (order.status === "COMPLETED" || order.convertedSale) {
        throw new GraphQLError("This order has already been completed.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      if (order.status === "CANCELLED") {
        throw new GraphQLError("Can't complete a cancelled order.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      // Re-check stock right now - the order may have sat pending for a
      // while and stock could have moved. Never deduct more than once.
      for (const item of order.items) {
        const product = item.product;
        if (item.quantity > product.quantity) {
          throw new GraphQLError(
            `Not enough stock for ${product.productName} (${product.quantity} available, ${item.quantity} needed).`,
            { extensions: { code: "BAD_USER_INPUT" } }
          );
        }
      }

      if (input.amountPaid < order.total) {
        throw new GraphQLError("Amount paid is less than the order total.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const receiptNumber = await generateSequenceNumber(Sale, "receiptNumber", "RCP");

      const sale = await Sale.create({
        receiptNumber,
        customer: order.customer || null,
        items: order.items.map((i) => ({
          product: i.product._id,
          quantity: i.quantity,
          price: i.price,
        })),
        subtotal: order.subtotal,
        total: order.total,
        amountPaid: input.amountPaid,
        change: input.amountPaid - order.total,
        paymentMethod: input.paymentMethod || "CASH",
        cashier: user._id,
        order: order._id,
      });

      for (const item of order.items) {
        const updatedProduct = await Product.findByIdAndUpdate(
          item.product._id,
          { $inc: { quantity: -item.quantity } },
          { new: true }
        );
        await StockMovement.create({
          product: item.product._id,
          type: "SALE",
          quantity: -item.quantity,
          reason: `Order ${order.orderNumber}`,
          performedBy: user._id,
        });
        await syncStockNotifications(updatedProduct);
      }

      order.status = "COMPLETED";
      order.paymentStatus = "PAID";
      order.convertedSale = sale._id;
      order.processedBy = user._id;
      await order.save();

      return sale.populate([{ path: "customer" }, { path: "items.product" }, { path: "cashier" }]);
    },
  },
};
