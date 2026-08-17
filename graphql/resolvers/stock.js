import { GraphQLError } from "graphql";
import Product from "../../models/Product.js";
import StockMovement from "../../models/StockMovement.js";
import { ROLES } from "../../config/roles.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { syncStockNotifications } from "../../utils/notifications.js";

const POPULATE = [{ path: "product" }, { path: "performedBy" }];

const applyMovement = async ({ productId, delta, type, reason, user }) => {
  const product = await Product.findById(productId);
  if (!product) {
    throw new GraphQLError("Product not found.", { extensions: { code: "BAD_USER_INPUT" } });
  }

  const newQuantity = product.quantity + delta;
  if (newQuantity < 0) {
    throw new GraphQLError(
      `This would take ${product.productName} below zero stock (${product.quantity} available).`,
      { extensions: { code: "BAD_USER_INPUT" } }
    );
  }

  product.quantity = newQuantity;
  await product.save();

  const movement = await StockMovement.create({
    product: productId,
    type,
    quantity: delta,
    reason,
    performedBy: user._id,
  });

  await syncStockNotifications(product);
  return movement.populate(POPULATE);
};

export const stockResolvers = {
  Query: {
    stockMovements: async (_p, { productId }, context) => {
      requireAuth(context);
      const filter = productId ? { product: productId } : {};
      return StockMovement.find(filter).populate(POPULATE).sort({ createdAt: -1 }).limit(500);
    },
  },

  Mutation: {
    stockIn: async (_p, { productId, quantity, reason }, context) => {
      const user = requireRole(context, [ROLES.ADMIN, ROLES.MANAGER, ROLES.STORE_KEEPER]);
      return applyMovement({
        productId,
        delta: Math.abs(quantity),
        type: "STOCK_IN",
        reason: reason || "Manual stock in",
        user,
      });
    },

    stockOut: async (_p, { productId, quantity, reason }, context) => {
      const user = requireRole(context, [ROLES.ADMIN, ROLES.MANAGER, ROLES.STORE_KEEPER]);
      return applyMovement({
        productId,
        delta: -Math.abs(quantity),
        type: "STOCK_OUT",
        reason: reason || "Manual stock out",
        user,
      });
    },

    stockAdjust: async (_p, { productId, quantity, reason }, context) => {
      const user = requireRole(context, [ROLES.ADMIN, ROLES.MANAGER, ROLES.STORE_KEEPER]);
      return applyMovement({
        productId,
        delta: quantity,
        type: "ADJUSTMENT",
        reason: reason || "Manual adjustment",
        user,
      });
    },

    stockTransfer: async (_p, { productId, quantity, from, to, note }, context) => {
      const user = requireRole(context, [ROLES.ADMIN, ROLES.MANAGER, ROLES.STORE_KEEPER]);
      const product = await Product.findById(productId);
      if (!product) {
        throw new GraphQLError("Product not found.", { extensions: { code: "BAD_USER_INPUT" } });
      }
      // Transfers don't change total stock on hand (moving between locations
      // this system doesn't model as separate entities yet) - logged as a
      // net-zero movement for audit purposes.
      const movement = await StockMovement.create({
        product: productId,
        type: "TRANSFER",
        quantity: Math.abs(quantity),
        reason: `Transferred from ${from} to ${to}${note ? ` — ${note}` : ""}`,
        performedBy: user._id,
      });
      return movement.populate(POPULATE);
    },
  },
};
