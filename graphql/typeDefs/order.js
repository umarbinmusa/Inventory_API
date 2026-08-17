export const orderTypeDefs = `#graphql
  enum OrderStatus {
    PENDING
    CONFIRMED
    PROCESSING
    READY
    COMPLETED
    CANCELLED
  }

  enum OrderPaymentStatus {
    UNPAID
    PAID
  }

  type OrderItem {
    product: Product!
    quantity: Int!
    price: Float!
  }

  type Order {
    id: ID!
    orderNumber: String!
    customerName: String!
    customerPhone: String!
    customerEmail: String
    customerAddress: String
    customer: Customer
    items: [OrderItem!]!
    subtotal: Float!
    total: Float!
    status: OrderStatus!
    paymentStatus: OrderPaymentStatus!
    notes: String
    convertedSale: Sale
    processedBy: User
    createdAt: String!
    updatedAt: String!
  }

  input PlaceOrderItemInput {
    productId: ID!
    quantity: Int!
  }

  "Public input - no login required. Anyone can book a product this way."
  input PlaceOrderInput {
    customerName: String!
    customerPhone: String!
    customerEmail: String
    customerAddress: String
    items: [PlaceOrderItemInput!]!
    notes: String
  }

  input ConvertOrderToSaleInput {
    amountPaid: Float!
    paymentMethod: PaymentMethod
  }

  extend type Query {
    "Admin/staff: list online orders, optionally filtered by status."
    orders(status: OrderStatus): [Order!]!
    order(id: ID!): Order

    "Public: a customer looks up their own order by order number - no login required."
    trackOrder(orderNumber: String!): Order
  }

  extend type Mutation {
    "Public: a customer places a booking/order - no login required. Stock is NOT deducted here."
    placeOrder(input: PlaceOrderInput!): Order!

    "Staff updates an order's status as it moves through the workflow."
    updateOrderStatus(id: ID!, status: OrderStatus!): Order!

    "Staff converts a confirmed/ready order into a completed Sale. Deducts stock exactly once."
    convertOrderToSale(id: ID!, input: ConvertOrderToSaleInput!): Sale!
  }
`;
