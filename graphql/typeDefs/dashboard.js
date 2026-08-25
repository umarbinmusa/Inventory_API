export const dashboardTypeDefs = `#graphql
  type MonthlyFigure {
    month: String!
    sales: Float!
  }

  type CategoryStock {
    category: String!
    quantity: Int!
  }

  type DashboardSummary {
    totalProducts: Int!
    totalCategories: Int!
    totalCustomers: Int!
    totalSales: Int!
    revenue: Float!
    profit: Float!
    expenses: Float!
    lowStockCount: Int!
    outOfStockCount: Int!
    todaysSalesCount: Int!
    todaysSalesTotal: Float!
    pendingOrdersCount: Int!
    completedOrdersCount: Int!
    monthlyFigures: [MonthlyFigure!]!
    categoryDistribution: [CategoryStock!]!
  }

  extend type Query {
    dashboardSummary: DashboardSummary!
  }
`;
