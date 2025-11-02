# ETL-WLG-METLINK

<p align='center'>Wellington public transport vehicle positions</p>

## Data Source

[Metlink OpenData API](https://api.opendata.metlink.org.nz/)

## Example Data

Real-time positions of buses and trains in the Greater Wellington area.

![Metlink vehicle locations](docs/etl-wlg-metlink.png)

## Vehicle Types and Icons

### Buses
* **Icon**: Transport/bus.png (Iconset: 6d781afb-89a6-4c07-b2b9-a89748b6a38f)
* **CoT Type**: a-f-G-E-V-C (Friendly Ground Equipment Vehicle - Civilian)
* **Routes**: All route IDs except 2, 5, and 6

### Trains
* **Icon**: Transportation/Train4.png (Iconset: 34ae1613-9645-4222-a9d2-e5f243dea2865)
* **CoT Type**: a-u-G-E-V (Unknown Ground Equipment Vehicle)
* **Routes**: Route IDs 2 (Kapiti Line), 5 (Hutt Valley Line), 6 (Johnsonville Line)

## Data Fields

Each vehicle displays the following information:
* Vehicle Type (Bus/Train)
* Vehicle ID
* Route ID
* Trip ID
* Direction (0 or 1)
* Start Time
* Occupancy Status (if available)
* Speed (if available)
* Real-time position and bearing

## Deployment

Deployment into the CloudTAK environment for ETL tasks is done via automatic releases to the TAK.NZ AWS environment.

Github actions will build and push docker releases on every version tag which can then be automatically configured via the
CloudTAK API.

### GitHub Actions Setup

The workflow uses GitHub variables and secrets to make it reusable across different ETL repositories.

#### Organization Variables (recommended)
- `DEMO_STACK_NAME`: Name of the demo stack (default: "Demo")
- `PROD_STACK_NAME`: Name of the production stack (default: "Prod")

#### Organization Secrets (recommended)
- `DEMO_AWS_ACCOUNT_ID`: AWS account ID for demo environment
- `DEMO_AWS_REGION`: AWS region for demo environment
- `DEMO_AWS_ROLE_ARN`: IAM role ARN for demo environment
- `PROD_AWS_ACCOUNT_ID`: AWS account ID for production environment
- `PROD_AWS_REGION`: AWS region for production environment
- `PROD_AWS_ROLE_ARN`: IAM role ARN for production environment

#### Repository Variables
- `ETL_NAME`: Name of the ETL (default: repository name)

#### Repository Secrets (alternative to organization secrets)
- `AWS_ACCOUNT_ID`: AWS account ID for the environment
- `AWS_REGION`: AWS region for the environment
- `AWS_ROLE_ARN`: IAM role ARN for the environment

These variables and secrets can be set in the GitHub organization or repository settings under Settings > Secrets and variables.

### Manual Deployment

For manual deployment you can use the `scripts/etl/deploy-etl.sh` script from the [CloudTAK](https://github.com/TAK-NZ/CloudTAK/) repo.
As an example: 
```
../CloudTAK/scripts/etl/deploy-etl.sh Demo v1.0.0 --profile tak-nz-demo
```

### CloudTAK Configuration

When registering this ETL as a task in CloudTAK:

- Use the `<repo-name>.png` file in the main folder of this repository as the Task Logo
- Use the raw GitHub URL of this README.md file as the Task Markdown Readme URL

This will ensure proper visual identification and documentation for the task in the CloudTAK interface.

## Development

TAK.NZ provided Lambda ETLs are currently all written in [NodeJS](https://nodejs.org/en) through the use of a AWS Lambda optimized
Docker container. Documentation for the Dockerfile can be found in the [AWS Help Center](https://docs.aws.amazon.com/lambda/latest/dg/images-create.html)

```sh
npm install
```

Add a .env file in the root directory that gives the ETL script the necessary variables to communicate with a local ETL server.
When the ETL is deployed the `ETL_API` and `ETL_LAYER` variables will be provided by the Lambda Environment

```json
{
    "ETL_API": "http://localhost:5001",
    "ETL_LAYER": "19",
    "METLINK_API_KEY": "your-metlink-api-key-here"
}
```

To run the task, ensure the local [CloudTAK](https://github.com/TAK-NZ/CloudTAK/) server is running and then run with typescript runtime
or build to JS and run natively with node

```
ts-node task.ts
```

```
npm run build
cp .env dist/
node dist/task.js
```

## License

TAK.NZ is distributed under [AGPL-3.0-only](LICENSE)
Copyright (C) 2025 - Christian Elsen, Team Awareness Kit New Zealand (TAK.NZ)
Copyright (C) 2023 - Public Safety TAK