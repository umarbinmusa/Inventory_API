import { baseTypeDefs } from "./base.js";
import { userTypeDefs } from "./user.js";
import { categoryTypeDefs } from "./category.js";
import { customerTypeDefs } from "./customer.js";
import { productTypeDefs } from "./product.js";
import { saleTypeDefs } from "./sale.js";
import { stockTypeDefs } from "./stock.js";
import { notificationTypeDefs } from "./notification.js";
import { dashboardTypeDefs } from "./dashboard.js";
import { orderTypeDefs } from "./order.js";
import { reorderTypeDefs } from "./reorder.js";

export const typeDefs = [
  baseTypeDefs,
  userTypeDefs,
  categoryTypeDefs,
  customerTypeDefs,
  productTypeDefs,
  saleTypeDefs,
  stockTypeDefs,
  notificationTypeDefs,
  dashboardTypeDefs,
  orderTypeDefs,
  reorderTypeDefs,
];
