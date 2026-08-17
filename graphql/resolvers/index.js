import { userResolvers } from "./user.js";
import { categoryResolvers } from "./category.js";
import { supplierResolvers } from "./supplier.js";
import { customerResolvers } from "./customer.js";
import { productResolvers } from "./product.js";
import { purchaseResolvers } from "./purchase.js";
import { saleResolvers } from "./sale.js";
import { stockResolvers } from "./stock.js";
import { notificationResolvers } from "./notification.js";
import { dashboardResolvers } from "./dashboard.js";
import { orderResolvers } from "./order.js";
import { reorderResolvers } from "./reorder.js";

// As new resolver modules are added, import them and add to this array.
// They are merged so each module can independently define Query/Mutation/
// <TypeName> resolvers without clobbering others.
const resolverModules = [
  userResolvers,
  categoryResolvers,
  supplierResolvers,
  customerResolvers,
  productResolvers,
  purchaseResolvers,
  saleResolvers,
  stockResolvers,
  notificationResolvers,
  dashboardResolvers,
  orderResolvers,
  reorderResolvers,
];

const mergeResolvers = (modules) => {
  const merged = {};

  for (const mod of modules) {
    for (const [typeName, fields] of Object.entries(mod)) {
      merged[typeName] = { ...(merged[typeName] || {}), ...fields };
    }
  }

  return merged;
};

export const resolvers = mergeResolvers(resolverModules);
