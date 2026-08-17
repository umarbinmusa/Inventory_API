import { GraphQLError } from "graphql";
import Product from "../../models/Product.js";
import Category from "../../models/Category.js";
import Supplier from "../../models/Supplier.js";
import { ROLES } from "../../config/roles.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { syncStockNotifications } from "../../utils/notifications.js";

const POPULATE = ["category", "supplier"];

const assertRefsExist = async (categoryId, supplierId) => {
  const [category, supplier] = await Promise.all([
    Category.findById(categoryId),
    Supplier.findById(supplierId),
  ]);
  if (!category) {
    throw new GraphQLError("Category not found.", { extensions: { code: "BAD_USER_INPUT" } });
  }
  if (!supplier) {
    throw new GraphQLError("Supplier not found.", { extensions: { code: "BAD_USER_INPUT" } });
  }
};

const toProductDoc = ({ categoryId, supplierId, ...rest }) => ({
  ...rest,
  ...(categoryId ? { category: categoryId } : {}),
  ...(supplierId ? { supplier: supplierId } : {}),
});

export const productResolvers = {
  Product: {
    id: (parent) => parent._id.toString(),
    stockStatus: (parent) => {
      if (parent.quantity === 0) return "OUT_OF_STOCK";
      if (parent.quantity <= parent.minimumStock) return "LOW_STOCK";
      return "IN_STOCK";
    },
  },

  Query: {
    products: async (_p, { categoryId, status }, context) => {
      requireAuth(context);
      const filter = {};
      if (categoryId) filter.category = categoryId;
      if (status) filter.status = status;
      return Product.find(filter).populate(POPULATE).sort({ createdAt: -1 });
    },

    product: async (_p, { id }, context) => {
      requireAuth(context);
      return Product.findById(id).populate(POPULATE);
    },

    searchProducts: async (_p, { query }, context) => {
      requireAuth(context);
      return Product.find({
        $or: [
          { productName: { $regex: query, $options: "i" } },
          { sku: { $regex: query, $options: "i" } },
          { barcode: { $regex: query, $options: "i" } },
        ],
      })
        .populate(POPULATE)
        .limit(20);
    },

    lowStockProducts: async (_p, _a, context) => {
      requireAuth(context);
      const products = await Product.find().populate(POPULATE);
      return products.filter((p) => p.quantity > 0 && p.quantity <= p.minimumStock);
    },

    outOfStockProducts: async (_p, _a, context) => {
      requireAuth(context);
      return Product.find({ quantity: 0 }).populate(POPULATE);
    },

    expiringProducts: async (_p, { withinDays }, context) => {
      requireAuth(context);
      const cutoff = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000);
      return Product.find({ expiryDate: { $ne: null, $lte: cutoff } })
        .populate(POPULATE)
        .sort({ expiryDate: 1 });
    },

    // Deliberately unauthenticated - customers browsing the storefront never
    // log in. Only ACTIVE products are ever exposed publicly, regardless of
    // stock level (an out-of-stock item still shows, just not orderable).
    shopProducts: async (_p, { categoryId }) => {
      const filter = { status: "ACTIVE" };
      if (categoryId) filter.category = categoryId;
      return Product.find(filter).populate(POPULATE).sort({ createdAt: -1 });
    },

    shopProduct: async (_p, { id }) => {
      return Product.findOne({ _id: id, status: "ACTIVE" }).populate(POPULATE);
    },

    shopSearchProducts: async (_p, { query }) => {
      return Product.find({
        status: "ACTIVE",
        $or: [
          { productName: { $regex: query, $options: "i" } },
          { sku: { $regex: query, $options: "i" } },
          { barcode: { $regex: query, $options: "i" } },
        ],
      })
        .populate(POPULATE)
        .limit(30);
    },
  },

  Mutation: {
    createProduct: async (_p, { input }, context) => {
      requireRole(context, [ROLES.ADMIN, ROLES.MANAGER, ROLES.STORE_KEEPER]);
      await assertRefsExist(input.categoryId, input.supplierId);

      const existingSku = await Product.findOne({ sku: input.sku.toUpperCase() });
      if (existingSku) {
        throw new GraphQLError("A product with this SKU already exists.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const product = await Product.create(toProductDoc(input));
      return product.populate(POPULATE);
    },

    updateProduct: async (_p, { id, input }, context) => {
      requireRole(context, [ROLES.ADMIN, ROLES.MANAGER, ROLES.STORE_KEEPER]);
      await assertRefsExist(input.categoryId, input.supplierId);

      const product = await Product.findByIdAndUpdate(id, toProductDoc(input), {
        new: true,
        runValidators: true,
      }).populate(POPULATE);

      if (!product) {
        throw new GraphQLError("Product not found.", { extensions: { code: "NOT_FOUND" } });
      }

      await syncStockNotifications(product);
      return product;
    },

    deleteProduct: async (_p, { id }, context) => {
      requireRole(context, [ROLES.ADMIN, ROLES.MANAGER]);
      const result = await Product.findByIdAndDelete(id);
      if (!result) {
        throw new GraphQLError("Product not found.", { extensions: { code: "NOT_FOUND" } });
      }
      return { success: true, message: "Product deleted." };
    },
  },
};
