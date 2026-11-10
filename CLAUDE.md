# Realms Scorer

Expo/React Native app that works out your score for the Fantasy Realms card game.

## Commands

```bash
adb connect <phone-ip>:<port>        # connect phone via wireless debugging
npx expo run:android --device        # build, install, and run on phone
npx expo start --dev-client          # dev server only
npx expo prebuild -p android --clean # regenerate android/
npx expo install <package>           # add a dependency
npm run ui:add -- <component>        # add a Gluestack component
npx expo-doctor                      # diagnose project issues
npm run format                       # format everything with Prettier
npm run format:check                 # check formatting without writing
npm run lint                         # run ESLint, including layer boundary rules
npm test                             # run Jest tests
npm run test:e2e                     # run Maestro flows on the installed debug build, starting Metro if needed
npm run test:e2e:build               # build and install the debug app, then run the flows, starting Metro if needed
npm run test:e2e:release             # run Maestro flows on the installed release build
npm run test:e2e:build:release       # build and install the release app, then run the flows
```

Do not install the app on the phone or run Maestro flows unless explicitly told to.

Component tests use React Native Testing Library: render the real components and store with fake use cases, as in `App.test.tsx`. Use them for UI behaviour, including failure and in-flight states, and keep Maestro for flows through the real wiring. Jest doesn't run the CSS, so passing tests say nothing about styling: check that on a device.

## Releasing

Publish a GitHub release whose tag is the version, such as `0.3.0` (a leading `v` is dropped, and tags with a `-`, such as `0.3.0-rc.1`, are ignored). Publishing creates the tag, which starts `.eas/workflows/release.yml`: EAS builds the `production` profile with the tag as `version`, through `APP_VERSION` in `app.config.ts`, and submits it to Google Play's internal testing track. Promote it to production in Play Console.

- Don't bump `version` in `app.config.ts` for a release. Its value is only the fallback for local builds.
- A `production` build fails without `APP_VERSION`, so `eas build --profile production` by hand needs it set.
- EAS sets the versionCode from its remote counter (`appVersionSource: "remote"`).
- The home screen shows the installed versionName and versionCode at the end of the grid, through the `LoadAppInfo` use case.

## Formatting

Prettier formats files on save in VS Code, after each Claude Code edit (a hook in `.claude/settings.json`), and on commit (husky and lint-staged), so don't format by hand. It also sorts Tailwind classes. `.prettierignore` leaves out the copied Gluestack components and the design mockups.

## Styling

Gluestack v5 components, styled with NativeWind v5 and Tailwind v4. `design/mockups/DESIGN-NOTES.md` maps the design to tokens, classes and components.

- Colours and fonts are tokens in `src/infrastructure/driving/ui/global.css`, the only place with colour values. Use token classes such as `bg-muted`, never hex values.
- Write class names out in full, as Tailwind only generates classes it finds as text. `SUITS` in `theme.ts` holds the suit classes for this reason.
- Use `style` only for values that truly vary at runtime.
- Use `font-heading` and `font-body-*`. Each font weight is its own family, so `font-medium` and `font-bold` don't work.
- Third-party components need NativeWind's `styled` to accept `className`, as in `Screen.tsx`.
- Import icons from their own path, such as `lucide-react-native/icons/x`. Importing from the package root bundles every icon.
- Some valid Tailwind classes do nothing on native, and lint won't catch them. Metro's `react-native-css` output lists what it drops, and should list nothing, so treat any entry as a problem to fix. `tabular-nums` is one such class, so use `fontVariant` in `style`.
- `npm run lint` rejects unknown classes. A new prop that takes classes needs adding to `classProps` in `eslint.config.js`.

Gluestack components are source files copied into `ui/gluestack/`:

- Add them with `npm run ui:add`, not the Gluestack CLI directly. On every install the CLI sets `legacy-peer-deps` in `.npmrc`, which hides peer conflicts and removes peers that Jest needs, so the script undoes it.
- `ui/gluestack/` is in `.prettierignore`, so these files keep their upstream formatting and re-adding a component only shows real changes.
- Re-adding a component overwrites it. Prefer tokens and `className` at the call site, and keep other edits to these files small. Most have local edits to reapply: `button`, `heading`, `card` and `gluestack-ui-provider` for the design, and any file with web-only classes, which come with new components too. Remove `index.web.tsx` files, `isWeb` branches, `web:` classes and anything else Metro reports as dropped.
- Components that need `@legendapp/motion` fail to install while NativeWind is a prerelease, as `5.0.0-rc.1` doesn't satisfy its `>=4.0.0` peer range. Use a narrow `overrides` entry for that package rather than `legacy-peer-deps`.
- With `android/` present, the CLI can't detect an Expo project and `-y` makes it choose `library`, which replaces NativeWind v5 with v4. Don't pass `-y` to `init`, and choose Expo when asked.

