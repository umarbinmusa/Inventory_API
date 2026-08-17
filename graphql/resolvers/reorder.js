import { GraphQLError } from "graphql";
import Reorder from "../../models/Reorder.js";
import Product from "../../models/Product.js";
import { ROLES } from "../../config/roles.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const POPULATE = [{ path: "product" }, { path: "supplier" }, { path: "requestedBy" }];

export const reorderResolvers = {
  Query: {
    // Powers the "Reorder Required" panel directly off live product data,
    // so it's always accurate even if no Reorder record has been created yet.
    reorderRequired: async (_p, _a, context) => {
      requireAuth(context);
      const products = await Product.find({ status: { $ne: "DISCONTINUED" } }).populate([
        "category",
        "supplier",
      ]);
      return products.filter((p) => p.quantity <= p.minimumStock);
    },

    reorders: async (_p, { status }, context) => {
      requireAuth(context);
      const filter = status ? { status } : {};
      return Reorder.find(filter).populate(POPULATE).sort({ createdAt: -1 });
    },
  },

  Mutation: {
    createReorder: async (_p, { input }, context) => {
      const user = requireRole(context, [ROLES.ADMIN, ROLES.MANAGER, ROLES.STORE_KEEPER]);

      const product = await Product.findById(input.productId);
      if (!product) {
        throw new GraphQLError("Product not found.", { extensions: { code: "BAD_USER_INPUT" } });
      }
      if (input.suggestedQuantity < 1) {
        throw new GraphQLError("Suggested quantity must be at least 1.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const reorder = await Reorder.create({
        product: product._id,
        supplier: input.supplierId || product.supplier || null,
        quantityAtRequest: product.quantity,
        reorderLevelAtRequest: product.minimumStock,
        suggestedQuantity: input.suggestedQuantity,
        requestedBy: user._id,
        notes: input.notes || "",
      });

      return reorder.populate(POPULATE);
    },

    updateReorderStatus: async (_p, { id, status }, context) => {
      requireRole(context, [ROLES.ADMIN, ROLES.MANAGER, ROLES.STORE_KEEPER]);

      const reorder = await Reorder.findById(id);
      if (!reorder) {
        throw new GraphQLError("Reorder request not found.", { extensions: { code: "NOT_FOUND" } });
      }

      // Simple forward-only workflow: Pending -> Ordered -> Received.
      const order = ["PENDING", "ORDERED", "RECEIVED"];
      if (order.indexOf(status) < order.indexOf(reorder.status)) {
        throw new GraphQLError(`Reorder can't move backwards from ${reorder.status} to ${status}.`, {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      reorder.status = status;
      await reorder.save();

      // Deliberately does NOT touch product.quantity - once stock physically
      // arrives, staff records it via stockIn, which is the single source of
      // truth for inventory changes and already creates its own notification.
      return reorder.populate(POPULATE);
    },
  },
};
