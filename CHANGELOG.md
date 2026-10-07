# CHANGELOG

## Emoji Cheatsheet
- :pencil2: doc updates
- :bug: when fixing a bug
- :rocket: when making general improvements
- :white_check_mark: when adding tests
- :arrow_up: when upgrading dependencies
- :tada: when adding new features

## Version History

### v1.0.0

- :tada: Transformed from aircraft tracking to Wellington public transport vehicle positions
- :rocket: Integrated with Metlink OpenData API for real-time bus and train positions
- :rocket: Added vehicle type detection (buses vs trains based on route ID)
- :rocket: Implemented appropriate icons for buses and trains
- :rocket: Added comprehensive vehicle information in remarks (route, trip, occupancy, etc.)
- :pencil2: Updated documentation for Wellington public transport use case
- :arrow_up: Update GitHub Actions to releases that run on Node.js 24, clearing the Node.js 20 deprecation warnings: `actions/checkout` v7, `actions/setup-node` v7 and `aws-actions/configure-aws-credentials` v6. `aws-actions/amazon-ecr-login` v2 already runs on Node.js 24. Not yet run in CI on these versions
- :rocket: Pin the workflow runners to `ubuntu-24.04` instead of `ubuntu-latest`, so the `ubuntu-latest` migration to Ubuntu 26 (starting October 19, 2026) does not change the build environment unannounced
