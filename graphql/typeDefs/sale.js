export const saleTypeDefs = `#graphql
  enum PaymentMethod {
    CASH
    CARD
    TRANSFER
  }

  type SaleItem {
    product: Product!
    quantity: Int!
    price: Float!
  }

  type Sale {
    id: ID!
    receiptNumber: String!
    customer: Customer
    items: [SaleItem!]!
    subtotal: Float!
    discount: Float!
    tax: Float!
    total: Float!
    amountPaid: Float!
    change: Float!
    paymentMethod: PaymentMethod!
    cashier: User
    "Set when this sale came from converting an online order/booking rather than a walk-in POS sale."
    order: Order
    createdAt: String!
  }

  input SaleItemInput {
    productId: ID!
    quantity: Int!
  }

  input CreateSaleInput {
    customerId: ID
    items: [SaleItemInput!]!
    discount: Float
    taxRate: Float
    "Amount tendered by the customer. Must be >= the sale total; change is computed automatically."
    amountPaid: Float
    paymentMethod: PaymentMethod
  }

  extend type Query {
    sales: [Sale!]!
    sale(id: ID!): Sale
  }

  extend type Mutation {
    "Creates the sale, validates stock availability, and deducts inventory."
    createSale(input: CreateSaleInput!): Sale!
  }
`;
