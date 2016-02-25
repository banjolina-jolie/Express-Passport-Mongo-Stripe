## Express-Passport-Mongo-Stripe

#### An API generator to work with https://github.com/banjolina-jolie/Backbone-React-Browserify-Gulp


### Setup

You'll want to use Node v4.2 or greater.

You'll also want to register your app with Stripe, Sendgrid, AWS, and Facebook to generate the proper keys necessary to populate your `.env` file

create a `.env` file at the root level with the following keys:

```
MONGODB_URL=mongodb://127.0.0.1/sampleApp
FE_URL=http://localhost:8080
NODE_ENV=development
PORT=3001
MONGODB_DATABASE=<FILL IN YOURSELF>
MONGO_PASSWORD=<FILL IN YOURSELF>
STRIPE_SECRETKEY=<FILL IN YOURSELF>
STRIPE_PUBLICKEY=<FILL IN YOURSELF>
SENDGRID_USER=<FILL IN YOURSELF>
SENDGRID_KEY=<FILL IN YOURSELF>
AWS_REGION=<FILL IN YOURSELF>
AWS_ACCESS_KEY_ID=<FILL IN YOURSELF>
AWS_SECRET_KEY=<FILL IN YOURSELF>
S3_PROFILE_IMG_BUCKET_NAME=<FILL IN YOURSELF>
FB_APP_ID=<FILL IN YOURSELF>
FB_APP_SECRET=<FILL IN YOURSELF>
```



- npm install
- mongod (in another terminal tab)
- node app/server.js
