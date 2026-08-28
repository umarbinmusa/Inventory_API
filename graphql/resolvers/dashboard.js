import Product from "../../models/Product.js";
import Category from "../../models/Category.js";
import Customer from "../../models/Customer.js";
import Sale from "../../models/Sale.js";
import Order from "../../models/Order.js";
import { requireAuth } from "../../middleware/auth.js";

const monthKey = (date) => new Date(date).toISOString().slice(0, 7); // "2026-07"
const monthLabel = (key) =>
  new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });

export const dashboardResolvers = {
  Query: {
    dashboardSummary: async (_p, _a, context) => {
      requireAuth(context);

      const [products, categories, customers, sales, pendingOrdersCount, completedOrdersCount] =
        await Promise.all([
          Product.find(),
          Category.find(),
          Customer.find(),
          Sale.find(),
          Order.countDocuments({ status: { $in: ["PENDING", "CONFIRMED", "PROCESSING", "READY"] } }),
          Order.countDocuments({ status: "COMPLETED" }),
        ]);

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const todaysSales = sales.filter((s) => s.createdAt >= startOfToday);
      const todaysSalesCount = todaysSales.length;
      const todaysSalesTotal = todaysSales.reduce((sum, s) => sum + s.total, 0);

      const revenue = sales.reduce((sum, s) => sum + s.total, 0);

      const productCostById = new Map(products.map((p) => [p._id.toString(), p.purchasePrice]));
      const costOfGoodsSold = sales.reduce((sum, s) => {
        const saleCost = s.items.reduce(
          (lineSum, item) => lineSum + item.quantity * (productCostById.get(item.product.toString()) || 0),
          0
        );
        return sum + saleCost;
      }, 0);
      const profit = revenue - costOfGoodsSold;
      // No standalone Purchase-order ledger anymore - cost of goods sold
      // (from each product's purchasePrice) is the closest available
      // stand-in for "expenses" tied to inventory.
      const expenses = costOfGoodsSold;

      const lowStockCount = products.filter((p) => p.quantity > 0 && p.quantity <= p.minimumStock).length;
      const outOfStockCount = products.filter((p) => p.quantity === 0).length;

      // Cost value of everything currently on the shelf. This falls on its
      // own whenever a sale runs (createSale decrements Product.quantity),
      // and rises whenever stock is created or restocked - no separate
      // ledger needed, it's always derived from live quantity x cost.
      const totalInventoryValue = products.reduce((sum, p) => sum + p.quantity * p.purchasePrice, 0);

      const buckets = {};
      sales.forEach((s) => {
        const key = monthKey(s.createdAt);
        buckets[key] = buckets[key] || { sales: 0 };
        buckets[key].sales += s.total;
      });
      const monthlyFigures = Object.entries(buckets)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([key, values]) => ({
          month: monthLabel(key),
          sales: Math.round(values.sales * 100) / 100,
        }));

      const categoryNameById = new Map(categories.map((c) => [c._id.toString(), c.name]));
      const categoryTotals = {};
      products.forEach((p) => {
        const name = categoryNameById.get(p.category.toString()) || "Uncategorized";
        categoryTotals[name] = (categoryTotals[name] || 0) + p.quantity;
      });
      const categoryDistribution = Object.entries(categoryTotals)
        .filter(([, quantity]) => quantity > 0)
        .map(([category, quantity]) => ({ category, quantity }));

      return {
        totalProducts: products.length,
        totalCategories: categories.length,
        totalCustomers: customers.length,
        totalSales: sales.length,
        revenue,
        profit,
        expenses,
        totalInventoryValue,
        lowStockCount,
        outOfStockCount,
        todaysSalesCount,
        todaysSalesTotal,
        pendingOrdersCount,
        completedOrdersCount,
        monthlyFigures,
        categoryDistribution,
      };
    },
  },
};
