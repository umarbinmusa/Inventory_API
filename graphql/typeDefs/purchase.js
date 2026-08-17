export const purchaseTypeDefs = `#graphql
  enum PaymentStatus {
    UNPAID
    PARTIAL
    PAID
  }

  type PurchaseItem {
    product: Product!
    quantity: Int!
    cost: Float!
  }

  type Purchase {
    id: ID!
    supplier: Supplier!
    items: [PurchaseItem!]!
    totalAmount: Float!
    paymentStatus: PaymentStatus!
    purchaseDate: String!
    receivedBy: User
    createdAt: String!
  }

  input PurchaseItemInput {
    productId: ID!
    quantity: Int!
    cost: Float!
  }

  input CreatePurchaseInput {
    supplierId: ID!
    items: [PurchaseItemInput!]!
    paymentStatus: PaymentStatus
  }

  extend type Query {
    purchases: [Purchase!]!
    purchase(id: ID!): Purchase
  }

  extend type Mutation {
    "Creates the purchase order and immediately receives it, increasing stock."
    createPurchase(input: CreatePurchaseInput!): Purchase!
    updatePurchasePayment(id: ID!, paymentStatus: PaymentStatus!): Purchase!
  }
`;
