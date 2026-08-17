export const stockTypeDefs = `#graphql
  enum StockMovementType {
    PURCHASE
    SALE
    STOCK_IN
    STOCK_OUT
    ADJUSTMENT
    TRANSFER
  }

  type StockMovement {
    id: ID!
    product: Product!
    type: StockMovementType!
    quantity: Int!
    reason: String
    performedBy: User
    createdAt: String!
  }

  extend type Query {
    stockMovements(productId: ID): [StockMovement!]!
  }

  extend type Mutation {
    stockIn(productId: ID!, quantity: Int!, reason: String): StockMovement!
    stockOut(productId: ID!, quantity: Int!, reason: String): StockMovement!
    "Use a negative quantity to reduce stock, positive to increase it."
    stockAdjust(productId: ID!, quantity: Int!, reason: String): StockMovement!
    stockTransfer(productId: ID!, quantity: Int!, from: String!, to: String!, note: String): StockMovement!
  }
`;
