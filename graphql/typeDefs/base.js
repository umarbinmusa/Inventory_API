// Root Query/Mutation types. Every module's typeDefs use `extend type Query`
// and `extend type Mutation` to add their own fields onto these.
export const baseTypeDefs = `#graphql
  type Query {
    _empty: String
  }

  type Mutation {
    _empty: String
  }
`;
