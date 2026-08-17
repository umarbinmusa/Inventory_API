export const customerTypeDefs = `#graphql
  type Customer {
    id: ID!
    fullName: String!
    phone: String
    email: String
    address: String
    orderCount: Int!
    "True only for customers who self-registered via the storefront."
    hasAccount: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type CustomerAuthPayload {
    customer: Customer!
    accessToken: String!
    refreshToken: String!
  }

  input CustomerInput {
    fullName: String!
    phone: String
    email: String
    address: String
  }

  input RegisterCustomerInput {
    fullName: String!
    email: String!
    password: String!
    phone: String
    address: String
  }

  input LoginCustomerInput {
    email: String!
    password: String!
  }

  extend type Query {
    customers: [Customer!]!
    customer(id: ID!): Customer

    "The logged-in customer's own profile. Null if not authenticated."
    currentCustomer: Customer

    "The logged-in customer's own booking history."
    myOrders: [Order!]!
  }

  extend type Mutation {
    createCustomer(input: CustomerInput!): Customer!
    updateCustomer(id: ID!, input: CustomerInput!): Customer!
    deleteCustomer(id: ID!): MessageResponse!

    "Public - no login required. Creates a storefront account a customer can use to log in, browse, and book."
    registerCustomer(input: RegisterCustomerInput!): CustomerAuthPayload!
    "Public - no login required."
    loginCustomer(input: LoginCustomerInput!): CustomerAuthPayload!
    customerRefreshToken(refreshToken: String!): CustomerAuthPayload!
    customerLogout: MessageResponse!
  }
`;
