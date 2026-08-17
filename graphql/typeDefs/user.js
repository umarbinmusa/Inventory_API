export const userTypeDefs = `#graphql
  enum Role {
    ADMIN
    MANAGER
    CASHIER
    STORE_KEEPER
  }

  type User {
    id: ID!
    fullName: String!
    email: String!
    role: Role!
    phone: String
    avatar: String
    isActive: Boolean!
    lastLoginAt: String
    createdAt: String!
    updatedAt: String!
  }

  type AuthPayload {
    user: User!
    accessToken: String!
    refreshToken: String!
  }

  type MessageResponse {
    success: Boolean!
    message: String!
  }

  input RegisterInput {
    fullName: String!
    email: String!
    password: String!
    role: Role
    phone: String
  }

  input LoginInput {
    email: String!
    password: String!
  }

  input ChangePasswordInput {
    currentPassword: String!
    newPassword: String!
  }

  input UpdateProfileInput {
    fullName: String
    phone: String
    avatar: String
  }

  extend type Query {
    "Returns the currently authenticated user, or null if not logged in."
    currentUser: User

    "Admin/Manager only: list all users."
    users(role: Role): [User!]!

    user(id: ID!): User
  }

  extend type Mutation {
    register(input: RegisterInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
    logout: MessageResponse!

    "Exchanges a valid refresh token (sent via header or arg) for a new token pair."
    refreshToken(refreshToken: String!): AuthPayload!

    changePassword(input: ChangePasswordInput!): MessageResponse!
    forgotPassword(email: String!): MessageResponse!
    resetPassword(token: String!, newPassword: String!): MessageResponse!

    updateProfile(input: UpdateProfileInput!): User!

    "Admin only: activate/deactivate or change another user's role."
    updateUserStatus(id: ID!, isActive: Boolean, role: Role): User!
    deleteUser(id: ID!): MessageResponse!
  }
`;
