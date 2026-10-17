# Wanderboard — GraphQL trail planner

A synthetic German trip catalogue with nested guides and stops, filtering, and a stateless group-price calculator. No reservations, payment, personal information or external services. One Node HTTP service, pinned upstream `graphql` package (17.0.2), no substituted query engine.

Run `npm ci && npm start`; open http://localhost:3290. `PORT` can override the port. The browser uses GET for reads and JSON POST for the calculation mutation. The same pure calculation is exposed as a query for a precise GET/POST comparison. Prices use integer cents. No persistent state is claimed.

`GET /health` identifies the release, group fee and actual GraphQL library. `/graphql` accepts GraphQL queries, variables and named operations. Parse/schema/variable errors return 400; resolver errors return 200 with GraphQL errors and nullable data. GET mutations return 405. Request limits: 16 KiB JSON body, 4096 query characters, 12 people per group. Introspection is enabled for this public demonstration.

Library documentation: https://www.graphql-js.org/docs/ . The HTTP adapter is this application's code; it does not claim full GraphQL-over-HTTP conformance. Request bodies use ordinary Node data/end/error events because the observed Dev compiler rejected async iteration in an earlier independent CSV case.

Release 1 has a 900-cent group fee. Release 2 changes only `policy.js` to a 1200-cent group fee, providing a visible deploy-version and shared-pricing check.

Deploy to Dev using `lly init xleonplayz/void-ship-graphql-trails-1017 --name void-ship-graphql-trails-1017 --all --config lily.toml -y --detach`; expose the app's HTTP port after deployment completes. Browser and platform evidence lives outside this public repository in Lane Ship's evidence directory.
