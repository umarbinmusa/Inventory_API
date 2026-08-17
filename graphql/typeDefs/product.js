export const productTypeDefs = `#graphql
  enum ProductStatus {
    ACTIVE
    INACTIVE
    DISCONTINUED
  }

  enum StockStatus {
    IN_STOCK
    LOW_STOCK
    OUT_OF_STOCK
  }

  type Product {
    id: ID!
    sku: String!
    barcode: String
    productName: String!
    category: Category!
    supplier: Supplier!
    purchasePrice: Float!
    sellingPrice: Float!
    quantity: Int!
    minimumStock: Int!
    unit: String!
    image: String
    description: String
    status: ProductStatus!
    stockStatus: StockStatus!
    expiryDate: String
    createdAt: String!
    updatedAt: String!
  }

  input ProductInput {
    sku: String!
    barcode: String
    productName: String!
    categoryId: ID!
    supplierId: ID!
    purchasePrice: Float!
    sellingPrice: Float!
    quantity: Int!
    minimumStock: Int!
    unit: String
    image: String
    description: String
    status: ProductStatus
    expiryDate: String
  }

  extend type Query {
    products(categoryId: ID, status: ProductStatus): [Product!]!
    product(id: ID!): Product
    searchProducts(query: String!): [Product!]!
    lowStockProducts: [Product!]!
    outOfStockProducts: [Product!]!
    expiringProducts(withinDays: Int = 30): [Product!]!

    "Public storefront: browse active products - no login required."
    shopProducts(categoryId: ID): [Product!]!
    "Public storefront: a single active product's detail page - no login required."
    shopProduct(id: ID!): Product
    "Public storefront: search active products by name, SKU, or category - no login required."
    shopSearchProducts(query: String!): [Product!]!
  }

  extend type Mutation {
    createProduct(input: ProductInput!): Product!
    updateProduct(id: ID!, input: ProductInput!): Product!
    deleteProduct(id: ID!): MessageResponse!
  }
`;
