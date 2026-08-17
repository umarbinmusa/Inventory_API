import { GraphQLError } from "graphql";
import Purchase from "../../models/Purchase.js";
import Product from "../../models/Product.js";
import Supplier from "../../models/Supplier.js";
import StockMovement from "../../models/StockMovement.js";
import { ROLES } from "../../config/roles.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { syncStockNotifications } from "../../utils/notifications.js";

const POPULATE = [{ path: "supplier" }, { path: "items.product" }, { path: "receivedBy" }];

export const purchaseResolvers = {
  Query: {
    purchases: async (_p, _a, context) => {
      requireAuth(context);
      return Purchase.find().populate(POPULATE).sort({ purchaseDate: -1 });
    },
    purchase: async (_p, { id }, context) => {
      requireAuth(context);
      return Purchase.findById(id).populate(POPULATE);
    },
  },

  Mutation: {
    createPurchase: async (_p, { input }, context) => {
      const user = requireRole(context, [ROLES.ADMIN, ROLES.MANAGER, ROLES.STORE_KEEPER]);

      const supplier = await Supplier.findById(input.supplierId);
      if (!supplier) {
        throw new GraphQLError("Supplier not found.", { extensions: { code: "BAD_USER_INPUT" } });
      }

      const products = await Product.find({
        _id: { $in: input.items.map((i) => i.productId) },
      });
      if (products.length !== new Set(input.items.map((i) => i.productId)).size) {
        throw new GraphQLError("One or more products in this order weren't found.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const totalAmount = input.items.reduce((sum, i) => sum + i.quantity * i.cost, 0);

      const purchase = await Purchase.create({
        supplier: input.supplierId,
        items: input.items.map((i) => ({
          product: i.productId,
          quantity: i.quantity,
          cost: i.cost,
        })),
        totalAmount,
        paymentStatus: input.paymentStatus || "UNPAID",
        purchaseDate: new Date(),
        receivedBy: user._id,
      });

      // Receive the goods immediately: increase stock and log each movement.
      for (const item of input.items) {
        const product = await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { quantity: item.quantity } },
          { new: true }
        );
        await StockMovement.create({
          product: item.productId,
          type: "PURCHASE",
          quantity: item.quantity,
          reason: `Purchase order ${purchase._id} received`,
          performedBy: user._id,
        });
        await syncStockNotifications(product);
      }

      return purchase.populate(POPULATE);
    },

    updatePurchasePayment: async (_p, { id, paymentStatus }, context) => {
      requireRole(context, [ROLES.ADMIN, ROLES.MANAGER]);
      const purchase = await Purchase.findByIdAndUpdate(
        id,
        { paymentStatus },
        { new: true, runValidators: true }
      ).populate(POPULATE);

      if (!purchase) {
        throw new GraphQLError("Purchase not found.", { extensions: { code: "NOT_FOUND" } });
      }
      return purchase;
    },
  },
};
