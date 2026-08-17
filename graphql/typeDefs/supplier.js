export const supplierTypeDefs = `#graphql
  type Supplier {
    id: ID!
    companyName: String!
    contactPerson: String
    phone: String
    email: String
    address: String
    productCount: Int!
    createdAt: String!
    updatedAt: String!
  }

  input SupplierInput {
    companyName: String!
    contactPerson: String
    phone: String
    email: String
    address: String
  }

  extend type Query {
    suppliers: [Supplier!]!
    supplier(id: ID!): Supplier
  }

  extend type Mutation {
    createSupplier(input: SupplierInput!): Supplier!
    updateSupplier(id: ID!, input: SupplierInput!): Supplier!
    deleteSupplier(id: ID!): MessageResponse!
  }
`;
