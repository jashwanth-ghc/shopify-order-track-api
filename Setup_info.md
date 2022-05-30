# Shopify environment for local server

- Install shopify-cli
- Login to shopify
    *shopify login*
- Setup ngrok auth token in shopify cli
    *shopify app tunnel auth <token>*
- Serve app
    *shopify app serve*

# Infra PreRequisites

- Create an SQS queue to push messages
    - Store the queue URL and aws credentials in .env
- Create a mongo DB
    - Store the db connection URI in .env
- Create an app in Shopify partners dashboard
    - Store API KEY and API secret key in .env
    - Store ngrok tunnel url as the app url in partners dashboard if testing the locally hosted app

# Environment variables

- Included a sample env file (.env.example)
- Replace the following fields
    - SHOPIFY_API_KEY
    - SHOPIFY_API_SECRET
    - ACCESS_KEY_ID and SECRET_ACCESS_KEY (aws creds)
    - AWS_SQS_URL
    - MONGO_URI
    - HOST

# ES6 Modules

- Currently, the code uses CommonJS modules. 
- The code with ES6 modules is in the zipped folder *ES6-files*. Can be replaced.
    - inculde *"type":"module"* in package.json
- ESBUILD:
    - If using esbuild, uncomment the commented parts in serverless.yml

# Serverless Framework Deployment
- serverless.yml is configured
- The last 3 lines in server/index.js (for creating local server) may be removed/commented if deploying to aws.
- use *npm run deploy* or *sls deploy* for deploying
