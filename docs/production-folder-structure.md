# Production Folder Structure

This project is currently deployable as a single Node service that serves both the Vite client and Express API. For production maintenance, move toward this structure:

```text
trrip/
  client/
    public/
    src/
      app/
        App.tsx
        routes/
      components/
        auth/
        itinerary/
        layout/
        ui/
      features/
        auth/
          api.ts
          hooks.ts
          types.ts
        itinerary/
          api.ts
          hooks.ts
          types.ts
      lib/
        api-client.ts
        storage.ts
      styles/
        index.css
    index.html
    vite.config.ts

  server/
    src/
      app.ts
      server.ts
      config/
        env.ts
      db/
        connection.ts
        models/
          itinerary.model.ts
          user.model.ts
      modules/
        auth/
          auth.controller.ts
          auth.routes.ts
          auth.service.ts
          auth.validation.ts
        itinerary/
          itinerary.controller.ts
          itinerary.routes.ts
          itinerary.service.ts
          itinerary.validation.ts
      middleware/
        auth.ts
        error-handler.ts
        rate-limit.ts
      services/
        gemini.service.ts
        document-parser.service.ts
      utils/
        async-handler.ts
        ids.ts
        logger.ts

  shared/
    types/
      itinerary.ts
      user.ts

  docs/
  data/                 # development-only fallback storage
  dist/                 # generated build output
  package.json
  render.yaml
  tsconfig.json
```

## Migration Order

1. Extract frontend API calls from `src/App.tsx` into `client/src/features/*/api.ts`.
2. Split UI from `src/App.tsx` into feature components: auth modal, upload form, history drawer, share modal, itinerary view.
3. Move backend bootstrap into `server/src/server.ts` and Express app setup into `server/src/app.ts`.
4. Move environment validation into `server/src/config/env.ts` and fail startup if required production env vars are missing.
5. Split `server/db/db.ts` into connection, models, and repository/service modules.
6. Move Gemini and document parsing logic out of the route handler into services.
7. Add integration tests for auth, itinerary generation validation, share lookup, and delete authorization.

## Production Rules

- Routes should only parse requests, call services, and return responses.
- Services should contain business logic and external API calls.
- Database code should be behind repositories or model helpers, not embedded in routes.
- Shared frontend/backend TypeScript types should live in `shared/types`.
- Local JSON storage should only be used in development.
- Production startup should fail fast when required secrets or database config are missing.
