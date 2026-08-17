export const categoryTypeDefs = `#graphql
  type Category {
    id: ID!
    name: String!
    description: String
    productCount: Int!
    createdAt: String!
    updatedAt: String!
  }

  input CategoryInput {
    name: String!
    description: String
  }

  extend type Query {
    categories: [Category!]!
    category(id: ID!): Category
    "Public storefront: category list for the filter bar - no login required."
    shopCategories: [Category!]!
  }

  extend type Mutation {
    createCategory(input: CategoryInput!): Category!
    updateCategory(id: ID!, input: CategoryInput!): Category!
    deleteCategory(id: ID!): MessageResponse!
  }
`;
