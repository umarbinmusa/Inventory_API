export const reorderTypeDefs = `#graphql
  enum ReorderStatus {
    PENDING
    ORDERED
    RECEIVED
  }

  type Reorder {
    id: ID!
    product: Product!
    supplier: Supplier
    quantityAtRequest: Int!
    reorderLevelAtRequest: Int!
    suggestedQuantity: Int!
    status: ReorderStatus!
    requestedBy: User
    notes: String
    createdAt: String!
    updatedAt: String!
  }

  input CreateReorderInput {
    productId: ID!
    supplierId: ID
    suggestedQuantity: Int!
    notes: String
  }

  extend type Query {
    "Products at or below their reorder level right now, for the 'Reorder Required' panel."
    reorderRequired: [Product!]!
    reorders(status: ReorderStatus): [Reorder!]!
  }

  extend type Mutation {
    createReorder(input: CreateReorderInput!): Reorder!
    "Move a reorder request through Pending -> Ordered -> Received. Does NOT change stock - use stockIn once goods physically arrive."
    updateReorderStatus(id: ID!, status: ReorderStatus!): Reorder!
  }
`;
