import { GraphQLError } from "graphql";
import Sale from "../../models/Sale.js";
import Product from "../../models/Product.js";
import Customer from "../../models/Customer.js";
import StockMovement from "../../models/StockMovement.js";
import { ROLES } from "../../config/roles.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { syncStockNotifications, createNewOrderNotification } from "../../utils/notifications.js";
import { generateSequenceNumber } from "../../utils/sequenceNumber.js";

const POPULATE = [{ path: "customer" }, { path: "items.product" }, { path: "cashier" }, { path: "order" }];

export const saleResolvers = {
  Query: {
    sales: async (_p, _a, context) => {
      requireAuth(context);
      return Sale.find().populate(POPULATE).sort({ createdAt: -1 });
    },
    sale: async (_p, { id }, context) => {
      requireAuth(context);
      return Sale.findById(id).populate(POPULATE);
    },
  },

  Mutation: {
    createSale: async (_p, { input }, context) => {
      const user = requireRole(context, [ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER]);

      if (input.customerId) {
        const customer = await Customer.findById(input.customerId);
        if (!customer) {
          throw new GraphQLError("Customer not found.", { extensions: { code: "BAD_USER_INPUT" } });
        }
      }

      const productIds = input.items.map((i) => i.productId);
      const products = await Product.find({ _id: { $in: productIds } });
      const productMap = new Map(products.map((p) => [p._id.toString(), p]));

      // Validate every line item BEFORE mutating anything, so a sale never
      // partially decrements stock and then fails partway through.
      const resolvedItems = input.items.map((item) => {
        const product = productMap.get(item.productId);
        if (!product) {
          throw new GraphQLError(`Product ${item.productId} not found.`, {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }
        if (item.quantity > product.quantity) {
          throw new GraphQLError(
            `Not enough stock for ${product.productName} (${product.quantity} available, ${item.quantity} requested).`,
            { extensions: { code: "BAD_USER_INPUT" } }
          );
        }
        return { product, quantity: item.quantity, price: product.sellingPrice };
      });

      const subtotal = resolvedItems.reduce((sum, i) => sum + i.quantity * i.price, 0);
      const discount = Math.max(0, input.discount || 0);
      const discountedSubtotal = Math.max(0, subtotal - discount);
      const taxRate = Math.max(0, input.taxRate || 0);
      const tax = discountedSubtotal * (taxRate / 100);
      const total = discountedSubtotal + tax;

      const amountPaid = input.amountPaid ?? total;
      if (amountPaid < total) {
        throw new GraphQLError(
          `Amount paid (${amountPaid}) is less than the total due (${total}).`,
          { extensions: { code: "BAD_USER_INPUT" } }
        );
      }
      const change = amountPaid - total;

      const receiptNumber = await generateSequenceNumber(Sale, "receiptNumber", "RCP");

      const sale = await Sale.create({
        receiptNumber,
        customer: input.customerId || null,
        items: resolvedItems.map((i) => ({
          product: i.product._id,
          quantity: i.quantity,
          price: i.price,
        })),
        subtotal,
        discount,
        tax,
        total,
        amountPaid,
        change,
        paymentMethod: input.paymentMethod || "CASH",
        cashier: user._id,
      });

      for (const item of resolvedItems) {
        const updatedProduct = await Product.findByIdAndUpdate(
          item.product._id,
          { $inc: { quantity: -item.quantity } },
          { new: true }
        );
        await StockMovement.create({
          product: item.product._id,
          type: "SALE",
          quantity: -item.quantity,
          reason: `Sale ${sale._id}`,
          performedBy: user._id,
        });
        await syncStockNotifications(updatedProduct);
      }

      await createNewOrderNotification(sale);

      return sale.populate(POPULATE);
    },
  },
};
