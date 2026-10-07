# CHANGELOG

## Emoji Cheatsheet
- :pencil2: doc updates
- :bug: when fixing a bug
- :rocket: when making general improvements
- :white_check_mark: when adding tests
- :arrow_up: when upgrading dependencies
- :tada: when adding new features

## Version History
### v1.2.0
- :pencil2: Complete the manifest-based capabilities migration (TAK-NZ/CloudTAK#172). The `capabilities.json` manifest, the `docker buildx` OCI annotation in CI, the test suite and the `Task.init()` entry points were already delivered in v1.1.0, so this release re-verifies them rather than changing behaviour. `capabilities.json` was validated against `StaticCapabilitiesSchema` from the installed `@tak-ps/etl` 10.22.2, and its single required permission (`feature:submit`) matches the only CloudTAK API the task calls, `submit()`. `capabilities.json`, `task.ts` and the workflows are unchanged
- :pencil2: The CI build is deliberately NOT moved to the `cloudtak-etl` CLI. Re-checked against `@tak-ps/etl` 10.22.2: `bin/build.ts` hardcodes the destination repository as `tak-vpc-<Environment>-cloudtak-tasks` and has no flag or environment variable to override it, whereas TAK.NZ base-infra creates `<stackname>-etltasks` and exports it as `EcrEtlTasksRepoArn`. Switching would push to a repository that does not exist. The image tag format is already the same as the CLI's, only the repository name differs. The manual `docker buildx` build and the CloudFormation export lookup therefore stay
- :bug: Fix the misspelled `"prviate"` key in `package.json`; it is now `"private": true`. This only stops an accidental `npm publish`, the image build is unaffected
- :pencil2: Document the capabilities manifest and the build decision in the README
- :pencil2: Not verified locally and left as post-deploy checks: the demo build and push, reading the manifest back from `GET /api/task/raw/etl-wlg-metlink/version/:version`, and the permission-mismatch rejection and update-diff modal that depend on CloudTAK#157
### v1.1.0
- :tada: Add a `capabilities.json` manifest so CloudTAK can read the task's requirements from the image (TAK-NZ/CloudTAK#165). It declares a single required permission, `feature:submit` (the only CloudTAK API the task uses is `submit()`), a default `rate(1 minute)` schedule, and 1024 MB memory / 120 s timeout. The schedule and compute sizing follow the other TAK-NZ ETLs and were not measured against real Metlink payloads. It is validated against `StaticCapabilitiesSchema` from `@tak-ps/etl`, and a test guards it in CI
- :rocket: Build and push the image with `docker buildx` in the demo and production deploy jobs, embedding `capabilities.json` as the `com.cloudtak.capabilities` OCI annotation, with `docker/setup-buildx-action@v4` providing the `docker-container` builder the annotation needs. The deploy workflow is now identical to the one in `etl-floodhub`. The annotation was not checked in the demo environment
- :rocket: Deliberately NOT adopting the `cloudtak-etl` CLI from `@tak-ps/etl` for the build and push: its `bin/build.ts` hardcodes the destination ECR repository as `tak-vpc-<Environment>-cloudtak-tasks`, which does not match the `<stackname>-etltasks` repository used by TAK.NZ base-infra. The existing lookup of the repository through the `EcrEtlTasksRepoArn` CloudFormation export is kept unchanged
- :white_check_mark: Add a basic test suite (`npm test`, `node:test` run through `tsx`) covering the task's static config, input and output schemas and the manifest. Previously `npm test` was `exit 0`. The `lint` script now also covers `test/`
- :rocket: Use `Task.init()` for the local and Lambda entry points. No change in Lambda behaviour, `ETL_TOKEN` is always provided there
- :rocket: Require Node 24 (`engines` `>= 24`), and use Node 24 instead of Node 18 in the lint and deploy workflows, matching the Lambda base image
- :arrow_up: Update dependencies within their existing ranges: `@tak-ps/etl` 10.22.2, `eslint` 10.12.0, `typescript-eslint` 8.71.1 and add `tsx` 4.23.15. The `@tak-ps/etl` minimum is raised to `^10.13.0`, which the manifest validation requires. `npm audit` now reports 0 vulnerabilities (9 before, including 1 critical and 3 high), with no `overrides`. `typescript` stays on 6.0.3 as `typescript-eslint` still limits supported versions to below 6.1.0
- :rocket: Add a `.dockerignore` so `.git`, `.github`, `node_modules`, `dist`, `test`, `docs`, `.env*` and markdown files are kept out of the image build context. `capabilities.json`, `task.ts`, `package*.json` and `tsconfig.json` stay in the context

### v1.0.0

- :tada: Transformed from aircraft tracking to Wellington public transport vehicle positions
- :rocket: Integrated with Metlink OpenData API for real-time bus and train positions
- :rocket: Added vehicle type detection (buses vs trains based on route ID)
- :rocket: Implemented appropriate icons for buses and trains
- :rocket: Added comprehensive vehicle information in remarks (route, trip, occupancy, etc.)
- :pencil2: Updated documentation for Wellington public transport use case
- :arrow_up: Update GitHub Actions to releases that run on Node.js 24, clearing the Node.js 20 deprecation warnings: `actions/checkout` v7, `actions/setup-node` v7 and `aws-actions/configure-aws-credentials` v6. `aws-actions/amazon-ecr-login` v2 already runs on Node.js 24. Not yet run in CI on these versions
- :rocket: Pin the workflow runners to `ubuntu-24.04` instead of `ubuntu-latest`, so the `ubuntu-latest` migration to Ubuntu 26 (starting October 19, 2026) does not change the build environment unannounced