`nativewind` and `react-native-css` are pinned as an exact release candidate pair, and `tailwindcss` and `@tailwindcss/postcss` to 4.2.x. Revisit these when NativeWind v5 is stable.

## Architecture

Hexagonal. Dependencies point inwards; ESLint enforces the boundaries.

- `src/domain/`: pure business rules and types. Imports only `domain`.
- `src/application/`: use cases, as `<name>.usecase.ts` plus `<name>.ports.ts` if it has ports. `use-cases.ts` holds the `UseCases` type. Imports `domain` and `application`; no React, Redux or Expo.
- `src/infrastructure/driven/`: general-purpose adapter classes that satisfy ports structurally, without `implements`. Imports `domain` types and its own libraries, not `application`.
- `src/infrastructure/driving/`: `state/` (Redux slices, thunks, selectors) and `ui/` (components, with those copied from Gluestack in `ui/gluestack/`). Imports `domain` types. Must not import `driven`.
- `src/composition-root.ts`: the only file that imports Awilix. Builds the use cases.
- `src/main.tsx`: the entry point (`main` in `package.json`). Builds the store, registers the root component, and is the only file with startup side effects, apart from `App.tsx` importing `global.css`, which NativeWind requires to be outside the file that registers the root component.

Conventions:

- Infrastructure never calls domain functions; it only uses domain types, through `import type`, which ESLint enforces. Business rules are reached through use cases.
- Use cases: a `<Name>` interface, implemented by a `<Name>UseCase` class with an `execute` method. `UseCases` refers to the interfaces, so tests can use simple fakes. Domain values stay plain data and functions.
- Dependency injection: use case constructors destructure their ports, so a missing registration fails at startup. Use `InjectionMode.PROXY`, and register explicitly rather than using `loadModules`. Register with `asFunction((deps: Cradle) => new X(deps))` rather than `asClass`, which doesn't type-check constructor arguments.
- Ports: each `.ports.ts` file belongs to one use case, exports a `<Name>Ports` interface plus named interfaces for each capability, and declares only what that use case calls. Tolerate similar ports, and extract a shared type only if they keep changing together.
- Commands: anything that changes state goes UI -> thunk -> use case, even with no I/O, so adding I/O later doesn't change the call path. Thunks receive use cases through the `extra` argument and never see ports.
- Reads: selectors derive display values from store state with their own logic. Use cases are for commands only. The hand score is the exception: the UI requests it through the `ScoreHand` use case whenever the hand changes.
- Components only dispatch thunks and slice actions, and read selectors.
- Purely visual state, which wouldn't matter if the UI were replaced, can use a plain slice action rather than a thunk and use case.
- Store state must be serializable. Derive values with selectors rather than storing them. The hand score and the latest scan are the exceptions: their latest result is stored, and responses from older requests are discarded.
- Scanning: `RecogniseHand` finds cards in a photo through the `CardRecognizer` port, and `ReplaceHand` makes the checked cards the hand. The ML Kit adapter does the OCR and the name matching, which are reading input, not game rules. Picking the photo (`usePickImage`) is player input, so it stays in the UI. When a real photo is misread, save ML Kit's output as a fixture in `ml-kit-card-recognizer/__fixtures__/` and change the matching until it passes, rather than tuning thresholds by eye.
- Driven adapters: treat every adapter as if it were remote and could be swapped out, even an in-memory one. Ports stay async where a real implementation would do I/O, calls may fail or be slow, and nothing outside an adapter relies on how it stores its data.
- Add a driven port when a use case needs something it doesn't own or determine itself: outside state, I/O, time, randomness. Logic we own goes in the domain. Cards and variants are the exception: they are always served through the `CardCatalog` and `VariantCatalog` ports, even as constants. The UI always passes the base game's variant ID (`BASE_VARIANT_ID` in `variant-slice.ts`) until there is a way to pick another, and the application never assumes there is only one.
- Redux and the UI only handle display data. Scoring logic stays in the application and domain layers.
