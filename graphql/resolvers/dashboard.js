import Product from "../../models/Product.js";
import Category from "../../models/Category.js";
import Supplier from "../../models/Supplier.js";
import Customer from "../../models/Customer.js";
import Purchase from "../../models/Purchase.js";
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

      const [products, categories, suppliers, customers, purchases, sales, pendingOrdersCount, completedOrdersCount] =
        await Promise.all([
          Product.find(),
          Category.find(),
          Supplier.find(),
          Customer.find(),
          Purchase.find(),
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
      const expenses = purchases.reduce((sum, p) => sum + p.totalAmount, 0);

      const productCostById = new Map(products.map((p) => [p._id.toString(), p.purchasePrice]));
      const costOfGoodsSold = sales.reduce((sum, s) => {
        const saleCost = s.items.reduce(
          (lineSum, item) => lineSum + item.quantity * (productCostById.get(item.product.toString()) || 0),
          0
        );
        return sum + saleCost;
      }, 0);
      const profit = revenue - costOfGoodsSold;

      const lowStockCount = products.filter((p) => p.quantity > 0 && p.quantity <= p.minimumStock).length;
      const outOfStockCount = products.filter((p) => p.quantity === 0).length;

      const buckets = {};
      sales.forEach((s) => {
        const key = monthKey(s.createdAt);
        buckets[key] = buckets[key] || { sales: 0, purchases: 0 };
        buckets[key].sales += s.total;
      });
      purchases.forEach((p) => {
        const key = monthKey(p.purchaseDate);
        buckets[key] = buckets[key] || { sales: 0, purchases: 0 };
        buckets[key].purchases += p.totalAmount;
      });
      const monthlyFigures = Object.entries(buckets)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([key, values]) => ({
          month: monthLabel(key),
          sales: Math.round(values.sales * 100) / 100,
          purchases: Math.round(values.purchases * 100) / 100,
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
        totalSuppliers: suppliers.length,
        totalCustomers: customers.length,
        totalPurchases: purchases.length,
        totalSales: sales.length,
        revenue,
        profit,
        expenses,
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
